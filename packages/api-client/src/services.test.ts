import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkServiceUpdate,
  deployService,
  getServiceLogs,
  getServiceMetrics,
  listServices,
  purgeService,
  redeployService,
  removeService,
  startService,
  updateServiceResources,
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

  it('removes a Service with a DELETE, keeping data by default', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));
    await removeService('sv_1');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('DELETE');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/services/sv_1');
    expect(JSON.parse(String(init?.body))).toEqual({ drop_data: false });
  });

  it('removes a Capability Service with drop_data when the Operator asks to also destroy its data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));
    await removeService('sv_1', true);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toEqual({ drop_data: true });
  });

  it('purges a Service with a DELETE and the typed confirmation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));
    await purgeService('sv_1', 'delete web');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('DELETE');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/services/sv_1/purge');
    expect(JSON.parse(String(init?.body))).toEqual({ confirm: 'delete web', drop_data: false });
  });

  it('reports the exact confirmation the backend refused', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(400, {
        error: {
          code: 'confirmation_mismatch',
          message: 'type "delete web" exactly to permanently delete this service',
        },
      }),
    );
    await expect(purgeService('sv_1', 'wrong')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'confirmation_mismatch',
    });
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
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { logs: 'line one\nline two' }),
    );
    const logs = await getServiceLogs('sv_1', 50);
    expect(logs).toBe('line one\nline two');
  });

  it('reads logs from a bare text body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(textResponse(200, 'plain log text'));
    const logs = await getServiceLogs('sv_1');
    expect(logs).toBe('plain log text');
  });

  it('checks for an update over the same origin with cookies and unwraps the envelope', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        update: {
          source: 'repository',
          branch: 'main',
          deployed_commit: 'aaaaaaa',
          latest_commit: 'bbbbbbb',
          update_available: true,
          reason: '',
        },
      }),
    );

    const update = await checkServiceUpdate('sv_1');

    expect(update.update_available).toBe(true);
    expect(update.latest_commit).toBe('bbbbbbb');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/services/sv_1/update-check');
  });

  it('redeploys a Service and returns it at status deploying', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(202, {
        service: { id: 'sv_1', name: 'web', status: 'deploying', runtime: 'container' },
      }),
    );

    const service = await redeployService('sv_1');

    expect(service.id).toBe('sv_1');
    expect(service.status).toBe('deploying');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/services/sv_1/redeploy');
  });

  it('surfaces a typed error when a redeploy target is already removed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(409, {
        error: { code: 'conflict', message: 'This Service was already removed.' },
      }),
    );

    await expect(redeployService('sv_1')).rejects.toMatchObject({ name: 'ApiError', status: 409 });
  });

  it('patches resources over the same origin with cookies and unwraps the updated Service', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        service: {
          id: 'sv_1',
          name: 'web',
          status: 'running',
          runtime: 'container',
          cpu_limit: 1,
          memory_mb: 512,
          pids_limit: 256,
        },
      }),
    );

    const service = await updateServiceResources('sv_1', {
      cpu_limit: 1,
      memory_mb: 512,
      pids_limit: 256,
    });

    expect(service.cpu_limit).toBe(1);
    expect(service.memory_mb).toBe(512);
    expect(service.pids_limit).toBe(256);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('PATCH');
    expect(init?.credentials).toBe('include');
    const sent = JSON.parse(String(init?.body)) as {
      cpu_limit: number;
      memory_mb: number;
      pids_limit: number;
    };
    expect(sent).toEqual({ cpu_limit: 1, memory_mb: 512, pids_limit: 256 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/services/sv_1/resources');
  });

  it('surfaces a typed invalid_resources error when a limit is not above zero', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(400, {
        error: { code: 'invalid_resources', message: 'Every limit must be greater than zero.' },
      }),
    );

    await expect(
      updateServiceResources('sv_1', { cpu_limit: 0, memory_mb: 512, pids_limit: 256 }),
    ).rejects.toMatchObject({ name: 'ApiError', status: 400, code: 'invalid_resources' });
  });
});
