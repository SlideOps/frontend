import { listNodes, type Node } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ChevronRight, Plus, Server } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useNavigate } from 'react-router-dom';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

function NodeRow({ node, onOpen }: { node: Node; onOpen: () => void }) {
  const discovered = node.last_discovered_at
    ? `Discovered ${new Date(node.last_discovered_at).toLocaleDateString()}`
    : 'Not discovered yet';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-md border border-border bg-surface px-4 py-3 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
        <Server width={18} height={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <Text variant="body-sm" className="font-medium">
          {node.name}
        </Text>
        <Text variant="body-sm" tone="secondary" className="truncate">
          {node.ssh_username}@{node.address}:{node.port}
          {node.distro ? ` · ${node.distro}${node.distro_version ? ` ${node.distro_version}` : ''}` : ''}
        </Text>
      </span>
      <span className="hidden shrink-0 text-xs text-ink-muted sm:block">{discovered}</span>
      <ChevronRight width={18} height={18} className="shrink-0 text-ink-muted" aria-hidden />
    </button>
  );
}

/** The Nodes list: every Node the Operator has connected. */
export function Nodes() {
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => listNodes(signal), []);

  return (
    <OperatorShell active="nodes">
      <PageHeader
        title="Servers"
        description="Every Linux server you have connected over SSH."
        guidanceKey="dashboard.nodes"
        actions={
          <Button onClick={() => navigate('/app/nodes/new')}>
            <Plus width={16} height={16} aria-hidden />
            Connect a server
          </Button>
        }
      />

      {state.status === 'loading' ? <Loading label="Loading your servers" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data.length === 0 ? (
          <EmptyState
            icon={Server}
            title="No servers connected yet"
            description="A server is a Linux machine you reach over SSH. Connect one and SlideOps will discover its state without changing anything."
            action={<Button onClick={() => navigate('/app/nodes/new')}>Connect your first server</Button>}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {state.data.map((node) => (
              <NodeRow key={node.id} node={node} onOpen={() => navigate(`/app/nodes/${node.id}`)} />
            ))}
          </div>
        )
      ) : null}
    </OperatorShell>
  );
}

/** A compact card used by the Workspace home to preview a Node. */
export { NodeRow };
