import type { ChartPalette } from '@slideops/design-system';
import type { NodeMetricSample } from '@slideops/api-client';
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
  return Number.isNaN(date.getTime()) ? at : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * A Node's recent health: memory and root disk used as percentages, on one axis,
 * with CPU load on a second axis. Missing readings are simply omitted.
 */
export function nodeHealthOption(palette: ChartPalette, history: NodeMetricSample[]): EChartsOption {
  const times = history.map((sample) => shortTime(sample.at));
  return {
    grid: { top: 28, right: 44, bottom: 28, left: 40 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.text,
      borderWidth: 0,
      textStyle: { color: palette.textOnBrand, fontSize: 12 },
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
