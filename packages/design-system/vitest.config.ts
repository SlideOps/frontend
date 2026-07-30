import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
    // jest-dom was a dependency here but was never wired in, so every DOM
    // assertion failed as an unknown Chai property and tests were written around
    // it with getAttribute instead. It is loaded now.
    setupFiles: ['./vitest.setup.ts'],
  },
});
