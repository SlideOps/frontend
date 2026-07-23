import {
  ApiError,
  createOperation,
  listCapabilities,
  listNodes,
  type Capability,
  type Node,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { Layers, Play, Search } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CapabilityCard } from '../components/CapabilityCard';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

const selectClass =
  'h-9 rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** The action on a catalog card: pick a Node, then start the Operation. */
function StartOnNode({ capability, nodes }: { capability: Capability; nodes: Node[] }) {
  const navigate = useNavigate();
  const [nodeId, setNodeId] = useState<string>(nodes[0]?.id ?? '');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (nodes.length === 0) {
    return (
      <Text variant="body-sm" tone="secondary">
        Connect a Node to run this Capability.
      </Text>
    );
  }

  const start = async () => {
    if (!nodeId) {
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const operation = await createOperation({ node_id: nodeId, capability_key: capability.key });
      navigate(`/operations/${operation.id}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The Operation could not be started.');
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`node-${capability.key}`}>
          Node
        </label>
        <select
          id={`node-${capability.key}`}
          className={selectClass}
          value={nodeId}
          onChange={(event) => setNodeId(event.target.value)}
        >
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.name}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={start} disabled={starting}>
          <Play width={15} height={15} aria-hidden />
          {starting ? 'Starting' : 'Start an Operation'}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The Capability catalog, searchable by the outcome you want. */
export function Capabilities() {
  const [query, setQuery] = useState('');
  const catalog = useAsyncData((signal) => listCapabilities(query.trim() || undefined, signal), [query]);
  const nodes = useAsyncData((signal) => listNodes(signal), []);
  const nodeList = nodes.state.status === 'ready' ? nodes.state.data : [];

  return (
    <OperatorShell active="capabilities">
      <PageHeader
        title="Capabilities"
        description="Search for the outcome you want, not the technology behind it. Every Capability shows its risk, and nothing runs before you approve a plan."
      />

      <div className="mb-6 flex max-w-md items-center gap-2 rounded-md border border-border bg-surface px-3">
        <Search width={18} height={18} className="text-ink-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by outcome, for example harden SSH"
          aria-label="Search Capabilities by outcome"
          className="h-10 w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none"
        />
        <Guidance for="capability.search" />
      </div>

      {catalog.state.status === 'loading' ? <Loading label="Loading the catalog" /> : null}
      {catalog.state.status === 'error' ? <ErrorNote error={catalog.state.error} /> : null}
      {catalog.state.status === 'ready' ? (
        catalog.state.data.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No Capabilities match"
            description="Try a different outcome, or clear the search to see everything available."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {catalog.state.data.map((capability) => (
              <CapabilityCard
                key={capability.key}
                capability={capability}
                footer={<StartOnNode capability={capability} nodes={nodeList} />}
              />
            ))}
          </div>
        )
      ) : null}
    </OperatorShell>
  );
}
