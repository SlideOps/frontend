import { getSavedDiscovery, listServices, type Facts, type Service } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { Cpu, Gauge, HardDrive, MemoryStick } from '@slideops/icons';
import { ErrorNote, Loading } from './Feedback';
import { Meter } from './Meter';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * The Node's compute capacity and how much of it its Services already reserve,
 * read from the last saved Discovery so it renders on load and never triggers an
 * SSH read. Total cores, memory, and disk come from saved Facts; the reservation
 * sums the CPU and memory ceilings of the Services running on this Node. When the
 * Node has never been discovered it shows a calm prompt rather than empty tiles.
 * Every color is a semantic token, so the card belongs to both themes, and each
 * bar carries an accessible label and value through the shared Meter.
 */

/** A Service still holds its allocation unless it has been removed or has failed. */
const RESERVING_STATUSES = new Set(['running', 'deploying', 'stopped']);

const KB_PER_GB = 1024 * 1024;
const MB_PER_GB = 1024;

/** Format a kilobyte count as gigabytes with one decimal, such as "11.7 GB". */
function gbFromKb(kb: number): string {
  return `${(kb / KB_PER_GB).toFixed(1)} GB`;
}

/** Format a gigabyte value with one decimal, without the unit. */
function gb(value: number): string {
  return value.toFixed(1);
}

/** Show a whole number plainly and a fraction to one decimal, such as 1.5. */
function amount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** The disk to feature: the root mount when present, else the largest by size. */
function primaryDisk(facts: Facts): NonNullable<Facts['disks']>[number] | undefined {
  const disks = (facts.disks ?? []).filter((disk) => typeof disk.size_kb === 'number');
  if (disks.length === 0) {
    return undefined;
  }
  const root = disks.find((disk) => (disk.mount_point ?? disk.mount) === '/');
  if (root) {
    return root;
  }
  return disks.reduce((largest, disk) =>
    (disk.size_kb ?? 0) > (largest.size_kb ?? 0) ? disk : largest,
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface p-3">
      <div className="flex items-center gap-2 text-ink-muted">
        <Icon width={16} height={16} aria-hidden />
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
      </div>
      <p className="mt-1.5 truncate text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function CapacityBody({ facts, services }: { facts: Facts; services: Service[] }) {
  const cores = facts.cpu?.cores;
  const totalMemKb = facts.memory?.total_kb;
  const disk = primaryDisk(facts);

  const reserving = services.filter((service) => RESERVING_STATUSES.has(service.status));
  const reservedCpu = reserving.reduce((sum, service) => sum + (service.cpu_limit ?? 0), 0);
  const reservedMemMb = reserving.reduce((sum, service) => sum + (service.memory_mb ?? 0), 0);
  const totalMemMb = typeof totalMemKb === 'number' ? totalMemKb / MB_PER_GB : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          icon={Cpu}
          label="Cores"
          value={typeof cores === 'number' ? String(cores) : 'Not reported'}
        />
        <Stat
          icon={MemoryStick}
          label="Memory"
          value={typeof totalMemKb === 'number' ? gbFromKb(totalMemKb) : 'Not reported'}
        />
      </div>

      {disk ? (
        <Meter
          label={`Disk ${disk.mount_point ?? disk.mount ?? ''}`.trim()}
          used={disk.used_kb ?? 0}
          limit={disk.size_kb ?? 0}
          valueText={`${gb((disk.used_kb ?? 0) / KB_PER_GB)} of ${gb((disk.size_kb ?? 0) / KB_PER_GB)} GB`}
          hint={
            disk.use_percent !== undefined
              ? `${String(disk.use_percent).replace('%', '')}% used`
              : undefined
          }
        />
      ) : null}

      <div className="border-t border-border pt-4">
        <Text variant="caption" tone="secondary" className="block">
          Reserved by {reserving.length} {reserving.length === 1 ? 'service' : 'services'} on this
          server
        </Text>
        <div className="mt-3 flex flex-col gap-3">
          <Meter
            label="CPU reserved"
            used={reservedCpu}
            limit={typeof cores === 'number' ? cores : 0}
            valueText={`${amount(reservedCpu)} of ${typeof cores === 'number' ? amount(cores) : '?'} vCPU`}
          />
          <Meter
            label="Memory reserved"
            used={reservedMemMb}
            limit={totalMemMb}
            valueText={`${gb(reservedMemMb / MB_PER_GB)} of ${totalMemMb > 0 ? gb(totalMemMb / MB_PER_GB) : '?'} GB`}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The capacity card for a Node. It reads the saved Discovery and the Services
 * list on mount, both read only, and never runs Discovery. It sits beside the
 * Connection summary so an Operator sees the headroom before deploying.
 */
export function NodeCapacity({ nodeId }: { nodeId: string }) {
  const { state } = useAsyncData(
    (signal) => Promise.all([getSavedDiscovery(nodeId, signal), listServices(signal)]),
    [nodeId],
  );

  return (
    <Card className="h-fit">
      <div className="mb-3 flex items-center gap-2">
        <Gauge width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Capacity</Text>
      </div>

      {state.status === 'loading' ? <Loading label="Reading saved capacity" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data[0].found && state.data[0].facts ? (
          (() => {
            const [saved, services] = state.data;
            const onThisNode = services.filter((service) => service.node_id === nodeId);
            return <CapacityBody facts={saved.facts as Facts} services={onThisNode} />;
          })()
        ) : (
          <div className="flex items-start gap-3 rounded-md border border-dashed border-border bg-subtle/40 px-4 py-3">
            <HardDrive width={18} height={18} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
            <Text variant="body-sm" tone="secondary">
              Run Discovery to see this server's capacity. It reads the cores, memory, and disks over
              SSH, and nothing here changes until you do.
            </Text>
          </div>
        )
      ) : null}
    </Card>
  );
}
