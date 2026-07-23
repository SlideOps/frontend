import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './auth';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

const operator = { id: 'op_1', email: 'ops@example.com', mfa_enabled: false, created_at: 'now' };

beforeEach(() => {
  useAuthStore.setState({ status: 'loading', operator: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('operator auth store', () => {
  it('starts in the loading state', () => {
    expect(useAuthStore.getState().status).toBe('loading');
  });

  it('moves to authenticated when the session resolves', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { operator }));
    await useAuthStore.getState().loadSession();
    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.operator?.email).toBe('ops@example.com');
  });

  it('moves to anonymous when the session is a 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(401, { error: { code: 'unauthorized', message: 'Not signed in.' } }),
    );
    await useAuthStore.getState().loadSession();
    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(useAuthStore.getState().operator).toBeNull();
  });

  it('records a completed sign in through signIn', () => {
    useAuthStore.getState().signIn(operator);
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().operator?.id).toBe('op_1');
  });

  it('returns to anonymous after signOut even if logout fails', async () => {
    useAuthStore.getState().signIn(operator);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(useAuthStore.getState().operator).toBeNull();
  });
});
