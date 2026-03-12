import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const NOTEBOOK_TYPE = 'databricks-notebook-local';
const CODE_END = '__PYDBX_CODE_END__';
const DONE = '__PYDBX_DONE__';

// Minimal type shims for ms-python.python exported API
interface PythonEnv {
  id: string;
  executable: { uri?: vscode.Uri };
  version?: { major: number; minor: number; micro: number };
  environment?: { name?: string; type?: string };
}

interface PythonExtensionApi {
  environments: {
    known: readonly PythonEnv[];
    onDidChangeEnvironments: vscode.Event<{
      env: PythonEnv;
      type: 'add' | 'remove' | 'update';
    }>;
  };
}

// Python script run as a subprocess. Maintains shared globals across cells
// so that variables defined in one cell are visible in later cells.
const RUNNER_SCRIPT = `import sys, traceback
_globals = {}
while True:
    buf = []
    while True:
        line = sys.stdin.readline()
        if not line:
            sys.exit(0)
        if line.rstrip('\\n') == '${CODE_END}':
            break
        buf.append(line)
    try:
        exec(compile(''.join(buf), '<cell>', 'exec'), _globals)
    except (SystemExit, KeyboardInterrupt):
        raise
    except Exception:
        traceback.print_exc()
    sys.stdout.flush()
    sys.stderr.flush()
    print('${DONE}', flush=True)
`;

let _runnerPath: string | undefined;

function runnerScriptPath(): string {
  if (!_runnerPath) {
    _runnerPath = path.join(os.tmpdir(), 'pydbx_runner.py');
    fs.writeFileSync(_runnerPath, RUNNER_SCRIPT, 'utf8');
  }
  return _runnerPath;
}

// One session per (notebook, environment) pair. Keeps the Python process alive
// across cell executions so variables persist within a notebook session.
class PythonSession {
  private stdoutBuf = '';
  private stderrBuf = '';
  private pending?: {
    resolve: (r: { stdout: string; stderr: string }) => void;
    reject: (e: Error) => void;
  };

  constructor(private readonly proc: ChildProcess) {
    proc.stdout!.on('data', (chunk: Buffer) => {
      this.stdoutBuf += chunk.toString();
      this.tryResolve();
    });
    proc.stderr!.on('data', (chunk: Buffer) => {
      this.stderrBuf += chunk.toString();
    });
    proc.on('exit', () => {
      this.pending?.reject(new Error('Python kernel exited unexpectedly'));
      this.pending = undefined;
    });
  }

  private tryResolve(): void {
    if (!this.pending) return;
    const idx = this.stdoutBuf.indexOf(DONE + '\n');
    if (idx === -1) return;
    const stdout = this.stdoutBuf.slice(0, idx);
    this.stdoutBuf = this.stdoutBuf.slice(idx + DONE.length + 1);
    const stderr = this.stderrBuf;
    this.stderrBuf = '';
    const { resolve } = this.pending;
    this.pending = undefined;
    resolve({ stdout, stderr });
  }

  execute(code: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      this.proc.stdin!.write(`${code}\n${CODE_END}\n`);
    });
  }

  dispose(): void {
    this.proc.kill();
  }
}

function envLabel(env: PythonEnv): string {
  const ver = env.version
    ? `Python ${env.version.major}.${env.version.minor}`
    : 'Python';
  const name = env.environment?.name ?? env.environment?.type;
  return name ? `${ver} (${name})` : ver;
}

export async function registerKernelControllers(
  context: vscode.ExtensionContext
): Promise<void> {
  const pythonExt = vscode.extensions.getExtension<PythonExtensionApi>('ms-python.python');
  if (!pythonExt) return;

  if (!pythonExt.isActive) {
    await pythonExt.activate();
  }

  const pythonApi = pythonExt.exports;
  if (!pythonApi?.environments) return;

  const controllers = new Map<string, vscode.NotebookController>();
  // key: `${notebookUri}::${envId}`
  const sessions = new Map<string, PythonSession>();

  function getOrCreateSession(env: PythonEnv, notebookUri: vscode.Uri): PythonSession | undefined {
    const pythonPath = env.executable.uri?.fsPath;
    if (!pythonPath) return undefined;
    const key = `${notebookUri.toString()}::${env.id}`;
    if (!sessions.has(key)) {
      // Use a login shell so the subprocess inherits the user's full PATH and
      // environment variables (e.g. DATABRICKS_HOST, credential helpers).
      // Without -l, VS Code's process may have a stripped PATH that omits
      // tools like databricks-cli that databricks-connect relies on.
      const shell = process.env.SHELL ?? '/bin/bash';
      const cmd = `${JSON.stringify(pythonPath)} -u ${JSON.stringify(runnerScriptPath())}`;
      const proc = spawn(shell, ['-l', '-c', cmd]);
      sessions.set(key, new PythonSession(proc));
    }
    return sessions.get(key)!;
  }

  async function executeHandler(
    cells: vscode.NotebookCell[],
    notebook: vscode.NotebookDocument,
    ctrl: vscode.NotebookController,
    env: PythonEnv
  ): Promise<void> {
    const session = getOrCreateSession(env, notebook.uri);
    for (const cell of cells) {
      const exec = ctrl.createNotebookCellExecution(cell);
      exec.start(Date.now());
      await exec.clearOutput();

      if (!session) {
        await exec.appendOutput(new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.text(
            'Python executable not found for this environment.',
            'text/plain'
          ),
        ]));
        exec.end(false, Date.now());
        continue;
      }

      try {
        const { stdout, stderr } = await session.execute(cell.document.getText());
        const outputs: vscode.NotebookCellOutput[] = [];
        if (stdout) {
          outputs.push(new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.text(stdout, 'application/vnd.code.notebook.stdout'),
          ]));
        }
        if (stderr) {
          outputs.push(new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.text(stderr, 'application/vnd.code.notebook.stderr'),
          ]));
        }
        if (outputs.length) {
          await exec.appendOutput(outputs);
        }
        exec.end(true, Date.now());
      } catch (err) {
        await exec.appendOutput(new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.error(
            err instanceof Error ? err : new Error(String(err))
          ),
        ]));
        exec.end(false, Date.now());
      }
    }
  }

  function addController(env: PythonEnv): void {
    if (controllers.has(env.id) || !env.executable.uri) return;
    const ctrl = vscode.notebooks.createNotebookController(
      env.id,
      NOTEBOOK_TYPE,
      envLabel(env)
    );
    ctrl.supportedLanguages = ['python'];
    ctrl.executeHandler = (cells, notebook) =>
      executeHandler(cells, notebook, ctrl, env);
    controllers.set(env.id, ctrl);
    context.subscriptions.push(ctrl);
  }

  function removeController(envId: string): void {
    controllers.get(envId)?.dispose();
    controllers.delete(envId);
    for (const [key, session] of sessions) {
      if (key.endsWith(`::${envId}`)) {
        session.dispose();
        sessions.delete(key);
      }
    }
  }

  for (const env of pythonApi.environments.known) {
    addController(env);
  }

  context.subscriptions.push(
    pythonApi.environments.onDidChangeEnvironments(({ env, type }) => {
      if (type === 'remove') {
        removeController(env.id);
      } else if (type === 'add') {
        addController(env);
      } else if (type === 'update') {
        removeController(env.id);
        addController(env);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseNotebookDocument(notebook => {
      const prefix = `${notebook.uri.toString()}::`;
      for (const [key, session] of sessions) {
        if (key.startsWith(prefix)) {
          session.dispose();
          sessions.delete(key);
        }
      }
    })
  );
}
