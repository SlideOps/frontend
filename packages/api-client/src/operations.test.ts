import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { revealOperationSecret } from './operations';

/** Build a Response-like stub for the mocked fetch. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('revealOperationSecret', () => {
  it('posts to the reveal path over the same origin with cookies included', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { parameter: 'password', value: 's3cret' }));

    const revealed = await revealOperationSecret('op_1', 'password');

    expect(revealed).toEqual({ parameter: 'password', value: 's3cret' });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    expect(String(url)).toContain('/api/v1/operations/op_1/secrets/password/reveal');
  });

  it('encodes the operation id and parameter key', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { parameter: 'db password', value: 'x' }));

    await revealOperationSecret('op/9', 'db password');

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/api/v1/operations/op%2F9/secrets/db%20password/reveal',
    );
  });

  it('raises a typed ApiError when the parameter has no sealed secret', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(404, { error: { code: 'secret_not_found', message: 'no sealed secret' } }),
    );

    await expect(revealOperationSecret('op_1', 'username')).rejects.toMatchObject({
      status: 404,
      code: 'secret_not_found',
    });
    await expect(revealOperationSecret('op_1', 'username')).rejects.toBeInstanceOf(ApiError);
  });
});
