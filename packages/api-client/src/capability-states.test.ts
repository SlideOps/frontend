import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCapabilityStates } from './capability-states';

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

describe('capability states requests', () => {
  it('reads the states over the same origin with cookies and no project query', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        states: {
          'secure-ssh': {
            status: 'done',
            last_operation_id: 'op_1',
            last_completed_at: '2026-07-20T10:00:00Z',
          },
        },
      }),
    );

    const states = await getCapabilityStates('nd_1');

    expect(states['secure-ssh']?.status).toBe('done');
    expect(states['secure-ssh']?.last_operation_id).toBe('op_1');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/api/v1/nodes/nd_1/capability-states');
    expect(url).not.toContain('project_id');
  });

  it('adds the project_id query only when a Project is given', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        states: {
          'install-postgresql': {
            status: 'done',
            last_operation_id: 'op_2',
            last_completed_at: '2026-07-21T12:00:00Z',
          },
        },
      }),
    );

    const states = await getCapabilityStates('nd_1', 'pr_9');

    expect(states['install-postgresql']?.last_operation_id).toBe('op_2');
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/api/v1/nodes/nd_1/capability-states');
    expect(url).toContain('project_id=pr_9');
  });

  it('encodes path and query values', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { states: {} }));

    await getCapabilityStates('nd/1', 'pr 9');

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/api/v1/nodes/nd%2F1/capability-states');
    expect(url).toContain('project_id=pr+9');
  });

  it('returns an empty map when the envelope carries no states', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {}));

    const states = await getCapabilityStates('nd_1');

    expect(states).toEqual({});
  });

  it('throws a typed ApiError carrying the backend code on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(404, { error: { code: 'not_found', message: 'That Node does not exist.' } }),
    );

    await expect(getCapabilityStates('missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'not_found',
    });
  });
});
