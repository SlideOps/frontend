import { defineConfig } from 'vitest/config';

// A standalone test config so vitest does not pull in the app Vite plugins for
// these plain store tests. The store logic needs no DOM.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
