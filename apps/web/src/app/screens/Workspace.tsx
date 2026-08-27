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
import { Button, StatTile, Text } from '@slideops/design-system';
import { ArrowRight, capabilityIcon, CheckCircle2, Plus, Server, XCircle } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useNavigate } from 'react-router-dom';
import { activeWorkspace, useWorkspaceStore } from '../../store/workspace';
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
    listCapabilities({}, signal),
  ]);
  return { projects, nodes, operations, capabilities };
}

function HealthCard({ operations }: { operations: Operation[] }) {
  const completed = operations.filter((operation) => operation.status === 'completed').length;
  const failed = operations.filter((operation) => operation.status === 'failed').length;
  const running = operations.filter((operation) =>
    ['approved', 'executing', 'verifying'].includes(operation.status),
  ).length;

  return (
    <div className="flex-1 px-5 py-4">
      <div className="flex items-center gap-1.5">
        <Text variant="caption" tone="secondary">
          Health at a glance
        </Text>
        <Guidance for="dashboard.health" size={14} />
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <CheckCircle2 width={16} height={16} className="text-success" aria-hidden />
          <Text variant="body-sm">{completed} verified</Text>
        </div>
        <div className="flex items-center gap-2">
          <XCircle width={16} height={16} className="text-danger" aria-hidden />
          <Text variant="body-sm">{failed} failed</Text>
        </div>
        <Text variant="body-sm" tone="secondary">
          {running > 0 ? `${running} running now` : 'Nothing running now'}
        </Text>
      </div>
    </div>
  );
}

/** The Workspace home: Projects, Nodes, recent Operations, and recommendations. */
export function Workspace() {
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => loadWorkspace(signal), []);
  const workspaces = useWorkspaceStore((store) => store.workspaces);
  const active = activeWorkspace(workspaces);

  return (
    <OperatorShell active="home">
      <PageHeader
        title={active?.name ?? 'Workspace'}
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
          {/* One strip, divided by hairlines, rather than four framed boxes for
              four numbers. */}
          <div className="flex flex-col divide-y divide-border border-b border-border sm:flex-row sm:divide-x sm:divide-y-0">
            <StatTile
              className="first:pl-0"
              label="Projects"
              value={state.data.projects.length}
              adornment={<Guidance for="dashboard.projects" size={14} />}
            />
            <StatTile
              label="Nodes"
              value={state.data.nodes.length}
              adornment={<Guidance for="dashboard.nodes" size={14} />}
            />
            <StatTile
              label="Operations"
              value={state.data.operations.length}
              adornment={<Guidance for="dashboard.operations" size={14} />}
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
                    <NodeRow
                      key={node.id}
                      node={node}
                      boxed
                      onOpen={() => navigate(`/app/nodes/${node.id}`)}
                    />
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
                  <Text variant="body-sm" tone="secondary">
                    No Operations yet. Open a Node, run Discovery, and start one.
                  </Text>
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
              {/* Rows, like every other list of Capabilities, so the same thing
                  looks the same wherever it appears. */}
              <div className="flex flex-col divide-y divide-border border-y border-border">
                {state.data.capabilities.slice(0, 2).map((capability) => {
                  const Icon = capabilityIcon(capability);
                  return (
                  <div key={capability.key} className="flex items-start gap-3 py-3.5">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                      <Icon width={15} height={15} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Text variant="body-sm" className="font-medium">
                        {capability.name}
                      </Text>
                      <Text
                        variant="caption"
                        tone="secondary"
                        className="mt-0.5 line-clamp-2 block"
                      >
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
                  </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </OperatorShell>
  );
}
