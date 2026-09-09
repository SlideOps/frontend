import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import {
  DOCKER_UNAVAILABLE_CODE,
  MANAGED_BY_SERVICE_CODE,
  getDockerOverview,
  inspectDockerContainer,
  isDockerUnavailable,
  isManagedByService,
  killDockerContainer,
  listDockerContainers,
  listDockerImages,
  listDockerNetworks,
  listDockerStats,
  listDockerVolumes,
  managedByServiceId,
  pauseDockerContainer,
  removeDockerContainer,
  restartDockerContainer,
  runDockerContainerAction,
  startDockerContainer,
  stopDockerContainer,
  unpauseDockerContainer,
  type DockerContainerAction,
} from './docker';

/*
 * The Docker read surface.
 *
 * What matters here is that every call is a plain GET against the Node it names,
 * that the envelope is unwrapped, and above all that "Docker is not on this
 * Node" is distinguishable from "the request failed". A screen that cannot tell
 * those apart shows a red error to an Operator whose server is working fine.
 */

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

describe('reading the state of Docker on a Node', () => {
  it('reads the overview over the same origin with cookies and unwraps the envelope', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        overview: {
          daemon: {
            available: true,
            version: '27.1.1',
            api_version: '1.46',
            storage_driver: 'overlay2',
            cgroup_driver: 'systemd',
            kernel: '6.8.0-40-generic',
            architecture: 'x86_64',
            warnings: ['No swap limit support'],
          },
          counts: {
            containers: 4,
            running: 3,
            stopped: 1,
            paused: 0,
            restarting: 0,
            unhealthy: 1,
            exited: 1,
            dead: 0,
            created: 0,
            images: 9,
            volumes: 2,
            networks: 3,
            compose_projects: 1,
          },
          disk: {
            images_bytes: 4_000_000_000,
            images_reclaimable_bytes: 1_500_000_000,
            containers_bytes: 200_000_000,
            containers_reclaimable_bytes: 10_000_000,
            volumes_bytes: 900_000_000,
            volumes_reclaimable_bytes: 0,
            build_cache_bytes: 300_000_000,
            build_cache_reclaimable_bytes: 300_000_000,
          },
        },
      }),
    );

    const overview = await getDockerOverview('nd_1');

    expect(overview.daemon.available).toBe(true);
    expect(overview.daemon.warnings).toEqual(['No swap limit support']);
    expect(overview.counts.running).toBe(3);
    expect(overview.disk.build_cache_reclaimable_bytes).toBe(300_000_000);

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('GET');
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/nodes/nd_1/docker/overview');
  });

  it('encodes the Node id in every path', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { containers: [] }));

    await listDockerContainers('nd/1');

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/api/v1/nodes/nd%2F1/docker/containers',
    );
  });

  it('lists containers with their ports, labels and ownership intact', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        containers: [
          {
            full_id: 'a'.repeat(64),
            id: 'aaaaaaaaaaaa',
            name: 'shop-web',
            image: 'ghcr.io/acme/shop:1.4',
            image_id: 'sha256:abc',
            state: 'running',
            status_text: 'Up 3 hours (healthy)',
            health: 'healthy',
            created_at: '2026-09-01T10:00:00Z',
            started_at: '2026-09-08T07:00:00Z',
            restart_count: 0,
            restart_policy: 'unless-stopped',
            ports: [{ host_ip: '0.0.0.0', host_port: 8080, container_port: 80, protocol: 'tcp' }],
            compose_project: 'shop',
            compose_service: 'web',
            ownership: 'slideops',
            service_id: 'sv_7',
            cpu_limit_cores: 1.5,
            memory_limit_mb: 512,
            networks: ['shop_default'],
            mount_count: 2,
            labels: { 'com.docker.compose.project': 'shop' },
          },
        ],
      }),
    );

    const containers = await listDockerContainers('nd_1');

    expect(containers).toHaveLength(1);
    expect(containers[0]?.ports[0]?.host_port).toBe(8080);
    expect(containers[0]?.ownership).toBe('slideops');
    expect(containers[0]?.labels['com.docker.compose.project']).toBe('shop');
  });

  it('reads stats, images, volumes and networks from their own paths', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(200, {
          stats: [
            {
              container_id: 'a'.repeat(64),
              cpu_percent: 12.5,
              memory_used_mb: 220,
              memory_limit_mb: 512,
              net_rx_bytes: 1000,
              net_tx_bytes: 2000,
              block_read_bytes: 0,
              block_write_bytes: 4096,
              pids: 12,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          images: [
            {
              id: 'sha256:abc',
              repository: 'ghcr.io/acme/shop',
              tag: '1.4',
              created_at: '2026-08-30T09:00:00Z',
              size_bytes: 180_000_000,
              dangling: false,
              in_use: true,
              containers: 1,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          volumes: [
            {
              name: 'shop_data',
              driver: 'local',
              mountpoint: '/var/lib/docker/volumes/shop_data/_data',
              in_use: true,
              containers: ['shop-db'],
              labels: {},
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          networks: [
            {
              id: 'net1',
              name: 'shop_default',
              driver: 'bridge',
              scope: 'local',
              subnet: '172.19.0.0/16',
              gateway: '172.19.0.1',
              internal: false,
              containers: ['shop-web'],
              labels: {},
            },
          ],
        }),
      );

    const stats = await listDockerStats('nd_1');
    const images = await listDockerImages('nd_1');
    const volumes = await listDockerVolumes('nd_1');
    const networks = await listDockerNetworks('nd_1');

    expect(stats[0]?.cpu_percent).toBe(12.5);
    expect(images[0]?.dangling).toBe(false);
    // A volume the daemon was not asked to size carries no size at all, which is
    // not the same as a volume of zero bytes.
    expect(volumes[0]?.size_bytes).toBeUndefined();
    expect(networks[0]?.subnet).toBe('172.19.0.0/16');

    const paths = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(paths[0]).toContain('/docker/stats');
    expect(paths[1]).toContain('/docker/images');
    expect(paths[2]).toContain('/docker/volumes');
    expect(paths[3]).toContain('/docker/networks');
  });
});

describe('telling an absent daemon apart from a failure', () => {
  it('recognises the conflict that means Docker is not on this Node', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(409, {
        error: {
          code: DOCKER_UNAVAILABLE_CODE,
          message: 'Docker is not installed on this server.',
        },
      }),
    );

    const error = await getDockerOverview('nd_1').catch((thrown: unknown) => thrown);

    expect(isDockerUnavailable(error)).toBe(true);
    expect(error).toMatchObject({ name: 'ApiError', status: 409, code: 'docker_unavailable' });
  });

  it('does not read every conflict as an absent daemon', () => {
    // 409 is an ordinary conflict all over this API. Only the code decides.
    expect(isDockerUnavailable(new ApiError(409, 'workload_adopted', 'Already managed.'))).toBe(
      false,
    );
  });

  it('does not read a real failure as an absent daemon', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(502, {
        error: { code: 'node_unreachable', message: 'That server could not be reached.' },
      }),
    );

    const error = await listDockerContainers('nd_1').catch((thrown: unknown) => thrown);

    expect(isDockerUnavailable(error)).toBe(false);
    expect(error).toMatchObject({ name: 'ApiError', status: 502, code: 'node_unreachable' });
  });

  it('says no for anything that is not an ApiError at all', () => {
    expect(isDockerUnavailable(undefined)).toBe(false);
    expect(isDockerUnavailable(null)).toBe(false);
    expect(isDockerUnavailable(new Error('docker_unavailable'))).toBe(false);
    expect(isDockerUnavailable({ code: 'docker_unavailable' })).toBe(false);
  });
});

/*
 * Acting on one container.
 *
 * Three things matter. The action reaches the container it names, whatever
 * characters are in the name. The response is the container as the daemon left
 * it, not the state the caller assumed the action would produce. And a removal
 * refused because a Service owns the container is distinguishable from a
 * removal that failed, because those two lead an Operator to different places.
 */

/** A container as the lifecycle endpoints return it, past the envelope. */
function containerBody(state: string, overrides: Record<string, unknown> = {}) {
  return {
    container: {
      full_id: 'a'.repeat(64),
      id: 'aaaaaaaaaaaa',
      name: 'shop-web',
      image: 'ghcr.io/acme/shop:1.4',
      image_id: 'sha256:abc',
      state,
      status_text: `Up 1 second`,
      health: 'starting',
      created_at: '2026-09-01T10:00:00Z',
      restart_count: 0,
      restart_policy: 'unless-stopped',
      ports: [],
      ownership: 'external',
      networks: ['bridge'],
      mount_count: 0,
      labels: {},
      ...overrides,
    },
  };
}

describe('the container lifecycle', () => {
  const calls: Array<[DockerContainerAction, (n: string, r: string) => Promise<unknown>]> = [
    ['start', startDockerContainer],
    ['stop', stopDockerContainer],
    ['restart', restartDockerContainer],
    ['pause', pauseDockerContainer],
    ['unpause', unpauseDockerContainer],
    ['kill', killDockerContainer],
  ];

  it.each(calls)('posts %s to the container it names', async (action, call) => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, containerBody('running')));

    const container = await call('nd_1', 'shop-web');

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      `/api/v1/nodes/nd_1/docker/containers/shop-web/${action}`,
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe('include');
    expect(container).toMatchObject({ name: 'shop-web', state: 'running' });
  });

  it('drives the same six actions from one value', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, containerBody('paused')));

    await runDockerContainerAction('nd_1', 'shop-web', 'pause');

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/docker/containers/shop-web/pause');
  });

  it('reports the state the daemon left, not the one the action implies', async () => {
    // A stop on a container an "always" policy brings straight back leaves it
    // restarting. A screen that assumed "stopped" would show a container that
    // is visibly running as stopped until the next poll.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, containerBody('restarting', { restart_policy: 'always' })),
    );

    const container = await stopDockerContainer('nd_1', 'shop-web');

    expect(container.state).toBe('restarting');
  });

  it('encodes a container reference that is not URL safe', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, containerBody('running')));

    // Whoever created the container chose its name, so it is encoded rather
    // than trusted to be a single path segment.
    await startDockerContainer('nd/1', 'shop/web');

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/api/v1/nodes/nd%2F1/docker/containers/shop%2Fweb/start',
    );
  });

  it('removes a container with both choices stated outright', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));

    await removeDockerContainer('nd_1', 'shop-web', { force: true, remove_volumes: false });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/api/v1/nodes/nd_1/docker/containers/shop-web',
    );
    expect(init?.method).toBe('DELETE');
    expect(JSON.parse(String(init?.body))).toEqual({ force: true, remove_volumes: false });
  });

  it('resolves a removal with nothing, because the container is gone', async () => {
    // The backend answers with the container's last state. Handing that back
    // would invite a panel to keep rendering something that no longer exists.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, containerBody('exited')));

    await expect(
      removeDockerContainer('nd_1', 'shop-web', { force: false, remove_volumes: true }),
    ).resolves.toBeUndefined();
  });
});

describe('a container a Service owns', () => {
  it('recognises the refusal and reads the Service off it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(409, {
        error: {
          code: MANAGED_BY_SERVICE_CODE,
          message: 'A Service manages this container.',
          details: { service_id: 'sv_7' },
        },
      }),
    );

    const error = await removeDockerContainer('nd_1', 'shop-web', {
      force: false,
      remove_volumes: false,
    }).catch((thrown: unknown) => thrown);

    expect(isManagedByService(error)).toBe(true);
    expect(managedByServiceId(error)).toBe('sv_7');
  });

  it('still recognises the refusal when no Service id came with it', () => {
    // The sentence "a Service manages this container" is true either way. Only
    // the link to follow is missing, and a made up id would be worse than none.
    const bare = new ApiError(409, MANAGED_BY_SERVICE_CODE, 'A Service manages this container.');

    expect(isManagedByService(bare)).toBe(true);
    expect(managedByServiceId(bare)).toBeNull();
  });

  it('reads an id sent as a bare string', () => {
    const error = new ApiError(409, MANAGED_BY_SERVICE_CODE, 'Managed.', 'sv_9');

    expect(managedByServiceId(error)).toBe('sv_9');
  });

  it('does not read every conflict, or every error, as a managed container', () => {
    expect(isManagedByService(new ApiError(409, 'docker_unavailable', 'No daemon.'))).toBe(false);
    expect(isManagedByService(new Error('managed_by_service'))).toBe(false);
    expect(isManagedByService(null)).toBe(false);
    expect(managedByServiceId({ details: { service_id: 'sv_7' } })).toBeNull();
  });
});

describe('inspecting one container', () => {
  it('reads the inspect sections whole and unwraps the envelope', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        inspect: {
          general: {
            id: 'a'.repeat(64),
            name: '/shop-web',
            created_at: '2026-09-01T10:00:00Z',
            state: 'running',
            status: 'Up 3 hours (healthy)',
            platform: 'linux',
            runtime: 'runc',
          },
          configuration: {
            image: 'ghcr.io/acme/shop:1.4',
            command: 'node server.js',
            entrypoint: '/docker-entrypoint.sh',
            working_dir: '/app',
            user: 'node',
            labels: { 'com.docker.compose.project': 'shop' },
          },
          resources: { cpu_limit_cores: 1.5, memory_limit_mb: 512 },
          networking: {
            networks: ['shop_default'],
            ip_addresses: { shop_default: '172.19.0.2' },
            ports: [{ host_ip: '0.0.0.0', host_port: 8080, container_port: 80, protocol: 'tcp' }],
            dns: ['1.1.1.1'],
            hostname: 'shop-web',
          },
          storage: {
            mounts: [
              {
                type: 'volume',
                source: '/var/lib/docker/volumes/shop_data/_data',
                destination: '/data',
                read_only: false,
                name: 'shop_data',
              },
            ],
          },
          runtime: {
            restart_policy: 'unless-stopped',
            restart_count: 2,
            healthcheck: {
              test: ['CMD-SHELL', 'curl -f http://localhost/health'],
              interval_seconds: 30,
              retries: 3,
              last_status: 'healthy',
            },
            oom_killed: false,
            pid: 4211,
          },
        },
      }),
    );

    const inspect = await inspectDockerContainer('nd_1', 'shop-web');

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/api/v1/nodes/nd_1/docker/containers/shop-web/inspect',
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('GET');
    expect(inspect.general.status).toBe('Up 3 hours (healthy)');
    expect(inspect.resources.cpu_limit_cores).toBe(1.5);
    expect(inspect.networking.ip_addresses.shop_default).toBe('172.19.0.2');
    expect(inspect.storage.mounts[0]?.name).toBe('shop_data');
    expect(inspect.runtime.healthcheck?.retries).toBe(3);
    // A resource nobody limited is absent, not zero, all the way through.
    expect(inspect.resources.pids_limit).toBeUndefined();
    // The environment is not on the wire and must never appear there.
    expect(Object.keys(inspect.configuration)).not.toContain('environment');
  });
});

/*
 * A nil slice from Go arrives as JSON null, and a screen that reads .length on
 * one does not render an empty section, it throws and takes the page with it.
 * That is the blank Docker page, and these are the shapes that caused it.
 */
describe('a server that answers with nulls instead of empty lists', () => {
  it('gives a container usable arrays whatever the daemon reported', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        containers: [
          {
            full_id: 'abc123def456',
            id: 'abc123def456',
            name: 'lonely',
            image: 'nginx:latest',
            state: 'running',
            status_text: 'Up 2 hours',
            health: 'none',
            created_at: '2026-01-01T00:00:00Z',
            restart_count: 0,
            restart_policy: 'no',
            ports: null,
            networks: null,
            labels: null,
            ownership: 'external',
            mount_count: 0,
          },
        ],
      }),
    );

    const [container] = await listDockerContainers('nd_1');

    expect(container?.ports).toEqual([]);
    expect(container?.networks).toEqual([]);
    expect(container?.labels).toEqual({});
    // The assertion that matters: rendering must not throw.
    expect(() => container!.ports.length).not.toThrow();
  });

  it('gives an empty list when the whole collection is null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { containers: null }));

    await expect(listDockerContainers('nd_1')).resolves.toEqual([]);
  });

  it('gives volumes and networks their container lists back', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        volumes: [
          {
            name: 'data',
            driver: 'local',
            mountpoint: '/v',
            in_use: false,
            containers: null,
            labels: null,
          },
        ],
      }),
    );

    const [volume] = await listDockerVolumes('nd_1');

    expect(volume?.containers).toEqual([]);
    expect(volume?.labels).toEqual({});
  });
});

/*
 * The overview crash. A daemon with nothing to complain about omits its
 * warnings entirely, which is the healthy case and so the common one, and the
 * attention list iterates that field to build itself.
 */
describe('an overview from a daemon with nothing to complain about', () => {
  it('still gives the warning list, so the attention list can be built', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        overview: {
          daemon: { available: true, version: '27.1.1' },
          counts: { containers: 3, running: 2 },
          disk: {},
        },
      }),
    );

    const overview = await getDockerOverview('nd_1');

    expect(overview.daemon.warnings).toEqual([]);
    expect(() => overview.daemon.warnings.entries()).not.toThrow();
  });
});
