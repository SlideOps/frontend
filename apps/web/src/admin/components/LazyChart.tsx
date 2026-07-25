import { lazy, Suspense } from 'react';
import { LogoLoader } from '../../components/LogoLoader';
import type { ChartProps } from './Chart';

/*
 * The charting library is heavy, so it loads on demand. React.lazy pulls the
 * Chart module (and ECharts with it) into its own chunk the first time a chart
 * renders, keeping the first load of the control plane small. Until it arrives a
 * calm placeholder holds the space so the layout never jumps.
 */
const Chart = lazy(() => import('./Chart'));

export function LazyChart(props: ChartProps) {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center rounded-md bg-subtle"
          style={{ height: props.height ?? 260 }}
        >
          <LogoLoader size="sm" />
        </div>
      }
    >
      <Chart {...props} />
    </Suspense>
  );
}
