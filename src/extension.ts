import * as vscode from 'vscode';
import { DatabricksSerializer } from './serializer';
import { registerKernelControllers } from './kernelProvider';
import { VariablesTreeDataProvider } from './variablesProvider';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer(
      'databricks-notebook-local',
      new DatabricksSerializer()
    )
  );

  const variablesProvider = new VariablesTreeDataProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('pydbx.variables', variablesProvider)
  );

  registerKernelControllers(context, vars => variablesProvider.refresh(vars));
}
