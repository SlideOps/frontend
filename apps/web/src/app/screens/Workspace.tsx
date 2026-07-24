import {
  listCapabilities,
  listNodes,
  listOperations,
  listProjects,
  type Capability,
  type Node,
  type Operation,
  type Project,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowRight, CheckCircle2, Layers, Plus, Server, XCircle } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { TierPanel } from '../components/TierPanel';
import { NodeRow } from './Nodes';
import { useAsyncData } from '../hooks/useAsyncData';

interface WorkspaceData {
  projects: Project[];
  nodes: Node[];
  operations: Operation[];
  capabilities: Capability[];
}

async function loadWorkspace(signal: AbortSignal): Promise<WorkspaceData> {
  const [projects, nodes, operations, capabilities] = await Promise.all([
    listProjects(signal),
    listNodes(signal),
    listOperations({}, signal),
    listCapabilities(undefined, signal),
  ]);
  return { projects, nodes, operations, capabilities };
}

function StatCard({
  label,
  value,
  guidanceKey,
}: {
  label: string;
  value: number;
  guidanceKey: string;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
        <Guidance for={guidanceKey} />
      </div>
      <Text variant="h1" className="mt-2">
        {String(value)}
      </Text>
    </Card>
  );
}

function HealthCard({ operations }: { operations: Operation[] }) {
  const completed = operations.filter((operation) => operation.status === 'completed').length;
  const failed = operations.filter((operation) => operation.status === 'failed').length;
  const running = operations.filter((operation) =>
    ['approved', 'executing', 'verifying'].includes(operation.status),
  ).length;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Text variant="caption" tone="secondary">
          Health at a glance
        </Text>
        <Guidance for="dashboard.health" />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 width={16} height={16} className="text-success" aria-hidden />
          <Text variant="body-sm">
            {completed} verified
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <XCircle width={16} height={16} className="text-danger" aria-hidden />
          <Text variant="body-sm">{failed} failed</Text>
        </div>
        <Text variant="body-sm" tone="secondary">
          {running > 0 ? `${running} running now` : 'Nothing running now'}
        </Text>
      </div>
    </Card>
  );
}

/** The Workspace home: Projects, Nodes, recent Operations, and recommendations. */
export function Workspace() {
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => loadWorkspace(signal), []);

  return (
    <OperatorShell active="home">
      <PageHeader
        title="Workspace"
        description="Your Projects, Nodes, and recent Operations at a glance."
        guidanceKey="dashboard.workspace"
        actions={
          <Button onClick={() => navigate('/app/nodes/new')}>
            <Plus width={16} height={16} aria-hidden />
            Connect a Node
          </Button>
        }
      />

      {state.status === 'loading' ? <Loading label="Loading your Workspace" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        <div className="flex flex-col gap-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Projects" value={state.data.projects.length} guidanceKey="dashboard.projects" />
            <StatCard label="Nodes" value={state.data.nodes.length} guidanceKey="dashboard.nodes" />
            <StatCard
              label="Operations"
              value={state.data.operations.length}
              guidanceKey="dashboard.operations"
            />
            <HealthCard operations={state.data.operations} />
          </div>

          <TierPanel />

          {state.data.nodes.length === 0 ? (
            <EmptyState
              icon={Server}
              title="Connect your first Node"
              description="A Node is a Linux machine you reach over SSH. Connect one and SlideOps will discover its state without changing anything, then recommend what to do next."
              action={<Button onClick={() => navigate('/app/nodes/new')}>Connect a Node</Button>}
            />
          ) : (
            <div className="grid gap-8 lg:grid-cols-2">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Text variant="h3">Nodes</Text>
                    <Guidance for="dashboard.nodes" />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/app/nodes')}>
                    All Nodes
                    <ArrowRight width={15} height={15} aria-hidden />
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  {state.data.nodes.slice(0, 4).map((node) => (
                    <NodeRow key={node.id} node={node} onOpen={() => navigate(`/app/nodes/${node.id}`)} />
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Text variant="h3">Recent Operations</Text>
                    <Guidance for="dashboard.operations" />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/app/operations')}>
                    History
                    <ArrowRight width={15} height={15} aria-hidden />
                  </Button>
                </div>
                {state.data.operations.length === 0 ? (
                  <Card>
                    <Text variant="body-sm" tone="secondary">
                      No Operations yet. Open a Node, run Discovery, and start one.
                    </Text>
                  </Card>
                ) : (
                  <div className="flex flex-col gap-2">
                    {state.data.operations.slice(0, 5).map((operation) => (
                      <button
                        key={operation.id}
                        type="button"
                        onClick={() => navigate(`/app/operations/${operation.id}`)}
                        className="flex w-full items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <Text variant="body-sm" className="min-w-0 flex-1 truncate font-medium">
                          {operation.capability_key}
                        </Text>
                        <StatusBadge status={operation.status} />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {state.data.nodes.length > 0 && state.data.capabilities.length > 0 ? (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Text variant="h3">Recommendations</Text>
                <Guidance for="dashboard.recommendations" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {state.data.capabilities.slice(0, 2).map((capability) => (
                  <Card key={capability.key} className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                      <Layers width={18} height={18} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Text variant="h4">{capability.name}</Text>
                      <Text variant="body-sm" tone="secondary" className="mt-1">
                        Recommended for your Nodes. {capability.description}
                      </Text>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 px-0"
                        onClick={() => navigate(`/app/capabilities/${capability.key}`)}
                      >
                        View this Capability
                        <ArrowRight width={15} height={15} aria-hidden />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </OperatorShell>
  );
}
