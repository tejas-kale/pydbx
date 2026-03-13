import { vi, describe, it, expect } from 'vitest';

// Must be declared before any import that transitively imports 'vscode'.
// vi.mock() calls are hoisted to the top of the file by Vitest.
vi.mock('vscode', () => {
  class TreeItem {
    label: string;
    collapsibleState: number;
    description?: string;
    tooltip?: string;
    constructor(label: string, collapsibleState: number) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  }
  class EventEmitter {
    event = undefined;
    fire() {}
  }
  return {
    TreeItemCollapsibleState: { None: 0 },
    TreeItem,
    EventEmitter,
  };
});

import { parseProbeOutput } from '../src/variablesProvider';

describe('parseProbeOutput', () => {
  it('returns empty array when stdout has no sentinel line', () => {
    expect(parseProbeOutput('hello\nworld\n')).toEqual([]);
  });

  it('parses variables from sentinel line', () => {
    const vars = [
      { name: 'x', type: 'int', value: '1' },
      { name: 'df', type: 'DataFrame', value: 'DataFrame[...]' },
    ];
    const stdout = `some output\n__PYDBX_VARS__${JSON.stringify(vars)}\n`;
    expect(parseProbeOutput(stdout)).toEqual(vars);
  });

  it('returns empty array when JSON after sentinel is malformed', () => {
    expect(parseProbeOutput('__PYDBX_VARS__not-json\n')).toEqual([]);
  });

  it('parses a single variable correctly', () => {
    const vars = [{ name: 'y', type: 'str', value: "'hello'" }];
    const result = parseProbeOutput(`output\n__PYDBX_VARS__${JSON.stringify(vars)}`);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('y');
  });
});
