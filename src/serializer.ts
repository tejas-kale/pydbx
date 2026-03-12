import * as vscode from 'vscode';

const NOTEBOOK_HEADER = /^#\s*Databricks notebook source\s*$/i;
const CELL_DELIMITER = /^#\s*COMMAND\s*-{5,}\s*$/m;
const MAGIC_PREFIX = /^\s*#\s*MAGIC\s?/i;
const MAGIC_MD = /^%md$/i;

export function parseCell(src: string): vscode.NotebookCellData {
  throw new Error('not implemented');
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
