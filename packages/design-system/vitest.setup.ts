import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Each test starts from an empty document, so a component left mounted by one
// test is never found by the next.
afterEach(() => {
  cleanup();
});
