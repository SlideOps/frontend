import type {
  DockerContainer,
  DockerContainerState,
  DockerHealth,
  DockerPort,
  DockerStats,
} from '@slideops/api-client';
import { Card, Text, cn } from '@slideops/design-system';
import { ArrowUpRight, ScanSearch, ShieldCheck } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { CopyButton } from './CopyButton';
import { Meter } from './Meter';
import { formatBytes, formatUptime, uptimeSeconds } from '../docker-inventory';

/*
 * One container, as a card rather than a table row.
 *
 * A row forces every container into the same handful of columns, and a
 * container is not that shape: one has four published ports and no limits,
 * the next has none and a memory ceiling it is sitting against, a third is a
 * Compose service that only makes sense next to its project. A card can carry
 * the fields that apply and leave out the ones that do not, which is the whole
 * point, because the alternative is a grid of dashes that reads as missing
 * data rather than as data that does not exist.
 *
 * Two rules run through everything below. Nothing that was not measured is
 * rendered as a number: a container with no live sample shows "--", never a
 * zero, because zero is a reading and an absent sample is not. And a container
 * SlideOps did not deploy is never dressed up as one it did, because the
 * moment this page implies ownership of somebody else's workload, every other
 * thing it says about that workload is worth less.
 */

const badgeBase = 'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-subtle text-ink-muted',
  info: 'bg-subtle text-info',
  success: 'bg-subtle text-success',
  warning: 'bg-subtle text-warning',
  danger: 'bg-subtle text-danger',
};

/**
 * The tone each container state reads in.
 *
 * Only `dead` is a fault. A stopped container is very often exactly what the
 * Operator intended, and painting every non-running container red teaches
 * people to stop reading the colour at all. `restarting` is the one state that
 * is neither fine nor final, so it is the warning.
 */
const stateTone: Record<DockerContainerState, Tone> = {
  running: 'success',
  restarting: 'warning',
  paused: 'info',
  created: 'neutral',
  exited: 'neutral',
  dead: 'danger',
};

const stateLabel: Record<DockerContainerState, string> = {
  running: 'Running',
  restarting: 'Restarting',
  paused: 'Paused',
  created: 'Created',
  exited: 'Exited',
  dead: 'Dead',
};

/** The Docker state Docker itself reports, in the tone it deserves. */
export function DockerStateBadge({ state }: { state: DockerContainerState }) {
  return (
    <span className={cn(badgeBase, toneClass[stateTone[state] ?? 'neutral'])}>
      {stateLabel[state] ?? state}
    </span>
  );
}

const healthTone: Record<DockerHealth, Tone> = {
  healthy: 'success',
  unhealthy: 'danger',
  starting: 'info',
  none: 'neutral',
};

const healthLabel: Record<DockerHealth, string> = {
  healthy: 'Healthy',
  unhealthy: 'Unhealthy',
  starting: 'Starting',
  none: 'No healthcheck',
};

/**
 * The healthcheck verdict.
 *
 * `none` is rendered as a plain note rather than a badge, because a badge in a
 * row of badges reads as a verdict and "the image declares no healthcheck" is
 * the absence of one. Nobody is checking, which is not the same as passing.
 */
export function DockerHealthBadge({ health }: { health: DockerHealth }) {
  if (health === 'none') {
    return (
      <span className="text-xs text-ink-muted" title="This image declares no healthcheck.">
        No healthcheck
      </span>
    );
  }
  return <span className={cn(badgeBase, toneClass[healthTone[health]])}>{healthLabel[health]}</span>;
}

/**
 * Who put this container on the Node.
 *
 * The two badges are deliberately different shapes and not just different
 * colours: a filled badge for the workloads SlideOps deployed, an outlined one
 * for everything else. An External container belongs to the Operator or to
 * another tool, and this page shows it without claiming it.
 */
export function DockerOwnershipBadge({ ownership }: { ownership: DockerContainer['ownership'] }) {
  if (ownership === 'slideops') {
    return (
      <span
        className={cn(badgeBase, toneClass.success)}
        title="SlideOps deployed this container and manages it."
      >
        <ShieldCheck width={12} height={12} aria-hidden />
        SlideOps Managed
      </span>
    );
  }
  if (ownership === 'external') {
    return (
      <span
        className={cn(badgeBase, 'border border-border bg-transparent text-ink-muted')}
        title="Created outside SlideOps. It is shown here, not managed here."
      >
        <ScanSearch width={12} height={12} aria-hidden />
        External
      </span>
    );
  }
  return (
    <span
      className={cn(badgeBase, 'border border-border bg-transparent text-ink-muted')}
      title="Nothing on this container says who created it, so neither does SlideOps."
    >
      Unknown origin
    </span>
  );
}

/** How one published port reads. An unpublished port says so rather than looking unreachable. */
function portText(port: DockerPort): string {
  const inside = `${port.container_port}/${port.protocol}`;
  if (typeof port.host_port !== 'number') {
    return `${inside} internal`;
  }
  const host = port.host_ip ? `${port.host_ip}:${port.host_port}` : String(port.host_port);
  return `${host} to ${inside}`;
}

/** Whole MB as something a person reads, through the one byte formatter this screen uses. */
function megabytes(mb: number): string {
  return formatBytes(mb * 1024 * 1024);
}

/** A labelled fact on the card. Renders nothing at all when there is no fact. */
function Fact({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }
  return (
    <div className="min-w-0">
      <Text variant="caption" tone="secondary" className="block">
        {label}
      </Text>
      <span className="block truncate text-sm text-ink" title={value}>
        {value}
      </span>
    </div>
  );
}

/**
 * The usage pair.
 *
 * A meter needs a ceiling, and the only honest ceiling is one the Operator set
 * on the container itself. Docker reports the whole machine's memory as the
 * limit for a container that has none of its own, so reading a percentage off
 * the sample alone would quietly turn "this server has 64 GB" into "this
 * container is fine". Without a limit the reading is shown as a plain number,
 * which is all that was actually measured.
 */
function Usage({ container, stat }: { container: DockerContainer; stat?: DockerStats }) {
  if (!stat) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-3">
          <Text variant="caption" tone="secondary" className="block">
            CPU
          </Text>
          <span className="mt-1 block text-sm font-medium text-ink">--</span>
          <Text variant="caption" tone="secondary" className="mt-1 block">
            No live sample
          </Text>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <Text variant="caption" tone="secondary" className="block">
            Memory
          </Text>
          <span className="mt-1 block text-sm font-medium text-ink">--</span>
          <Text variant="caption" tone="secondary" className="mt-1 block">
            No live sample
          </Text>
        </div>
      </div>
    );
  }

  const cores = container.cpu_limit_cores;
  const memoryLimit = container.memory_limit_mb;
  const cpuReading = `${Math.round(stat.cpu_percent)}%`;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {typeof cores === 'number' && cores > 0 ? (
        <Meter
          label="CPU"
          used={stat.cpu_percent}
          limit={cores * 100}
          valueText={cpuReading}
          hint={`Limited to ${cores} ${cores === 1 ? 'core' : 'cores'}`}
        />
      ) : (
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <Text variant="caption" tone="secondary">
              CPU
            </Text>
            <span className="text-sm font-medium text-ink">{cpuReading}</span>
          </div>
          <Text variant="caption" tone="secondary" className="mt-1.5 block">
            No CPU limit set
          </Text>
        </div>
      )}

      {typeof memoryLimit === 'number' && memoryLimit > 0 ? (
        <Meter
          label="Memory"
          used={stat.memory_used_mb}
          limit={memoryLimit}
          valueText={`${megabytes(stat.memory_used_mb)} / ${megabytes(memoryLimit)}`}
        />
      ) : (
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <Text variant="caption" tone="secondary">
              Memory
            </Text>
            <span className="text-sm font-medium text-ink">
              {megabytes(stat.memory_used_mb)}
            </span>
          </div>
          <Text variant="caption" tone="secondary" className="mt-1.5 block">
            No memory limit set
          </Text>
        </div>
      )}
    </div>
  );
}

export interface DockerContainerCardProps {
  container: DockerContainer;
  /** The live sample, when the sampling pass covered this container. */
  stat?: DockerStats;
  /** The clock uptime is measured against, so a test can state what "now" was. */
  now?: Date;
  /**
   * The Node whose daemon holds this container.
   *
   * Optional because the detail page it unlocks is addressed by Node and
   * container together: without a Node there is no honest link to build, and a
   * card rendered somewhere that does not know its Node shows the name as plain
   * text rather than as a link that would land nowhere.
   */
  nodeId?: string;
}

/**
 * One container on the Node.
 *
 * There are still no lifecycle controls here. Start, stop and remove live on
 * the container's own page, behind the confirmations and the write-access gate
 * that belong with them; a grid of cards is the wrong place to put a control
 * that kills a process, because the card next to the one being aimed at looks
 * exactly the same.
 *
 * The name is the way through to that page. When a Service also owns the
 * container, that gets its own labelled link rather than being folded into the
 * name: "open this container" and "open the Service that manages it" are two
 * different destinations, and one link that silently means the second is how an
 * Operator ends up somewhere they did not choose.
 */
export function DockerContainerCard({ container, stat, now, nodeId }: DockerContainerCardProps) {
  const uptime = uptimeSeconds(container, now ?? new Date());
  const compose =
    container.compose_project && container.compose_service
      ? `${container.compose_project} / ${container.compose_service}`
      : (container.compose_project ?? undefined);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {nodeId ? (
              <Link
                to={`/app/docker/containers/${encodeURIComponent(container.full_id)}?node=${encodeURIComponent(nodeId)}`}
                className="inline-flex items-center gap-1 rounded-md text-base font-semibold text-ink hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {container.name}
                <ArrowUpRight width={14} height={14} aria-hidden />
              </Link>
            ) : (
              <span className="truncate text-base font-semibold text-ink">{container.name}</span>
            )}
            <DockerStateBadge state={container.state} />
            <DockerHealthBadge health={container.health} />
            <DockerOwnershipBadge ownership={container.ownership} />
          </div>
          {container.service_id ? (
            <Link
              to={`/app/services/${container.service_id}`}
              className="mt-1 inline-flex items-center gap-1 rounded-md text-xs font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Open the Service that manages it
              <ArrowUpRight width={12} height={12} aria-hidden />
            </Link>
          ) : null}
          <span className="mt-1 block truncate font-mono text-xs text-ink-muted" title={container.image}>
            {container.image}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <CopyButton value={container.name} label={`the name of ${container.name}`} />
          <CopyButton value={container.full_id} label={`the id of ${container.name}`} />
        </div>
      </div>

      <Usage container={container} stat={stat} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact
          label="Uptime"
          value={uptime === null ? 'Not running' : formatUptime(uptime)}
        />
        <Fact label="Short id" value={container.id} />
        <Fact label="Compose" value={compose} />
        {/* Zero restarts is the ordinary case and says nothing, so it is left
            out entirely rather than shown as a reassuring zero. */}
        <Fact
          label="Restarts"
          value={container.restart_count > 0 ? String(container.restart_count) : undefined}
        />
      </div>

      {container.ports.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Text variant="caption" tone="secondary">
            Ports
          </Text>
          {container.ports.map((port) => (
            <span
              key={`${port.container_port}/${port.protocol}/${port.host_port ?? 'internal'}`}
              className="rounded-md border border-border px-2 py-0.5 font-mono text-xs text-ink-muted"
            >
              {portText(port)}
            </span>
          ))}
        </div>
      ) : null}

      <Text variant="body-sm" tone="secondary" className="truncate" title={container.status_text}>
        {container.status_text}
      </Text>
    </Card>
  );
}
