import type { ChartPalette } from '@slideops/design-system';
import type {
  CapabilityUsage,
  OperationsOverTimePoint,
} from '@slideops/api-client';
import type { EChartsOption } from 'echarts';

/*
 * The chart option builders for the control plane. Each takes the resolved token
 * palette and the data, and returns an ECharts option whose every color is a
 * design token, so the charts follow light and dark and never hard-code a hex.
 * Grid, axis, and tooltip chrome all read from the palette too.
 */

/** Shared axis and grid styling so every chart shares the same calm chrome. */
function axisStyle(palette: ChartPalette) {
  return {
    axisLine: { lineStyle: { color: palette.border } },
    axisTick: { show: false },
    axisLabel: { color: palette.textMuted, fontSize: 11 },
    splitLine: { lineStyle: { color: palette.border, opacity: 0.6 } },
  };
}

function tooltipStyle(palette: ChartPalette) {
  return {
    backgroundColor: palette.raised,
    borderColor: palette.border,
    borderWidth: 1,
    textStyle: { color: palette.text, fontSize: 12 },
  } as const;
}

/** A line of Operations run per day. */
export function operationsOverTimeOption(
  palette: ChartPalette,
  points: OperationsOverTimePoint[],
): EChartsOption {
  return {
    grid: { top: 16, right: 16, bottom: 28, left: 40 },
    tooltip: { trigger: 'axis', ...tooltipStyle(palette) },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.date),
      boundaryGap: false,
      ...axisStyle(palette),
    },
    yAxis: { type: 'value', minInterval: 1, ...axisStyle(palette) },
    series: [
      {
        type: 'line',
        name: 'Operations',
        smooth: true,
        showSymbol: false,
        data: points.map((p) => p.count),
        lineStyle: { color: palette.brand, width: 2 },
        areaStyle: { color: palette.brand, opacity: 0.12 },
        itemStyle: { color: palette.brand },
      },
    ],
  };
}

/** A horizontal bar of Capability usage, most used first. */
export function capabilityUsageOption(
  palette: ChartPalette,
  usage: CapabilityUsage[],
): EChartsOption {
  const sorted = [...usage].sort((a, b) => a.count - b.count);
  return {
    grid: { top: 8, right: 24, bottom: 8, left: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...tooltipStyle(palette) },
    xAxis: { type: 'value', minInterval: 1, ...axisStyle(palette) },
    yAxis: {
      type: 'category',
      data: sorted.map((u) => u.capability_key),
      ...axisStyle(palette),
    },
    series: [
      {
        type: 'bar',
        name: 'Runs',
        data: sorted.map((u) => u.count),
        itemStyle: { color: palette.info, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 20,
      },
    ],
  };
}

/** Map an Operation status to the palette color that reads as its tone. */
function statusColor(palette: ChartPalette, status: string): string {
  if (status === 'completed') return palette.success;
  if (status === 'failed') return palette.danger;
  if (status === 'cancelled') return palette.textMuted;
  if (status === 'awaiting_approval') return palette.warning;
  return palette.info;
}

/** A donut of Operations by status. */
export function statusBreakdownOption(
  palette: ChartPalette,
  byStatus: Record<string, number>,
): EChartsOption {
  const entries = Object.entries(byStatus).filter(([, count]) => count > 0);
  return {
    tooltip: { trigger: 'item', ...tooltipStyle(palette) },
    legend: {
      bottom: 0,
      textStyle: { color: palette.textMuted, fontSize: 11 },
      icon: 'circle',
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '72%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderColor: palette.border, borderWidth: 2 },
        data: entries.map(([status, count]) => ({
          name: status.replace(/_/g, ' '),
          value: count,
          itemStyle: { color: statusColor(palette, status) },
        })),
      },
    ],
  };
}
