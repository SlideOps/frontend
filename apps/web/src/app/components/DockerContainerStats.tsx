import type { DockerStats } from '@slideops/api-client';
import { Button, Card, StatTile, Text } from '@slideops/design-system';
import { Activity, ArrowRightLeft, Cpu, HardDrive, MemoryStick } from '@slideops/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { containerUsageOption, type ContainerUsageSample } from '../charts/options';
import { formatBytes } from '../docker-inventory';
import { LazyChart } from './LazyChart';

/*
 * CPU and memory over time, out of the only history SlideOps actually has.
 *
 * There is no stored series behind this. The daemon answers a stats call with
 * one reading and no past, and SlideOps does not yet keep container samples, so
 * the only points that exist are the ones taken while this tab has been open.
 * The chart draws those and says so in plain words above it.
 *
 * What it deliberately does not do is offer a last-hour or last-day control. A
 * range control is a promise that choosing it fills the chart, and filling an
 * hour SlideOps never watched would mean interpolating, back-filling from a
 * single reading, or drawing a flat line through time nobody measured. Any of
 * those is a graph that says something untrue about somebody's production
 * server, and it would be believed because it looks exactly like a real one.
 * The honest version of this chart is short and says why it is short.
 */

/**
 * The most samples kept.
 *
 * At the five second cadence the screen polls on, this is a little over an hour
 * of watching, which is longer than anybody keeps a tab open on one container
 * and short enough that the array never becomes the reason the page is slow.
 */
const MAX_SAMPLES = 720;

/** A percentage rounded for reading, never rounded down to nothing. */
function percent(value: number): string {
  return value > 0 && value < 1 ? '<1%' : `${Math.round(value)}%`;
}

/** Whole MB through the one byte formatter this workspace uses. */
function megabytes(mb: number): string {
  return formatBytes(mb * 1024 * 1024);
}

/** How long the collected window covers, in the plainest words available. */
function span(samples: ContainerUsageSample[]): string {
  if (samples.length < 2) {
    return 'less than a minute';
  }
  const first = new Date(samples[0]!.at).getTime();
  const last = new Date(samples[samples.length - 1]!.at).getTime();
  const seconds = Math.round((last - first) / 1000);
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  const minutes = Math.round(seconds / 60);
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

export interface DockerContainerStatsProps {
  /** The latest sample, or undefined when the last pass did not cover this container. */
  stat?: DockerStats;
  containerName: string;
}

/**
 * The Stats tab: the samples taken while this tab has been open, and the latest
 * reading in full.
 */
export function DockerContainerStats({ stat, containerName }: DockerContainerStatsProps) {
  const [samples, setSamples] = useState<ContainerUsageSample[]>([]);

  /*
   * One point per reading the screen hands down.
   *
   * The screen re-reads the daemon on a timer and passes the newest sample in,
   * so a new object identity is a new reading. A pass that covered nothing
   * contributes no point at all rather than a zero, which is why this returns
   * early instead of appending a blank: a gap in the line is the truth about a
   * container that was not sampled.
   */
  useEffect(() => {
    if (!stat) {
      return;
    }
    setSamples((current) => {
      const next = current.concat({
        at: new Date().toISOString(),
        cpu_percent: stat.cpu_percent,
        memory_used_mb: stat.memory_used_mb,
      });
      return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next;
    });
  }, [stat]);

  // Rebuilt only when the samples change, since Chart takes the builder as a
  // dependency and a fresh closure on every render would repaint continuously.
  const build = useCallback(
    (palette: Parameters<typeof containerUsageOption>[0]) => containerUsageOption(palette, samples),
    [samples],
  );

  const startedRef = useRef(new Date());

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity width={18} height={18} className="text-brand" aria-hidden />
            <Text variant="h4">CPU and memory while you have been watching</Text>
          </div>
          {samples.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => setSamples([])}>
              Start again
            </Button>
          ) : null}
        </div>

        <Text variant="body-sm" tone="secondary">
          SlideOps keeps no history of container usage, so this chart is built from the readings
          taken since you opened this tab at {startedRef.current.toLocaleTimeString()}. It does not
          reach back before that, and leaving this tab starts it over. There is no last-hour view
          because there is no last hour to show.
        </Text>

        {samples.length < 2 ? (
          <div className="rounded-md border border-dashed border-border bg-surface px-4 py-6">
            <Text variant="body-sm" tone="secondary">
              {stat
                ? `Collecting readings for ${containerName}. The line appears once there are two of them.`
                : `No live sample covered ${containerName} on the last pass, so there is nothing to plot. That is usually because it is not running.`}
            </Text>
          </div>
        ) : (
          <>
            <LazyChart
              build={build}
              height={280}
              ariaLabel={`CPU percent and memory in MB for ${containerName}, ${samples.length} readings over the last ${span(samples)}`}
            />
            <Text variant="caption" tone="secondary" className="normal-case tracking-normal">
              {samples.length} readings over {span(samples)}. CPU is Docker's own figure, which is a
              percentage of one core and passes 100 on a container using more than one.
            </Text>
          </>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <Text variant="h4">The latest reading</Text>
        {stat ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile bordered icon={Cpu} label="CPU" value={percent(stat.cpu_percent)} />
            <StatTile
              bordered
              icon={MemoryStick}
              label="Memory"
              value={megabytes(stat.memory_used_mb)}
            />
            <StatTile
              bordered
              icon={ArrowRightLeft}
              label="Network in / out"
              value={`${formatBytes(stat.net_rx_bytes)} / ${formatBytes(stat.net_tx_bytes)}`}
            />
            <StatTile
              bordered
              icon={HardDrive}
              label="Block read / written"
              value={`${formatBytes(stat.block_read_bytes)} / ${formatBytes(stat.block_write_bytes)}`}
            />
            <StatTile bordered icon={Activity} label="Processes" value={String(stat.pids)} />
          </div>
        ) : (
          <Text variant="body-sm" tone="secondary">
            No live sample covered {containerName} on the last pass, so every figure here would be
            invented. Nothing is shown rather than zeros.
          </Text>
        )}
        {stat ? (
          <Text variant="body-sm" tone="secondary">
            Network and block figures are totals since the container started, not rates.
          </Text>
        ) : null}
      </Card>
    </div>
  );
}
