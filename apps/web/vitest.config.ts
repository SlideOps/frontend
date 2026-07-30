import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/*
 * Two kinds of test, in one suite.
 *
 * Most tests here are plain logic: stores, schemas, the command palette, how a
 * Service's address is decided. They need no DOM, so they run in the node
 * environment where they stay fast, and that is where most belong. A component
 * test that only re-asserts a pure function is a slower copy of one that exists.
 *
 * The rest are components whose behaviour cannot be extracted, because the thing
 * worth asserting is what an Operator sees and what a click does: a destructive
 * control that must be confirmed, a dialog a keyboard can reach and dismiss.
 * Those are given jsdom, matched by the .test.tsx suffix, so a component test
 * costs a DOM only where one is needed.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [['**/*.test.tsx', 'jsdom']],
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
