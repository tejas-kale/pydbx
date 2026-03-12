import { vi, describe, it, expect } from 'vitest';

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

  it('test 4: content whitespace after prefix is preserved', () => {
    // 7 spaces between MAGIC and "required"; regex consumes 1, 6 remain
    const src = '#MAGIC %md\n#MAGIC       required data';
    const cell = parseCell(src);
    expect(cell.kind).toBe(2);
    expect(cell.value).toBe('      required data');
  });

  it('test 10: %md and content on same line — content preserved', () => {
    const src = '# MAGIC %md ## Heading';
    const cell = parseCell(src);
    expect(cell.kind).toBe(2);
    expect(cell.languageId).toBe('markdown');
    expect(cell.value).toBe('## Heading');
  });
});

describe('DatabricksSerializer.serializeNotebook', () => {
  const s = new DatabricksSerializer();
  const decode = (b: Uint8Array) => new TextDecoder().decode(b);

  it('serializes a code cell with header and delimiter', () => {
    const nb = { cells: [{ kind: 1, value: 'import os', languageId: 'python' }] } as any;
    expect(decode(s.serializeNotebook(nb))).toBe(
      '# Databricks notebook source\n\n# COMMAND ----------\n\nimport os\n'
    );
  });

  it('serializes a markdown cell with # MAGIC prefix lines', () => {
    const nb = { cells: [{ kind: 2, value: '## Heading\nSome text', languageId: 'markdown' }] } as any;
    expect(decode(s.serializeNotebook(nb))).toBe(
      '# Databricks notebook source\n\n# COMMAND ----------\n\n# MAGIC %md\n# MAGIC ## Heading\n# MAGIC Some text\n'
    );
  });

  it('round-trips: deserialize → serialize → deserialize gives same cells', () => {
    const src = '# Databricks notebook source\n\n# COMMAND ----------\n\nimport os\n\n# COMMAND ----------\n\n# MAGIC %md\n# MAGIC ## Heading\n';
    const nb = s.deserializeNotebook(encode(src), {} as any);
    const roundTripped = s.deserializeNotebook(s.serializeNotebook(nb), {} as any);
    expect(roundTripped.cells).toHaveLength(2);
    expect(roundTripped.cells[0].value).toBe('import os');
    expect(roundTripped.cells[0].kind).toBe(1);
    expect(roundTripped.cells[1].value).toBe('## Heading');
    expect(roundTripped.cells[1].kind).toBe(2);
  });
});

describe('DatabricksSerializer.deserializeNotebook', () => {
  it('test 6: splits on delimiter with exactly 5 dashes', () => {
    const src = 'import os\n# COMMAND -----\nimport sys';
    const nb = new DatabricksSerializer().deserializeNotebook(encode(src), {} as any);
    expect(nb.cells).toHaveLength(2);
    expect(nb.cells[0].value).toBe('import os');
    expect(nb.cells[1].value).toBe('import sys');
  });

  it('test 7: splits on delimiter with 10 dashes', () => {
    const src = 'import os\n# COMMAND ----------\nimport sys';
    const nb = new DatabricksSerializer().deserializeNotebook(encode(src), {} as any);
    expect(nb.cells).toHaveLength(2);
    expect(nb.cells[0].value).toBe('import os');
    expect(nb.cells[1].value).toBe('import sys');
  });

  it('test 8: strips # Databricks notebook source header', () => {
    const src = '# Databricks notebook source\n# COMMAND ----------\nimport os';
    const nb = new DatabricksSerializer().deserializeNotebook(encode(src), {} as any);
    expect(nb.cells).toHaveLength(1);
    expect(nb.cells[0].value).toBe('import os');
    expect(nb.cells[0].kind).toBe(1); // Code
  });

  it('test 9: empty segments after splitting are filtered out', () => {
    // Double delimiter produces an empty segment between them
    const src = 'import os\n# COMMAND ----------\n# COMMAND ----------\nimport sys';
    const nb = new DatabricksSerializer().deserializeNotebook(encode(src), {} as any);
    expect(nb.cells).toHaveLength(2);
    expect(nb.cells[0].value).toBe('import os');
    expect(nb.cells[1].value).toBe('import sys');
  });
});
