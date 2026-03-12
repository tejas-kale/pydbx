import * as vscode from 'vscode';

// Minimal type shims for the Jupyter extension's exported API.
// Full types live in @vscode/jupyter-extension but we avoid the dependency.

interface KernelConnectionMetadata {
  id: string;
  kernelSpec?: { display_name?: string; name?: string };
  interpreter?: { displayName?: string };
}

interface IKernelConnection {
  requestExecute(content: { code: string }): {
    onIOPub: (handler: (msg: IIOPubMessage) => void) => void;
    done: Promise<void>;
  };
}

interface IIOPubMessage {
  header: { msg_type: string };
  content: Record<string, unknown>;
}

interface IExportedKernelService {
  getKernelSpecifications(token?: vscode.CancellationToken): Promise<KernelConnectionMetadata[]>;
  getKernel(uri: vscode.Uri): { metadata: KernelConnectionMetadata; connection: IKernelConnection } | undefined;
  startKernel(
    metadata: KernelConnectionMetadata,
    uri: vscode.Uri,
    token?: vscode.CancellationToken
  ): Promise<{ metadata: KernelConnectionMetadata; connection: IKernelConnection }>;
  readonly onDidChangeKernels: vscode.Event<void>;
}

interface JupyterExtensionApi {
  getKernelService(): Promise<IExportedKernelService | undefined>;
}

const NOTEBOOK_TYPE = 'databricks-notebook-local';

function kernelLabel(spec: KernelConnectionMetadata): string {
  return (
    spec.kernelSpec?.display_name ||
    spec.interpreter?.displayName ||
    spec.kernelSpec?.name ||
    spec.id
  );
}

async function executeCell(
  cells: vscode.NotebookCell[],
  notebook: vscode.NotebookDocument,
  controller: vscode.NotebookController,
  kernelSvc: IExportedKernelService
): Promise<void> {
  for (const cell of cells) {
    const exec = controller.createNotebookCellExecution(cell);
    exec.start(Date.now());
    exec.clearOutput();

    try {
      let kernel = kernelSvc.getKernel(notebook.uri);
      if (!kernel) {
        // Find the metadata whose id matches this controller
        const specs = await kernelSvc.getKernelSpecifications();
        const meta = specs.find(s => s.id === controller.id);
        if (!meta) {
          exec.appendOutput(new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.text('Kernel spec not found.', 'text/plain'),
          ]));
          exec.end(false, Date.now());
          continue;
        }
        kernel = await kernelSvc.startKernel(meta, notebook.uri);
      }

      const reply = kernel.connection.requestExecute({ code: cell.document.getText() });
      const outputs: vscode.NotebookCellOutput[] = [];

      reply.onIOPub((msg) => {
        const type = msg.header.msg_type;
        const content = msg.content;

        if (type === 'stream') {
          const text = String(content['text'] ?? '');
          exec.appendOutput(new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.text(text, 'text/plain'),
          ]));
        } else if (type === 'display_data' || type === 'execute_result') {
          const data = content['data'] as Record<string, unknown> | undefined;
          if (!data) return;
          const items: vscode.NotebookCellOutputItem[] = [];
          if (typeof data['text/html'] === 'string') {
            items.push(vscode.NotebookCellOutputItem.text(data['text/html'], 'text/html'));
          } else if (typeof data['text/plain'] === 'string') {
            items.push(vscode.NotebookCellOutputItem.text(data['text/plain'], 'text/plain'));
          }
          if (items.length > 0) {
            exec.appendOutput(new vscode.NotebookCellOutput(items));
          }
        } else if (type === 'error') {
          const traceback = (content['traceback'] as string[] | undefined) ?? [];
          exec.appendOutput(new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.error({
              name: String(content['ename'] ?? 'Error'),
              message: String(content['evalue'] ?? ''),
              stack: traceback.join('\n'),
            }),
          ]));
        }
      });

      await reply.done;
      exec.end(true, Date.now());
    } catch (err) {
      exec.appendOutput(new vscode.NotebookCellOutput([
        vscode.NotebookCellOutputItem.error(err instanceof Error ? err : new Error(String(err))),
      ]));
      exec.end(false, Date.now());
    }
  }
}

export async function registerKernelControllers(context: vscode.ExtensionContext): Promise<void> {
  const jupyterExt = vscode.extensions.getExtension<JupyterExtensionApi>('ms-toolsai.jupyter');
  if (!jupyterExt) {
    return; // Jupyter extension not installed — kernel picker stays empty, which is fine
  }

  if (!jupyterExt.isActive) {
    await jupyterExt.activate();
  }

  const kernelSvc = await jupyterExt.exports.getKernelService();
  if (!kernelSvc) {
    return;
  }

  const controllers = new Map<string, vscode.NotebookController>();

  async function refreshControllers(): Promise<void> {
    const specs = await kernelSvc!.getKernelSpecifications();
    const seen = new Set<string>();

    for (const spec of specs) {
      seen.add(spec.id);
      if (controllers.has(spec.id)) continue;

      const ctrl = vscode.notebooks.createNotebookController(
        spec.id,
        NOTEBOOK_TYPE,
        kernelLabel(spec)
      );
      ctrl.supportedLanguages = ['python'];
      ctrl.executeHandler = (cells, notebook, controller) =>
        executeCell(cells, notebook, controller, kernelSvc!);

      controllers.set(spec.id, ctrl);
      context.subscriptions.push(ctrl);
    }

    // Remove controllers whose kernel specs have disappeared
    for (const [id, ctrl] of controllers) {
      if (!seen.has(id)) {
        ctrl.dispose();
        controllers.delete(id);
      }
    }
  }

  await refreshControllers();

  const listener = kernelSvc.onDidChangeKernels(() => refreshControllers());
  context.subscriptions.push(listener);
}
