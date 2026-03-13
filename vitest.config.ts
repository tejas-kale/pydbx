import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      vscode: new URL('./test/mocks/vscode.ts', import.meta.url).pathname,
    },
  },
});
