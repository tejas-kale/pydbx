import * as vscode from 'vscode';
import { DatabricksSerializer } from './serializer';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer(
      'databricks-notebook-local',
      new DatabricksSerializer()
    )
  );
}
