import * as vscode from 'vscode';

const NOTEBOOK_HEADER = /^#\s*Databricks notebook source\s*$/i;
const CELL_DELIMITER = /^#\s*COMMAND\s*-{5,}\s*$/m;
const MAGIC_PREFIX = /^\s*#\s*MAGIC\s?/i;
const MAGIC_MD = /^%md$/i;

export function parseCell(src: string): vscode.NotebookCellData {
  const lines = src.split('\n');
  const firstNonEmpty = lines.find(l => l.trim() !== '');

  const isMarkdown =
    firstNonEmpty !== undefined &&
    MAGIC_PREFIX.test(firstNonEmpty) &&
    MAGIC_MD.test(firstNonEmpty.replace(MAGIC_PREFIX, '').trim());

  if (isMarkdown) {
    throw new Error('markdown not implemented yet');
  }

  return new vscode.NotebookCellData(
    vscode.NotebookCellKind.Code,
    src.trim(),
    'python'
  );
}

export class DatabricksSerializer implements vscode.NotebookSerializer {
  deserializeNotebook(
    content: Uint8Array,
    _token: vscode.CancellationToken
  ): vscode.NotebookData {
    throw new Error('not implemented');
  }

  serializeNotebook(_data: vscode.NotebookData): Uint8Array {
    throw new Error('not implemented');
  }
}
