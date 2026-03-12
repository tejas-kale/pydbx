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
  it('returns a code cell unchanged (trimmed)', () => {
    const cell = parseCell('import pyspark\n\ndf = spark.read.csv("data.csv")\n');
    expect(cell.kind).toBe(1); // NotebookCellKind.Code
    expect(cell.languageId).toBe('python');
    expect(cell.value).toBe('import pyspark\n\ndf = spark.read.csv("data.csv")');
  });

  it('test 1: standard # MAGIC %md cell', () => {
    const src = '# MAGIC %md\n# MAGIC ## Heading\n# MAGIC Some text';
    const cell = parseCell(src);
    expect(cell.kind).toBe(2); // NotebookCellKind.Markup
    expect(cell.languageId).toBe('markdown');
    expect(cell.value).toBe('## Heading\nSome text');
  });

  it('test 2: #MAGIC %md (no space after #) is recognised as markdown', () => {
    const src = '#MAGIC %md\n#MAGIC content';
    const cell = parseCell(src);
    expect(cell.kind).toBe(2);
    expect(cell.languageId).toBe('markdown');
    expect(cell.value).toBe('content');
  });

  it('test 3: #MAGIC       %md (many spaces) is recognised as markdown', () => {
    const src = '#MAGIC       %md\n#MAGIC line';
    const cell = parseCell(src);
    expect(cell.kind).toBe(2);
    expect(cell.languageId).toBe('markdown');
    expect(cell.value).toBe('line');
  });
});

describe('DatabricksSerializer.deserializeNotebook', () => {
  it('placeholder', () => {
    expect(true).toBe(true);
  });
});
