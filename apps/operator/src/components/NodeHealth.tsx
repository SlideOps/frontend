import { getNodeMetrics, type NodeMetricSample } from '@slideops/api-client';
import { Button, Card, Text, type ChartPalette } from '@slideops/design-system';
import { Cpu, HardDrive, HeartPulse, MemoryStick } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { nodeHealthOption } from '../charts/options';
import { ErrorNote, Loading } from './Feedback';
import { LazyChart } from './LazyChart';
import { useAsyncData } from '../hooks/useAsyncData';

/** Format a percentage reading, or a dash when it is absent. */
function pct(value?: number): string {
  return typeof value === 'number' ? `${Math.round(value)}%` : '-';
}

/** Format uptime from either a ready string or a seconds count. */
function uptime(sample: NodeMetricSample): string {
  if (sample.uptime) {
    return sample.uptime;
  }
  if (typeof sample.uptime_seconds === 'number') {
    const days = Math.floor(sample.uptime_seconds / 86400);
    const hours = Math.floor((sample.uptime_seconds % 86400) / 3600);
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    const minutes = Math.floor((sample.uptime_seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
  return '-';
}

function Metric({
  icon: Icon,
  label,
  value,
  percent,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  percent?: number;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-center gap-2 text-ink-muted">
        <Icon width={16} height={16} aria-hidden />
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
      </div>
      <p className="mt-1.5 text-xl font-semibold text-ink">{value}</p>
      {typeof percent === 'number' ? (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-subtle"
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div
            className={`h-full rounded-pill ${percent >= 90 ? 'bg-danger' : percent >= 75 ? 'bg-warning' : 'bg-success'}`}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The Node health panel. It reads the metrics endpoint (read only, never a
 * mutation) and shows the current CPU, memory, disk, uptime, and service count,
 * with a chart of the recent history. When monitoring is not yet enabled it
 * shows a calm state that links to the enable-monitoring Capability.
 */
export function NodeHealth({ nodeId }: { nodeId: string }) {
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => getNodeMetrics(nodeId, signal), [nodeId]);

  const history = state.status === 'ready' ? state.data.history : [];
  const build = useCallback(
    (palette: ChartPalette) => nodeHealthOption(palette, history),
    [history],
  );

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <HeartPulse width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Health</Text>
        <Guidance for="node.health" />
      </div>

      {state.status === 'loading' ? <Loading label="Reading current health, read only" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data.monitoring_enabled ? (
          <div className="flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                icon={Cpu}
                label="CPU load"
                value={
                  typeof state.data.current.cpu_load === 'number'
                    ? state.data.current.cpu_load.toFixed(2)
                    : '-'
                }
              />
              <Metric
                icon={MemoryStick}
                label="Memory"
                value={pct(state.data.current.memory_used_percent)}
                percent={state.data.current.memory_used_percent}
              />
              <Metric
                icon={HardDrive}
                label="Root disk"
                value={pct(state.data.current.disk_used_percent)}
                percent={state.data.current.disk_used_percent}
              />
              <Metric
                icon={HeartPulse}
                label="Uptime"
                value={uptime(state.data.current)}
              />
            </div>

            {typeof state.data.current.service_count === 'number' ? (
              <Text variant="body-sm" tone="secondary">
                {state.data.current.service_count} services running.
              </Text>
            ) : null}

            {history.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Text variant="caption" tone="secondary">
                    Recent history
                  </Text>
                  <Guidance for="node.health.history" />
                </div>
                <LazyChart ariaLabel="Recent Node health history" build={build} height={240} />
              </div>
            ) : (
              <Text variant="body-sm" tone="secondary">
                A recent history will appear here as the monitoring log accumulates readings.
              </Text>
            )}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-subtle/40 px-5 py-8 text-center">
            <Text variant="h4">Monitoring is not enabled</Text>
            <Text variant="body-sm" tone="secondary" className="mx-auto mt-2 max-w-md">
              Enable monitoring on this Node to see live health and a recent history here. It runs as
              a Capability you review and approve first, and it never changes anything else.
            </Text>
            <Button
              className="mt-4"
              onClick={() => navigate(`/capabilities/enable-monitoring?node=${nodeId}`)}
            >
              Enable monitoring
            </Button>
          </div>
        )
      ) : null}
    </Card>
  );
}
