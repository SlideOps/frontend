import { getAnalytics } from '@slideops/api-client';
import { Card, Text, type ChartPalette } from '@slideops/design-system';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { useCallback } from 'react';
import { AdminShell } from '../components/AdminShell';
import { ErrorNote, Loading } from '../components/Feedback';
import { LazyChart } from '../components/LazyChart';
import { StatTile } from '../components/StatTile';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  capabilityUsageOption,
  operationsOverTimeOption,
  statusBreakdownOption,
} from '../charts/options';

/** Analytics: the aggregates from the analytics endpoint, drawn as charts. */
export function Analytics() {
  const { state } = useAsyncData((signal) => getAnalytics(signal), []);

  const overTime = state.status === 'ready' ? state.data.operations_over_time : [];
  const usage = state.status === 'ready' ? state.data.capability_usage : [];
  const byStatus = state.status === 'ready' ? state.data.operations_by_status : {};

  const buildOverTime = useCallback(
    (palette: ChartPalette) => operationsOverTimeOption(palette, overTime),
    [overTime],
  );
  const buildUsage = useCallback(
    (palette: ChartPalette) => capabilityUsageOption(palette, usage),
    [usage],
  );
  const buildStatus = useCallback(
    (palette: ChartPalette) => statusBreakdownOption(palette, byStatus),
    [byStatus],
  );

  return (
    <AdminShell active="analytics">
      <PageHeader
        title="Analytics"
        description="How the platform is used across every tenant: throughput over time, success, and which Capabilities Operators reach for."
        guidanceKey="analytics.over_time"
      />

      {state.status === 'loading' ? <Loading label="Loading analytics" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              label="Success rate"
              value={`${Math.round((state.data.success_rate ?? 0) * 100)}%`}
              guidanceKey="analytics.success"
              tone="success"
            />
            <StatTile
              label="Capabilities in use"
              value={state.data.capability_usage.length}
              guidanceKey="analytics.capabilities"
            />
            <StatTile
              label="Days charted"
              value={state.data.operations_over_time.length}
              guidanceKey="analytics.over_time"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Text variant="h4">Operations over time</Text>
                <Guidance for="analytics.over_time" />
              </div>
              <LazyChart ariaLabel="Operations run per day" build={buildOverTime} height={260} />
            </Card>
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Text variant="h4">Status breakdown</Text>
                <Guidance for="analytics.status" />
              </div>
              <LazyChart ariaLabel="Operations by status" build={buildStatus} height={260} />
            </Card>
            <Card className="lg:col-span-2">
              <div className="mb-3 flex items-center gap-2">
                <Text variant="h4">Capability usage</Text>
                <Guidance for="analytics.capabilities" />
              </div>
              <LazyChart
                ariaLabel="Capability usage"
                build={buildUsage}
                height={Math.max(220, usage.length * 34)}
              />
            </Card>
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}
