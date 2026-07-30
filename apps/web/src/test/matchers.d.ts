/*
 * Register the DOM matchers with TypeScript.
 *
 * The setup file imports them at runtime, and only when a document exists, so the
 * logic tests do not pay for a DOM they never use. A conditional runtime import
 * teaches TypeScript nothing, so without this every toBeInTheDocument in a
 * component test typechecks as an error while the test itself passes: the worst
 * combination, since the suite looks healthy and the gate does not.
 */
import '@testing-library/jest-dom/vitest';
