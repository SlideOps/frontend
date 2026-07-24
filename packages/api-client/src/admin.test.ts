import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOverview, listAdminOperations, suspendOperator } from './admin';

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

describe('admin requests', () => {
  it('reads the overview over the admin path with cookies included', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        overview: {
          operators_total: 4,
          nodes_total: 12,
          operations_total: 88,
          operations_by_status: { completed: 70, failed: 3 },
          active_operations: 2,
          failures_last_24h: 1,
          executions_paused: false,
          operators_suspended: 1,
        },
      }),
    );

    const overview = await getOverview();

    expect(overview.operators_total).toBe(4);
    expect(overview.operators_suspended).toBe(1);
    expect(overview.executions_paused).toBe(false);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/admin/overview');
  });

  it('unwraps a bare overview body when the envelope key is absent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        operators_total: 1,
        nodes_total: 1,
        operations_total: 1,
        operations_by_status: {},
        active_operations: 0,
        failures_last_24h: 0,
        executions_paused: true,
        operators_suspended: 0,
      }),
    );

    const overview = await getOverview();
    expect(overview.executions_paused).toBe(true);
    expect(overview.operators_total).toBe(1);
  });

  it('sends the status and operator filters when listing Operations', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { operations: [] }));

    await listAdminOperations({ status: 'failed', operator_id: 'op_9' });

    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain('status=failed');
    expect(calledUrl).toContain('operator_id=op_9');
  });

  it('posts a suspend as an audited mutation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));

    await suspendOperator('op_3');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/admin/operators/op_3/suspend');
  });
});
