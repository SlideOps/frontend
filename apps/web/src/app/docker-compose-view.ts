import type {
  DockerComposeDiff,
  DockerHealthcheck,
  DockerInspect,
  DockerMount,
  DockerPort,
  DockerRunRequest,
} from '@slideops/api-client';

/*
 * The rules behind the Compose workspace, the run form, bulk actions, and
 * export, kept out of the markup so they can be argued with and asserted.
 *
 * Four things live here, and they are here rather than in a component because
 * every one of them is a rule somebody could get wrong quietly:
 *
 * 1. What order a stack's services start in, and what to say when the file
 *    describes an order that cannot exist. A dependency walk that follows a
 *    cycle does not print a wrong answer, it stops responding, so the cycle is
 *    found first and reported as a finding rather than walked into.
 * 2. What a Compose diff means, with the one destructive part of it separated
 *    from the rest by construction rather than by a screen remembering to.
 * 3. Whether an apply is allowed to proceed at all.
 * 4. How a container becomes a `docker run` command or a Compose service, with
 *    environment values redacted unless the Operator asked for them.
 *
 * The redaction rule is the one to read twice. Exporting a container is a
 * copy-and-paste operation: the result goes into a chat message, a runbook, a
 * ticket, a repository. Every one of those outlives the window it was copied
 * from, so the default has to be the safe one, and opting out has to be an act.
 */

/* ------------------------------------------------------------------ *
 * Dependency graph
 * ------------------------------------------------------------------ */

/**
 * How many root-to-leaf chains are worth rendering before the list stops being
 * a readable summary and starts being the file again.
 *
 * A stack whose services fan out widely produces a chain per path, and the
 * number of paths grows multiplicatively with the fan-out. Twenty four is about
 * as many lines as an Operator reads before scrolling past the section, and the
 * count is reported when it is hit so the view can say it is showing a
 * selection rather than pretending it showed everything.
 */
export const MAX_DEPENDENCY_CHAINS = 24;

/** One service, reduced to what the dependency order needs from it. */
export interface ComposeGraphService {
  name: string;
  depends_on: string[];
}

/** A `depends_on` entry naming a service this stack does not define. */
export interface MissingDependency {
  service: string;
  dependsOn: string;
}

/**
 * The start order a stack's `depends_on` describes, or the reason there is not
 * one.
 *
 * `cycle` and the ordering fields are mutually exclusive by construction: when
 * a cycle exists there is no start order to report, so `order`, `levels` and
 * `chains` are empty and the cycle is the whole answer. A view that renders
 * `order` without checking `cycle` first shows an empty list, which is wrong
 * but harmless; one that walked the graph anyway would hang.
 */
export interface ComposeDependencyGraph {
  /** Every service in start order, dependencies before the things needing them. */
  order: string[];
  /** The same services banded by depth: level 0 depends on nothing. */
  levels: string[][];
  /** Readable paths, each rendering as `frontend -> backend -> postgres`. */
  chains: string[][];
  /** True when there were more chains than {@link MAX_DEPENDENCY_CHAINS}. */
  chainsTruncated: boolean;
  /**
   * The services on a dependency cycle, closing back on the one it started
   * from, so it reads as `api -> worker -> api`. Null when the graph is sound.
   */
  cycle: string[] | null;
  /** `depends_on` entries pointing at a service that is not in this stack. */
  missing: MissingDependency[];
}

/**
 * Work out the start order from a stack's `depends_on` declarations.
 *
 * Cycles are found before anything else is computed. A Compose file can declare
 * one (Docker itself refuses to start such a stack, so an Operator can be
 * looking at exactly this file wondering why nothing comes up), and every
 * ordering algorithm below this point assumes acyclic input. Finding it first
 * means the bad case returns a finding an Operator can act on, in bounded time,
 * instead of the view freezing.
 *
 * A `depends_on` naming a service the stack does not define is reported in
 * `missing` and ignored for ordering. Dropping it silently would leave a broken
 * file looking sound, and inventing a node for it would put a service in the
 * graph that does not exist.
 */
export function dependencyGraph(services: ComposeGraphService[]): ComposeDependencyGraph {
  const known = new Set(services.map((service) => service.name));
  const deps = new Map<string, string[]>();
  const missing: MissingDependency[] = [];

  for (const service of services) {
    const resolved: string[] = [];
    for (const dependency of service.depends_on) {
      if (known.has(dependency)) {
        resolved.push(dependency);
      } else {
        missing.push({ service: service.name, dependsOn: dependency });
      }
    }
    deps.set(service.name, resolved);
  }

  const cycle = findCycle(deps);
  if (cycle) {
    return { order: [], levels: [], chains: [], chainsTruncated: false, cycle, missing };
  }

  const depth = new Map<string, number>();
  const depthOf = (name: string): number => {
    const cached = depth.get(name);
    if (cached !== undefined) {
      return cached;
    }
    const own = deps.get(name) ?? [];
    // Safe to recurse without a guard: findCycle has already established there
    // is no path from a service back to itself.
    const value = own.length === 0 ? 0 : Math.max(...own.map(depthOf)) + 1;
    depth.set(name, value);
    return value;
  };

  const names = [...deps.keys()].sort();
  for (const name of names) {
    depthOf(name);
  }

  const order = [...names].sort((a, b) => {
    const byDepth = (depth.get(a) ?? 0) - (depth.get(b) ?? 0);
    return byDepth !== 0 ? byDepth : a.localeCompare(b);
  });

  const levels: string[][] = [];
  for (const name of order) {
    const level = depth.get(name) ?? 0;
    (levels[level] ??= []).push(name);
  }

  const dependedOn = new Set<string>();
  for (const own of deps.values()) {
    for (const dependency of own) {
      dependedOn.add(dependency);
    }
  }
  const roots = names.filter((name) => !dependedOn.has(name));

  const chains: string[][] = [];
  let chainsTruncated = false;
  const walk = (name: string, path: string[]) => {
    if (chains.length >= MAX_DEPENDENCY_CHAINS) {
      chainsTruncated = true;
      return;
    }
    const own = deps.get(name) ?? [];
    if (own.length === 0) {
      chains.push([...path, name]);
      return;
    }
    for (const dependency of own) {
      walk(dependency, [...path, name]);
    }
  };
  for (const root of roots) {
    walk(root, []);
  }

  return { order, levels, chains, chainsTruncated, cycle: null, missing };
}

/**
 * The first dependency cycle, as a path closing on itself, or null.
 *
 * A depth-first walk with three states per node: unvisited, on the current
 * path, and finished. Meeting a node that is on the current path is the cycle,
 * and the path from that node to here is what to report. Every node is entered
 * once, so this terminates on any input, including a service that declares
 * itself as its own dependency.
 */
function findCycle(deps: Map<string, string[]>): string[] | null {
  const state = new Map<string, 'visiting' | 'done'>();
  const path: string[] = [];
  let found: string[] | null = null;

  const visit = (name: string): boolean => {
    const current = state.get(name);
    if (current === 'done') {
      return false;
    }
    if (current === 'visiting') {
      const start = path.indexOf(name);
      found = [...path.slice(start), name];
      return true;
    }
    state.set(name, 'visiting');
    path.push(name);
    for (const dependency of deps.get(name) ?? []) {
      if (visit(dependency)) {
        return true;
      }
    }
    path.pop();
    state.set(name, 'done');
    return false;
  };

  for (const name of [...deps.keys()].sort()) {
    if (visit(name)) {
      return found;
    }
  }
  return null;
}

/** Render one chain the way it reads aloud: `frontend -> backend -> postgres`. */
export function formatDependencyChain(chain: string[]): string {
  return chain.join(' -> ');
}

/* ------------------------------------------------------------------ *
 * Compose diff
 * ------------------------------------------------------------------ */

/** One band of a Compose diff, all of whose entries mean the same thing. */
export interface ComposeDiffGroup {
  key: 'containers_recreated' | 'images_changed' | 'networks_added' | 'networks_removed' | 'volumes_added';
  heading: string;
  /** What this band costs, in the Operator's terms rather than Docker's. */
  description: string;
  entries: string[];
}

/**
 * A Compose diff, arranged for a screen that has to make one part of it
 * impossible to miss.
 *
 * `volumesRemoved` is deliberately not a group. Everything in `groups` is
 * recoverable: a recreated container comes back, a changed image is pulled
 * again, a removed network is redeclared by editing the file. A removed volume
 * is a deleted database, and nothing in the file brings it back. Keeping it out
 * of the group list means a view cannot render it in the same loop as the rest
 * by accident, which is exactly how it would end up looking like one bullet
 * among nine.
 */
export interface ComposeDiffSummary {
  /** Nothing at all changes if this file is applied. */
  empty: boolean;
  /** Applying this destroys data. True exactly when a volume would be removed. */
  destroysData: boolean;
  /** The volumes that would be removed, by name. */
  volumesRemoved: string[];
  /** Everything else, banded for display. Empty bands are dropped. */
  groups: ComposeDiffGroup[];
  /** Every changed entry, volume removals included. */
  changeCount: number;
}

const DIFF_GROUPS: {
  key: ComposeDiffGroup['key'];
  field: keyof DockerComposeDiff;
  heading: string;
  description: string;
}[] = [
  {
    key: 'containers_recreated',
    field: 'containers_recreated',
    heading: 'Containers recreated',
    description:
      'These are replaced with new containers. Anything written inside them, outside a volume, is lost, and each one is briefly unavailable while it restarts.',
  },
  {
    key: 'images_changed',
    field: 'images_changed',
    heading: 'Images changed',
    description: 'These services will run a different image than they do now.',
  },
  {
    key: 'networks_added',
    field: 'networks_added',
    heading: 'Networks added',
    description: 'New networks are created for this stack.',
  },
  {
    key: 'networks_removed',
    field: 'networks_removed',
    heading: 'Networks removed',
    description:
      'These networks go away. Nothing stored is lost, and putting them back in the file recreates them.',
  },
  {
    key: 'volumes_added',
    field: 'volumes_added',
    heading: 'Volumes added',
    description: 'New, empty volumes are created for this stack.',
  },
];

/** Band a Compose diff for display, with the destructive part kept separate. */
export function summariseComposeDiff(diff: DockerComposeDiff): ComposeDiffSummary {
  const groups: ComposeDiffGroup[] = [];
  for (const group of DIFF_GROUPS) {
    const entries = diff[group.field] ?? [];
    if (entries.length > 0) {
      groups.push({
        key: group.key,
        heading: group.heading,
        description: group.description,
        entries: [...entries],
      });
    }
  }
  const volumesRemoved = [...(diff.volumes_removed ?? [])];
  const changeCount =
    groups.reduce((total, group) => total + group.entries.length, 0) + volumesRemoved.length;

  return {
    empty: changeCount === 0,
    destroysData: volumesRemoved.length > 0,
    volumesRemoved,
    groups,
    changeCount,
  };
}

/** What the Apply control is being asked to decide. */
export interface ComposeApplyInput {
  /** The diff the Operator has actually been shown. Null before they ran one. */
  diff: DockerComposeDiff | null;
  /** Whether they ticked the data-loss acknowledgement for this exact diff. */
  dataLossConfirmed: boolean;
  /** Whether their role in the active Workspace may write at all. */
  canWrite: boolean;
}

/**
 * Whether an apply may go ahead, and if not, what to say instead.
 *
 * A refusal always carries the sentence to show. A disabled control with no
 * explanation is the thing an Operator files a bug about, because from where
 * they sit the button is simply broken.
 */
export type ComposeApplyGate = { allowed: true } | { allowed: false; reason: string };

/**
 * The one place that decides whether a Compose file may be applied.
 *
 * The order of the checks is the order in which they matter. Write access
 * first, because nothing else is worth explaining to somebody who cannot act.
 * Then having seen a diff, because applying a file whose effects nobody has
 * looked at is the failure mode this whole screen exists to prevent. Then the
 * data-loss acknowledgement, which is asked for only when the diff being
 * applied actually removes a volume.
 */
export function composeApplyGate(input: ComposeApplyInput): ComposeApplyGate {
  if (!input.canWrite) {
    return {
      allowed: false,
      reason: 'Your role in this Workspace is read only, so this file cannot be applied from here.',
    };
  }
  if (!input.diff) {
    return {
      allowed: false,
      reason: 'Run the diff first. Nothing is applied until you have seen what it changes.',
    };
  }
  const summary = summariseComposeDiff(input.diff);
  if (summary.destroysData && !input.dataLossConfirmed) {
    return {
      allowed: false,
      reason: `This removes ${countOf(summary.volumesRemoved.length, 'volume')} and everything stored in ${summary.volumesRemoved.length === 1 ? 'it' : 'them'}. Confirm that before applying.`,
    };
  }
  return { allowed: true };
}

/* ------------------------------------------------------------------ *
 * Bulk actions
 * ------------------------------------------------------------------ */

/** The actions a selection of containers can be put through at once. */
export type BulkContainerAction = 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'remove';

/**
 * The bulk actions that cannot be undone.
 *
 * Removal is the only one. Every other action here leaves the container on the
 * Node, so an Operator who chose the wrong rows can put them back the way they
 * were. A removed container is gone, and with it anything written inside it
 * that was not in a volume.
 */
export const DESTRUCTIVE_BULK_ACTIONS: readonly BulkContainerAction[] = ['remove'];

/** Whether this action needs the confirmation that names every container. */
export function isDestructiveBulkAction(action: BulkContainerAction): boolean {
  return DESTRUCTIVE_BULK_ACTIONS.includes(action);
}

/** How each action is named in a control, and how it reads once it has run. */
const BULK_ACTION_WORDS: Record<BulkContainerAction, { label: string; past: string }> = {
  start: { label: 'Start', past: 'Started' },
  stop: { label: 'Stop', past: 'Stopped' },
  restart: { label: 'Restart', past: 'Restarted' },
  pause: { label: 'Pause', past: 'Paused' },
  unpause: { label: 'Resume', past: 'Resumed' },
  remove: { label: 'Remove', past: 'Removed' },
};

/** The control's label for one bulk action. */
export function bulkActionLabel(action: BulkContainerAction): string {
  return BULK_ACTION_WORDS[action].label;
}

/** What happened to one container. `message` says why, when it failed. */
export interface BulkOutcome {
  name: string;
  ok: boolean;
  message?: string;
}

/** What happened to the whole selection, told without rounding up. */
export interface BulkReport {
  total: number;
  succeeded: string[];
  failed: BulkOutcome[];
  /** True only when every single container in the selection succeeded. */
  allSucceeded: boolean;
  /** One sentence, accurate about partial failure. */
  headline: string;
}

/**
 * Summarise what a bulk run actually did.
 *
 * The rule this exists to enforce: a run in which anything failed is never
 * reported as a success. Ten containers stopped and one refused is not "stopped
 * 11 containers", and it is not a green tick either. It is a partial result,
 * and the count that failed goes in the same sentence as the count that worked,
 * because an Operator who reads only the first half must still be told.
 */
export function summariseBulkOutcomes(
  action: BulkContainerAction,
  outcomes: BulkOutcome[],
): BulkReport {
  const succeeded = outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.name);
  const failed = outcomes.filter((outcome) => !outcome.ok);
  const total = outcomes.length;
  const past = BULK_ACTION_WORDS[action].past.toLowerCase();

  let headline: string;
  if (total === 0) {
    headline = 'Nothing was selected, so nothing ran.';
  } else if (failed.length === 0) {
    headline = `${BULK_ACTION_WORDS[action].past} ${countOf(total, 'container')}.`;
  } else if (succeeded.length === 0) {
    headline = `None of the ${countOf(total, 'container')} could be ${past}. ${countOf(failed.length, 'failure')} to look at.`;
  } else {
    headline = `${BULK_ACTION_WORDS[action].past} ${succeeded.length} of ${countOf(total, 'container')}. ${countOf(failed.length, 'container')} failed.`;
  }

  return { total, succeeded, failed, allSucceeded: total > 0 && failed.length === 0, headline };
}

/* ------------------------------------------------------------------ *
 * Export and clone
 * ------------------------------------------------------------------ */

/**
 * What stands in for an environment value that was not exported.
 *
 * Deliberately not a plausible value and not an empty string. A blank would
 * paste into a runbook as a container that starts with no password set, which
 * is worse than one that refuses to start; this reads as an instruction and
 * fails loudly if anybody runs it unchanged.
 */
export const REDACTED_ENV_PLACEHOLDER = '<set this value>';

/** The line that travels with an export whose environment values were redacted. */
export const REDACTION_NOTICE =
  '# Environment values are placeholders. Fill them in before running this.';

/** Everything an export needs about one container. */
export interface ExportSource {
  name: string;
  image: string;
  command?: string;
  entrypoint?: string;
  workingDir?: string;
  user?: string;
  restartPolicy?: string;
  ports: DockerPort[];
  /**
   * The container's environment.
   *
   * Usually empty, and that is by design: SlideOps does not carry a running
   * container's environment to the browser at all, so an export built from an
   * inspect has no values to leak. It is a field here because the clone flow
   * exports a form an Operator filled in themselves, where the values are
   * already on screen and redaction is the thing that matters.
   */
  env: Record<string, string>;
  mounts: DockerMount[];
  networks: string[];
  dns: string[];
  labels: Record<string, string>;
  cpuLimitCores?: number;
  memoryLimitMb?: number;
  healthcheck?: DockerHealthcheck;
}

/** Whether the Operator asked for the real environment values. Off by default. */
export interface ExportOptions {
  includeSecrets?: boolean;
}

/** Build an export source from an inspect, plus any environment held locally. */
export function exportSourceFromInspect(
  inspect: DockerInspect,
  env: Record<string, string> = {},
): ExportSource {
  return {
    // Docker reports a container name with a leading slash. Nobody types it and
    // no command wants it.
    name: inspect.general.name.replace(/^\//, ''),
    image: inspect.configuration.image,
    command: blankToUndefined(inspect.configuration.command),
    entrypoint: blankToUndefined(inspect.configuration.entrypoint),
    workingDir: blankToUndefined(inspect.configuration.working_dir),
    user: blankToUndefined(inspect.configuration.user),
    restartPolicy: normalizeRestartPolicy(inspect.runtime.restart_policy),
    ports: inspect.networking.ports,
    env,
    mounts: inspect.storage.mounts,
    networks: inspect.networking.networks,
    dns: inspect.networking.dns,
    labels: inspect.configuration.labels,
    cpuLimitCores: inspect.resources.cpu_limit_cores,
    memoryLimitMb: inspect.resources.memory_limit_mb,
    healthcheck: inspect.runtime.healthcheck,
  };
}

/**
 * The container as a `docker run` command.
 *
 * Environment values are placeholders unless `includeSecrets` was asked for,
 * and when they are placeholders the command carries a comment saying so. The
 * comment matters as much as the redaction: this text is going to be pasted
 * somewhere else, where the checkbox that produced it is not visible and nobody
 * remembers which way it was set.
 */
export function runCommand(source: ExportSource, options: ExportOptions = {}): string {
  const includeSecrets = options.includeSecrets === true;
  const envKeys = Object.keys(source.env).sort();
  const redacting = !includeSecrets && envKeys.length > 0;

  const lines: string[] = ['docker run -d'];
  if (source.name) {
    lines.push(`--name ${shellQuote(source.name)}`);
  }
  if (source.restartPolicy) {
    lines.push(`--restart ${shellQuote(source.restartPolicy)}`);
  }
  for (const port of source.ports) {
    const published = publishedPort(port);
    if (published) {
      lines.push(`-p ${shellQuote(published)}`);
    } else {
      lines.push(`--expose ${port.container_port}`);
    }
  }
  for (const key of envKeys) {
    const value = includeSecrets ? (source.env[key] ?? '') : REDACTED_ENV_PLACEHOLDER;
    lines.push(`-e ${shellQuote(`${key}=${value}`)}`);
  }
  for (const mount of source.mounts) {
    const spec = mountSpec(mount);
    if (spec) {
      lines.push(`-v ${shellQuote(spec)}`);
    }
  }
  for (const network of source.networks) {
    lines.push(`--network ${shellQuote(network)}`);
  }
  for (const server of source.dns) {
    lines.push(`--dns ${shellQuote(server)}`);
  }
  for (const key of Object.keys(source.labels).sort()) {
    lines.push(`--label ${shellQuote(`${key}=${source.labels[key] ?? ''}`)}`);
  }
  if (source.cpuLimitCores !== undefined) {
    lines.push(`--cpus ${source.cpuLimitCores}`);
  }
  if (source.memoryLimitMb !== undefined) {
    lines.push(`--memory ${source.memoryLimitMb}m`);
  }
  if (source.user) {
    lines.push(`--user ${shellQuote(source.user)}`);
  }
  if (source.workingDir) {
    lines.push(`--workdir ${shellQuote(source.workingDir)}`);
  }
  if (source.entrypoint) {
    lines.push(`--entrypoint ${shellQuote(source.entrypoint)}`);
  }
  const health = source.healthcheck;
  if (health && health.test.length > 0) {
    lines.push(`--health-cmd ${shellQuote(healthCommand(health.test))}`);
    if (health.interval_seconds !== undefined) {
      lines.push(`--health-interval ${health.interval_seconds}s`);
    }
    if (health.retries !== undefined) {
      lines.push(`--health-retries ${health.retries}`);
    }
  }
  lines.push(shellQuote(source.image));
  if (source.command) {
    lines.push(source.command);
  }

  const command = lines.join(' \\\n  ');
  return redacting ? `${REDACTION_NOTICE}\n${command}` : command;
}

/**
 * The container as a Compose service, ready to paste under `services:`.
 *
 * Written by hand rather than through a YAML library, because the alternative
 * is a dependency for something this file already knows the exact shape of.
 * Every value that could contain a colon, a hash or leading whitespace is
 * quoted, which is the only part of YAML quoting that matters here.
 *
 * Resource limits are emitted as `cpus` and `mem_limit` rather than under
 * `deploy.resources`, because these snippets are for `docker compose up` on one
 * Node, and `deploy` is honoured only by Swarm.
 */
export function composeServiceSnippet(source: ExportSource, options: ExportOptions = {}): string {
  const includeSecrets = options.includeSecrets === true;
  const envKeys = Object.keys(source.env).sort();
  const redacting = !includeSecrets && envKeys.length > 0;
  const serviceName = source.name || 'service';

  const lines: string[] = ['services:', `  ${serviceName}:`, `    image: ${yamlScalar(source.image)}`];
  if (source.name) {
    lines.push(`    container_name: ${yamlScalar(source.name)}`);
  }
  if (source.restartPolicy) {
    lines.push(`    restart: ${yamlScalar(source.restartPolicy)}`);
  }
  if (source.entrypoint) {
    lines.push(`    entrypoint: ${yamlScalar(source.entrypoint)}`);
  }
  if (source.command) {
    lines.push(`    command: ${yamlScalar(source.command)}`);
  }
  if (source.workingDir) {
    lines.push(`    working_dir: ${yamlScalar(source.workingDir)}`);
  }
  if (source.user) {
    lines.push(`    user: ${yamlScalar(source.user)}`);
  }
  const ports = source.ports.map(publishedPort).filter((port): port is string => Boolean(port));
  if (ports.length > 0) {
    lines.push('    ports:');
    for (const port of ports) {
      lines.push(`      - ${yamlScalar(port)}`);
    }
  }
  if (envKeys.length > 0) {
    lines.push('    environment:');
    for (const key of envKeys) {
      const value = includeSecrets ? (source.env[key] ?? '') : REDACTED_ENV_PLACEHOLDER;
      lines.push(`      ${key}: ${yamlScalar(value)}`);
    }
  }
  const volumes = source.mounts.map(mountSpec).filter((spec): spec is string => Boolean(spec));
  if (volumes.length > 0) {
    lines.push('    volumes:');
    for (const volume of volumes) {
      lines.push(`      - ${yamlScalar(volume)}`);
    }
  }
  if (source.networks.length > 0) {
    lines.push('    networks:');
    for (const network of source.networks) {
      lines.push(`      - ${yamlScalar(network)}`);
    }
  }
  if (source.dns.length > 0) {
    lines.push('    dns:');
    for (const server of source.dns) {
      lines.push(`      - ${yamlScalar(server)}`);
    }
  }
  const labelKeys = Object.keys(source.labels).sort();
  if (labelKeys.length > 0) {
    lines.push('    labels:');
    for (const key of labelKeys) {
      lines.push(`      ${key}: ${yamlScalar(source.labels[key] ?? '')}`);
    }
  }
  if (source.cpuLimitCores !== undefined) {
    lines.push(`    cpus: ${yamlScalar(String(source.cpuLimitCores))}`);
  }
  if (source.memoryLimitMb !== undefined) {
    lines.push(`    mem_limit: ${yamlScalar(`${source.memoryLimitMb}m`)}`);
  }
  const health = source.healthcheck;
  if (health && health.test.length > 0) {
    lines.push('    healthcheck:');
    lines.push(`      test: [${health.test.map((part) => yamlScalar(part)).join(', ')}]`);
    if (health.interval_seconds !== undefined) {
      lines.push(`      interval: ${health.interval_seconds}s`);
    }
    if (health.retries !== undefined) {
      lines.push(`      retries: ${health.retries}`);
    }
  }

  const snippet = lines.join('\n');
  return redacting ? `${REDACTION_NOTICE}\n${snippet}` : snippet;
}

/** A clone: a run request prefilled from a container, and what was left out. */
export interface CloneResult {
  request: DockerRunRequest;
  /**
   * What was deliberately not copied, in the Operator's words.
   *
   * Shown next to the prefilled form, always. A form that silently dropped the
   * volumes would produce a container that looks like the original and starts
   * with an empty database, which is the kind of surprise that is discovered in
   * production rather than in the form.
   */
  omitted: string[];
}

/**
 * Prefill the run form from an existing container: configuration only.
 *
 * Three things are left behind on purpose.
 *
 * Storage, because a clone that mounted the original's volumes would be two
 * containers writing to one database, and a clone that mounted its bind paths
 * would be two containers writing to one directory. Neither is a copy; both are
 * a collision.
 *
 * Published host ports, because the original still holds them and a clone that
 * cannot bind its port fails at start with an error about an address in use.
 * The container ports are kept, so the Operator only has to choose new host
 * ones.
 *
 * Runtime state, because uptime, restart count, health verdict, exit code and
 * assigned addresses are things that happened to that container, not settings
 * that describe it.
 */
export function cloneRequestFromInspect(inspect: DockerInspect): CloneResult {
  const request: DockerRunRequest = {
    image: inspect.configuration.image,
    // The container ports carry over; the host bindings do not.
    ports: inspect.networking.ports.map((port) => ({
      container_port: port.container_port,
      protocol: port.protocol,
    })),
    restart_policy: normalizeRestartPolicy(inspect.runtime.restart_policy),
    command: blankToUndefined(inspect.configuration.command),
    entrypoint: blankToUndefined(inspect.configuration.entrypoint),
    working_dir: blankToUndefined(inspect.configuration.working_dir),
    user: blankToUndefined(inspect.configuration.user),
    cpu_limit_cores: inspect.resources.cpu_limit_cores,
    memory_limit_mb: inspect.resources.memory_limit_mb,
    network: inspect.networking.networks[0],
    dns: inspect.networking.dns.length > 0 ? [...inspect.networking.dns] : undefined,
    labels: Object.keys(inspect.configuration.labels).length > 0
      ? { ...inspect.configuration.labels }
      : undefined,
    healthcheck: inspect.runtime.healthcheck
      ? {
          test: [...inspect.runtime.healthcheck.test],
          interval_seconds: inspect.runtime.healthcheck.interval_seconds,
          retries: inspect.runtime.healthcheck.retries,
        }
      : undefined,
  };

  const omitted: string[] = [
    'The container name. Two containers cannot share one, so choose a new name.',
    'Environment variables. SlideOps never carries a running container environment to the browser, so there is nothing here to copy. Set them again below.',
  ];
  if (inspect.storage.mounts.length > 0) {
    omitted.push(
      'Volumes and bind mounts. A clone sharing the storage of the original would be two containers writing to one database, so the clone starts with none.',
    );
  }
  if (inspect.networking.ports.some((port) => port.host_port !== undefined)) {
    omitted.push(
      'Published host ports. The original still holds them, so pick different ones. The container ports were kept.',
    );
  }
  omitted.push(
    'Runtime state: uptime, restart count, health verdict, exit code, and the addresses Docker assigned.',
  );

  return { request, omitted };
}

/* ------------------------------------------------------------------ *
 * Small shared pieces
 * ------------------------------------------------------------------ */

/** "1 volume", "3 volumes". Plural rules the app says out loud in sentences. */
function countOf(count: number, noun: string): string {
  const plural = noun.endsWith('s') ? `${noun}es` : `${noun}s`;
  return `${count} ${count === 1 ? noun : plural}`;
}

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Docker reports "no" for a container with no restart policy, which is a value
 * nobody needs to see in an export or carry into a clone.
 */
function normalizeRestartPolicy(policy: string | undefined): string | undefined {
  const trimmed = policy?.trim();
  if (!trimmed || trimmed === 'no' || trimmed === '') {
    return undefined;
  }
  return trimmed;
}

/** `127.0.0.1:8080:80/tcp`, or null when the port is not published to the Node. */
function publishedPort(port: DockerPort): string | null {
  if (port.host_port === undefined) {
    return null;
  }
  const host = port.host_ip ? `${port.host_ip}:` : '';
  const protocol = port.protocol && port.protocol !== 'tcp' ? `/${port.protocol}` : '';
  return `${host}${port.host_port}:${port.container_port}${protocol}`;
}

/**
 * A mount as `-v` takes it. A tmpfs has no source to name, so it produces
 * nothing here rather than a `-v :/path` that would not run.
 */
function mountSpec(mount: DockerMount): string | null {
  const source = mount.name ?? mount.source;
  if (!source) {
    return null;
  }
  return `${source}:${mount.destination}${mount.read_only ? ':ro' : ''}`;
}

/**
 * Docker's healthcheck array carries a dispatch token first ("CMD-SHELL",
 * "CMD", "NONE"). `--health-cmd` wants the command without it.
 */
function healthCommand(test: string[]): string {
  const [first, ...rest] = test;
  if (first === 'CMD-SHELL' || first === 'CMD') {
    return rest.join(' ');
  }
  return test.join(' ');
}

/** Single-quote for a POSIX shell, closing and reopening around any quote. */
function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_.:/=-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Double-quote a YAML scalar unless it is plainly safe unquoted. */
function yamlScalar(value: string): string {
  if (/^[A-Za-z0-9_./-]+$/.test(value) && value !== '') {
    return value;
  }
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
