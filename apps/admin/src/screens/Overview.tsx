import { Card, Text } from '@slideops/design-system';
import { Activity, Gauge, ListChecks, ShieldCheck, Users } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { AppShell, PageHeader, type NavItem } from '@slideops/ui';

const nav: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: Gauge, active: true },
  { key: 'operators', label: 'Operators', icon: Users },
  { key: 'operations', label: 'Operations', icon: Activity },
  { key: 'audit', label: 'Audit log', icon: ListChecks },
];

interface Metric {
  label: string;
  value: string;
  guidanceKey: string;
}

const metrics: Metric[] = [
  { label: 'Platform health', value: 'Nominal', guidanceKey: 'overview.health' },
  { label: 'Active Operations', value: '0', guidanceKey: 'overview.operations' },
  { label: 'Operators', value: '0', guidanceKey: 'overview.operators' },
  { label: 'Executions paused', value: 'No', guidanceKey: 'overview.emergency' },
];

/** Placeholder Admin overview. Denser and calmer than the Operator surface. */
export function Overview() {
  return (
    <AppShell surface="Admin" nav={nav} dense>
      <PageHeader
        title="Overview"
        description="A calm read on the whole platform. Oversight and analytics across every tenant, with emergency controls kept close but deliberate."
        guidanceKey="overview.health"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="p-4">
            <div className="flex items-center justify-between">
              <Text variant="caption" tone="secondary">
                {metric.label}
              </Text>
              <Guidance for={metric.guidanceKey} />
            </div>
            <Text variant="h3" className="mt-2">
              {metric.value}
            </Text>
          </Card>
        ))}
      </div>

      <Card className="mt-6 flex items-start gap-3 p-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
          <ShieldCheck width={18} height={18} aria-hidden />
        </span>
        <div>
          <Text variant="h4">Emergency controls</Text>
          <Text variant="body-sm" tone="secondary" className="mt-1">
            Pause or resume executions platform wide. Every action is confirmed and written to the
            immutable audit trail.
          </Text>
        </div>
        <div className="ml-auto">
          <Guidance for="overview.emergency" placement="left" />
        </div>
      </Card>
    </AppShell>
  );
}
