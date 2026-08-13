import { listNodes, type Node } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ChevronRight, Plus, Search, Server } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useMemo, useState } from 'react';
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
        <div className="flex flex-wrap items-center gap-2">
          <Text variant="body-sm" className="font-medium">
            {node.name}
          </Text>
          {node.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-pill bg-subtle px-2 py-0.5 text-xs font-medium text-ink-muted"
            >
              {tag}
            </span>
          ))}
        </div>
        <Text variant="body-sm" tone="secondary" className="truncate">
          {node.ssh_username}@{node.address}:{node.port}
          {node.distro
            ? ` · ${node.distro}${node.distro_version ? ` ${node.distro_version}` : ''}`
            : ''}
        </Text>
      </span>
      <span className="hidden shrink-0 text-xs text-ink-muted sm:block">{discovered}</span>
      <ChevronRight width={18} height={18} className="shrink-0 text-ink-muted" aria-hidden />
    </button>
  );
}

/** Every Node whose name, address, username, or tags match the search term. */
function filterNodes(nodes: Node[], search: string): Node[] {
  const term = search.trim().toLowerCase();
  if (term === '') {
    return nodes;
  }
  return nodes.filter((node) =>
    [node.name, node.hostname, node.address, node.ssh_username, ...node.tags]
      .join(' ')
      .toLowerCase()
      .includes(term),
  );
}

const UNGROUPED = 'Ungrouped';

/** Nodes bucketed by their first tag, in the order each group first appears. */
function groupByFirstTag(nodes: Node[]): Array<[string, Node[]]> {
  const groups = new Map<string, Node[]>();
  for (const node of nodes) {
    const key = node.tags[0] ?? UNGROUPED;
    const existing = groups.get(key);
    if (existing) {
      existing.push(node);
    } else {
      groups.set(key, [node]);
    }
  }
  // Ungrouped last, so a mostly-tagged Workspace does not open on a pile of
  // untagged Nodes before the groups an Operator actually organized.
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === UNGROUPED) return 1;
    if (b === UNGROUPED) return -1;
    return a.localeCompare(b);
  });
}

/** The Nodes list: every Node the Operator has connected. */
export function Nodes() {
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => listNodes(signal), []);
  const [search, setSearch] = useState('');
  const [grouped, setGrouped] = useState(false);

  const filtered = useMemo(
    () => (state.status === 'ready' ? filterNodes(state.data, search) : []),
    [state, search],
  );
  const groups = useMemo(() => (grouped ? groupByFirstTag(filtered) : null), [grouped, filtered]);

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
            action={
              <Button onClick={() => navigate('/app/nodes/new')}>Connect your first server</Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 sm:max-w-xs">
                <Search
                  width={15}
                  height={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                  aria-hidden
                />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, address, or tag"
                  className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  className="accent-brand"
                  checked={grouped}
                  onChange={(event) => setGrouped(event.target.checked)}
                />
                Group by tag
              </label>
            </div>

            {filtered.length === 0 ? (
              <Text variant="body-sm" tone="secondary">
                No servers match "{search}".
              </Text>
            ) : groups ? (
              <div className="flex flex-col gap-5">
                {groups.map(([tag, nodes]) => (
                  <div key={tag} className="flex flex-col gap-2">
                    <Text variant="body-sm" tone="secondary" className="font-medium uppercase">
                      {tag}
                    </Text>
                    {nodes.map((node) => (
                      <NodeRow
                        key={node.id}
                        node={node}
                        onOpen={() => navigate(`/app/nodes/${node.id}`)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map((node) => (
                  <NodeRow
                    key={node.id}
                    node={node}
                    onOpen={() => navigate(`/app/nodes/${node.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      ) : null}
    </OperatorShell>
  );
}

/** A compact card used by the Workspace home to preview a Node. */
export { NodeRow };
