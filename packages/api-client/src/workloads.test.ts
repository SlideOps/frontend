import { afterEach, describe, expect, it, vi } from 'vitest';
import { adoptWorkload, listNodeWorkloads, moveServiceToProject } from './workloads';

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

describe('reading what is already running on a server', () => {
  it('lists the workloads over the same origin with cookies', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        workloads: [
          {
            ref: 'shop-web',
            name: 'shop-web',
            runtime: 'container',
            image: 'ghcr.io/acme/shop:1.4',
            ports: [{ host: 8080, container: 80 }],
            status: 'running',
            cpu_limit: 1.5,
            memory_mb: 512,
            adopted: false,
          },
          {
            ref: 'shop-api.service',
            name: 'shop-api',
            runtime: 'systemd',
            description: 'Shop API',
            ports: [],
            status: 'running',
            cpu_limit: 0,
            memory_mb: 0,
            adopted: true,
            service_id: 'sv_7',
          },
        ],
      }),
    );

    const workloads = await listNodeWorkloads('nd_1');

    expect(workloads).toHaveLength(2);
    expect(workloads[0]?.image).toBe('ghcr.io/acme/shop:1.4');
    expect(workloads[0]?.ports[0]?.host).toBe(8080);
    // An already managed workload names the Service it is managed as.
    expect(workloads[1]?.adopted).toBe(true);
    expect(workloads[1]?.service_id).toBe('sv_7');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/nodes/nd_1/workloads');
  });

  it('encodes the node id in the path', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { workloads: [] }));

    await listNodeWorkloads('nd/1');

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/nodes/nd%2F1/workloads');
  });

  it('throws a typed ApiError when the server cannot be read', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(502, {
        error: { code: 'workload_listing_failed', message: 'That server could not be reached.' },
      }),
    );

    await expect(listNodeWorkloads('nd_1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 502,
      code: 'workload_listing_failed',
    });
  });
});

describe('bringing a workload under management', () => {
  it('posts the Project and the workload reference and returns the Service', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(201, {
        service: {
          id: 'sv_9',
          name: 'shop-web',
          project_id: 'pr_1',
          node_id: 'nd_1',
          runtime: 'container',
          source: { type: 'adopted', image: 'ghcr.io/acme/shop:1.4' },
          cpu_limit: 1.5,
          memory_mb: 512,
          status: 'running',
          adopted: true,
          created_at: '2026-07-26T10:00:00Z',
        },
      }),
    );

    const service = await adoptWorkload('nd_1', {
      project_id: 'pr_1',
      ref: 'shop-web',
      runtime: 'container',
    });

    expect(service.id).toBe('sv_9');
    expect(service.adopted).toBe(true);
    expect(service.source.type).toBe('adopted');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      project_id: 'pr_1',
      ref: 'shop-web',
      runtime: 'container',
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/nodes/nd_1/workloads/adopt');
  });

  it('surfaces the conflict when the workload is already managed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(409, {
        error: {
          code: 'workload_adopted',
          message: 'That workload is already managed as a service.',
        },
      }),
    );

    await expect(
      adoptWorkload('nd_1', { project_id: 'pr_1', ref: 'shop-web', runtime: 'container' }),
    ).rejects.toMatchObject({ name: 'ApiError', status: 409, code: 'workload_adopted' });
  });

  it('moves a Service to another Project without touching the workload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        service: {
          id: 'sv_9',
          name: 'shop-web',
          project_id: 'pr_2',
          node_id: 'nd_1',
          runtime: 'container',
          source: { type: 'adopted' },
          cpu_limit: 1.5,
          memory_mb: 512,
          status: 'running',
          adopted: true,
          created_at: '2026-07-26T10:00:00Z',
        },
      }),
    );

    const service = await moveServiceToProject('sv_9', 'pr_2');

    expect(service.project_id).toBe('pr_2');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ project_id: 'pr_2' });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/services/sv_9/project');
  });
});
