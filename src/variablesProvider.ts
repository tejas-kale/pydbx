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
