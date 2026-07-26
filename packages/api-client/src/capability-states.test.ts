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

  it('carries a detected state with its evidence, so a server set up before SlideOps reads as set up', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        states: {
          'enable-containers': {
            status: 'detected',
            source: 'existing',
            evidence: 'Docker is already installed on this server and is running.',
            running: true,
            detected_at: '2026-07-25T09:00:00Z',
          },
          'secure-ssh': {
            status: 'done',
            source: 'slideops',
            last_operation_id: 'op_3',
            last_completed_at: '2026-07-24T09:00:00Z',
          },
        },
      }),
    );

    const states = await getCapabilityStates('nd_1');

    const detected = states['enable-containers'];
    expect(detected?.status).toBe('detected');
    expect(detected?.source).toBe('existing');
    expect(detected?.evidence).toContain('Docker');
    expect(detected?.running).toBe(true);
    expect(detected?.detected_at).toBe('2026-07-25T09:00:00Z');
    // A detected state has no Operation behind it, so nothing may link to History.
    expect(detected?.last_operation_id).toBeUndefined();

    expect(states['secure-ssh']?.source).toBe('slideops');
    expect(states['secure-ssh']?.last_operation_id).toBe('op_3');
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
