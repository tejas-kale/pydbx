import * as vscode from 'vscode';

export interface VariableInfo {
  name: string;
  type: string;
  value: string;
}

export const VARS_SENTINEL = '__PYDBX_VARS__';

export function parseProbeOutput(stdout: string): VariableInfo[] {
  const line = stdout.split('\n').find(l => l.startsWith(VARS_SENTINEL));
  if (!line) return [];
  try {
    return JSON.parse(line.slice(VARS_SENTINEL.length)) as VariableInfo[];
  } catch {
    return [];
  }
}

export class VariableItem extends vscode.TreeItem {
  constructor(info: VariableInfo) {
    super(info.name, vscode.TreeItemCollapsibleState.None);
    this.description = `${info.type}: ${info.value}`;
    this.tooltip = info.value;
  }
}

export class VariablesTreeDataProvider
  implements vscode.TreeDataProvider<VariableItem>
{
  private _onDidChangeTreeData =
    new vscode.EventEmitter<VariableItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private variables: VariableInfo[] = [];

  refresh(variables: VariableInfo[]): void {
    this.variables = variables;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: VariableItem): vscode.TreeItem {
    return element;
  }

  getChildren(): VariableItem[] {
    return this.variables.map(v => new VariableItem(v));
  }
}
