import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, normalizeError } from './errors';
import { getAuthProviders, githubSignInUrl, login, me } from './auth';

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

describe('normalizeError', () => {
  it('unwraps the contract error envelope into code and message', () => {
    const error = normalizeError(400, {
      error: { code: 'invalid_credentials', message: 'That email and password do not match.' },
    });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('invalid_credentials');
    expect(error.message).toBe('That email and password do not match.');
  });

  it('falls back to a top level shape when there is no envelope', () => {
    const error = normalizeError(409, { code: 'email_taken', message: 'That email is in use.' });
    expect(error.code).toBe('email_taken');
    expect(error.message).toBe('That email is in use.');
  });

  it('produces a safe default for an unreadable body', () => {
    const error = normalizeError(500, null);
    expect(error.code).toBe('unknown_error');
    expect(error.message).toBe('The request could not be completed.');
  });
});

describe('auth requests', () => {
  it('sends cookies and returns the Operator with its role on a plain login', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        operator: {
          id: 'op_1',
          email: 'ops@example.com',
          role: 'operator',
          mfa_enabled: false,
          created_at: 'now',
        },
      }),
    );

    const result = await login({ email: 'ops@example.com', password: 'a-strong-passphrase' });

    expect(result.kind).toBe('authenticated');
    if (result.kind === 'authenticated') {
      expect(result.operator.email).toBe('ops@example.com');
      expect(result.operator.role).toBe('operator');
    }
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
  });

  it('carries the admin role through login for an admin account', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        operator: {
          id: 'op_2',
          email: 'admin@example.com',
          role: 'admin',
          mfa_enabled: true,
          created_at: 'now',
        },
      }),
    );

    const result = await login({ email: 'admin@example.com', password: 'a-strong-passphrase' });

    expect(result.kind).toBe('authenticated');
    if (result.kind === 'authenticated') {
      expect(result.operator.role).toBe('admin');
    }
  });

  it('returns the MFA challenge when the account requires it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { mfa_required: true, challenge: 'chal_123' }),
    );

    const result = await login({ email: 'ops@example.com', password: 'a-strong-passphrase' });

    expect(result.kind).toBe('mfa_required');
    if (result.kind === 'mfa_required') {
      expect(result.challenge).toBe('chal_123');
    }
  });

  it('throws a typed ApiError carrying the backend message on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(401, {
        error: { code: 'invalid_credentials', message: 'Those details do not match.' },
      }),
    );

    await expect(me()).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'invalid_credentials',
      message: 'Those details do not match.',
    });
  });

});

describe('sign in providers and the GitHub entry point', () => {
  it('reads which ways in this deployment offers', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { password: true, github: true }));

    const providers = await getAuthProviders();

    expect(providers).toEqual({ password: true, github: true });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/auth/providers');
  });

  // A sign in screen must render even when this call fails, so a failure resolves
  // to password only rather than rejecting.
  it('falls back to password only when the call fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    await expect(getAuthProviders()).resolves.toEqual({ password: true, github: false });
  });

  it('builds the GitHub sign in URL against the API base, with the return path', () => {
    expect(githubSignInUrl()).toBe('/api/v1/auth/github/authorize');
    expect(githubSignInUrl('/app')).toBe('/api/v1/auth/github/authorize?return=%2Fapp');
  });
});
