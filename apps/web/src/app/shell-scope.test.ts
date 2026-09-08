import { describe, expect, it } from 'vitest';
import { shellScopeFor } from './shell-scope';

/*
 * The label on a Service terminal, before it opens.
 *
 * Both screens used to ask only whether the runtime was systemd, so a compose
 * Service was described as being inside its own container while its shell was
 * in fact on the host. Claiming isolation a shell does not have is the one
 * wrong answer that gets somebody hurt, which is why every case that is not a
 * container claims none.
 */
describe('where a Service terminal lands', () => {
  it('says a container Service is entered inside its own container', () => {
    const scope = shellScopeFor('container');
    expect(scope.isolated).toBe(true);
    expect(scope.detail).toContain('own container');
  });

  it('does not tell a compose Service it is inside a container, because it is not', () => {
    const scope = shellScopeFor('compose');
    expect(scope.isolated).toBe(false);
    expect(scope.detail).not.toContain('inside this Service');
    expect(scope.detail).toContain('on the server');
    expect(scope.detail).toContain('not confined');
  });

  it('says a systemd Service reaches the server rather than only itself', () => {
    const scope = shellScopeFor('systemd');
    expect(scope.isolated).toBe(false);
    expect(scope.detail).toContain('not confined');
  });

  it('claims no isolation for a runtime it has never heard of', () => {
    for (const runtime of [undefined, '', 'something-new']) {
      expect(shellScopeFor(runtime).isolated).toBe(false);
    }
  });

  it('records in every case that opening a terminal is audited', () => {
    for (const runtime of ['container', 'compose', 'systemd']) {
      expect(shellScopeFor(runtime).detail).toContain('audit trail');
    }
  });
});
