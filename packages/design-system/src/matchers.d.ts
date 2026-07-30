/*
 * Register the DOM matchers with TypeScript.
 *
 * The setup file loads them at runtime. Without this declaration every
 * toBeInTheDocument typechecks as an error while the test itself passes, which
 * is the worst combination: the suite looks healthy and the gate does not hold.
 */
import '@testing-library/jest-dom/vitest';
