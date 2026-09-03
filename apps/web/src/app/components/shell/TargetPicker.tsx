import {
  ApiError,
  listNodes,
  listProjects,
  listServices,
  type Node,
  type Project,
  type Service,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { Plus, Search, Server, serviceIcon } from '@slideops/icons';
import { useEffect, useRef, useState } from 'react';

/*
 * Picks any Node or Service to open a terminal tab against, from anywhere in
 * the Workspace -- the point of a global terminal page is not having to
 * navigate to a resource's own page first to reach a shell on it.
 */

export type PickedTarget =
  | { kind: 'node'; node: Node }
  | { kind: 'service'; service: Service };

interface PickerData {
  nodes: Node[];
  services: Service[];
  projectNames: Map<string, string>;
}

const UNASSIGNED = 'Unassigned';

/** Nodes and Services together, grouped by their Project's name, Unassigned last. */
function groupByProject(data: PickerData, term: string): Array<[string, PickedTarget[]]> {
  const needle = term.trim().toLowerCase();
  const groups = new Map<string, PickedTarget[]>();

  const push = (projectId: string | null, target: PickedTarget) => {
    const name = (projectId && data.projectNames.get(projectId)) || UNASSIGNED;
    const existing = groups.get(name);
    if (existing) {
      existing.push(target);
    } else {
      groups.set(name, [target]);
    }
  };

  for (const node of data.nodes) {
    if (needle && ![node.name, node.hostname, node.address].join(' ').toLowerCase().includes(needle)) {
      continue;
    }
    push(node.project_id, { kind: 'node', node });
  }
  for (const service of data.services) {
    if (needle && !service.name.toLowerCase().includes(needle)) {
      continue;
    }
    push(service.project_id, { kind: 'service', service });
  }

  return [...groups.entries()].sort(([a], [b]) => {
    if (a === UNASSIGNED) return 1;
    if (b === UNASSIGNED) return -1;
    return a.localeCompare(b);
  });
}

export function TargetPicker({ onPick }: { onPick: (target: PickedTarget) => void }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PickerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || data !== null) {
      return;
    }
    let cancelled = false;
    Promise.all([listNodes(), listServices(), listProjects()])
      .then(([nodes, services, projects]) => {
        if (!cancelled) {
          setData({
            nodes,
            services,
            projectNames: new Map(projects.map((project: Project) => [project.id, project.name])),
          });
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Your servers and Services could not be loaded.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, data]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as globalThis.Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const groups = data ? groupByProject(data, search) : [];
  const empty = data && data.nodes.length === 0 && data.services.length === 0;

  return (
    <div ref={rootRef} className="relative">
      <Button size="sm" onClick={() => setOpen((was) => !was)} aria-expanded={open} aria-haspopup="true">
        <Plus width={15} height={15} aria-hidden />
        Open a shell on…
      </Button>

      {open ? (
        <div className="absolute left-0 top-full z-10 mt-1 w-80 rounded-md border border-border bg-surface p-2 shadow-lg">
          {error ? <p className="px-2 py-1 text-sm text-danger">{error}</p> : null}
          {!error && data === null ? <p className="px-2 py-1 text-sm text-ink-muted">Loading…</p> : null}
          {!error && empty ? (
            <p className="px-2 py-1 text-sm text-ink-muted">
              No servers or Services yet. Connect one first.
            </p>
          ) : null}
          {data && !empty ? (
            <>
              <div className="relative mb-1">
                <Search
                  width={14}
                  height={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
                  aria-hidden
                />
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search servers and Services"
                  className="h-8 w-full rounded-md border border-border bg-app pl-8 pr-2 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </div>
              <div className="max-h-72 overflow-y-auto">
                {groups.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-ink-muted">No matches.</p>
                ) : (
                  groups.map(([project, targets]) => (
                    <div key={project} className="mb-1">
                      <Text
                        variant="caption"
                        tone="secondary"
                        className="block px-2 py-1 font-medium uppercase"
                      >
                        {project}
                      </Text>
                      {targets.map((target) => {
                        const key = target.kind === 'node' ? `n-${target.node.id}` : `s-${target.service.id}`;
                        const label = target.kind === 'node' ? target.node.name : target.service.name;
                        const detail =
                          target.kind === 'node'
                            ? `${target.node.ssh_username}@${target.node.address}`
                            : target.service.runtime === 'systemd'
                              ? 'systemd'
                              : 'container';
                        const Icon =
                          target.kind === 'node' ? Server : serviceIcon(target.service.source.image);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              onPick(target);
                              setOpen(false);
                              setSearch('');
                            }}
                            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                          >
                            <Icon width={15} height={15} className="shrink-0 text-brand" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <Text variant="body-sm" className="block truncate font-medium">
                                {label}
                              </Text>
                              <Text variant="caption" tone="secondary" className="block truncate">
                                {detail}
                              </Text>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
