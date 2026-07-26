import { describe, expect, it } from 'vitest';
import { normalizeError } from './errors';

describe('a response with no error envelope', () => {
  // A single generic sentence hid the cause three times: a dev proxy with nothing
  // behind it, a body the server rejected, and an endpoint an older build did not
  // have. All three read identically, and none is the reader's fault.
  it('names an unreachable server', () => {
    expect(normalizeError(0, null).message).toMatch(/could not be reached/i);
  });

  it('points a 404 at a stale server build', () => {
    expect(normalizeError(404, '404 page not found').message).toMatch(/older build/i);
  });

  it('says a 5xx is the server, not the request', () => {
    expect(normalizeError(503, null).message).toMatch(/not answering/i);
    expect(normalizeError(500, null).message).toMatch(/unexpected problem/i);
  });

  it('tells an expired session to sign in again', () => {
    expect(normalizeError(401, null).message).toMatch(/sign in again/i);
  });

  // A real envelope always wins: the server's own wording is better than ours.
  it('prefers the backend message when there is one', () => {
    const error = normalizeError(404, { error: { code: 'not_found', message: 'the node was not found' } });
    expect(error.message).toBe('the node was not found');
    expect(error.code).toBe('not_found');
  });
});
