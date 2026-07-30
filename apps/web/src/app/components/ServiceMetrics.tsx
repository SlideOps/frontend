import { getServiceMetrics, type ServiceMetrics } from '@slideops/api-client';
import { Cpu, MemoryStick } from '@slideops/icons';
import { useEffect, useRef, useState } from 'react';
import { Meter } from './Meter';

/*
 * Live resource usage for one Service. It reads the metrics endpoint over the
 * Operator session and, while the Service is running, refreshes on a gentle
 * interval so the reading stays live without hammering the Node. It never
 * mutates. The compact variant shows two thin readings for a list row; the full
 * variant shows two labelled meters for the detail view.
 */

const REFRESH_MS = 5000;

function useLiveMetrics(id: string, active: boolean): ServiceMetrics | null {
  const [metrics, setMetrics] = useState<ServiceMetrics | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!active) {
      setMetrics(null);
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let mounted = true;

    const tick = async () => {
      try {
        const next = await getServiceMetrics(id, controller.signal);
        if (mounted) {
          setMetrics(next);
        }
      } catch {
        // A missed reading is not worth surfacing; the next tick tries again.
      }
      if (mounted && activeRef.current) {
        timer = setTimeout(() => void tick(), REFRESH_MS);
      }
    };
    void tick();

    return () => {
      mounted = false;
      controller.abort();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [id, active]);

  return metrics;
}

function pct(value: number): string {
  return `${Math.round(value)}%`;
}

function mb(value: number): string {
  if (value >= 1024) {
    const gb = value / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  return `${Math.round(value)} MB`;
}

/** Compact live readings for a Service list row. */
export function ServiceMetricsInline({ id, running }: { id: string; running: boolean }) {
  const metrics = useLiveMetrics(id, running);
  if (!running) {
    return null;
  }
  if (!metrics) {
    return (
      <span className="text-xs text-ink-muted" role="status">
        Reading usage
      </span>
    );
  }
  const memRatio =
    metrics.memory_limit_mb > 0 ? (metrics.memory_used_mb / metrics.memory_limit_mb) * 100 : 0;
  return (
    <div className="flex items-center gap-4 text-xs text-ink-muted">
      <span className="inline-flex items-center gap-1.5">
        <Cpu width={13} height={13} aria-hidden />
        {pct(metrics.cpu_percent)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MemoryStick width={13} height={13} aria-hidden />
        {mb(metrics.memory_used_mb)} ({pct(memRatio)})
      </span>
    </div>
  );
}

/** Two labelled meters of live usage for the Service detail view. */
export function ServiceMetricsPanel({ id, running }: { id: string; running: boolean }) {
  const metrics = useLiveMetrics(id, running);

  if (!running) {
    return (
      <p className="text-sm text-ink-muted">
        Live usage appears here while the Service is running.
      </p>
    );
  }
  if (!metrics) {
    return (
      <p className="text-sm text-ink-muted" role="status">
        Reading live usage
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Meter
        label="CPU"
        used={metrics.cpu_percent}
        limit={100}
        valueText={pct(metrics.cpu_percent)}
      />
      <Meter
        label="Memory"
        used={metrics.memory_used_mb}
        limit={metrics.memory_limit_mb}
        valueText={`${mb(metrics.memory_used_mb)} / ${mb(metrics.memory_limit_mb)}`}
      />
    </div>
  );
}
