import type {
  DockerHealthcheck,
  DockerInspect,
  DockerMount,
  DockerPort,
} from '@slideops/api-client';
import { formatBytes } from './docker-inventory';

/*
 * How one container's full detail reads on the screen that inspects it.
 *
 * Pure, for the same reason docker-inventory.ts is pure: the decisions about
 * what is worth showing, what a raw field means, and above all what must not be
 * shown are decisions, and they belong somewhere they can be asserted rather
 * than scattered through markup.
 *
 * Two rules govern everything below.
 *
 * The first is the one inherited from the inventory: nothing is stated that the
 * daemon did not report. An absent limit is an absent row, not a limit of zero.
 * A healthcheck with no verdict yet gets no verdict written for it. A row whose
 * value would be "undefined", "0 B" or an empty string is a row that never
 * existed, and a section left with no rows is not rendered at all, because an
 * empty "Resources" heading reads as "this container has no resources" rather
 * than "nobody set any limits".
 *
 * The second is about secrets. There is no environment here, there is no field
 * for one in the contract, and none may be added. A container's environment is
 * where its database passwords and API keys live, and an inspect panel is a
 * screen that gets left open, screen shared, and pasted into a support thread.
 * The safe way to keep those off a screen is to never carry them to the browser.
 */

/** One labelled fact. `value` is always something a person can read. */
export interface InspectRow {
  label: string;
  value: string;
}

/**
 * One group of facts, in the order they should be read. `key` is stable and
 * safe to use for React keys and for remembering which section was collapsed;
 * `title` is what an Operator sees and may be reworded freely.
 */
export interface InspectSection {
  key: string;
  title: string;
  rows: InspectRow[];
}

/* ------------------------------------------------------------------ *
 * Sections
 * ------------------------------------------------------------------ */

/**
 * The whole inspect result as ordered, labelled sections.
 *
 * The order is the order the questions get asked: what is this, how was it
 * configured, what was it allowed to use, what can reach it, what has it
 * mounted, and how has it behaved. Labels sit apart from the wire so a
 * confusing backend field name can be given a readable label here without
 * anybody renaming a contract.
 */
export function inspectSections(inspect: DockerInspect): InspectSection[] {
  return [
    { key: 'general', title: 'General', rows: generalRows(inspect) },
    { key: 'configuration', title: 'Configuration', rows: configurationRows(inspect) },
    { key: 'labels', title: 'Labels', rows: labelRows(inspect) },
    { key: 'resources', title: 'Resources', rows: resourceRows(inspect) },
    { key: 'networking', title: 'Networking', rows: networkingRows(inspect) },
    { key: 'storage', title: 'Storage', rows: storageRows(inspect) },
    { key: 'runtime', title: 'Runtime', rows: runtimeRows(inspect) },
  ].filter((section) => section.rows.length > 0);
}

function generalRows(inspect: DockerInspect): InspectRow[] {
  const general = inspect.general;
  return rows([
    // Docker's own name carries a leading slash, which is an artefact of its
    // API and not part of the name anybody typed or would recognise.
    ['Name', text(general.name.replace(/^\//, ''))],
    ['Container ID', text(general.id)],
    ['Created', timestamp(general.created_at)],
    ['State', capitalised(general.state)],
    // Docker's own status line, verbatim. It says things the structured fields
    // do not ("Exited (137) 2 hours ago"), and rewording it would put words in
    // the daemon's mouth.
    ['Status', text(general.status)],
    ['Platform', text(general.platform)],
    ['Runtime', text(general.runtime)],
  ]);
}

function configurationRows(inspect: DockerInspect): InspectRow[] {
  const configuration = inspect.configuration;
  return rows([
    ['Image', text(configuration.image)],
    ['Entrypoint', text(configuration.entrypoint)],
    ['Command', text(configuration.command)],
    ['Working directory', text(configuration.working_dir)],
    // An empty user means the image's own default, which is root far more often
    // than anybody intends. Saying so is worth a row; guessing is not, so this
    // says only what was set and stays silent when nothing was.
    ['User', text(configuration.user)],
  ]);
}

/**
 * Labels as their own section rather than one crowded row.
 *
 * Labels are the only field on a container whose meaning SlideOps did not
 * choose: they are where a team's own vocabulary lives, an owner, a stack, a
 * ticket number. Flattening a dozen of them into a single comma separated value
 * would make the one an Operator came to read the hardest to find. Sorted by
 * key so the same container always renders the same way.
 */
function labelRows(inspect: DockerInspect): InspectRow[] {
  return Object.entries(inspect.configuration.labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({ label: key, value }))
    .filter((row) => row.value.trim() !== '');
}

function resourceRows(inspect: DockerInspect): InspectRow[] {
  const resources = inspect.resources;
  return rows([
    ['CPU limit', cores(resources.cpu_limit_cores)],
    ['CPU reservation', cores(resources.cpu_reservation_cores)],
    // A relative weight against every other container on the Node, not a
    // ceiling, so it is left as the bare number Docker uses rather than dressed
    // up in units it does not have.
    ['CPU shares', positive(resources.cpu_shares)],
    ['Memory limit', megabytes(resources.memory_limit_mb)],
    ['Memory reservation', megabytes(resources.memory_reservation_mb)],
    ['Process limit', positive(resources.pids_limit)],
  ]);
}

function networkingRows(inspect: DockerInspect): InspectRow[] {
  const networking = inspect.networking;
  const addresses = Object.entries(networking.ip_addresses)
    .sort(([left], [right]) => left.localeCompare(right))
    .filter(([, address]) => address.trim() !== '')
    .map(([network, address]): InspectRow => ({ label: `Address on ${network}`, value: address }));

  return [
    ...rows([
      ['Hostname', text(networking.hostname)],
      ['Networks', list(networking.networks)],
    ]),
    ...addresses,
    ...networking.ports.map(portRow),
    ...rows([['DNS servers', list(networking.dns)]]),
  ];
}

/**
 * One port, said in full.
 *
 * A port exposed inside Docker but not published to the Node is the common case
 * for a database behind a Compose network, and it is working exactly as
 * intended. It still has to be distinguishable at a glance from a port that is
 * reachable from outside, because those two facts lead an Operator to opposite
 * conclusions about why something cannot connect.
 */
function portRow(port: DockerPort): InspectRow {
  const label = `Port ${port.container_port}/${port.protocol}`;
  if (typeof port.host_port !== 'number') {
    return { label, value: 'Not published outside Docker' };
  }
  const host = port.host_ip ? `${port.host_ip}:${port.host_port}` : String(port.host_port);
  return { label, value: `Published on ${host}` };
}

function storageRows(inspect: DockerInspect): InspectRow[] {
  return inspect.storage.mounts.map(mountRow);
}

/**
 * One mount, keyed by where it lands inside the container.
 *
 * The destination is the label because it is unique within a container and is
 * what an Operator recognises: the path the workload writes to. The value says
 * what is behind it and whether it can be written, because a named volume that
 * outlives the container, a bind mount from the Node's own disk, and a tmpfs
 * that vanishes on restart are three very different promises about the data.
 */
function mountRow(mount: DockerMount): InspectRow {
  const origin = mount.name?.trim() || mount.source.trim();
  const kind = capitalised(mount.type) || 'Mount';
  const access = mount.read_only ? 'read-only' : 'read-write';
  const value = origin ? `${kind} ${origin}, ${access}` : `${kind}, ${access}`;
  return { label: mount.destination, value };
}

function runtimeRows(inspect: DockerInspect): InspectRow[] {
  const runtime = inspect.runtime;
  const health = runtime.healthcheck;

  return rows([
    ['Restart policy', text(runtime.restart_policy)],
    // Zero restarts is a reported fact and a reassuring one, so unlike a limit
    // of zero it is shown rather than omitted.
    ['Restarts', String(runtime.restart_count)],
    ['Process ID', positive(runtime.pid)],
    // Zero is kept here too: a clean exit is the answer to "why did this stop",
    // and omitting it would leave the question looking unanswered.
    ['Exit code', typeof runtime.exit_code === 'number' ? String(runtime.exit_code) : null],
    // Only shown when true. A row reading "No" would add a line to every
    // container on the estate to say that the ordinary thing happened.
    ['Killed for memory', runtime.oom_killed ? 'Yes, the kernel stopped this container' : null],
    ['Healthcheck', health ? healthCommand(health) : null],
    ['Check interval', health ? seconds(health.interval_seconds) : null],
    ['Check retries', health ? positive(health.retries) : null],
    ['Last check', health ? text(health.last_status) : null],
    ['Last check output', health ? text(health.last_output?.trim()) : null],
  ]);
}

/* ------------------------------------------------------------------ *
 * Health
 * ------------------------------------------------------------------ */

/**
 * What the healthcheck is doing, in one sentence, or null when there is nothing
 * to say.
 *
 * Null when the image declares no healthcheck. That is not a failure and it is
 * not health either: nobody is checking, and the honest rendering of "nobody is
 * checking" is silence rather than a reassuring green line.
 *
 * When a check exists but has produced no verdict, this says exactly that. It
 * never fills the gap with "healthy", because a container inside its start
 * period and a container that passed its check look identical from here and are
 * not the same thing at all.
 */
export function healthSummary(inspect: DockerInspect): string | null {
  const health = inspect.runtime.healthcheck;
  if (!health || !definesHealthcheck(health)) {
    return null;
  }

  const cadence = health.interval_seconds
    ? ` It runs every ${seconds(health.interval_seconds)}.`
    : '';
  const status = health.last_status?.trim().toLowerCase();

  if (!status) {
    return `The image defines a healthcheck, and Docker has not reported a result yet.${cadence}`;
  }
  if (status === 'healthy') {
    return `The image defines a healthcheck, and Docker's last run of it passed.${cadence}`;
  }
  if (status === 'unhealthy') {
    return `The image defines a healthcheck, and Docker's last run of it failed, so this container may be running without being able to serve.${cadence}`;
  }
  if (status === 'starting') {
    return `The image defines a healthcheck, and this container is still inside its start-up grace period, which is not a failure.${cadence}`;
  }
  // An answer nobody here anticipated is quoted rather than translated, so a
  // status Docker adds later reaches the Operator instead of being swallowed.
  return `The image defines a healthcheck, and Docker's last run of it reported "${health.last_status?.trim() ?? ''}".${cadence}`;
}

/**
 * Whether the image really declares a check.
 *
 * Docker reports the absence of a healthcheck as the literal test `["NONE"]`
 * rather than as an empty field, so a check that exists and a check that was
 * explicitly switched off both arrive as an object here. Only one of them is a
 * healthcheck.
 */
function definesHealthcheck(health: DockerHealthcheck): boolean {
  const meaningful = health.test.filter((part) => part.trim() !== '');
  if (meaningful.length === 0) {
    return false;
  }
  return meaningful[0]?.toUpperCase() !== 'NONE';
}

/**
 * The healthcheck command without Docker's dispatch token.
 *
 * `test` begins with CMD or CMD-SHELL, which says how Docker runs the rest and
 * is not part of the command anybody wrote. Showing it would put a word at the
 * front of the line that appears in no shell history.
 */
function healthCommand(health: DockerHealthcheck): string | null {
  if (!definesHealthcheck(health)) {
    return null;
  }
  const parts = health.test.filter((part) => part.trim() !== '');
  const head = parts[0]?.toUpperCase();
  const command = head === 'CMD' || head === 'CMD-SHELL' ? parts.slice(1) : parts;
  return text(command.join(' '));
}

/* ------------------------------------------------------------------ *
 * Values
 *
 * Every helper here returns null for "there is nothing to show", and rows()
 * drops those. Null rather than an empty string, so an absent value cannot
 * quietly become a row with a blank value in it.
 * ------------------------------------------------------------------ */

function rows(entries: Array<[string, string | null]>): InspectRow[] {
  const kept: InspectRow[] = [];
  for (const [label, value] of entries) {
    if (value !== null && value !== '') {
      kept.push({ label, value });
    }
  }
  return kept;
}

/** A string field, or null when the daemon reported nothing in it. */
function text(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function capitalised(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : '';
}

function list(values: string[]): string | null {
  const kept = values.map((value) => value.trim()).filter((value) => value !== '');
  return kept.length > 0 ? kept.join(', ') : null;
}

/**
 * A number that only means something above zero.
 *
 * Docker reports an unset limit as zero rather than omitting it, and a memory
 * limit of "0 B" or a process limit of "0" would read as a container allowed
 * nothing at all, which is the opposite of what an unset limit means.
 */
function positive(value: number | undefined): string | null {
  return typeof value === 'number' && value > 0 ? String(value) : null;
}

/** A CPU allowance in cores, without trailing zeroes on a whole number. */
function cores(value: number | undefined): string | null {
  if (typeof value !== 'number' || value <= 0 || !Number.isFinite(value)) {
    return null;
  }
  const amount = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  return `${amount} ${value === 1 ? 'core' : 'cores'}`;
}

const BYTES_PER_MB = 1024 * 1024;

/** A memory figure, reported in MB on the wire, read in whatever unit suits it. */
function megabytes(value: number | undefined): string | null {
  if (typeof value !== 'number' || value <= 0 || !Number.isFinite(value)) {
    return null;
  }
  return formatBytes(value * BYTES_PER_MB);
}

const SECONDS_PER_MINUTE = 60;

/**
 * A duration in seconds.
 *
 * Deliberately not the inventory's formatUptime, which drops the seconds inside
 * a longer span. That is right for an uptime, where a minute either way changes
 * nothing, and wrong for a healthcheck interval, where the difference between
 * every 90 seconds and every minute is the whole setting.
 */
function seconds(value: number | undefined): string | null {
  if (typeof value !== 'number' || value <= 0 || !Number.isFinite(value)) {
    return null;
  }
  const whole = Math.round(value);
  if (whole < SECONDS_PER_MINUTE) {
    return `${whole}s`;
  }
  const minutes = Math.floor(whole / SECONDS_PER_MINUTE);
  const rest = whole % SECONDS_PER_MINUTE;
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

/** A wire timestamp as a date, or null when there is nothing readable in it. */
function timestamp(iso: string | undefined): string | null {
  if (!iso) {
    return null;
  }
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) {
    return null;
  }
  return when.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
