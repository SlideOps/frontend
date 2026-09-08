import type { DockerContainer, DockerOverview, DockerStats } from '@slideops/api-client';
import { describe, expect, it } from 'vitest';
import {
  attentionItems,
  filterContainers,
  formatBytes,
  formatUptime,
  memoryPressurePercent,
  MEMORY_NEAR_LIMIT_PERCENT,
  RECLAIMABLE_DISK_WARNING_BYTES,
  RESTART_COUNT_CRITICAL,
  RESTART_COUNT_WARNING,
  searchContainers,
  sortContainers,
  summarise,
  uptimeSeconds,
} from './docker-inventory';

/*
 * The rules behind the Docker control centre.
 *
 * The searching and sorting tests check that the page can be driven. The
 * attention tests check something else entirely: that this file never states
 * anything the daemon did not report. Most of them are about silence, because
 * an observation that appears when the evidence is missing is worse than no
 * observation at all, and it is the failure that would not show up in any
 * screenshot.
 */

const now = new Date('2026-09-08T12:00:00Z');

function agoIso(seconds: number): string {
  return new Date(now.getTime() - seconds * 1000).toISOString();
}

function container(over: Partial<DockerContainer> = {}): DockerContainer {
  const name = over.name ?? 'shop-web';
  return {
    full_id: `${name}-full-id`,
    id: name.slice(0, 12),
    name,
    image: 'ghcr.io/acme/shop:1.4',
    image_id: 'sha256:abc',
    state: 'running',
    status_text: 'Up 3 hours',
    health: 'none',
    created_at: agoIso(86_400),
    started_at: agoIso(3_600),
    restart_count: 0,
    restart_policy: 'unless-stopped',
    ports: [],
    ownership: 'external',
    networks: [],
    mount_count: 0,
    labels: {},
    ...over,
  };
}

function stat(over: Partial<DockerStats> & { container_id: string }): DockerStats {
  return {
    cpu_percent: 1,
    memory_used_mb: 100,
    memory_limit_mb: 64_000,
    net_rx_bytes: 0,
    net_tx_bytes: 0,
    block_read_bytes: 0,
    block_write_bytes: 0,
    pids: 4,
    ...over,
  };
}

function overview(over: Partial<DockerOverview> = {}): DockerOverview {
  return {
    daemon: { available: true, version: '27.1.1', warnings: [] },
    counts: {
      containers: 0,
      running: 0,
      stopped: 0,
      paused: 0,
      restarting: 0,
      unhealthy: 0,
      exited: 0,
      dead: 0,
      created: 0,
      images: 0,
      volumes: 0,
      networks: 0,
      compose_projects: 0,
    },
    disk: {
      images_bytes: 0,
      images_reclaimable_bytes: 0,
      containers_bytes: 0,
      containers_reclaimable_bytes: 0,
      volumes_bytes: 0,
      volumes_reclaimable_bytes: 0,
      build_cache_bytes: 0,
      build_cache_reclaimable_bytes: 0,
    },
    ...over,
  };
}

function ids(items: { id: string }[]): string[] {
  return items.map((item) => item.id);
}

describe('finding a container by whatever the Operator remembers about it', () => {
  const containers = [
    container({
      name: 'shop-web',
      image: 'ghcr.io/acme/shop:1.4',
      compose_project: 'shop',
      compose_service: 'web',
      networks: ['shop_default'],
      ports: [{ host_ip: '0.0.0.0', host_port: 8080, container_port: 80, protocol: 'tcp' }],
      labels: { owner: 'platform-team' },
    }),
    container({
      name: 'billing-api',
      image: 'ghcr.io/acme/billing:2.0',
      networks: ['bridge'],
      ports: [{ container_port: 5432, protocol: 'tcp' }],
      labels: {},
    }),
  ];

  it('returns everything when nothing was typed', () => {
    expect(searchContainers(containers, '')).toHaveLength(2);
    expect(searchContainers(containers, '   ')).toHaveLength(2);
  });

  it('matches the name, the image, the Compose project and the service', () => {
    expect(searchContainers(containers, 'shop-web')[0]?.name).toBe('shop-web');
    expect(searchContainers(containers, 'billing:2.0')[0]?.name).toBe('billing-api');
    expect(searchContainers(containers, 'shop')).toHaveLength(1);
    expect(searchContainers(containers, 'web')[0]?.compose_service).toBe('web');
  });

  it('matches either form of the id and ignores case', () => {
    expect(searchContainers(containers, 'SHOP-WEB-FULL-ID')[0]?.name).toBe('shop-web');
    expect(searchContainers(containers, containers[1]!.id)[0]?.name).toBe('billing-api');
  });

  it('matches a network, a published port, and a label key or value', () => {
    expect(searchContainers(containers, 'shop_default')[0]?.name).toBe('shop-web');
    expect(searchContainers(containers, '8080')[0]?.name).toBe('shop-web');
    expect(searchContainers(containers, 'owner')[0]?.name).toBe('shop-web');
    expect(searchContainers(containers, 'platform-team')[0]?.name).toBe('shop-web');
  });

  it('does not match a port that is not published', () => {
    // Searching a port means looking for what answers on it. A container whose
    // internal port happens to be 5432 is not reachable there.
    expect(searchContainers(containers, '5432')).toHaveLength(0);
  });
});

describe('narrowing the list down', () => {
  const running = container({ name: 'web', state: 'running', ownership: 'slideops' });
  const stopped = container({ name: 'batch', state: 'exited', ownership: 'external' });

  it('treats an empty filter as no constraint at all', () => {
    expect(filterContainers([running, stopped], {})).toHaveLength(2);
    expect(filterContainers([running, stopped], { states: [] })).toHaveLength(2);
  });

  it('combines values inside one field with or, and fields with and', () => {
    expect(filterContainers([running, stopped], { states: ['running', 'exited'] })).toHaveLength(2);
    expect(
      filterContainers([running, stopped], { states: ['running'], ownership: ['external'] }),
    ).toHaveLength(0);
  });

  it('matches an image as a substring so a repository finds all of its tags', () => {
    expect(filterContainers([running, stopped], { image: 'acme/shop' })).toHaveLength(2);
    expect(filterContainers([running, stopped], { image: 'ghcr.io/other' })).toHaveLength(0);
  });

  it('matches a Compose project and a network exactly', () => {
    const inCompose = container({
      name: 'db',
      compose_project: 'shop',
      networks: ['shop_default'],
    });
    const list = [inCompose, running];
    expect(filterContainers(list, { composeProject: 'shop' })).toHaveLength(1);
    expect(filterContainers(list, { composeProject: 'sho' })).toHaveLength(0);
    expect(filterContainers(list, { network: 'shop_default' })).toHaveLength(1);
  });

  it('names no container as busy when it was given no numbers to read', () => {
    // The question was which containers are busy. With no samples in hand there
    // is no honest answer, so the filter returns none rather than everything.
    expect(filterContainers([running], { highCpu: true })).toHaveLength(0);
    expect(filterContainers([running], { highCpu: true }, { stats: [] })).toHaveLength(0);
    expect(filterContainers([running], { highMemory: true }, { stats: [] })).toHaveLength(0);
  });

  it('selects high CPU only from the containers that were actually sampled', () => {
    const busy = container({ name: 'busy' });
    const quiet = container({ name: 'quiet' });
    const stats = [
      stat({ container_id: busy.full_id, cpu_percent: 96 }),
      stat({ container_id: quiet.full_id, cpu_percent: 2 }),
    ];
    const matched = filterContainers([busy, quiet], { highCpu: true }, { stats });
    expect(matched.map((c) => c.name)).toEqual(['busy']);
  });

  it('never calls a container high memory when it has no limit of its own', () => {
    // The daemon reports the whole machine's memory as the ceiling for an
    // unlimited container, so a percentage read off the sample alone is a
    // percentage of the wrong number.
    const unlimited = container({ name: 'cache', memory_limit_mb: undefined });
    const stats = [
      stat({ container_id: unlimited.full_id, memory_used_mb: 32_000, memory_limit_mb: 64_000 }),
    ];
    expect(filterContainers([unlimited], { highMemory: true }, { stats })).toHaveLength(0);

    const limited = container({ name: 'api', memory_limit_mb: 512 });
    const limitedStats = [
      stat({ container_id: limited.full_id, memory_used_mb: 480, memory_limit_mb: 512 }),
    ];
    expect(filterContainers([limited], { highMemory: true }, { stats: limitedStats })).toHaveLength(
      1,
    );
  });

  it('reads recently created against the clock it was given', () => {
    const fresh = container({ name: 'fresh', created_at: agoIso(600) });
    const old = container({ name: 'old', created_at: agoIso(86_400) });
    const matched = filterContainers([fresh, old], { recentlyCreated: true }, { now });
    expect(matched.map((c) => c.name)).toEqual(['fresh']);
  });

  it('needs both a restart and a recent start before calling something recently restarted', () => {
    const justDeployed = container({ name: 'new', restart_count: 0, started_at: agoIso(120) });
    const restartedLongAgo = container({
      name: 'settled',
      restart_count: 12,
      started_at: agoIso(200_000),
    });
    const restartedJustNow = container({
      name: 'flapping',
      restart_count: 3,
      started_at: agoIso(60),
    });
    const beingRestarted = container({ name: 'looping', state: 'restarting', restart_count: 0 });

    const matched = filterContainers(
      [justDeployed, restartedLongAgo, restartedJustNow, beingRestarted],
      { recentlyRestarted: true },
      { now },
    );
    // A container deployed an hour ago has not restarted, and one that
    // restarted last month did not just do so. A container Docker is restarting
    // right now counts whatever its timestamps say.
    expect(matched.map((c) => c.name)).toEqual(['flapping', 'looping']);
  });

  it('does not treat an unreadable timestamp as recent', () => {
    const broken = container({ name: 'broken', created_at: 'not a date' });
    expect(filterContainers([broken], { recentlyCreated: true }, { now })).toHaveLength(0);
  });
});

describe('ordering the list', () => {
  it('sorts by name in both directions and leaves ties in their original order', () => {
    const list = [container({ name: 'beta' }), container({ name: 'Alpha' })];
    expect(sortContainers(list, { field: 'name', direction: 'asc' }).map((c) => c.name)).toEqual([
      'Alpha',
      'beta',
    ]);
    expect(sortContainers(list, { field: 'name', direction: 'desc' }).map((c) => c.name)).toEqual([
      'beta',
      'Alpha',
    ]);
  });

  it('sorts by state worst first rather than alphabetically', () => {
    const list = [
      container({ name: 'ok', state: 'running' }),
      container({ name: 'made', state: 'created' }),
      container({ name: 'gone', state: 'dead' }),
      container({ name: 'looping', state: 'restarting' }),
    ];
    expect(sortContainers(list, { field: 'state', direction: 'asc' }).map((c) => c.name)).toEqual([
      'gone',
      'looping',
      'made',
      'ok',
    ]);
  });

  it('puts containers with no sample last in both directions, never as zero', () => {
    const sampled = container({ name: 'sampled' });
    const unsampled = container({ name: 'unsampled' });
    const stats = [stat({ container_id: sampled.full_id, cpu_percent: 40 })];

    const ascending = sortContainers(
      [unsampled, sampled],
      { field: 'cpu', direction: 'asc' },
      stats,
    );
    // Ascending would put a zero first. An absent sample is not a zero, so the
    // unsampled container stays at the end.
    expect(ascending.map((c) => c.name)).toEqual(['sampled', 'unsampled']);

    const descending = sortContainers(
      [unsampled, sampled],
      { field: 'cpu', direction: 'desc' },
      stats,
    );
    expect(descending.map((c) => c.name)).toEqual(['sampled', 'unsampled']);
  });

  it('sorts by memory used and keeps unsampled containers out of the ordering', () => {
    const big = container({ name: 'big' });
    const small = container({ name: 'small' });
    const none = container({ name: 'none' });
    const stats = [
      stat({ container_id: big.full_id, memory_used_mb: 900 }),
      stat({ container_id: small.full_id, memory_used_mb: 20 }),
    ];
    expect(
      sortContainers([small, none, big], { field: 'memory', direction: 'desc' }, stats).map(
        (c) => c.name,
      ),
    ).toEqual(['big', 'small', 'none']);
  });

  it('sorts by uptime with stopped containers last, since they have none', () => {
    const oldest = container({ name: 'oldest', started_at: agoIso(500_000) });
    const newest = container({ name: 'newest', started_at: agoIso(60) });
    const stopped = container({ name: 'stopped', state: 'exited', started_at: agoIso(900_000) });

    expect(
      sortContainers([newest, stopped, oldest], { field: 'uptime', direction: 'desc' }).map(
        (c) => c.name,
      ),
    ).toEqual(['oldest', 'newest', 'stopped']);
  });

  it('sorts by created time and by restart count', () => {
    const older = container({ name: 'older', created_at: agoIso(500_000) });
    const newer = container({ name: 'newer', created_at: agoIso(50) });
    expect(
      sortContainers([older, newer], { field: 'created', direction: 'desc' }).map((c) => c.name),
    ).toEqual(['newer', 'older']);

    const calm = container({ name: 'calm', restart_count: 0 });
    const flapping = container({ name: 'flapping', restart_count: 9 });
    expect(
      sortContainers([calm, flapping], { field: 'restarts', direction: 'desc' }).map((c) => c.name),
    ).toEqual(['flapping', 'calm']);
  });

  it('does not modify the list it was given', () => {
    const list = [container({ name: 'b' }), container({ name: 'a' })];
    sortContainers(list, { field: 'name', direction: 'asc' });
    expect(list.map((c) => c.name)).toEqual(['b', 'a']);
  });
});

describe('how long a container has been up', () => {
  it('is null for anything that is not running', () => {
    expect(uptimeSeconds(container({ state: 'exited', started_at: agoIso(100) }), now)).toBeNull();
    expect(uptimeSeconds(container({ state: 'created', started_at: undefined }), now)).toBeNull();
  });

  it('is null for a running container the daemon gave no start time for', () => {
    // Zero would read as "just started", which is the opposite of unknown.
    expect(uptimeSeconds(container({ state: 'running', started_at: undefined }), now)).toBeNull();
    expect(uptimeSeconds(container({ started_at: 'not a date' }), now)).toBeNull();
  });

  it('counts the seconds since the current run began', () => {
    expect(uptimeSeconds(container({ started_at: agoIso(7_200) }), now)).toBe(7_200);
  });

  it('reads a start time in the future as clock skew rather than negative uptime', () => {
    const future = new Date(now.getTime() + 30_000).toISOString();
    expect(uptimeSeconds(container({ started_at: future }), now)).toBe(0);
  });
});

describe('summarising what is on the Node', () => {
  it('counts every state, ownership and health, including the ones at zero', () => {
    const summary = summarise([
      container({ state: 'running', ownership: 'slideops', health: 'healthy' }),
      container({ state: 'running', ownership: 'external', health: 'unhealthy' }),
      container({ state: 'exited', ownership: 'unknown', health: 'none' }),
    ]);

    expect(summary.total).toBe(3);
    expect(summary.byState.running).toBe(2);
    expect(summary.byState.exited).toBe(1);
    // Present and zero, so the header renders a fixed set of figures.
    expect(summary.byState.dead).toBe(0);
    expect(summary.byOwnership).toEqual({ slideops: 1, external: 1, unknown: 1 });
    expect(summary.byHealth.unhealthy).toBe(1);
    expect(summary.byHealth.starting).toBe(0);
  });

  it('summarises an empty Node without inventing anything', () => {
    const summary = summarise([]);
    expect(summary.total).toBe(0);
    expect(Object.values(summary.byState).every((count) => count === 0)).toBe(true);
  });
});

describe('what is worth an Operator attention, and what is not', () => {
  it('says nothing at all about a Node where everything is fine', () => {
    const healthy = container({ name: 'web', health: 'healthy', restart_count: 1 });
    expect(
      attentionItems([healthy], [stat({ container_id: healthy.full_id })], overview()),
    ).toEqual([]);
  });

  it('says nothing when there is no data to judge anything by', () => {
    expect(attentionItems([], [], overview())).toEqual([]);
    expect(attentionItems([], [])).toEqual([]);
    expect(attentionItems([container()], [])).toEqual([]);
  });

  it('reports a failing healthcheck, and says nothing about one still starting', () => {
    const failing = container({ name: 'api', health: 'unhealthy' });
    const starting = container({ name: 'db', health: 'starting' });
    const none = container({ name: 'worker', health: 'none' });

    const items = attentionItems([failing, starting, none], []);
    expect(ids(items)).toEqual([`unhealthy:${failing.full_id}`]);
    expect(items[0]?.severity).toBe('critical');
    expect(items[0]?.containerId).toBe(failing.full_id);
  });

  it('reports a dead container', () => {
    const dead = container({ name: 'ghost', state: 'dead' });
    const items = attentionItems([dead], []);
    expect(ids(items)).toEqual([`dead:${dead.full_id}`]);
    expect(items[0]?.severity).toBe('critical');
  });

  it('reports an exit only when the code says it failed', () => {
    const failed = container({ name: 'importer', state: 'exited', exit_code: 137 });
    const finished = container({ name: 'backup', state: 'exited', exit_code: 0 });
    // A batch job that finished cleanly is not an incident, and an exit nobody
    // recorded a code for is an exit nobody knows anything about.
    const unrecorded = container({ name: 'unknown', state: 'exited', exit_code: undefined });

    const items = attentionItems([failed, finished, unrecorded], []);
    expect(ids(items)).toEqual([`exit:${failed.full_id}`]);
    expect(items[0]?.detail).toContain('137');
  });

  it('reports repeated restarts only once the named threshold is reached', () => {
    const below = container({ name: 'fine', restart_count: RESTART_COUNT_WARNING - 1 });
    expect(attentionItems([below], [])).toEqual([]);

    const at = container({ name: 'flapping', restart_count: RESTART_COUNT_WARNING });
    const atItems = attentionItems([at], []);
    expect(ids(atItems)).toEqual([`restarts:${at.full_id}`]);
    expect(atItems[0]?.severity).toBe('warning');
    expect(atItems[0]?.detail).toContain(String(RESTART_COUNT_WARNING));

    const looping = container({ name: 'looping', restart_count: RESTART_COUNT_CRITICAL });
    expect(attentionItems([looping], [])[0]?.severity).toBe('critical');
  });

  it('says nothing about memory when the container was not sampled', () => {
    const limited = container({ name: 'api', memory_limit_mb: 512 });
    expect(attentionItems([limited], [])).toEqual([]);
  });

  it('says nothing about memory when the container has no limit of its own', () => {
    // The sample carries a limit, but it is the machine's memory rather than a
    // ceiling anybody set for this container, so there is no percentage to
    // report and nothing to warn about.
    const unlimited = container({ name: 'cache', memory_limit_mb: undefined });
    const stats = [
      stat({ container_id: unlimited.full_id, memory_used_mb: 63_000, memory_limit_mb: 64_000 }),
    ];
    expect(attentionItems([unlimited], stats)).toEqual([]);
  });

  it('reports memory pressure against the limit the Operator actually set', () => {
    const limited = container({ name: 'api', memory_limit_mb: 512 });
    const comfortable = [stat({ container_id: limited.full_id, memory_used_mb: 256 })];
    expect(attentionItems([limited], comfortable)).toEqual([]);

    const near = [stat({ container_id: limited.full_id, memory_used_mb: 470 })];
    const nearItems = attentionItems([limited], near);
    expect(ids(nearItems)).toEqual([`memory:${limited.full_id}`]);
    expect(nearItems[0]?.severity).toBe('warning');
    expect(nearItems[0]?.detail).toContain('512 MB');

    const atLimit = [stat({ container_id: limited.full_id, memory_used_mb: 508 })];
    expect(attentionItems([limited], atLimit)[0]?.severity).toBe('critical');
  });

  it('sits exactly on the named memory threshold rather than near it', () => {
    const limited = container({ name: 'api', memory_limit_mb: 1_000 });
    const justUnder = [stat({ container_id: limited.full_id, memory_used_mb: 899 })];
    const exactly = [
      stat({ container_id: limited.full_id, memory_used_mb: MEMORY_NEAR_LIMIT_PERCENT * 10 }),
    ];
    expect(attentionItems([limited], justUnder)).toEqual([]);
    expect(attentionItems([limited], exactly)).toHaveLength(1);
  });

  it('never says anything about CPU, however busy a container is', () => {
    const busy = container({ name: 'render' });
    const items = attentionItems([busy], [stat({ container_id: busy.full_id, cpu_percent: 400 })]);
    // Busy is not broken. There is no CPU figure that makes a container a fault.
    expect(items).toEqual([]);
  });

  it('passes the daemon warnings through in Docker own words', () => {
    const items = attentionItems(
      [],
      [],
      overview({
        daemon: { available: true, warnings: ['No swap limit support'] },
      }),
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.severity).toBe('info');
    expect(items[0]?.detail).toBe('No swap limit support');
    expect(items[0]?.containerId).toBeUndefined();
  });

  it('reports reclaimable disk only above the named threshold', () => {
    const under = overview({
      disk: {
        ...overview().disk,
        images_reclaimable_bytes: RECLAIMABLE_DISK_WARNING_BYTES - 1,
      },
    });
    expect(attentionItems([], [], under)).toEqual([]);

    const over = overview({
      disk: {
        ...overview().disk,
        images_reclaimable_bytes: RECLAIMABLE_DISK_WARNING_BYTES / 2,
        build_cache_reclaimable_bytes: RECLAIMABLE_DISK_WARNING_BYTES / 2,
      },
    });
    const items = attentionItems([], [], over);
    expect(ids(items)).toEqual(['reclaimable:disk']);
    expect(items[0]?.severity).toBe('info');
    expect(items[0]?.title).toContain('5.0 GB');
  });

  it('says nothing about disk when no overview was loaded yet', () => {
    // A screen that has containers but not the overview must not be told about
    // a disk nobody has measured.
    expect(attentionItems([container({ health: 'unhealthy' })], [], null)).toHaveLength(1);
    expect(attentionItems([container({ health: 'unhealthy' })], [], null)[0]?.id).toContain(
      'unhealthy:',
    );
  });

  it('orders the loudest first and keeps the order stable within a severity', () => {
    const dead = container({ name: 'gone', state: 'dead' });
    const exited = container({ name: 'importer', state: 'exited', exit_code: 2 });
    const flapping = container({ name: 'flapping', restart_count: RESTART_COUNT_WARNING });

    const items = attentionItems(
      [exited, flapping, dead],
      [],
      overview({ daemon: { available: true, warnings: ['No swap limit support'] } }),
    );

    expect(items.map((item) => item.severity)).toEqual(['critical', 'warning', 'warning', 'info']);
    expect(ids(items)).toEqual([
      `dead:${dead.full_id}`,
      `exit:${exited.full_id}`,
      `restarts:${flapping.full_id}`,
      'daemon:0',
    ]);
  });

  it('gives every item an id that stays the same across a refresh', () => {
    const failing = container({ name: 'api', health: 'unhealthy' });
    const first = attentionItems([failing], []);
    const second = attentionItems([failing], []);
    expect(ids(first)).toEqual(ids(second));
    expect(new Set(ids(first)).size).toBe(first.length);
  });
});

describe('memory pressure as a number', () => {
  it('is null without a sample and null without a declared limit', () => {
    const limited = container({ memory_limit_mb: 512 });
    expect(memoryPressurePercent(limited, undefined)).toBeNull();
    expect(
      memoryPressurePercent(
        container({ memory_limit_mb: undefined }),
        stat({ container_id: 'x', memory_used_mb: 400 }),
      ),
    ).toBeNull();
    expect(
      memoryPressurePercent(
        container({ memory_limit_mb: 0 }),
        stat({ container_id: 'x', memory_used_mb: 400 }),
      ),
    ).toBeNull();
  });

  it('is the share of the container own limit', () => {
    expect(
      memoryPressurePercent(
        container({ memory_limit_mb: 512 }),
        stat({ container_id: 'x', memory_used_mb: 128 }),
      ),
    ).toBe(25);
  });
});

describe('writing numbers a person reads', () => {
  it('formats bytes in binary units, matching the rest of the app', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe('5.0 GB');
  });

  it('does not print a negative or unreadable size', () => {
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });

  it('writes an uptime as two units at most, largest first', () => {
    expect(formatUptime(45)).toBe('45s');
    expect(formatUptime(90)).toBe('1m');
    expect(formatUptime(3_600)).toBe('1h');
    expect(formatUptime(3_600 + 900)).toBe('1h 15m');
    expect(formatUptime(3 * 86_400 + 4 * 3_600)).toBe('3d 4h');
    expect(formatUptime(2 * 86_400)).toBe('2d');
  });
});
