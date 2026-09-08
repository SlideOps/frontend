import type {
  DockerContainer,
  DockerContainerState,
  DockerHealth,
  DockerOverview,
  DockerOwnership,
  DockerStats,
} from '@slideops/api-client';

/*
 * How a Node's containers read on the Docker control centre.
 *
 * Pure, so the rules about what is worth an Operator's attention live in one
 * testable place rather than being spread through markup where nobody can
 * assert them. The screen renders; this file decides.
 *
 * One rule governs everything below: nothing is stated that the data does not
 * establish. A container with no live sample has no CPU figure, not a CPU
 * figure of zero. A container with no memory limit is not at ninety percent of
 * anything. A filter that needs numbers we were not given returns nothing
 * rather than guessing. Every observation this file makes must be traceable to
 * a field the daemon actually reported, because an infrastructure tool that
 * invents a fact once is never trusted about a real one again.
 */

/* ------------------------------------------------------------------ *
 * Thresholds
 *
 * Every number a rule turns on is named here with the reason it is that
 * number, so it can be argued with instead of being discovered in a
 * comparison halfway down the file.
 * ------------------------------------------------------------------ */

/**
 * Restarts before a container is worth mentioning.
 *
 * A restart policy is meant to fire: a container that came back after a host
 * reboot or a transient dependency failure is working as intended, and a
 * handful over a container's life is ordinary churn. Five is where the pattern
 * stops looking like bad luck and starts looking like a process that will not
 * stay up on its own.
 */
export const RESTART_COUNT_WARNING = 5;

/**
 * Restarts that mean the container is in a loop rather than having a bad week.
 *
 * Docker's default backoff reaches roughly a minute between attempts, so twenty
 * restarts is not something that accumulates quietly in the background. It is a
 * crash loop, and it is the loudest thing on the page.
 */
export const RESTART_COUNT_CRITICAL = 20;

/**
 * Where memory use against a container's own limit becomes worth saying.
 *
 * Below ninety percent a container is simply using the memory it was given, and
 * flagging that would train an Operator to ignore this list. Above it, the
 * remaining headroom is smaller than a normal allocation spike.
 */
export const MEMORY_NEAR_LIMIT_PERCENT = 90;

/**
 * Where memory use stops being a warning and becomes an imminent kill.
 *
 * At ninety-eight percent of its own cgroup limit a container is one allocation
 * from being OOM killed by the kernel, which happens without warning and looks
 * to everyone downstream like the process crashed for no reason.
 */
export const MEMORY_AT_LIMIT_PERCENT = 98;

/**
 * Reclaimable disk worth telling an Operator about, in bytes.
 *
 * Docker accumulates dangling images and build cache as a matter of course, so
 * a few hundred megabytes is noise on any server that has built anything. Five
 * gibibytes is a meaningful share of the small disks these servers usually
 * have, and is enough to be the difference between a deploy that fits and one
 * that fills the disk.
 */
export const RECLAIMABLE_DISK_WARNING_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * The CPU share at which the "high CPU" filter includes a container.
 *
 * Deliberately a browsing aid and not a verdict: busy is not broken, and this
 * threshold appears in no attention item. Eighty percent of a core is where a
 * container is doing enough work to be the one an Operator is looking for.
 */
export const HIGH_CPU_PERCENT = 80;

/**
 * The share of its own memory limit at which the "high memory" filter includes
 * a container. Lower than {@link MEMORY_NEAR_LIMIT_PERCENT} on purpose: finding
 * the heavy containers is a wider question than being warned about one.
 */
export const HIGH_MEMORY_PERCENT = 80;

/**
 * How recently a container must have been created to count as recent, in
 * seconds. An hour answers "what did I just start" without turning the filter
 * into a day of history, which the created column already shows.
 */
export const RECENTLY_CREATED_SECONDS = 60 * 60;

/**
 * How recently a container must have started to count as recently restarted, in
 * seconds. The same hour, for the same reason: this filter exists to find what
 * moved while the Operator was looking at something else.
 */
export const RECENTLY_RESTARTED_SECONDS = 60 * 60;

/* ------------------------------------------------------------------ *
 * Reading one container
 * ------------------------------------------------------------------ */

/** Every container state, in the order a summary lists them. */
export const CONTAINER_STATES: readonly DockerContainerState[] = [
  'running',
  'restarting',
  'paused',
  'created',
  'exited',
  'dead',
];

/** Every ownership answer, including the honest "nobody could tell". */
export const CONTAINER_OWNERSHIPS: readonly DockerOwnership[] = ['slideops', 'external', 'unknown'];

/** Every healthcheck verdict, including "the image declares no check". */
export const CONTAINER_HEALTHS: readonly DockerHealth[] = [
  'healthy',
  'unhealthy',
  'starting',
  'none',
];

/**
 * Index live samples by the container they belong to, so a lookup per container
 * is not a scan of the whole list.
 */
export function indexStats(stats: DockerStats[]): Map<string, DockerStats> {
  const index = new Map<string, DockerStats>();
  for (const stat of stats) {
    index.set(stat.container_id, stat);
  }
  return index;
}

/**
 * The sample for one container, or undefined when it has none.
 *
 * Undefined is a real answer and callers must keep it: a container that was not
 * sampled, because it is not running or because the sampling pass had not
 * finished, has no CPU or memory figure at all. Substituting zero would state
 * that a stopped container is using no memory, which is true, and that a
 * running one is idle, which is a guess.
 *
 * The full id is what the backend keys samples by; the short id is tried after
 * it because it costs nothing and a daemon reporting the short form would
 * otherwise silently produce a page with no numbers on it.
 */
export function statFor(
  container: DockerContainer,
  stats: Map<string, DockerStats>,
): DockerStats | undefined {
  return stats.get(container.full_id) ?? stats.get(container.id);
}

/**
 * How long the container has been up, in seconds, or null when that question
 * has no answer.
 *
 * Null for anything not running, and for a running container the daemon gave no
 * start time. A stopped container has no uptime; showing it as zero seconds
 * reads as "just started", which is the opposite of what happened.
 */
export function uptimeSeconds(container: DockerContainer, now: Date = new Date()): number | null {
  if (container.state !== 'running' || !container.started_at) {
    return null;
  }
  const started = Date.parse(container.started_at);
  if (Number.isNaN(started)) {
    return null;
  }
  // A start time slightly in the future is clock skew between this browser and
  // the server, not a container that starts later. Zero is the honest reading.
  return Math.max(0, Math.floor((now.getTime() - started) / 1000));
}

/**
 * Memory use as a percentage of the container's own declared limit, or null
 * when there is no percentage to be had.
 *
 * Requires both a live sample and a limit the Operator actually set. The
 * daemon reports the whole machine's memory as the ceiling for a container that
 * has no limit of its own, so reading a percentage off the sample alone would
 * quietly turn "this server has 64 GB" into "this container is fine", and would
 * put a well behaved cache at the top of a list about memory pressure.
 */
export function memoryPressurePercent(
  container: DockerContainer,
  stat: DockerStats | undefined,
): number | null {
  const limit = container.memory_limit_mb;
  if (!stat || typeof limit !== 'number' || limit <= 0) {
    return null;
  }
  return (stat.memory_used_mb / limit) * 100;
}

/* ------------------------------------------------------------------ *
 * Searching
 * ------------------------------------------------------------------ */

/**
 * Free text search across everything an Operator might recognise a container
 * by: its name and either form of its id, the image it runs, the Compose
 * project and service it belongs to, a port it publishes, a network it is on,
 * and any label key or value.
 *
 * Labels are searchable because they are where a team's own vocabulary lives --
 * an owner, a stack, a ticket number -- and they are the only field on a
 * container that SlideOps did not choose the meaning of.
 *
 * Only published ports are matched. An Operator searching a port number is
 * looking for the thing answering on it; returning a container whose internal
 * port happens to be that number would point them at something nothing can
 * reach there.
 *
 * An empty query is not a filter. It returns everything, rather than nothing.
 */
export function searchContainers(containers: DockerContainer[], query: string): DockerContainer[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...containers];
  }
  return containers.filter((container) => containerHaystack(container).includes(needle));
}

function containerHaystack(container: DockerContainer): string {
  const parts: string[] = [
    container.name,
    container.id,
    container.full_id,
    container.image,
    container.compose_project ?? '',
    container.compose_service ?? '',
    ...container.networks,
  ];
  for (const port of container.ports) {
    if (typeof port.host_port === 'number') {
      parts.push(String(port.host_port));
    }
  }
  for (const [key, value] of Object.entries(container.labels)) {
    parts.push(key, value);
  }
  return parts.join('\n').toLowerCase();
}

/* ------------------------------------------------------------------ *
 * Filtering
 * ------------------------------------------------------------------ */

/**
 * What a filter needs that a container cannot answer on its own.
 *
 * Stats are passed rather than fetched or assumed, so a filter that depends on
 * live numbers is visibly a filter that depends on live numbers. `now` is
 * passed for the same reason a pure function always takes its clock: so a test
 * can state exactly what "recently" meant.
 */
export interface ContainerFilterContext {
  stats?: DockerStats[];
  now?: Date;
}

/**
 * Which containers to show. Every field is optional; an omitted field is not a
 * constraint. Fields combine with AND, values inside one field with OR, which
 * is what a set of checkboxes over one column means.
 */
export interface ContainerFilter {
  states?: DockerContainerState[];
  ownership?: DockerOwnership[];
  health?: DockerHealth[];
  /** The exact Compose project name. Containers outside Compose never match. */
  composeProject?: string;
  /** Matched as a substring, so a repository matches all of its tags. */
  image?: string;
  /** The exact network name, as Docker reports it. */
  network?: string;
  /** Needs stats. Without them nothing matches, because nothing is known. */
  highCpu?: boolean;
  /** Needs stats and a declared memory limit. See memoryPressurePercent. */
  highMemory?: boolean;
  recentlyCreated?: boolean;
  recentlyRestarted?: boolean;
}

/**
 * Apply the filter.
 *
 * The derived predicates fail closed. Asked for high CPU containers with no
 * stats to read, this returns none rather than all: the question was which
 * containers are busy, and with no samples the honest answer is that we cannot
 * name one. Returning everything would present the whole list as an answer to a
 * question nobody could answer.
 */
export function filterContainers(
  containers: DockerContainer[],
  filter: ContainerFilter,
  context: ContainerFilterContext = {},
): DockerContainer[] {
  const stats = indexStats(context.stats ?? []);
  const now = context.now ?? new Date();
  const nowMs = now.getTime();

  return containers.filter((container) => {
    if (filter.states && filter.states.length > 0 && !filter.states.includes(container.state)) {
      return false;
    }
    if (
      filter.ownership &&
      filter.ownership.length > 0 &&
      !filter.ownership.includes(container.ownership)
    ) {
      return false;
    }
    if (filter.health && filter.health.length > 0 && !filter.health.includes(container.health)) {
      return false;
    }
    if (filter.composeProject && container.compose_project !== filter.composeProject) {
      return false;
    }
    if (filter.image && !container.image.toLowerCase().includes(filter.image.toLowerCase())) {
      return false;
    }
    if (filter.network && !container.networks.includes(filter.network)) {
      return false;
    }
    if (filter.highCpu) {
      const stat = statFor(container, stats);
      if (!stat || stat.cpu_percent < HIGH_CPU_PERCENT) {
        return false;
      }
    }
    if (filter.highMemory) {
      const percent = memoryPressurePercent(container, statFor(container, stats));
      if (percent === null || percent < HIGH_MEMORY_PERCENT) {
        return false;
      }
    }
    if (
      filter.recentlyCreated &&
      !withinSeconds(container.created_at, nowMs, RECENTLY_CREATED_SECONDS)
    ) {
      return false;
    }
    if (filter.recentlyRestarted && !recentlyRestarted(container, nowMs)) {
      return false;
    }
    return true;
  });
}

/**
 * Whether an ISO timestamp is inside the window ending now.
 *
 * A timestamp that will not parse is not recent. It is unreadable, and the two
 * must not collapse into each other.
 */
function withinSeconds(iso: string | undefined, nowMs: number, seconds: number): boolean {
  if (!iso) {
    return false;
  }
  const when = Date.parse(iso);
  if (Number.isNaN(when)) {
    return false;
  }
  const age = nowMs - when;
  // A timestamp in the future is clock skew rather than a future event, so it
  // counts as recent instead of falling outside the window entirely.
  return age <= seconds * 1000;
}

/**
 * Whether the container restarted lately.
 *
 * Two pieces of evidence, both required: it has restarted at least once in its
 * life, and its current run began inside the window. Either alone is a
 * different fact. A container that restarted twenty times last month is not
 * something that just happened, and a container that started an hour ago having
 * never restarted is simply a container that was deployed an hour ago.
 *
 * A container Docker is actively restarting counts on its own, because that is
 * happening now whatever the timestamps say.
 */
function recentlyRestarted(container: DockerContainer, nowMs: number): boolean {
  if (container.state === 'restarting') {
    return true;
  }
  if (container.restart_count < 1) {
    return false;
  }
  return withinSeconds(container.started_at, nowMs, RECENTLY_RESTARTED_SECONDS);
}

/* ------------------------------------------------------------------ *
 * Sorting
 * ------------------------------------------------------------------ */

export type ContainerSortField =
  'name' | 'state' | 'cpu' | 'memory' | 'uptime' | 'created' | 'restarts';

export interface ContainerSort {
  field: ContainerSortField;
  direction: 'asc' | 'desc';
}

/**
 * How loudly a state asks to be looked at.
 *
 * Sorting by state alphabetically would put "created" above "dead", which is
 * exactly backwards for a page whose job is to surface trouble. Ascending is
 * therefore worst first, and the order is a judgement about attention: dead
 * containers are gone, restarting ones are failing right now, exited ones
 * stopped, paused ones were stopped deliberately, created ones never ran, and
 * running ones are fine.
 */
const stateRank: Record<DockerContainerState, number> = {
  dead: 0,
  restarting: 1,
  exited: 2,
  paused: 3,
  created: 4,
  running: 5,
};

/**
 * Sort containers, keeping containers we know nothing about at the end.
 *
 * The sort key for a container with no CPU sample, no memory sample, or no
 * uptime is null, and null sorts last in both directions. This is the whole
 * point of the function: a container with no sample must never sit at the top
 * of an ascending CPU sort as though it were measured at zero, nor imply it was
 * measured at all. Ties keep their original order, so a stable input produces a
 * stable page.
 */
export function sortContainers(
  containers: DockerContainer[],
  sort: ContainerSort,
  stats?: DockerStats[],
): DockerContainer[] {
  const index = indexStats(stats ?? []);
  const direction = sort.direction === 'desc' ? -1 : 1;

  const decorated = containers.map((container, position) => ({
    container,
    position,
    key: sortKey(container, sort.field, index),
  }));

  decorated.sort((left, right) => {
    // Missing keys are not small values, they are absent ones, so they leave
    // the ordering entirely and land at the end whichever way it points.
    if (left.key === null || right.key === null) {
      if (left.key === right.key) {
        return left.position - right.position;
      }
      return left.key === null ? 1 : -1;
    }
    if (typeof left.key === 'string' && typeof right.key === 'string') {
      const compared = left.key.localeCompare(right.key);
      return compared === 0 ? left.position - right.position : compared * direction;
    }
    const compared = Number(left.key) - Number(right.key);
    return compared === 0 ? left.position - right.position : Math.sign(compared) * direction;
  });

  return decorated.map((entry) => entry.container);
}

function sortKey(
  container: DockerContainer,
  field: ContainerSortField,
  stats: Map<string, DockerStats>,
): string | number | null {
  switch (field) {
    case 'name':
      return container.name.toLowerCase();
    case 'state':
      return stateRank[container.state];
    case 'restarts':
      return container.restart_count;
    case 'cpu':
      return statFor(container, stats)?.cpu_percent ?? null;
    case 'memory':
      return statFor(container, stats)?.memory_used_mb ?? null;
    case 'created':
      return timestampKey(container.created_at);
    case 'uptime':
      // Uptime orders identically to start time reversed, so it needs no clock:
      // the container that started longest ago has been up longest. Only a
      // running container has an uptime at all.
      if (container.state !== 'running') {
        return null;
      }
      return negated(timestampKey(container.started_at));
  }
}

function timestampKey(iso: string | undefined): number | null {
  if (!iso) {
    return null;
  }
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? null : parsed;
}

function negated(value: number | null): number | null {
  return value === null ? null : -value;
}

/* ------------------------------------------------------------------ *
 * Summarising
 * ------------------------------------------------------------------ */

/**
 * The tallies behind the header of the page.
 *
 * Every state, ownership and health value gets a key even when it is zero, so a
 * screen can render a fixed set of figures instead of a set that changes shape
 * with the data.
 */
export interface ContainerSummary {
  total: number;
  byState: Record<DockerContainerState, number>;
  byOwnership: Record<DockerOwnership, number>;
  byHealth: Record<DockerHealth, number>;
}

/** Count the containers by state, by who put them there, and by health. */
export function summarise(containers: DockerContainer[]): ContainerSummary {
  const byState = zeroed(CONTAINER_STATES);
  const byOwnership = zeroed(CONTAINER_OWNERSHIPS);
  const byHealth = zeroed(CONTAINER_HEALTHS);

  for (const container of containers) {
    byState[container.state] += 1;
    byOwnership[container.ownership] += 1;
    byHealth[container.health] += 1;
  }

  return { total: containers.length, byState, byOwnership, byHealth };
}

function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  const counts = {} as Record<K, number>;
  for (const key of keys) {
    counts[key] = 0;
  }
  return counts;
}

/* ------------------------------------------------------------------ *
 * Attention
 * ------------------------------------------------------------------ */

export type AttentionSeverity = 'info' | 'warning' | 'critical';

/**
 * One thing worth an Operator's attention, each traceable to a field the daemon
 * reported. `containerId` is the full id, so a screen can link straight to the
 * container the observation is about; it is absent on observations about the
 * Node as a whole.
 */
export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  title: string;
  detail: string;
  containerId?: string;
}

const severityRank: Record<AttentionSeverity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * What is worth saying about this Node's Docker right now.
 *
 * This is the one function in this file where being wrong costs trust rather
 * than a redraw, so it follows a single rule without exception: if the data to
 * judge something is absent, it says nothing. Not a hedge, not a maybe, nothing.
 *
 * Concretely, what is deliberately never emitted:
 *
 * - Nothing about CPU. A busy container is a container doing its job, and there
 *   is no threshold at which "using CPU" becomes a fault worth interrupting
 *   somebody over.
 * - Nothing about memory for a container with no limit of its own, because
 *   there is no ceiling to be near and the daemon's reported ceiling is the
 *   whole machine.
 * - Nothing about a container that exited cleanly, or whose exit code the
 *   daemon did not report. A batch job that finished is not an incident, and an
 *   unknown exit code is unknown.
 * - Nothing about a healthcheck still in its starting grace period, which has
 *   not failed and may never.
 * - Nothing derived from an average, a trend, or a comparison with other
 *   Operators. There is one sample in hand and it says what it says.
 *
 * The daemon's own warnings are passed through verbatim, because they are
 * Docker reporting on itself and are the least invented thing on the page.
 */
export function attentionItems(
  containers: DockerContainer[],
  stats: DockerStats[],
  overview?: DockerOverview | null,
): AttentionItem[] {
  const index = indexStats(stats);
  const items: AttentionItem[] = [];

  for (const container of containers) {
    const name = container.name;

    // A failing healthcheck is the image's own author saying this container is
    // not working, which outranks anything inferred from the outside.
    if (container.health === 'unhealthy') {
      items.push({
        id: `unhealthy:${container.full_id}`,
        severity: 'critical',
        title: `${name} is failing its healthcheck`,
        detail: `Docker reports this container as unhealthy. Its own healthcheck is failing, so it may be running without being able to serve. Docker's status line reads "${container.status_text}".`,
        containerId: container.full_id,
      });
    }

    if (container.state === 'dead') {
      items.push({
        id: `dead:${container.full_id}`,
        severity: 'critical',
        title: `${name} is dead`,
        detail:
          'Docker could not stop or remove this container cleanly and has marked it dead. It is not running and will not start again in this state.',
        containerId: container.full_id,
      });
    }

    // Only a non-zero code is evidence of a failure. Zero is a clean stop, and
    // an absent code is a container Docker told us nothing about.
    if (
      container.state === 'exited' &&
      typeof container.exit_code === 'number' &&
      container.exit_code !== 0
    ) {
      items.push({
        id: `exit:${container.full_id}`,
        severity: 'warning',
        title: `${name} stopped with an error`,
        detail: `This container exited with code ${container.exit_code}. Its logs cover what happened before it stopped.`,
        containerId: container.full_id,
      });
    }

    if (container.restart_count >= RESTART_COUNT_WARNING) {
      const critical = container.restart_count >= RESTART_COUNT_CRITICAL;
      items.push({
        id: `restarts:${container.full_id}`,
        severity: critical ? 'critical' : 'warning',
        title: critical
          ? `${name} is restarting in a loop`
          : `${name} has restarted ${container.restart_count} times`,
        detail: `Docker has restarted this container ${container.restart_count} times under the "${container.restart_policy}" policy. A container that keeps coming back is a process that keeps stopping.`,
        containerId: container.full_id,
      });
    }

    const memoryPercent = memoryPressurePercent(container, statFor(container, index));
    if (memoryPercent !== null && memoryPercent >= MEMORY_NEAR_LIMIT_PERCENT) {
      const atLimit = memoryPercent >= MEMORY_AT_LIMIT_PERCENT;
      items.push({
        id: `memory:${container.full_id}`,
        severity: atLimit ? 'critical' : 'warning',
        title: atLimit ? `${name} is at its memory limit` : `${name} is close to its memory limit`,
        detail: `This container is using ${Math.round(memoryPercent)}% of the ${container.memory_limit_mb} MB limit set for it. A container that reaches its limit is killed by the kernel without warning.`,
        containerId: container.full_id,
      });
    }
  }

  if (overview) {
    for (const [position, warning] of overview.daemon.warnings.entries()) {
      items.push({
        id: `daemon:${position}`,
        severity: 'info',
        title: 'Docker reported a warning about this server',
        // Verbatim. It is the daemon's own sentence about its own configuration,
        // and rewording it would put words in Docker's mouth.
        detail: warning,
      });
    }

    const reclaimable = reclaimableBytes(overview);
    if (reclaimable >= RECLAIMABLE_DISK_WARNING_BYTES) {
      items.push({
        id: 'reclaimable:disk',
        severity: 'info',
        title: `${formatBytes(reclaimable)} of disk can be reclaimed`,
        detail: `Docker is holding ${formatBytes(reclaimable)} in unused images, stopped containers, unused volumes and build cache. Nothing running depends on it, and the Operator can choose to release it.`,
      });
    }
  }

  // Sorted by how loudly each item asks to be read, and by input order within a
  // severity, so the same data always produces the same page.
  return items
    .map((item, position) => ({ item, position }))
    .sort(
      (left, right) =>
        severityRank[left.item.severity] - severityRank[right.item.severity] ||
        left.position - right.position,
    )
    .map((entry) => entry.item);
}

/** What Docker says it could release, added up across all four accounts. */
export function reclaimableBytes(overview: DockerOverview): number {
  const disk = overview.disk;
  return (
    disk.images_reclaimable_bytes +
    disk.containers_reclaimable_bytes +
    disk.volumes_reclaimable_bytes +
    disk.build_cache_reclaimable_bytes
  );
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

const BYTES_PER_UNIT = 1024;
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

/**
 * Bytes as something a person reads.
 *
 * Binary units, matching how the rest of this app reports memory and disk. A
 * server's memory is quoted in binary units everywhere else in the product, and
 * two different meanings of "GB" on one page is worse than either meaning.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  let value = bytes;
  let unit = 0;
  while (value >= BYTES_PER_UNIT && unit < BYTE_UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unit += 1;
  }
  // Whole bytes are always whole; everything above them reads better rounded,
  // and a tenth of a gigabyte is more precision than any decision needs.
  const text = unit === 0 ? String(Math.round(value)) : value.toFixed(1);
  return `${text} ${BYTE_UNITS[unit]}`;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;

/**
 * An uptime in seconds as a duration.
 *
 * Two units at most, largest first. "3d 4h" is what somebody wants from a
 * glance at a container list; the minutes inside a three day uptime are noise,
 * and the seconds inside a three minute one are not.
 */
export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < SECONDS_PER_MINUTE) {
    const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
    return `${whole}s`;
  }
  if (seconds < SECONDS_PER_HOUR) {
    return `${Math.floor(seconds / SECONDS_PER_MINUTE)}m`;
  }
  if (seconds < SECONDS_PER_DAY) {
    const hours = Math.floor(seconds / SECONDS_PER_HOUR);
    const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}
