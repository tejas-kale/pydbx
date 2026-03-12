import * as vscode from 'vscode';

const NOTEBOOK_HEADER = /^#\s*Databricks notebook source\s*$/i;
const CELL_DELIMITER = /^#\s*COMMAND\s*-{5,}\s*$/m;
const MAGIC_PREFIX = /^\s*#\s*MAGIC\s?/i;
const MAGIC_MD = /^%md(\s|$)/i;

export function parseCell(src: string): vscode.NotebookCellData {
  const lines = src.split('\n');
  const firstNonEmpty = lines.find(l => l.trim() !== '');

  const isMarkdown =
    firstNonEmpty !== undefined &&
    MAGIC_PREFIX.test(firstNonEmpty) &&
    MAGIC_MD.test(firstNonEmpty.replace(MAGIC_PREFIX, '').trim());

  if (!isMarkdown) {
    return new vscode.NotebookCellData(
      vscode.NotebookCellKind.Code,
      src.trim(),
      'python'
    );
  }

  // Process the %md directive line: strip prefix, then strip leading "%md "
  const STRIP_MD = /^%md ?/i;
  const contentLines: string[] = [];

  let directiveProcessed = false;
  for (const line of lines) {
    if (!directiveProcessed && line.trim() !== '' && MAGIC_PREFIX.test(line) &&
        MAGIC_MD.test(line.replace(MAGIC_PREFIX, '').trim())) {
      // This is the %md directive line
      directiveProcessed = true;
      const afterPrefix = line.replace(MAGIC_PREFIX, '').trim();
      const afterMd = afterPrefix.replace(STRIP_MD, '');
      if (afterMd !== '') {
        contentLines.push(afterMd);
      }
      continue;
    }

    if (!directiveProcessed) {
      // Skip empty lines before the directive
      continue;
    }

    // All lines after the directive: strip MAGIC_PREFIX if present, else pass through
    if (MAGIC_PREFIX.test(line)) {
      contentLines.push(line.replace(MAGIC_PREFIX, ''));
    } else {
      contentLines.push(line);
    }
  }

  const joined = contentLines.join('\n').replace(/^\n+|\n+$/g, '');
  return new vscode.NotebookCellData(
    vscode.NotebookCellKind.Markup,
    joined,
    'markdown'
  );
}

export class DatabricksSerializer implements vscode.NotebookSerializer {
  deserializeNotebook(
    content: Uint8Array,
    _token: vscode.CancellationToken
  ): vscode.NotebookData {
    const decoder = new TextDecoder('utf-8');
    let text = decoder.decode(content);

    // Strip header from first line only
    const firstNewline = text.indexOf('\n');
    const firstLine = firstNewline === -1 ? text : text.slice(0, firstNewline);
    if (NOTEBOOK_HEADER.test(firstLine)) {
      text = firstNewline === -1 ? '' : text.slice(firstNewline + 1);
    }

    const segments = text.split(CELL_DELIMITER);
    const cells = segments
      .filter(seg => seg.trim() !== '')
      .map(seg => parseCell(seg));

    return new vscode.NotebookData(cells);
  }

  serializeNotebook(_data: vscode.NotebookData): Uint8Array {
    throw new Error('not implemented');
  }
}
