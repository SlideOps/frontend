import { getAnalytics, getOverview } from '@slideops/api-client';
import { Card, StatTile, Text, type ChartPalette } from '@slideops/design-system';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { useCallback } from 'react';
import { AdminShell } from '../components/AdminShell';
import { ErrorNote, Loading } from '../components/Feedback';
import { LazyChart } from '../components/LazyChart';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  capabilityUsageOption,
  operationsOverTimeOption,
  statusBreakdownOption,
} from '../charts/options';

/** The Admin overview: headline numbers, a status breakdown, and two charts. */
export function Overview() {
  const overview = useAsyncData((signal) => getOverview(signal), []);
  const analytics = useAsyncData((signal) => getAnalytics(signal), []);

  const overTime =
    analytics.state.status === 'ready' ? analytics.state.data.operations_over_time : [];
  const usage = analytics.state.status === 'ready' ? analytics.state.data.capability_usage : [];
  const byStatus =
    overview.state.status === 'ready' ? overview.state.data.operations_by_status : {};

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
    <AdminShell active="overview">
      <PageHeader
        title="Overview"
        description="A calm read on the whole platform. Oversight and analytics across every tenant, with emergency controls kept close but deliberate."
        guidanceKey="overview.health"
      />

      {overview.state.status === 'loading' ? <Loading label="Reading the platform" /> : null}
      {overview.state.status === 'error' ? <ErrorNote error={overview.state.error} /> : null}
      {overview.state.status === 'ready' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile
              bordered
              label="Operators"
              value={overview.state.data.operators_total}
              adornment={<Guidance for="overview.operators" />}
            />
            <StatTile
              bordered
              label="Nodes"
              value={overview.state.data.nodes_total}
              adornment={<Guidance for="overview.nodes" />}
            />
            <StatTile
              bordered
              label="Operations"
              value={overview.state.data.operations_total}
              adornment={<Guidance for="overview.operations" />}
            />
            <StatTile
              bordered
              label="Active now"
              value={overview.state.data.active_operations}
              adornment={<Guidance for="overview.active" />}
              tone={overview.state.data.active_operations > 0 ? 'warning' : 'primary'}
            />
            <StatTile
              bordered
              label="Failures, 24h"
              value={overview.state.data.failures_last_24h}
              adornment={<Guidance for="overview.failures" />}
              tone={overview.state.data.failures_last_24h > 0 ? 'danger' : 'primary'}
            />
            <StatTile
              bordered
              label="Suspended Operators"
              value={overview.state.data.operators_suspended}
              adornment={<Guidance for="overview.suspended" />}
              tone={overview.state.data.operators_suspended > 0 ? 'danger' : 'primary'}
            />
          </div>

          <Card
            className={`mt-4 flex items-center justify-between gap-3 p-4 ${
              overview.state.data.executions_paused ? 'border-danger' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <Text variant="body-sm" className="font-medium">
                Executions are{' '}
                {overview.state.data.executions_paused
                  ? 'paused platform wide'
                  : 'running normally'}
              </Text>
              <Guidance for="overview.emergency" />
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium ${
                overview.state.data.executions_paused
                  ? 'bg-subtle text-danger'
                  : 'bg-subtle text-success'
              }`}
            >
              {overview.state.data.executions_paused ? 'Paused' : 'Live'}
            </span>
          </Card>
        </>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Text variant="h4">Operations over time</Text>
            <Guidance for="analytics.over_time" />
          </div>
          {analytics.state.status === 'loading' ? (
            <Loading label="Loading analytics" />
          ) : (
            <LazyChart ariaLabel="Operations run per day" build={buildOverTime} height={240} />
          )}
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Text variant="h4">Status breakdown</Text>
            <Guidance for="analytics.status" />
          </div>
          {overview.state.status === 'loading' ? (
            <Loading label="Loading status" />
          ) : (
            <LazyChart ariaLabel="Operations by status" build={buildStatus} height={240} />
          )}
        </Card>
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Text variant="h4">Capability usage</Text>
            <Guidance for="analytics.capabilities" />
          </div>
          {analytics.state.status === 'loading' ? (
            <Loading label="Loading analytics" />
          ) : (
            <LazyChart
              ariaLabel="Capability usage"
              build={buildUsage}
              height={Math.max(200, usage.length * 34)}
            />
          )}
        </Card>
      </div>

      {analytics.state.status === 'error' ? (
        <div className="mt-4">
          <ErrorNote error={analytics.state.error} />
        </div>
      ) : null}
    </AdminShell>
  );
}
