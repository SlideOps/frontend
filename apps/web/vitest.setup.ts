import { afterEach } from 'vitest';

/*
 * Shared setup for both kinds of test in this app.
 *
 * The logic tests run in the node environment and must not pay for a DOM they do
 * not use, so the DOM matchers and the cleanup are loaded only when a document
 * actually exists. Importing them unconditionally would fail every logic test on
 * a missing global.
 */
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');

  // Each test starts from an empty document. Without this, a component left
  // mounted by one test is still found by the next, which produces passes that
  // mean nothing and failures that point at the wrong test.
  afterEach(() => {
    cleanup();
  });
}
