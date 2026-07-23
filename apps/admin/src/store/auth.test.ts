import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './auth';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

const admin = { id: 'ad_1', email: 'admin@example.com', mfa_enabled: true, created_at: 'now' };

beforeEach(() => {
  useAuthStore.setState({ status: 'loading', admin: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('admin auth store', () => {
  it('moves to authenticated when the admin session resolves', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { admin }));
    await useAuthStore.getState().loadSession();
    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.admin?.email).toBe('admin@example.com');
  });

  it('moves to anonymous when the admin session is a 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(401, { error: { code: 'unauthorized', message: 'Not signed in.' } }),
    );
    await useAuthStore.getState().loadSession();
    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(useAuthStore.getState().admin).toBeNull();
  });

  it('returns to anonymous after signOut even if logout fails', async () => {
    useAuthStore.getState().signIn(admin);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(useAuthStore.getState().admin).toBeNull();
  });
});
