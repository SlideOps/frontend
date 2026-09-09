import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import {
  DOCKER_UNAVAILABLE_CODE,
  getDockerOverview,
  isDockerUnavailable,
  listDockerContainers,
  listDockerImages,
  listDockerNetworks,
  listDockerStats,
  listDockerVolumes,
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
