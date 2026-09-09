import {
  getSavedDiscovery,
  type DockerContainer,
  type DockerPort,
  type DockerStats,
  type Facts,
} from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { Gauge } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { formatBytes } from '../docker-inventory';
import { useAsyncData } from '../hooks/useAsyncData';
import { ErrorNote, Loading } from './Feedback';
import { Meter } from './Meter';

/*
 * What this container is using, and what it is using it out of.
 *
 * The second half is the one that is usually missing. "340 MB" is a number
 * nobody can act on; "340 MB of the 16 GB this server has" is a sentence about
 * whether anything needs doing. A container's own limits answer a different
 * question -- whether it is about to be throttled or killed -- and both are
 * worth a meter, so both are here, clearly separated and never mixed.
 *
 * A meter needs a real ceiling. Docker reports the whole machine's memory as
 * the limit for a container that has none of its own, so reading a percentage
 * off the sample alone would quietly turn "this server is large" into "this
 * container is fine". Where the Operator set no limit, this says so and shows
 * the plain reading, which is all that was actually measured.
 *
 * The Node's own totals come from the last saved Discovery, which is a read of
 * a record and never an SSH connection. When there is no saved Discovery there
 * is no denominator, and this says that instead of inventing one.
 */

const MB_PER_GB = 1024;
const KB_PER_MB = 1024;

/** Whole MB through the one byte formatter this workspace uses. */
function megabytes(mb: number): string {
  return formatBytes(mb * KB_PER_MB * KB_PER_MB);
}

/** A percentage rounded for reading, never rounded to zero from a real reading. */
function percent(value: number): string {
  return value > 0 && value < 1 ? '<1%' : `${Math.round(value)}%`;
}

/** How one published port reads. An unpublished port says so rather than looking unreachable. */
function portText(port: DockerPort): string {
  const inside = `${port.container_port}/${port.protocol}`;
  if (typeof port.host_port !== 'number') {
    return `${inside} inside Docker only`;
  }
  const host = port.host_ip ? `${port.host_ip}:${port.host_port}` : String(port.host_port);
  return `${host} to ${inside}`;
}

/** One labelled fact. Absent data is a dash, never a zero. */
function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <Text variant="caption" tone="secondary" className="block">
        {label}
      </Text>
      <span className="mt-0.5 block break-words text-sm text-ink">{value ? value : '--'}</span>
    </div>
  );
}

/** The container's own reading against its own ceilings, when it has any. */
function OwnLimits({ container, stat }: { container: DockerContainer; stat?: DockerStats }) {
  if (!stat) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface px-4 py-3">
        <Text variant="body-sm" tone="secondary">
          No live sample covered this container on the last pass, so there is no reading to show.
          That is usually because it is not running.
        </Text>
      </div>
    );
  }

  const cores = container.cpu_limit_cores;
  const memoryLimit = container.memory_limit_mb;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {typeof cores === 'number' && cores > 0 ? (
        <Meter
          label="CPU against its limit"
          used={stat.cpu_percent}
          limit={cores * 100}
          valueText={percent(stat.cpu_percent)}
          hint={`Limited to ${cores} ${cores === 1 ? 'core' : 'cores'}`}
        />
      ) : (
        <Reading
          label="CPU"
          value={percent(stat.cpu_percent)}
          note="No CPU limit set, so there is no ceiling to measure this against."
        />
      )}

      {typeof memoryLimit === 'number' && memoryLimit > 0 ? (
        <Meter
          label="Memory against its limit"
          used={stat.memory_used_mb}
          limit={memoryLimit}
          valueText={`${megabytes(stat.memory_used_mb)} / ${megabytes(memoryLimit)}`}
          hint="Docker kills a container that passes its memory limit."
        />
      ) : (
        <Reading
          label="Memory"
          value={megabytes(stat.memory_used_mb)}
          note="No memory limit set, so this container may use whatever the server has."
        />
      )}
    </div>
  );
}

/** A measured number with no honest denominator behind it. */
function Reading({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
        <span className="text-sm font-medium text-ink">{value}</span>
      </div>
      <Text variant="caption" tone="secondary" className="mt-1.5 block normal-case tracking-normal">
        {note}
      </Text>
    </div>
  );
}

/**
 * The same reading, measured against the machine it is running on.
 *
 * Docker reports CPU as a percentage of one core, so a container on a four core
 * server can legitimately read 400%. Dividing by the core count is what turns
 * that into a share of the server, and it is stated in the label rather than
 * left for the reader to work out.
 */
function AgainstTheServer({
  nodeId,
  nodeName,
  stat,
}: {
  nodeId: string;
  nodeName: string;
  stat?: DockerStats;
}) {
  const { state } = useAsyncData((signal) => getSavedDiscovery(nodeId, signal), [nodeId]);

  if (state.status === 'loading') {
    return <Loading label={`Reading what SlideOps knows about ${nodeName}`} />;
  }
  if (state.status === 'error') {
    return <ErrorNote error={state.error} />;
  }

  const facts: Facts | undefined = state.data.found ? state.data.facts : undefined;
  const cores = facts?.cpu?.cores;
  const totalMemMb =
    typeof facts?.memory?.total_kb === 'number' ? facts.memory.total_kb / KB_PER_MB : undefined;

  // No saved Discovery means no cores and no installed memory, and therefore no
  // denominator. Saying so is the only honest option: a share of an unknown
  // total is not a smaller number, it is a made up one.
  if (typeof cores !== 'number' && typeof totalMemMb !== 'number') {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface px-4 py-3">
        <Text variant="body-sm" tone="secondary">
          SlideOps has not read how many cores or how much memory {nodeName} has, so it cannot say
          what share of the server this container is using. Running Discovery on{' '}
          <Link
            to={`/app/nodes/${nodeId}`}
            className="text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {nodeName}
          </Link>{' '}
          reads those over SSH and changes nothing on the server.
        </Text>
      </div>
    );
  }

  if (!stat) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface px-4 py-3">
        <Text variant="body-sm" tone="secondary">
          There is no live sample for this container, so there is nothing to measure against{' '}
          {nodeName} yet.
        </Text>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {typeof cores === 'number' && cores > 0 ? (
        <Meter
          label={`CPU of ${nodeName}`}
          used={stat.cpu_percent}
          limit={cores * 100}
          valueText={percent(stat.cpu_percent / cores)}
          hint={`Docker reports ${percent(stat.cpu_percent)} of one core, and this server has ${cores}.`}
        />
      ) : (
        <Reading
          label={`CPU of ${nodeName}`}
          value="--"
          note={`SlideOps has not read how many cores ${nodeName} has, so this container's share of it is unknown.`}
        />
      )}

      {typeof totalMemMb === 'number' && totalMemMb > 0 ? (
        <Meter
          label={`Memory of ${nodeName}`}
          used={stat.memory_used_mb}
          limit={totalMemMb}
          valueText={`${megabytes(stat.memory_used_mb)} of ${(totalMemMb / MB_PER_GB).toFixed(1)} GB`}
          hint="Every other container and every other process on this server shares the same total."
        />
      ) : (
        <Reading
          label={`Memory of ${nodeName}`}
          value="--"
          note={`SlideOps has not read how much memory ${nodeName} has, so this container's share of it is unknown.`}
        />
      )}
    </div>
  );
}

export interface DockerContainerOverviewProps {
  nodeId: string;
  nodeName: string;
  container: DockerContainer;
  /** The live sample, when the last sampling pass covered this container. */
  stat?: DockerStats;
}

/** The Overview tab: what it is using, out of what, and how it was set up to run. */
export function DockerContainerOverview({
  nodeId,
  nodeName,
  container,
  stat,
}: DockerContainerOverviewProps) {
  const compose =
    container.compose_project && container.compose_service
      ? `${container.compose_project} / ${container.compose_service}`
      : (container.compose_project ?? null);

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Gauge width={18} height={18} className="text-brand" aria-hidden />
          <Text variant="h4">Live usage</Text>
        </div>
        <div>
          <Text variant="body-sm" tone="secondary" className="mb-2">
            Against the limits set on the container itself.
          </Text>
          <OwnLimits container={container} stat={stat} />
        </div>
        <div className="border-t border-border pt-4">
          <Text variant="body-sm" tone="secondary" className="mb-2">
            Against everything {nodeName} has. A container is not the unit an Operator is short of;
            the server is.
          </Text>
          <AgainstTheServer nodeId={nodeId} nodeName={nodeName} stat={stat} />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <Text variant="h4">How it runs</Text>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Restart policy" value={container.restart_policy} />
          {/* Zero restarts is the ordinary case, and it is a real reading, so it
              is shown as zero rather than as a dash. A dash here would mean
              "nobody counted", which is not what happened. */}
          <Fact label="Restarts" value={String(container.restart_count)} />
          <Fact label="Compose" value={compose} />
          <Fact
            label="Last exit code"
            value={typeof container.exit_code === 'number' ? String(container.exit_code) : null}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <Text variant="h4">Ports</Text>
        {container.ports.length === 0 ? (
          <Text variant="body-sm" tone="secondary">
            This container publishes no ports and exposes none. Nothing reaches it over the network
            from outside Docker.
          </Text>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {container.ports.map((port) => (
                <span
                  key={`${port.container_port}/${port.protocol}/${port.host_port ?? 'internal'}`}
                  className="rounded-md border border-border px-2 py-0.5 font-mono text-xs text-ink-muted"
                >
                  {portText(port)}
                </span>
              ))}
            </div>
            <Text variant="body-sm" tone="secondary">
              A port marked "inside Docker only" is reachable by other containers on the same
              network and by nothing on {nodeName} itself.
            </Text>
          </>
        )}
      </Card>
    </div>
  );
}
