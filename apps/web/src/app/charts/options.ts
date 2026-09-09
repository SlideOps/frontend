import type { ChartPalette } from '@slideops/design-system';
import type { NodeMetricSample, TransactionPoint } from '@slideops/api-client';
import type { EChartsOption } from 'echarts';

/*
 * The chart option builders for the Operator surface. Each takes the resolved
 * token palette and the data, and returns an ECharts option whose every color is
 * a design token, so the charts follow light and dark and never hard-code a hex.
 */

function axisStyle(palette: ChartPalette) {
  return {
    axisLine: { lineStyle: { color: palette.border } },
    axisTick: { show: false },
    axisLabel: { color: palette.textMuted, fontSize: 11 },
    splitLine: { lineStyle: { color: palette.border, opacity: 0.6 } },
  };
}

function shortTime(at?: string): string {
  if (!at) {
    return '';
  }
  const date = new Date(at);
  return Number.isNaN(date.getTime())
    ? at
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * A Node's recent health: memory and root disk used as percentages, on one axis,
 * with CPU load on a second axis. Missing readings are simply omitted.
 */
export function nodeHealthOption(
  palette: ChartPalette,
  history: NodeMetricSample[],
): EChartsOption {
  const times = history.map((sample) => shortTime(sample.at));
  return {
    grid: { top: 28, right: 44, bottom: 28, left: 40 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.raised,
      borderColor: palette.border,
      borderWidth: 1,
      textStyle: { color: palette.text, fontSize: 12 },
    },
    legend: {
      top: 0,
      textStyle: { color: palette.textMuted, fontSize: 11 },
      icon: 'circle',
    },
    xAxis: { type: 'category', data: times, boundaryGap: false, ...axisStyle(palette) },
    yAxis: [
      { type: 'value', name: '%', min: 0, max: 100, ...axisStyle(palette) },
      { type: 'value', name: 'load', ...axisStyle(palette) },
    ],
    series: [
      {
        type: 'line',
        name: 'Memory',
        smooth: true,
        showSymbol: false,
        data: history.map((sample) => sample.memory_used_percent ?? null),
        lineStyle: { color: palette.info, width: 2 },
        itemStyle: { color: palette.info },
      },
      {
        type: 'line',
        name: 'Disk',
        smooth: true,
        showSymbol: false,
        data: history.map((sample) => sample.disk_used_percent ?? null),
        lineStyle: { color: palette.warning, width: 2 },
        itemStyle: { color: palette.warning },
      },
      {
        type: 'line',
        name: 'CPU load',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        data: history.map((sample) => sample.cpu_load ?? null),
        lineStyle: { color: palette.brand, width: 2 },
        itemStyle: { color: palette.brand },
      },
    ],
  };
}

/**
 * The Transactions page activity chart: how much was successfully paid in
 * each period, one currency at a time (points already come pre-bucketed by
 * currency, so amounts from different currencies are never mixed into one
 * bar). Pending and failed counts ride along in the tooltip rather than as
 * their own series, so the chart stays about money moving, not clutter.
 */
export function transactionsOverTimeOption(
  palette: ChartPalette,
  points: TransactionPoint[],
  currency: string,
): EChartsOption {
  const filtered = points.filter((p) => p.currency === currency);
  return {
    grid: { top: 20, right: 16, bottom: 28, left: 56 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.raised,
      borderColor: palette.border,
      borderWidth: 1,
      textStyle: { color: palette.text, fontSize: 12 },
      formatter: (params) => {
        const items = Array.isArray(params) ? params : [params];
        const point = filtered[items[0]?.dataIndex ?? 0];
        if (!point) {
          return '';
        }
        const paid = (point.successful_minor / 100).toLocaleString(undefined, {
          style: 'currency',
          currency,
        });
        return [
          `<strong>${point.period}</strong>`,
          `Paid: ${paid} (${point.successful_count})`,
          point.pending_count ? `Pending: ${point.pending_count}` : null,
          point.failed_count ? `Failed: ${point.failed_count}` : null,
        ]
          .filter(Boolean)
          .join('<br/>');
      },
    },
    xAxis: {
      type: 'category',
      data: filtered.map((p) => p.period),
      ...axisStyle(palette),
    },
    yAxis: { type: 'value', ...axisStyle(palette) },
    series: [
      {
        type: 'bar',
        name: 'Paid',
        data: filtered.map((p) => p.successful_minor / 100),
        itemStyle: { color: palette.brand, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 28,
      },
    ],
  };
}

/**
 * One sample of a container's live usage, taken at a moment SlideOps knows.
 *
 * `at` is when the reading was taken by the screen holding these, not a
 * timestamp the daemon supplied: Docker's stats call answers with a reading and
 * no clock, so the only honest time to put on the axis is the one at which the
 * question was asked.
 */
export interface ContainerUsageSample {
  at: string;
  cpu_percent: number;
  memory_used_mb: number;
}

/**
 * A sample clock down to the second.
 *
 * Container samples arrive seconds apart, so the hour-and-minute label the Node
 * health chart uses would put the same text on a dozen consecutive points and
 * make a five minute window unreadable.
 */
function clockTime(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime())
    ? at
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * One container's CPU and memory across the samples a screen has collected.
 *
 * Two axes, because the two series are in different units and sharing one would
 * flatten whichever number happens to be smaller into the floor. CPU is a
 * percentage as Docker reports it, which runs past 100 on a container using more
 * than one core, so the axis is deliberately not capped at 100: clamping it
 * would hide exactly the case worth seeing.
 *
 * Gaps are gaps. A poll that failed contributes no sample at all rather than a
 * zero, and the line simply has no point there.
 */
export function containerUsageOption(
  palette: ChartPalette,
  samples: ContainerUsageSample[],
): EChartsOption {
  return {
    grid: { top: 28, right: 52, bottom: 28, left: 48 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.raised,
      borderColor: palette.border,
      borderWidth: 1,
      textStyle: { color: palette.text, fontSize: 12 },
    },
    legend: {
      top: 0,
      textStyle: { color: palette.textMuted, fontSize: 11 },
      icon: 'circle',
    },
    xAxis: {
      type: 'category',
      data: samples.map((sample) => clockTime(sample.at)),
      boundaryGap: false,
      ...axisStyle(palette),
    },
    yAxis: [
      { type: 'value', name: 'CPU %', min: 0, ...axisStyle(palette) },
      { type: 'value', name: 'MB', min: 0, ...axisStyle(palette) },
    ],
    series: [
      {
        type: 'line',
        name: 'CPU',
        smooth: true,
        showSymbol: false,
        data: samples.map((sample) => sample.cpu_percent),
        lineStyle: { color: palette.brand, width: 2 },
        itemStyle: { color: palette.brand },
      },
      {
        type: 'line',
        name: 'Memory',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        data: samples.map((sample) => sample.memory_used_mb),
        lineStyle: { color: palette.info, width: 2 },
        itemStyle: { color: palette.info },
      },
    ],
  };
}
