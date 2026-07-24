import { defineConfig } from 'vitest/config';

// A standalone test config so vitest does not pull in the app Vite plugins for
// these plain logic tests (stores, schemas, the command palette). They need no
// DOM, and keeping them in the node environment keeps the suite fast.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
