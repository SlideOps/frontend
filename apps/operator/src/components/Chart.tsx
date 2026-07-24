import { prefersReducedMotion, resolveChartPalette, useTheme, type ChartPalette } from '@slideops/design-system';
import * as echarts from 'echarts';
import { useEffect, useRef } from 'react';

/*
 * A theme-aware ECharts wrapper. The screen passes a builder that turns the
 * resolved design-token palette into an ECharts option, so every series and axis
 * color comes from the tokens and follows light and dark. Nothing here hard-codes
 * a color. The chart repaints when the theme changes and resizes with its box,
 * and it skips its entrance animation when the viewer prefers reduced motion.
 *
 * This module is the only place that imports ECharts, so a lazy import of the
 * screen that uses it keeps the heavy charting library out of the first load.
 */

export interface ChartProps {
  /** Build the ECharts option from the active theme's token palette. */
  build: (palette: ChartPalette) => echarts.EChartsOption;
  /** A short description of what the chart shows, for assistive technology. */
  ariaLabel: string;
  /** Chart height in pixels. */
  height?: number;
  className?: string;
}

export function Chart({ build, ariaLabel, height = 260, className }: ChartProps) {
  const { resolved } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const chart = echarts.init(container, undefined, { renderer: 'canvas' });
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // Repaint whenever the theme changes so colors follow light and dark. The
  // palette is re-resolved from the live tokens, never from a stored value.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    const palette = resolveChartPalette();
    const option = build(palette);
    chart.setOption(
      { animation: !prefersReducedMotion(), ...option },
      { notMerge: true },
    );
  }, [build, resolved]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ height, width: '100%' }}
    />
  );
}

export default Chart;
