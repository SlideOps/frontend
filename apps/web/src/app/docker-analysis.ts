import type {
  DockerContainer,
  DockerContainerState,
  DockerCrashAnalysis,
  DockerImage,
  DockerNetwork,
  DockerOverview,
  DockerStats,
  DockerVolume,
  Facts,
} from '@slideops/api-client';
import { indexStats, statFor } from './docker-inventory';

/*
 * The four questions this file answers, for the Docker control centre:
 * which containers are using the most of something, how much of the Node
 * Docker has taken, what depends on what, and what Docker recorded about a
 * container that keeps failing.
 *
 * Pure, and held to exactly the standard docker-inventory.ts sets: nothing is
 * stated that the data does not establish.
 *
 * That rule has three specific consequences here, and every one of them was a
 * deliberate choice against an easier alternative:
 *
 * - A container with no live sample is not ranked at zero. It is excluded from
 *   the ranking and counted, so the screen can say how many containers it could
 *   not see. A ranking that quietly pads itself with unmeasured containers is a
 *   ranking that answers a different question than the one it is labelled with.
 * - Allocated and used are never added together or substituted for each other.
 *   A container with no limit consumes real CPU and memory while reserving
 *   nothing, so it appears in one figure and not the other, and the count of
 *   such containers travels with the summary so a screen can say so.
 * - Where a denominator does not exist -- an undiscovered Node has no core
 *   count, an unread disk has no size -- the total is null and stays null. It
 *   is never the largest value seen, never the sum of the parts, and never
 *   100%.
 *
 * Nothing here decides *why* anything happened. crashEvidence arranges what the
 * backend reported; it adds no verdict of its own, because the one thing worse
 * than not knowing why a container died is being told a confident wrong answer.
 */

/* ------------------------------------------------------------------ *
 * Rankings
 * ------------------------------------------------------------------ */

/**
 * How many containers a ranking names.
 *
 * Five, because a ranking is a way of asking "where is it going" and the
 * answer stops being useful once it becomes another list of everything. A
 * server with forty containers has a handful worth looking at first; if the
 * sixth matters, the sortable container list is one tab away and is the right
 * tool for reading all of them.
 */
export const RANKING_TOP_N = 5;

/** One container in a ranking, with the reading it was ranked on. */
export interface CpuRankEntry {
  container: DockerContainer;
  /** Percent of one core, as Docker reports it: 200 means two cores' worth. */
  cpuPercent: number;
}

export interface MemoryRankEntry {
  container: DockerContainer;
  memoryUsedMb: number;
  /** The ceiling the Operator set, or null when they set none. */
  limitMb: number | null;
  /** Use against that ceiling, or null when there is no ceiling to measure against. */
  percentOfLimit: number | null;
}

export interface RestartRankEntry {
  container: DockerContainer;
  restarts: number;
}

/**
 * A ranking, with the honesty attached rather than left to the caller.
 *
 * `excluded` is the whole reason this is an object and not an array: a screen
 * showing three containers out of twenty must be able to say that seventeen
 * had no live sample, or the Operator reads the three as the complete answer.
 */
export interface Ranking<T> {
  /** Highest first, at most the limit asked for. */
  top: T[];
  /** How many containers could be ranked at all. */
  ranked: number;
  /** How many were left out because there was nothing to rank them by. */
  excluded: number;
}

/** Sort a decorated list highest first, keeping equal readings in input order. */
function highestFirst<T>(entries: { entry: T; value: number; position: number }[]): T[] {
  return entries
    .sort((left, right) => right.value - left.value || left.position - right.position)
    .map((decorated) => decorated.entry);
}

/**
 * The containers using the most CPU.
 *
 * A container with no live sample is excluded, never ranked as zero. It is the
 * single most important line in this file: the sampling pass covers running
 * containers, so treating an unsampled container as idle would state that a
 * container nobody measured is doing nothing, and would rank a busy container
 * whose sample simply had not arrived below a stopped one.
 */
export function rankByCpu(
  containers: DockerContainer[],
  stats: DockerStats[],
  limit: number = RANKING_TOP_N,
): Ranking<CpuRankEntry> {
  const index = indexStats(stats);
  const decorated: { entry: CpuRankEntry; value: number; position: number }[] = [];
  let excluded = 0;

  containers.forEach((container, position) => {
    const stat = statFor(container, index);
    if (!stat) {
      excluded += 1;
      return;
    }
    decorated.push({
      entry: { container, cpuPercent: stat.cpu_percent },
      value: stat.cpu_percent,
      position,
    });
  });

  return { top: highestFirst(decorated).slice(0, limit), ranked: decorated.length, excluded };
}

/**
 * The containers using the most memory.
 *
 * Ranked on megabytes actually in use, not on percentage of a limit. Docker
 * reports the whole machine's memory as the ceiling for a container with no
 * limit of its own, so ranking on percentage would sort by who happens to have
 * set a small limit rather than by who is holding the memory. The percentage
 * rides along only where the Operator set a real ceiling, and is null
 * otherwise.
 */
export function rankByMemory(
  containers: DockerContainer[],
  stats: DockerStats[],
  limit: number = RANKING_TOP_N,
): Ranking<MemoryRankEntry> {
  const index = indexStats(stats);
  const decorated: { entry: MemoryRankEntry; value: number; position: number }[] = [];
  let excluded = 0;

  containers.forEach((container, position) => {
    const stat = statFor(container, index);
    if (!stat) {
      excluded += 1;
      return;
    }
    const limitMb =
      typeof container.memory_limit_mb === 'number' && container.memory_limit_mb > 0
        ? container.memory_limit_mb
        : null;
    decorated.push({
      entry: {
        container,
        memoryUsedMb: stat.memory_used_mb,
        limitMb,
        percentOfLimit: limitMb === null ? null : (stat.memory_used_mb / limitMb) * 100,
      },
      value: stat.memory_used_mb,
      position,
    });
  });

  return { top: highestFirst(decorated).slice(0, limit), ranked: decorated.length, excluded };
}

/**
 * The containers Docker has restarted most.
 *
 * The one ranking that needs no live sample: every container reports its
 * restart count, running or not, so a container that died last night and has
 * not been sampled since is still ranked here. That is the point -- it is
 * exactly the container an Operator is looking for.
 *
 * Containers that have never restarted are left out rather than listed with a
 * zero. Zero restarts is a real reading and a true one, but a top five of
 * zeroes answers no question, and on a healthy server it would fill this list
 * with containers chosen at random.
 */
export function rankByRestarts(
  containers: DockerContainer[],
  limit: number = RANKING_TOP_N,
): Ranking<RestartRankEntry> {
  const decorated: { entry: RestartRankEntry; value: number; position: number }[] = [];
  let excluded = 0;

  containers.forEach((container, position) => {
    if (container.restart_count <= 0) {
      excluded += 1;
      return;
    }
    decorated.push({
      entry: { container, restarts: container.restart_count },
      value: container.restart_count,
      position,
    });
  });

  return { top: highestFirst(decorated).slice(0, limit), ranked: decorated.length, excluded };
}

/* ------------------------------------------------------------------ *
 * Capacity
 * ------------------------------------------------------------------ */

/**
 * The states in which a container is holding the Node's resources.
 *
 * A stopped, dead or never-started container reserves nothing and uses
 * nothing, so counting its limits towards what the Node has committed would
 * inflate the reservation with containers that could not consume a byte.
 * Paused is included: a paused container's memory is still resident, it is
 * only its processes that are frozen. Restarting is included because it is
 * about to be running again and its limit is still in force.
 */
export const CONSUMING_STATES: readonly DockerContainerState[] = [
  'running',
  'restarting',
  'paused',
];

/** What the Node itself has, as far as anybody has established it. */
export interface NodeCapacity {
  /** Total CPU cores, or null when the Node has never been discovered. */
  cores: number | null;
  /** Total memory in whole MB, or null when it was never read. */
  memoryMb: number | null;
  /** The primary disk's size in bytes, or null when it was never read. */
  diskTotalBytes: number | null;
  /** How much of that disk is used, by everything on the Node, not only Docker. */
  diskUsedBytes: number | null;
  /** Which filesystem the disk figures describe, for a screen that must name it. */
  diskMount: string | null;
}

/** A Node nobody has discovered: every denominator absent, and honestly so. */
export const UNKNOWN_NODE_CAPACITY: NodeCapacity = {
  cores: null,
  memoryMb: null,
  diskTotalBytes: null,
  diskUsedBytes: null,
  diskMount: null,
};

const KB_PER_MB = 1024;
const BYTES_PER_KB = 1024;

/**
 * The Node's capacity as saved Discovery recorded it.
 *
 * Every field is optional in Facts because Discovery reports what it could
 * read, so every field is nullable here. A Facts object with no cpu section is
 * a Node whose core count nobody knows, which is a different thing from a Node
 * with no cores, and the two must not collapse into each other.
 *
 * The disk is the root filesystem when there is one, and otherwise the largest
 * -- the same choice NodeCapacity.tsx makes, for the same reason: Docker's
 * data directory lives under / on an ordinary install, and the largest disk is
 * the best guess left when it does not.
 */
export function nodeCapacityFromFacts(facts: Facts | null | undefined): NodeCapacity {
  if (!facts) {
    return UNKNOWN_NODE_CAPACITY;
  }
  const disks = (facts.disks ?? []).filter((disk) => typeof disk.size_kb === 'number');
  const root = disks.find((disk) => (disk.mount_point ?? disk.mount) === '/');
  const disk =
    root ??
    (disks.length > 0
      ? disks.reduce((largest, next) =>
          (next.size_kb ?? 0) > (largest.size_kb ?? 0) ? next : largest,
        )
      : undefined);

  return {
    cores: typeof facts.cpu?.cores === 'number' ? facts.cpu.cores : null,
    memoryMb: typeof facts.memory?.total_kb === 'number' ? facts.memory.total_kb / KB_PER_MB : null,
    diskTotalBytes: typeof disk?.size_kb === 'number' ? disk.size_kb * BYTES_PER_KB : null,
    diskUsedBytes: typeof disk?.used_kb === 'number' ? disk.used_kb * BYTES_PER_KB : null,
    diskMount: disk ? (disk.mount_point ?? disk.mount ?? null) : null,
  };
}

/**
 * One dimension of capacity, with allocated and used kept strictly apart.
 *
 * `allocated` is the sum of the ceilings the Operator set. `used` is the sum of
 * what live samples measured. They are different questions with different
 * answers, and a container can appear in one and not the other: a container
 * with no limit uses memory while reserving none, and a container Docker has
 * not sampled reserves its limit while being measured at nothing.
 *
 * `unlimited` and `unsampled` exist so a screen can say that out loud instead
 * of presenting a total that quietly undercounts.
 */
export interface CapacityDimension {
  /** The Node's ceiling, or null when nobody has established one. */
  total: number | null;
  /** The sum of container limits, across containers that have one. */
  allocated: number;
  /** How many containers contributed to `allocated`. */
  allocatedFrom: number;
  /** How many consuming containers have no limit in this dimension at all. */
  unlimited: number;
  /** The sum of live samples, or null when not one container was sampled. */
  used: number | null;
  /** How many containers contributed to `used`. */
  usedFrom: number;
  /** How many consuming containers had no live sample. */
  unsampled: number;
}

/** What Docker is holding on the Node's disk, against the disk itself. */
export interface DiskCapacity {
  /** Everything Docker accounts for, or null when the overview was not read. */
  dockerBytes: number | null;
  /** What Docker says it could release, or null when the overview was not read. */
  reclaimableBytes: number | null;
  /** The whole filesystem, or null when the Node has not been discovered. */
  totalBytes: number | null;
  /** What everything on the Node uses, Docker included, or null when unread. */
  usedBytes: number | null;
  /** The filesystem the two figures above describe. */
  mount: string | null;
}

export interface CapacitySummary {
  /** In cores: a limit of 1.5 and a sample of 0.5 are both half-cores. */
  cpu: CapacityDimension;
  /** In whole MB, matching how Docker reports both limits and samples. */
  memory: CapacityDimension;
  disk: DiskCapacity;
  /** How many containers were counted: those in a state that consumes anything. */
  counted: number;
  /** How many were skipped because a stopped container reserves nothing. */
  idle: number;
}

/** Percent of one core, as Docker reports CPU, converted to cores. */
const PERCENT_PER_CORE = 100;

/**
 * How much of the Node Docker has taken, allocated and used side by side.
 *
 * Only containers in a consuming state are counted; see CONSUMING_STATES. The
 * Node's own totals are passed in rather than read, so this stays pure and so
 * that a Node nobody has discovered produces a summary with null totals instead
 * of a summary that cannot be produced at all -- the container figures are
 * true and worth showing even when there is nothing to measure them against.
 */
export function capacitySummary(
  containers: DockerContainer[],
  stats: DockerStats[],
  node: NodeCapacity = UNKNOWN_NODE_CAPACITY,
  overview?: DockerOverview | null,
): CapacitySummary {
  const index = indexStats(stats);

  const cpu: CapacityDimension = blankDimension(node.cores);
  const memory: CapacityDimension = blankDimension(node.memoryMb);
  let cpuUsed = 0;
  let memoryUsed = 0;
  let counted = 0;
  let idle = 0;

  for (const container of containers) {
    if (!CONSUMING_STATES.includes(container.state)) {
      idle += 1;
      continue;
    }
    counted += 1;

    if (typeof container.cpu_limit_cores === 'number' && container.cpu_limit_cores > 0) {
      cpu.allocated += container.cpu_limit_cores;
      cpu.allocatedFrom += 1;
    } else {
      cpu.unlimited += 1;
    }

    if (typeof container.memory_limit_mb === 'number' && container.memory_limit_mb > 0) {
      memory.allocated += container.memory_limit_mb;
      memory.allocatedFrom += 1;
    } else {
      memory.unlimited += 1;
    }

    const stat = statFor(container, index);
    if (!stat) {
      cpu.unsampled += 1;
      memory.unsampled += 1;
      continue;
    }
    cpuUsed += stat.cpu_percent / PERCENT_PER_CORE;
    cpu.usedFrom += 1;
    memoryUsed += stat.memory_used_mb;
    memory.usedFrom += 1;
  }

  // Nothing sampled means nothing measured. A sum of no samples is zero
  // arithmetically and absent in fact, and the second is what is true.
  cpu.used = cpu.usedFrom > 0 ? cpuUsed : null;
  memory.used = memory.usedFrom > 0 ? memoryUsed : null;

  return {
    cpu,
    memory,
    disk: diskCapacity(node, overview),
    counted,
    idle,
  };
}

function blankDimension(total: number | null): CapacityDimension {
  return {
    total,
    allocated: 0,
    allocatedFrom: 0,
    unlimited: 0,
    used: null,
    usedFrom: 0,
    unsampled: 0,
  };
}

function diskCapacity(node: NodeCapacity, overview?: DockerOverview | null): DiskCapacity {
  if (!overview) {
    return {
      dockerBytes: null,
      reclaimableBytes: null,
      totalBytes: node.diskTotalBytes,
      usedBytes: node.diskUsedBytes,
      mount: node.diskMount,
    };
  }
  const disk = overview.disk;
  return {
    // Docker's own accounting, the same four accounts behind `docker system df`.
    // Added up, never estimated.
    dockerBytes:
      disk.images.bytes_total +
      disk.containers.bytes_total +
      disk.volumes.bytes_total +
      disk.build_cache.bytes_total,
    reclaimableBytes:
      disk.images.bytes_reclaimable +
      disk.containers.bytes_reclaimable +
      disk.volumes.bytes_reclaimable +
      disk.build_cache.bytes_reclaimable,
    totalBytes: node.diskTotalBytes,
    usedBytes: node.diskUsedBytes,
    mount: node.diskMount,
  };
}

/* ------------------------------------------------------------------ *
 * Relationships
 * ------------------------------------------------------------------ */

export type DockerResourceKind = 'container' | 'volume' | 'network' | 'image';

/** Which thing the questions below are being asked about. */
export interface DockerResourceRef {
  kind: DockerResourceKind;
  /** The container or volume or network name, or the image reference. */
  name: string;
}

/** One thing at the other end of a relationship. */
export interface RelatedResource {
  kind: DockerResourceKind;
  name: string;
  /** Why this is related, in a few words. */
  detail?: string;
}

/**
 * Whatever the caller has already read. Every list but the containers is
 * optional, and an absent list is reported in `notRead` rather than answered
 * as an empty one: "no volumes use this" and "nobody looked at the volumes"
 * are different sentences, and only one of them is safe to act on.
 */
export interface DockerInventory {
  containers: DockerContainer[];
  volumes?: DockerVolume[];
  networks?: DockerNetwork[];
  images?: DockerImage[];
}

export interface DockerRelationships {
  target: DockerResourceRef;
  /** Whether the named resource was in the inventory at all. */
  found: boolean;
  /** What the target depends on. */
  uses: RelatedResource[];
  /** What depends on the target: what would be affected if it went away. */
  usedBy: RelatedResource[];
  /** Related but neither above: the rest of a Compose project, for instance. */
  peers: RelatedResource[];
  /** Kinds of record that were not read, so an empty answer is not read as none. */
  notRead: DockerResourceKind[];
  /** Caveats about what this view can and cannot see. */
  notes: string[];
}

/**
 * Whether a name Docker printed on a volume or network refers to this
 * container. Docker prints the name in most places and the id in some, so all
 * three forms are matched rather than assuming one.
 */
function isContainer(container: DockerContainer, reference: string): boolean {
  return (
    container.name === reference ||
    container.id === reference ||
    container.full_id === reference ||
    // Docker's own API prefixes container names with a slash in places.
    container.name === reference.replace(/^\//, '')
  );
}

/**
 * What this container uses, and what uses this volume, network or image.
 *
 * Built from records the caller already read, which is the whole design: this
 * answers "what would break if I removed this" without a single extra request
 * to the Node, and without a graph library, because the answer is a list and a
 * list is what an Operator can act on.
 *
 * What it cannot see is stated rather than omitted. A container's bind mounts
 * and tmpfs do not appear in the volume list -- they are not Docker volumes --
 * so where the mount count exceeds the named volumes found, that difference
 * becomes a note instead of silently reading as "this container mounts one
 * thing".
 */
export function relationshipsFor(
  target: DockerResourceRef,
  inventory: DockerInventory,
): DockerRelationships {
  const notRead: DockerResourceKind[] = [];
  if (!inventory.volumes) {
    notRead.push('volume');
  }
  if (!inventory.networks) {
    notRead.push('network');
  }
  if (!inventory.images) {
    notRead.push('image');
  }

  const base: DockerRelationships = {
    target,
    found: false,
    uses: [],
    usedBy: [],
    peers: [],
    notRead,
    notes: [],
  };

  switch (target.kind) {
    case 'container':
      return containerRelationships(target, inventory, base);
    case 'volume':
      return volumeRelationships(target, inventory, base);
    case 'network':
      return networkRelationships(target, inventory, base);
    case 'image':
      return imageRelationships(target, inventory, base);
  }
}

function containerRelationships(
  target: DockerResourceRef,
  inventory: DockerInventory,
  base: DockerRelationships,
): DockerRelationships {
  const container = inventory.containers.find((candidate) => isContainer(candidate, target.name));
  if (!container) {
    return base;
  }

  const uses: RelatedResource[] = [
    { kind: 'image', name: container.image, detail: 'Runs this image' },
  ];
  for (const network of container.networks) {
    uses.push({ kind: 'network', name: network, detail: 'Attached' });
  }

  const volumes = (inventory.volumes ?? []).filter((volume) =>
    volume.containers.some((reference) => isContainer(container, reference)),
  );
  for (const volume of volumes) {
    uses.push({ kind: 'volume', name: volume.name, detail: 'Mounted' });
  }

  const peers = container.compose_project
    ? inventory.containers
        .filter(
          (candidate) =>
            candidate.compose_project === container.compose_project &&
            candidate.full_id !== container.full_id,
        )
        .map((candidate) => ({
          kind: 'container' as const,
          name: candidate.name,
          detail: `Same Compose project: ${container.compose_project}`,
        }))
    : [];

  const notes: string[] = [];
  // mount_count counts everything attached, volumes and bind mounts and tmpfs
  // alike. Only named volumes can be matched from the volume list, so the
  // difference is stated rather than left to read as "nothing else is mounted".
  if (inventory.volumes && container.mount_count > volumes.length) {
    const unnamed = container.mount_count - volumes.length;
    notes.push(
      `Docker reports ${container.mount_count} ${container.mount_count === 1 ? 'mount' : 'mounts'} on this container and ${volumes.length} named ${volumes.length === 1 ? 'volume' : 'volumes'}. The other ${unnamed} ${unnamed === 1 ? 'is a bind mount or tmpfs' : 'are bind mounts or tmpfs'}, which Inspect lists in full.`,
    );
  }

  return { ...base, found: true, uses, peers, notes };
}

function volumeRelationships(
  target: DockerResourceRef,
  inventory: DockerInventory,
  base: DockerRelationships,
): DockerRelationships {
  const volume = inventory.volumes?.find((candidate) => candidate.name === target.name);
  if (!volume) {
    return base;
  }
  return {
    ...base,
    found: true,
    usedBy: volume.containers.map((reference) =>
      resolveContainer(reference, inventory, 'Mounts this volume'),
    ),
    notes:
      volume.in_use && volume.containers.length === 0
        ? [
            // Docker can hold a volume in use without naming what holds it, which
            // is worth saying rather than reporting the volume as free.
            'Docker reports this volume as in use but named no container holding it.',
          ]
        : [],
  };
}

function networkRelationships(
  target: DockerResourceRef,
  inventory: DockerInventory,
  base: DockerRelationships,
): DockerRelationships {
  const network = inventory.networks?.find((candidate) => candidate.name === target.name);
  if (!network) {
    return base;
  }
  return {
    ...base,
    found: true,
    usedBy: network.containers.map((reference) =>
      resolveContainer(reference, inventory, 'Attached to this network'),
    ),
  };
}

function imageRelationships(
  target: DockerResourceRef,
  inventory: DockerInventory,
  base: DockerRelationships,
): DockerRelationships {
  const image = inventory.images?.find(
    (candidate) => candidate.id === target.name || imageReference(candidate) === target.name,
  );
  const reference = image ? imageReference(image) : target.name;
  const users = inventory.containers.filter(
    (container) =>
      container.image === reference ||
      container.image === target.name ||
      (image !== undefined && container.image_id === image.id),
  );

  return {
    ...base,
    found: image !== undefined,
    usedBy: users.map((container) => ({
      kind: 'container' as const,
      name: container.name,
      detail: 'Runs this image',
    })),
  };
}

/** An image's readable reference, or its id when a rebuild left it dangling. */
function imageReference(image: DockerImage): string {
  return image.repository ? `${image.repository}:${image.tag}` : image.id;
}

/**
 * Turn a name Docker printed into the container it refers to, where the
 * container list has it. A reference nothing matches is still returned, with a
 * note: the volume really does name it, and dropping it would hide a
 * dependency on a container this page could not see.
 */
function resolveContainer(
  reference: string,
  inventory: DockerInventory,
  detail: string,
): RelatedResource {
  const container = inventory.containers.find((candidate) => isContainer(candidate, reference));
  if (container) {
    return { kind: 'container', name: container.name, detail };
  }
  return {
    kind: 'container',
    name: reference,
    detail: `${detail}, and is not in this server's container list`,
  };
}

/* ------------------------------------------------------------------ *
 * Crash evidence
 * ------------------------------------------------------------------ */

export type CrashEvidenceTone = 'neutral' | 'warning' | 'danger';

/**
 * One piece of evidence about a failing container.
 *
 * `at` carries an instant rather than a formatted string, because a timestamp
 * is the one fact that has to be rendered in the reader's own timezone and a
 * pure function has no business choosing one. When `at` is set, `value` holds
 * the same instant as the backend sent it, so a consumer that does not format
 * still shows something true.
 */
export interface CrashEvidenceItem {
  key: string;
  label: string;
  value: string;
  at?: string;
  tone: CrashEvidenceTone;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * 60;

/** A window in seconds as the phrase a sentence about it would use. */
function windowText(seconds: number): string {
  if (seconds < SECONDS_PER_MINUTE) {
    return `${Math.round(seconds)} ${Math.round(seconds) === 1 ? 'second' : 'seconds'}`;
  }
  if (seconds < SECONDS_PER_HOUR) {
    const minutes = Math.round(seconds / SECONDS_PER_MINUTE);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }
  const hours = Math.round(seconds / SECONDS_PER_HOUR);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/**
 * The evidence Docker recorded about a container that keeps stopping, in the
 * order somebody reads it.
 *
 * Every item is a field the backend actually populated. A dimension with no
 * evidence produces no item at all -- there is no "Exit code: unknown" row, no
 * "Healthcheck: none" row, and above all no row naming a cause. An absent exit
 * code means Docker did not record one; writing "unknown" in its place turns a
 * gap in the record into a statement about the container.
 *
 * `oom_killed` false is treated as no evidence rather than as evidence of the
 * negative. It is the default value of a boolean the daemon sets only when it
 * knows, so "the kernel did not run out of memory" is not something this can
 * safely claim from it.
 */
export function crashEvidence(analysis: DockerCrashAnalysis): CrashEvidenceItem[] {
  const items: CrashEvidenceItem[] = [];

  items.push({
    key: 'restarts',
    label: 'Restarts',
    value: String(analysis.restart_count),
    tone: analysis.restart_count > 0 ? 'warning' : 'neutral',
  });

  if (analysis.last_restart_at) {
    items.push({
      key: 'last_restart',
      label: 'Last restart',
      value: analysis.last_restart_at,
      at: analysis.last_restart_at,
      tone: 'neutral',
    });
  }

  if (analysis.previous_state) {
    items.push({
      key: 'previous_state',
      label: 'Previous state',
      value: analysis.previous_state,
      tone: 'neutral',
    });
  }

  // The server always sends a number and says separately whether it means
  // anything. A container that has not finished a run reports 0, which is the
  // same number a clean exit reports, so the flag is the only thing that tells
  // "it exited cleanly" from "it has not exited".
  if (analysis.exit_code_known) {
    items.push({
      key: 'exit_code',
      label: 'Exit code',
      value: String(analysis.exit_code),
      // Zero is a clean stop and reads as one. Any other code is the process
      // reporting a failure, which is worth the colour without naming a cause.
      tone: analysis.exit_code === 0 ? 'neutral' : 'danger',
    });
  }

  if (analysis.oom_killed) {
    items.push({
      key: 'oom_killed',
      label: 'Out of memory',
      value: 'The kernel killed this container for using more memory than it was allowed.',
      tone: 'danger',
    });
  }

  if (analysis.health) {
    items.push({
      key: 'health_status',
      label: 'Healthcheck',
      value: analysis.health,
      tone: analysis.health === 'unhealthy' ? 'danger' : 'neutral',
    });
  }

  // The server reads the daemon's event history to decide this, and says when
  // it could not. "No loop" and "nobody looked" are different answers, and the
  // second one must not be rendered as the first on a page somebody is reading
  // to decide whether a container is stable.
  if (!analysis.events_read) {
    items.push({
      key: 'events_unread',
      label: 'Restart pattern',
      value: "Docker's event history could not be read, so nothing was measured.",
      tone: 'neutral',
    });
  } else if (analysis.restart_loop) {
    const restarts = analysis.deaths_in_window;
    const window = analysis.crash_loop_window_seconds;
    items.push({
      key: 'crash_loop',
      label: 'Restart pattern',
      // The figures are the evidence. Without them the item still says what
      // the backend judged, and says nothing it did not measure.
      // Both figures come over as plain numbers, so nothing was measured is
      // spelled 0 rather than absent. Saying "0 restarts in 0 seconds" would be
      // a measurement nobody took.
      value:
        restarts > 0 && window > 0
          ? `${restarts} ${restarts === 1 ? 'restart' : 'restarts'} in ${windowText(window)}`
          : 'Docker restarted this container repeatedly.',
      tone: 'danger',
    });
  }

  return items;
}
