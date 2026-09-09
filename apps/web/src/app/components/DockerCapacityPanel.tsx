import type { DockerContainer, DockerOverview, DockerStats } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { Cpu, HardDrive, MemoryStick } from '@slideops/icons';
import {
  capacitySummary,
  nodeCapacityFromFacts,
  type CapacityDimension,
  type DiskCapacity,
} from '../docker-analysis';
import { formatBytes } from '../docker-inventory';
import { Meter } from './Meter';

/*
 * How much of this server Docker has taken, and how much it could take.
 *
 * The distinction this panel exists to draw is allocated against used. A
 * container with a 4 GB limit holding 1.2 GB has reserved four and is using
 * one, and the two numbers answer different questions: allocated says what is
 * promised and therefore what is left to promise, used says what is happening.
 * A dashboard that shows only one of them cannot tell over-provisioning from
 * pressure.
 *
 * Everything here can be null and each null is rendered as a sentence rather
 * than a zero. A Node nobody has discovered has no totals, a container with no
 * limit contributes to used but not to allocated, and an unsampled container
 * contributes to neither. Saying so is the difference between a capacity view
 * and a guess.
 */

/** How a dimension is measured, so the same panel serves cores and megabytes. */
interface Units {
  /** Turn a figure into something readable, including its unit. */
  format: (value: number) => string;
  /** What the dimension is called when explaining what is missing. */
  noun: string;
}

const cores: Units = {
  format: (value) => `${value.toFixed(value < 10 ? 2 : 1)} cores`,
  noun: 'CPU limit',
};

const megabytes: Units = {
  format: (value) => formatBytes(value * 1024 * 1024),
  noun: 'memory limit',
};

/**
 * One dimension, with the caveats attached to it rather than to the page.
 *
 * The meter is drawn against the Node's own total when there is one. When there
 * is not, the figures are still shown: what containers have reserved and what
 * they are using are true and useful on their own, and only the proportion is
 * unavailable.
 */
function Dimension({
  title,
  icon: Icon,
  dimension,
  units,
}: {
  title: string;
  icon: typeof Cpu;
  dimension: CapacityDimension;
  units: Units;
}) {
  const { total, allocated, used, unlimited, unsampled, allocatedFrom, usedFrom } = dimension;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon width={16} height={16} className="text-ink-muted" aria-hidden />
        <Text variant="body-sm" className="font-medium">
          {title}
        </Text>
      </div>

      {total === null ? (
        <Text variant="body-sm" tone="secondary">
          This server has not been discovered, so there is no total to measure against. The figures
          below are what the containers themselves report.
        </Text>
      ) : (
        <Meter
          label="Allocated"
          used={allocated}
          limit={total}
          valueText={`${units.format(allocated)} of ${units.format(total)}`}
          hint={
            used === null
              ? undefined
              : `Actually using ${units.format(used)} right now, across ${usedFrom} of them.`
          }
        />
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <Text as="span" variant="caption" tone="secondary">
            Allocated
          </Text>
          <Text as="span" variant="body-sm" className="tabular-nums">
            {units.format(allocated)}
            {allocatedFrom > 0 ? ` from ${allocatedFrom}` : ''}
          </Text>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <Text as="span" variant="caption" tone="secondary">
            Using now
          </Text>
          <Text as="span" variant="body-sm" className="tabular-nums">
            {/* Never a zero for an unread figure: nothing sampled and nothing
                used are different answers. */}
            {used === null ? 'Not sampled' : units.format(used)}
          </Text>
        </div>
        {total !== null ? (
          <div className="flex items-baseline justify-between gap-3">
            <Text as="span" variant="caption" tone="secondary">
              Left to allocate
            </Text>
            <Text as="span" variant="body-sm" className="tabular-nums">
              {units.format(Math.max(0, total - allocated))}
            </Text>
          </div>
        ) : null}
      </div>

      {unlimited > 0 || unsampled > 0 ? (
        <Text variant="caption" tone="secondary">
          {unlimited > 0
            ? `${unlimited} running ${unlimited === 1 ? 'container has' : 'containers have'} no ${units.noun}, so ${unlimited === 1 ? 'it counts' : 'they count'} towards what is used but not towards what is allocated. `
            : ''}
          {unsampled > 0
            ? `${unsampled} had no live sample and ${unsampled === 1 ? 'is' : 'are'} in neither figure.`
            : ''}
        </Text>
      ) : null}
    </Card>
  );
}

/** Docker's own disk against the filesystem it sits on. */
function Disk({ disk }: { disk: DiskCapacity }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <HardDrive width={16} height={16} className="text-ink-muted" aria-hidden />
        <Text variant="body-sm" className="font-medium">
          Disk
        </Text>
      </div>

      {disk.dockerBytes === null ? (
        <Text variant="body-sm" tone="secondary">
          Docker's disk usage has not been read for this server yet.
        </Text>
      ) : disk.totalBytes === null ? (
        <>
          <Text variant="body-sm">Docker is holding {formatBytes(disk.dockerBytes)}.</Text>
          <Text variant="caption" tone="secondary">
            This server has not been discovered, so there is no filesystem size to measure that
            against.
          </Text>
        </>
      ) : (
        <Meter
          label={disk.mount ? `Docker on ${disk.mount}` : 'Docker on this server'}
          used={disk.dockerBytes}
          limit={disk.totalBytes}
          valueText={`${formatBytes(disk.dockerBytes)} of ${formatBytes(disk.totalBytes)}`}
          hint={
            disk.usedBytes === null
              ? undefined
              : `Everything on the filesystem, Docker included, uses ${formatBytes(disk.usedBytes)}.`
          }
        />
      )}

      {disk.reclaimableBytes !== null && disk.reclaimableBytes > 0 ? (
        <Text variant="caption" tone="secondary">
          {formatBytes(disk.reclaimableBytes)} of that can be reclaimed from the Cleanup tab.
        </Text>
      ) : null}
    </Card>
  );
}

/**
 * The capacity view.
 *
 * Facts come from the Node's last saved Discovery rather than a fresh read, the
 * same way the Server capacity panel gets them: this is a page an Operator
 * refreshes, and it should not open an SSH connection to draw a bar.
 */
export function DockerCapacityPanel({
  containers,
  stats,
  overview,
  facts,
}: {
  containers: DockerContainer[];
  stats: DockerStats[];
  overview: DockerOverview | null;
  facts: Parameters<typeof nodeCapacityFromFacts>[0];
}) {
  const node = nodeCapacityFromFacts(facts);
  const summary = capacitySummary(containers, stats, node, overview);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Dimension title="CPU" icon={Cpu} dimension={summary.cpu} units={cores} />
        <Dimension title="Memory" icon={MemoryStick} dimension={summary.memory} units={megabytes} />
        <Disk disk={summary.disk} />
      </div>

      <Text variant="caption" tone="secondary">
        Counted {summary.counted} {summary.counted === 1 ? 'container' : 'containers'} in a state
        that consumes something.
        {summary.idle > 0
          ? ` ${summary.idle} stopped ${summary.idle === 1 ? 'container is' : 'containers are'} not counted, because a stopped container reserves nothing.`
          : ''}
      </Text>
    </div>
  );
}
