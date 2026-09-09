import type { DockerContainer, DockerOverview, DockerStats } from '@slideops/api-client';
import { Section, StatTile, Text, cn } from '@slideops/design-system';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Database,
  HardDrive,
  Info,
  Network,
  Play,
  RefreshCw,
  Square,
} from '@slideops/icons';
import { Meter } from './Meter';
import {
  attentionItems,
  formatBytes,
  reclaimableBytes,
  type AttentionItem,
  type AttentionSeverity,
} from '../docker-inventory';

/*
 * The state of Docker on one Node, read in the order somebody actually asks
 * for it: is the daemon there, what is running, what is it holding on disk,
 * and is any of it a problem.
 *
 * The attention list is last and is never hidden. A section that disappears
 * when there is nothing wrong teaches an Operator that its absence means
 * nothing was checked, so an empty list says so in words instead. Every item
 * in it comes from `attentionItems`, which will not say anything the daemon
 * did not report, so nothing on this panel is inferred here.
 */

/** How each severity reads. Semantic tokens only, so both themes are correct. */
const severityText: Record<AttentionSeverity, string> = {
  critical: 'text-danger',
  warning: 'text-warning',
  info: 'text-ink-muted',
};

const severityIcon: Record<AttentionSeverity, typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

function AttentionRow({ item }: { item: AttentionItem }) {
  const Icon = severityIcon[item.severity];
  return (
    <li className="flex items-start gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
      <Icon
        width={16}
        height={16}
        className={cn('mt-0.5 shrink-0', severityText[item.severity])}
        aria-hidden
      />
      <div className="min-w-0">
        <span className={cn('block text-sm font-medium', severityText[item.severity])}>
          {item.title}
        </span>
        <Text variant="body-sm" tone="secondary" className="mt-0.5">
          {item.detail}
        </Text>
      </div>
    </li>
  );
}

/**
 * What Docker is holding on disk.
 *
 * The meter measures reclaimable against total, which is the only ratio here
 * that anybody can act on: it says how much of the disk Docker has taken is
 * being used for nothing. The four accounts underneath are Docker's own, from
 * the same accounting behind `docker system df`, reported rather than
 * estimated.
 */
function DiskUsage({ overview }: { overview: DockerOverview }) {
  const disk = overview.disk;
  const total =
    disk.images.bytes_total +
    disk.containers.bytes_total +
    disk.volumes.bytes_total +
    disk.build_cache.bytes_total;
  const reclaimable = reclaimableBytes(overview);

  const accounts = [
    { label: 'Images', bytes: disk.images.bytes_total, free: disk.images.bytes_reclaimable },
    {
      label: 'Containers',
      bytes: disk.containers.bytes_total,
      free: disk.containers.bytes_reclaimable,
    },
    { label: 'Volumes', bytes: disk.volumes.bytes_total, free: disk.volumes.bytes_reclaimable },
    {
      label: 'Build cache',
      bytes: disk.build_cache.bytes_total,
      free: disk.build_cache.bytes_reclaimable,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <Meter
        label="Reclaimable"
        used={reclaimable}
        limit={total}
        valueText={`${formatBytes(reclaimable)} of ${formatBytes(total)}`}
        hint="Docker's own figure for what nothing running depends on."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {accounts.map((account) => (
          <StatTile
            bordered
            key={account.label}
            label={account.label}
            value={formatBytes(account.bytes)}
            footer={
              <Text variant="caption" tone="secondary">
                {formatBytes(account.free)} reclaimable
              </Text>
            }
          />
        ))}
      </div>
    </div>
  );
}

export interface DockerOverviewPanelProps {
  overview: DockerOverview;
  containers: DockerContainer[];
  stats: DockerStats[];
}

/** The Docker overview for one Node: the daemon, the tallies, the disk, the trouble. */
export function DockerOverviewPanel({ overview, containers, stats }: DockerOverviewPanelProps) {
  const { daemon, counts } = overview;
  const items = attentionItems(containers, stats, overview);

  return (
    <div className="flex flex-col gap-8">
      <Section
        flush
        title="Daemon"
        description={
          daemon.available
            ? 'Docker is answering on this server. Everything below is read from it, and nothing on this page changes it.'
            : 'The Docker daemon did not answer, so the figures below are the last thing it said.'
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            bordered
            icon={daemon.available ? CheckCircle2 : AlertTriangle}
            label="Daemon"
            value={daemon.available ? 'Running' : 'Not answering'}
            tone={daemon.available ? 'success' : 'danger'}
          />
          <StatTile bordered label="Version" value={daemon.version ?? '--'} />
          <StatTile bordered label="Storage driver" value={daemon.storage_driver ?? '--'} />
          <StatTile bordered label="Cgroup driver" value={daemon.cgroup_driver ?? '--'} />
        </div>
      </Section>

      <Section
        title="What is here"
        description={`${counts.containers} containers on this server, whoever created them.`}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile bordered icon={Play} label="Running" value={counts.running} tone="success" />
          <StatTile bordered icon={Square} label="Stopped" value={counts.stopped} />
          <StatTile
            bordered
            icon={RefreshCw}
            label="Restarting"
            value={counts.restarting}
            tone={counts.restarting > 0 ? 'warning' : 'primary'}
          />
          <StatTile
            bordered
            icon={AlertTriangle}
            label="Unhealthy"
            value={counts.unhealthy}
            tone={counts.unhealthy > 0 ? 'danger' : 'primary'}
          />
          <StatTile bordered icon={HardDrive} label="Images" value={counts.images} />
          <StatTile bordered icon={Database} label="Volumes" value={counts.volumes} />
          <StatTile bordered icon={Network} label="Networks" value={counts.networks} />
          <StatTile
            bordered
            icon={Boxes}
            label="Compose projects"
            value={counts.compose_projects}
          />
        </div>
      </Section>

      <Section
        title="Disk"
        description="How much of this server's disk Docker is using, and how much of that is holding nothing."
      >
        <DiskUsage overview={overview} />
      </Section>

      <Section
        title="Needs attention"
        description="Everything here is something Docker reported. Nothing is inferred, averaged, or guessed."
      >
        {items.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3">
            <CheckCircle2 width={16} height={16} className="shrink-0 text-success" aria-hidden />
            <Text variant="body-sm" tone="secondary">
              Nothing needs attention. No container is unhealthy, dead, restarting in a loop, or
              close to a memory limit it was given.
            </Text>
          </div>
        ) : (
          <ul className="rounded-md border border-border bg-surface px-4 py-3">
            {items.map((item) => (
              <AttentionRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
