import type {
  DockerContainer,
  DockerCrashAnalysis,
  DockerImage,
  DockerNetwork,
  DockerOverview,
  DockerStats,
  DockerVolume,
  Facts,
} from '@slideops/api-client';
import { describe, expect, it } from 'vitest';
import {
  CONSUMING_STATES,
  RANKING_TOP_N,
  capacitySummary,
  crashEvidence,
  nodeCapacityFromFacts,
  rankByCpu,
  rankByMemory,
  rankByRestarts,
  relationshipsFor,
  type NodeCapacity,
} from './docker-analysis';

/*
 * The rules this file exists to hold in place.
 *
 * A container nobody sampled is not a container using nothing. A limit nobody
 * set is not a limit of zero. A disk nobody measured has no size. And nothing
 * anywhere in here may name a reason a container failed.
 *
 * Every assertion below is one of those four, or the ordinary arithmetic that
 * only means anything once they hold.
 */

function container(overrides: Partial<DockerContainer> = {}): DockerContainer {
  return {
    full_id: overrides.full_id ?? `full-${overrides.name ?? 'c'}`,
    id: overrides.id ?? `short-${overrides.name ?? 'c'}`,
    name: overrides.name ?? 'c',
    image: 'ghcr.io/acme/api:1.0.0',
    image_id: 'sha256:aaa',
    state: 'running',
    status_text: 'Up 2 hours',
    health: 'none',
    created_at: '2026-01-01T00:00:00Z',
    started_at: '2026-01-01T00:00:00Z',
    restart_count: 0,
    restart_policy: 'unless-stopped',
    ports: [],
    ownership: 'external',
    networks: [],
    mount_count: 0,
    labels: {},
    ...overrides,
  };
}

function stat(containerId: string, overrides: Partial<DockerStats> = {}): DockerStats {
  return {
    container_id: containerId,
    cpu_percent: 0,
    memory_used_mb: 0,
    memory_limit_mb: 16384,
    net_rx_bytes: 0,
    net_tx_bytes: 0,
    block_read_bytes: 0,
    block_write_bytes: 0,
    pids: 1,
    ...overrides,
  };
}

describe('rankByCpu', () => {
  it('ranks the busiest containers highest', () => {
    const containers = [
      container({ name: 'idle', full_id: 'f-idle' }),
      container({ name: 'busy', full_id: 'f-busy' }),
      container({ name: 'middling', full_id: 'f-mid' }),
    ];
    const stats = [
      stat('f-idle', { cpu_percent: 1 }),
      stat('f-busy', { cpu_percent: 190 }),
      stat('f-mid', { cpu_percent: 40 }),
    ];

    const ranking = rankByCpu(containers, stats);

    expect(ranking.top.map((entry) => entry.container.name)).toEqual(['busy', 'middling', 'idle']);
    expect(ranking.top[0].cpuPercent).toBe(190);
    expect(ranking.excluded).toBe(0);
  });

  it('excludes a container with no live sample rather than ranking it at zero', () => {
    const containers = [
      container({ name: 'sampled', full_id: 'f-1' }),
      container({ name: 'unsampled', full_id: 'f-2' }),
    ];

    const ranking = rankByCpu(containers, [stat('f-1', { cpu_percent: 5 })]);

    expect(ranking.top.map((entry) => entry.container.name)).toEqual(['sampled']);
    expect(ranking.ranked).toBe(1);
    // The screen can now say that one container could not be ranked, which is
    // the difference between an incomplete answer and a wrong one.
    expect(ranking.excluded).toBe(1);
    expect(ranking.top.some((entry) => entry.container.name === 'unsampled')).toBe(false);
  });

  it('ranks nothing at all when nothing was sampled', () => {
    const ranking = rankByCpu([container({ name: 'a' }), container({ name: 'b' })], []);

    expect(ranking.top).toEqual([]);
    expect(ranking.ranked).toBe(0);
    expect(ranking.excluded).toBe(2);
  });

  it('names at most the top N, and keeps equal readings in input order', () => {
    const containers = Array.from({ length: 8 }, (_, index) =>
      container({ name: `c${index}`, full_id: `f${index}` }),
    );
    const stats = containers.map((entry) => stat(entry.full_id, { cpu_percent: 10 }));

    const ranking = rankByCpu(containers, stats);

    expect(ranking.top).toHaveLength(RANKING_TOP_N);
    expect(ranking.top.map((entry) => entry.container.name)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4']);
  });

  it('matches a sample keyed by the short id as well as the full one', () => {
    const only = container({ name: 'api', full_id: 'full-api', id: 'short-api' });
    const ranking = rankByCpu([only], [stat('short-api', { cpu_percent: 3 })]);
    expect(ranking.top).toHaveLength(1);
  });
});

describe('rankByMemory', () => {
  it('ranks on memory actually in use, not on a percentage of some limit', () => {
    const containers = [
      container({ name: 'small-limit', full_id: 'f-1', memory_limit_mb: 128 }),
      container({ name: 'no-limit', full_id: 'f-2' }),
    ];
    const stats = [
      stat('f-1', { memory_used_mb: 120 }),
      stat('f-2', { memory_used_mb: 4096 }),
    ];

    const ranking = rankByMemory(containers, stats);

    // The unlimited container is holding 4 GB. Ranking on percent of limit
    // would have put the 120 MB one on top at 94%.
    expect(ranking.top[0].container.name).toBe('no-limit');
    expect(ranking.top[0].limitMb).toBeNull();
    expect(ranking.top[0].percentOfLimit).toBeNull();
    expect(ranking.top[1].percentOfLimit).toBeCloseTo(93.75);
  });

  it('excludes an unsampled container rather than reading it as empty', () => {
    const ranking = rankByMemory(
      [container({ name: 'a', full_id: 'f-1' }), container({ name: 'b', full_id: 'f-2' })],
      [stat('f-1', { memory_used_mb: 10 })],
    );

    expect(ranking.top).toHaveLength(1);
    expect(ranking.excluded).toBe(1);
  });
});

describe('rankByRestarts', () => {
  it('ranks on the restart count every container reports, sample or no sample', () => {
    const containers = [
      container({ name: 'stable', restart_count: 0 }),
      container({ name: 'flapping', restart_count: 42, state: 'exited' }),
      container({ name: 'occasional', restart_count: 3 }),
    ];

    const ranking = rankByRestarts(containers);

    expect(ranking.top.map((entry) => entry.container.name)).toEqual(['flapping', 'occasional']);
    // A container that has never restarted is not a rank, it is the absence of
    // one, so it is counted out rather than listed at zero.
    expect(ranking.excluded).toBe(1);
  });

  it('needs no stats at all', () => {
    const ranking = rankByRestarts([container({ name: 'gone', state: 'dead', restart_count: 7 })]);
    expect(ranking.top[0].restarts).toBe(7);
  });
});

describe('capacitySummary', () => {
  const node: NodeCapacity = {
    cores: 4,
    memoryMb: 8192,
    diskTotalBytes: 100 * 1024 * 1024 * 1024,
    diskUsedBytes: 40 * 1024 * 1024 * 1024,
    diskMount: '/',
  };

  it('keeps allocated and used apart, and counts what belongs to neither', () => {
    const containers = [
      container({
        name: 'limited',
        full_id: 'f-1',
        cpu_limit_cores: 1,
        memory_limit_mb: 512,
      }),
      container({ name: 'unlimited', full_id: 'f-2' }),
    ];
    const stats = [
      stat('f-1', { cpu_percent: 50, memory_used_mb: 256 }),
      stat('f-2', { cpu_percent: 100, memory_used_mb: 1024 }),
    ];

    const summary = capacitySummary(containers, stats, node);

    expect(summary.cpu.allocated).toBe(1);
    expect(summary.cpu.allocatedFrom).toBe(1);
    // The container with no limit uses a full core while reserving nothing,
    // and the summary says so rather than quietly undercounting.
    expect(summary.cpu.unlimited).toBe(1);
    expect(summary.cpu.used).toBeCloseTo(1.5);
    expect(summary.memory.allocated).toBe(512);
    expect(summary.memory.used).toBe(1280);
    expect(summary.memory.unlimited).toBe(1);
  });

  it('reports used as absent when nothing was sampled, never as zero', () => {
    const summary = capacitySummary(
      [container({ name: 'a', full_id: 'f-1', memory_limit_mb: 256 })],
      [],
      node,
    );

    expect(summary.memory.used).toBeNull();
    expect(summary.cpu.used).toBeNull();
    expect(summary.memory.unsampled).toBe(1);
    // The reservation is still known: a limit is a limit whether or not
    // anything measured what the container did with it.
    expect(summary.memory.allocated).toBe(256);
  });

  it('counts only containers in a state that consumes anything', () => {
    const containers = [
      container({ name: 'running', full_id: 'f-1', memory_limit_mb: 100 }),
      container({ name: 'paused', full_id: 'f-2', state: 'paused', memory_limit_mb: 100 }),
      container({ name: 'exited', full_id: 'f-3', state: 'exited', memory_limit_mb: 100 }),
      container({ name: 'dead', full_id: 'f-4', state: 'dead', memory_limit_mb: 100 }),
    ];

    const summary = capacitySummary(containers, [], node);

    expect(summary.counted).toBe(2);
    expect(summary.idle).toBe(2);
    expect(summary.memory.allocated).toBe(200);
    expect(CONSUMING_STATES).toContain('paused');
  });

  it('leaves every denominator null when the Node has never been discovered', () => {
    const summary = capacitySummary(
      [container({ name: 'a', full_id: 'f-1', memory_limit_mb: 256 })],
      [stat('f-1', { memory_used_mb: 128 })],
    );

    expect(summary.cpu.total).toBeNull();
    expect(summary.memory.total).toBeNull();
    expect(summary.disk.totalBytes).toBeNull();
    // What was measured is still reported: the missing denominator costs the
    // ratio, not the reading.
    expect(summary.memory.used).toBe(128);
  });

  it('adds up Docker disk from the daemon accounting and leaves it absent without it', () => {
    const overview = {
      daemon: { available: true, warnings: [] },
      counts: {
        containers: 1,
        running: 1,
        stopped: 0,
        paused: 0,
        restarting: 0,
        unhealthy: 0,
        exited: 0,
        dead: 0,
        created: 0,
        images: 1,
        volumes: 1,
        networks: 1,
        compose_projects: 0,
      },
      disk: {
        images_bytes: 1000,
        images_reclaimable_bytes: 400,
        containers_bytes: 100,
        containers_reclaimable_bytes: 10,
        volumes_bytes: 20,
        volumes_reclaimable_bytes: 5,
        build_cache_bytes: 3,
        build_cache_reclaimable_bytes: 3,
      },
    } as DockerOverview;

    const withOverview = capacitySummary([], [], node, overview);
    expect(withOverview.disk.dockerBytes).toBe(1123);
    expect(withOverview.disk.reclaimableBytes).toBe(418);
    expect(withOverview.disk.totalBytes).toBe(node.diskTotalBytes);

    const without = capacitySummary([], [], node);
    expect(without.disk.dockerBytes).toBeNull();
    expect(without.disk.reclaimableBytes).toBeNull();
  });
});

describe('nodeCapacityFromFacts', () => {
  it('reads cores, memory and the root filesystem from saved Discovery', () => {
    const facts: Facts = {
      cpu: { cores: 8 },
      memory: { total_kb: 16 * 1024 * 1024 },
      disks: [
        { mount_point: '/boot', size_kb: 1024 * 1024, used_kb: 512 * 1024 },
        { mount_point: '/', size_kb: 50 * 1024 * 1024, used_kb: 20 * 1024 * 1024 },
      ],
    };

    const capacity = nodeCapacityFromFacts(facts);

    expect(capacity.cores).toBe(8);
    expect(capacity.memoryMb).toBe(16 * 1024);
    expect(capacity.diskMount).toBe('/');
    expect(capacity.diskTotalBytes).toBe(50 * 1024 * 1024 * 1024);
  });

  it('falls back to the largest filesystem when there is no root mount', () => {
    const capacity = nodeCapacityFromFacts({
      disks: [
        { mount: '/data', size_kb: 200 },
        { mount: '/var', size_kb: 900 },
      ],
    });
    expect(capacity.diskMount).toBe('/var');
  });

  it('returns nothing but nulls for a Node that has never been discovered', () => {
    const capacity = nodeCapacityFromFacts(null);
    expect(capacity).toEqual({
      cores: null,
      memoryMb: null,
      diskTotalBytes: null,
      diskUsedBytes: null,
      diskMount: null,
    });
  });

  it('does not invent a size for a disk Discovery could not measure', () => {
    const capacity = nodeCapacityFromFacts({ disks: [{ mount: '/', total: '50G' }] });
    expect(capacity.diskTotalBytes).toBeNull();
    expect(capacity.diskMount).toBeNull();
  });
});

describe('relationshipsFor', () => {
  const api = container({
    name: 'shop-api',
    full_id: 'f-api',
    id: 's-api',
    image: 'ghcr.io/acme/api:1.0.0',
    image_id: 'sha256:api',
    networks: ['shop_default'],
    mount_count: 2,
    compose_project: 'shop',
    compose_service: 'api',
  });
  const worker = container({
    name: 'shop-worker',
    full_id: 'f-worker',
    id: 's-worker',
    image: 'ghcr.io/acme/api:1.0.0',
    image_id: 'sha256:api',
    networks: ['shop_default'],
    compose_project: 'shop',
    compose_service: 'worker',
  });
  const volumes: DockerVolume[] = [
    {
      name: 'shop_data',
      driver: 'local',
      mountpoint: '/var/lib/docker/volumes/shop_data/_data',
      in_use: true,
      containers: ['shop-api'],
      labels: {},
    },
  ];
  const networks: DockerNetwork[] = [
    {
      id: 'net-1',
      name: 'shop_default',
      driver: 'bridge',
      scope: 'local',
      internal: false,
      containers: ['shop-api', 'shop-worker'],
      labels: {},
    },
  ];
  const images: DockerImage[] = [
    {
      id: 'sha256:api',
      repository: 'ghcr.io/acme/api',
      tag: '1.0.0',
      created_at: '2026-01-01T00:00:00Z',
      size_bytes: 100,
      dangling: false,
      in_use: true,
      containers: 2,
    },
  ];
  const inventory = { containers: [api, worker], volumes, networks, images };

  it('says what one container uses', () => {
    const relationships = relationshipsFor({ kind: 'container', name: 'shop-api' }, inventory);

    expect(relationships.found).toBe(true);
    expect(relationships.uses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'image', name: 'ghcr.io/acme/api:1.0.0' }),
        expect.objectContaining({ kind: 'network', name: 'shop_default' }),
        expect.objectContaining({ kind: 'volume', name: 'shop_data' }),
      ]),
    );
    expect(relationships.peers.map((peer) => peer.name)).toEqual(['shop-worker']);
  });

  it('says plainly that it cannot see the mounts that are not named volumes', () => {
    const relationships = relationshipsFor({ kind: 'container', name: 'shop-api' }, inventory);
    expect(relationships.notes.join(' ')).toMatch(/bind mount|tmpfs/);
  });

  it('answers what uses this volume', () => {
    const relationships = relationshipsFor({ kind: 'volume', name: 'shop_data' }, inventory);
    expect(relationships.usedBy.map((entry) => entry.name)).toEqual(['shop-api']);
  });

  it('answers what is on this network', () => {
    const relationships = relationshipsFor({ kind: 'network', name: 'shop_default' }, inventory);
    expect(relationships.usedBy.map((entry) => entry.name)).toEqual(['shop-api', 'shop-worker']);
  });

  it('answers what would break if an image were removed', () => {
    const relationships = relationshipsFor(
      { kind: 'image', name: 'ghcr.io/acme/api:1.0.0' },
      inventory,
    );
    expect(relationships.usedBy.map((entry) => entry.name)).toEqual(['shop-api', 'shop-worker']);
  });

  it('reports a record it was never given rather than answering "nothing uses this"', () => {
    const relationships = relationshipsFor(
      { kind: 'container', name: 'shop-api' },
      { containers: [api, worker] },
    );

    expect(relationships.notRead).toEqual(['volume', 'network', 'image']);
    // No volume was found, and the answer says why: nobody read the volumes.
    expect(relationships.uses.some((entry) => entry.kind === 'volume')).toBe(false);
  });

  it('keeps a container a volume names but this server did not list', () => {
    const orphaned: DockerVolume[] = [
      { ...volumes[0], name: 'ghost_data', containers: ['long-gone'] },
    ];
    const relationships = relationshipsFor(
      { kind: 'volume', name: 'ghost_data' },
      { containers: [api], volumes: orphaned },
    );

    expect(relationships.usedBy[0].name).toBe('long-gone');
    expect(relationships.usedBy[0].detail).toMatch(/not in this server's container list/);
  });

  it('reports a resource the inventory does not hold as not found', () => {
    const relationships = relationshipsFor({ kind: 'volume', name: 'nope' }, inventory);
    expect(relationships.found).toBe(false);
    expect(relationships.usedBy).toEqual([]);
  });
});

describe('crashEvidence', () => {
  const full: DockerCrashAnalysis = {
    restart_count: 12,
    last_restart_at: '2026-02-01T10:00:00Z',
    previous_state: 'running',
    exit_code: 137,
    oom_killed: true,
    health_status: 'unhealthy',
    crash_loop: true,
    crash_loop_window_seconds: 300,
    restarts_in_window: 6,
    observations: [{ code: 'oom_killed', detail: 'The kernel killed this container.' }],
  };

  it('arranges every dimension the backend reported', () => {
    const keys = crashEvidence(full).map((item) => item.key);
    expect(keys).toEqual([
      'restarts',
      'last_restart',
      'previous_state',
      'exit_code',
      'oom_killed',
      'health_status',
      'crash_loop',
    ]);
  });

  it('states the crash loop as the evidence for it, not as a verdict', () => {
    const loop = crashEvidence(full).find((item) => item.key === 'crash_loop');
    expect(loop?.value).toBe('6 restarts in 5 minutes');
  });

  it('omits a dimension with no evidence rather than calling it unknown', () => {
    const sparse: DockerCrashAnalysis = {
      restart_count: 2,
      oom_killed: false,
      crash_loop: false,
      observations: [],
    };

    const items = crashEvidence(sparse);
    const keys = items.map((item) => item.key);

    expect(keys).toEqual(['restarts']);
    // Not "Exit code: unknown", not "Healthcheck: none", not "OOM: no".
    const rendered = items.map((item) => `${item.label} ${item.value}`).join(' ').toLowerCase();
    expect(rendered).not.toContain('unknown');
    expect(rendered).not.toContain('none');
  });

  it('treats oom_killed false as no evidence, not as evidence of the opposite', () => {
    const items = crashEvidence({ ...full, oom_killed: false });
    expect(items.some((item) => item.key === 'oom_killed')).toBe(false);
  });

  it('reads a clean exit as a clean exit', () => {
    const items = crashEvidence({ ...full, exit_code: 0, oom_killed: false, crash_loop: false });
    expect(items.find((item) => item.key === 'exit_code')?.tone).toBe('neutral');
  });

  it('hands over the instant of the last restart rather than formatting it', () => {
    const item = crashEvidence(full).find((entry) => entry.key === 'last_restart');
    expect(item?.at).toBe('2026-02-01T10:00:00Z');
  });

  it('says what it measured when the window figures are missing', () => {
    const items = crashEvidence({
      ...full,
      crash_loop_window_seconds: undefined,
      restarts_in_window: undefined,
    });
    const loop = items.find((item) => item.key === 'crash_loop');
    expect(loop?.value).toBe('Docker restarted this container repeatedly.');
  });
});
