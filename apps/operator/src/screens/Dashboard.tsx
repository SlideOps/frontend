import { Card, Text } from '@slideops/design-system';
import { Network } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState, PageHeader } from '@slideops/ui';
import { OperatorShell } from '../components/OperatorShell';

interface Stat {
  label: string;
  value: string;
  guidanceKey: string;
}

const stats: Stat[] = [
  { label: 'Projects', value: '0', guidanceKey: 'dashboard.workspace' },
  { label: 'Nodes', value: '0', guidanceKey: 'dashboard.nodes' },
  { label: 'Recent Operations', value: '0', guidanceKey: 'dashboard.operations' },
];

/** The Operator dashboard, built on the shared AppShell and guidance. */
export function Dashboard() {
  return (
    <OperatorShell active="home">
      <PageHeader
        title="Workspace"
        description="Your Projects, Nodes, and recent Operations at a glance. Connect your first Node to begin."
        guidanceKey="dashboard.workspace"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-center justify-between">
              <Text variant="caption" tone="secondary">
                {stat.label}
              </Text>
              <Guidance for={stat.guidanceKey} />
            </div>
            <Text variant="h1" className="mt-2">
              {stat.value}
            </Text>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <EmptyState
          icon={Network}
          title="No Nodes connected yet"
          description="A Node is a Linux machine you reach over SSH. Connect one and SlideOps will discover its state without changing anything."
        />
      </div>
    </OperatorShell>
  );
}
