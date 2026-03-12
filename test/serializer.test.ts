import { vi, describe, it, expect, beforeEach } from 'vitest';

// Must be declared before any import that transitively imports 'vscode'.
// vi.mock() calls are hoisted to the top of the file by Vitest.
vi.mock('vscode', () => {
  class NotebookCellData {
    kind: number;
    value: string;
    languageId: string;
    constructor(kind: number, value: string, languageId: string) {
      this.kind = kind;
      this.value = value;
      this.languageId = languageId;
    }
  }
  class NotebookData {
    cells: NotebookCellData[];
    constructor(cells: NotebookCellData[]) {
      this.cells = cells;
    }
  }
  return {
    NotebookCellKind: { Code: 1, Markup: 2 },
    NotebookCellData,
    NotebookData,
  };
});

import { parseCell, DatabricksSerializer } from '../src/serializer';

function encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe('parseCell', () => {
  it('placeholder', () => {
    expect(true).toBe(true);
  });
});

describe('DatabricksSerializer.deserializeNotebook', () => {
  it('placeholder', () => {
    expect(true).toBe(true);
  });
});
