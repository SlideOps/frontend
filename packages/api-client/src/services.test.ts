import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deployService,
  getServiceLogs,
  getServiceMetrics,
  listServices,
  removeService,
  startService,
} from './services';

/** Build a Response-like stub for the mocked fetch. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

/** Build a Response-like stub whose body is bare text, not JSON. */
function textResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('services requests', () => {
  it('lists Services over the same origin with cookies and unwraps the envelope', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { services: [{ id: 'sv_1', name: 'web' }] }));

    const services = await listServices();

    expect(services).toHaveLength(1);
    expect(services[0]?.name).toBe('web');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/services');
  });

  it('deploys a Service and returns it at status deploying', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(201, {
        service: { id: 'sv_2', name: 'api', status: 'deploying', runtime: 'container' },
      }),
    );

    const service = await deployService({
      project_id: 'pr_1',
      node_id: 'nd_1',
      name: 'api',
      runtime: 'container',
      source: { type: 'image', image: 'nginx:latest' },
      cpu_limit: 0.5,
      memory_mb: 256,
    });

    expect(service.id).toBe('sv_2');
    expect(service.status).toBe('deploying');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    const sent = JSON.parse(String(init?.body)) as { cpu_limit: number; source: { image: string } };
    expect(sent.cpu_limit).toBe(0.5);
    expect(sent.source.image).toBe('nginx:latest');
  });

  it('sends the branch for a repository source', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(201, {
        service: { id: 'sv_3', name: 'from-repo', status: 'deploying', runtime: 'container' },
      }),
    );

    await deployService({
      project_id: 'pr_1',
      node_id: 'nd_1',
      name: 'from-repo',
      runtime: 'container',
      source: {
        type: 'repository',
        repository_url: 'https://github.com/octocat/app.git',
        branch: 'release',
      },
      cpu_limit: 0.5,
      memory_mb: 256,
    });

    const init = fetchMock.mock.calls[0]?.[1];
    const sent = JSON.parse(String(init?.body)) as { source: { branch: string } };
    expect(sent.source.branch).toBe('release');
  });

  it('surfaces a typed quota_exceeded error on an over-quota deploy', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(403, {
        error: { code: 'quota_exceeded', message: 'Your tier allows 1 Service.' },
      }),
    );

    await expect(
      deployService({
        project_id: 'pr_1',
        node_id: 'nd_1',
        name: 'api',
        runtime: 'container',
        source: { type: 'image', image: 'nginx:latest' },
        cpu_limit: 0.5,
        memory_mb: 256,
      }),
    ).rejects.toMatchObject({ name: 'ApiError', status: 403, code: 'quota_exceeded' });
  });

  it('starts a Service with a POST to the start action', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(202, undefined));
    await startService('sv_1');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/services/sv_1/start');
  });

  it('removes a Service with a DELETE', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));
    await removeService('sv_1');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('DELETE');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/services/sv_1');
  });

  it('reads live metrics, accepting a bare shape', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { cpu_percent: 12.5, memory_used_mb: 128, memory_limit_mb: 256 }),
    );
    const metrics = await getServiceMetrics('sv_1');
    expect(metrics.cpu_percent).toBe(12.5);
    expect(metrics.memory_limit_mb).toBe(256);
  });

  it('reads logs from a JSON envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { logs: 'line one\nline two' }));
    const logs = await getServiceLogs('sv_1', 50);
    expect(logs).toBe('line one\nline two');
  });

  it('reads logs from a bare text body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(textResponse(200, 'plain log text'));
    const logs = await getServiceLogs('sv_1');
    expect(logs).toBe('plain log text');
  });
});
