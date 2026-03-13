export class TreeItem {
  label: string;
  description?: string;
  tooltip?: string;
  collapsibleState: TreeItemCollapsibleState;

  constructor(
    label: string,
    collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None,
  ) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  get event() {
    return (listener: (e: T) => void) => {
      this.listeners.push(listener);
      return () => {
        this.listeners = this.listeners.filter(l => l !== listener);
      };
    };
  }

  fire(data: T): void {
    this.listeners.forEach(listener => listener(data));
  }
}

export interface TreeDataProvider<T> {
  onDidChangeTreeData?:
    | EventEmitter<T | undefined | void>['event']
    | undefined;
  getChildren?(
    element?: T,
  ): Thenable<T[]> | T[] | undefined | null;
  getParent?(element: T): Thenable<T | null> | T | null | undefined;
  getTreeItem(element: T): TreeItem | Thenable<TreeItem>;
}
