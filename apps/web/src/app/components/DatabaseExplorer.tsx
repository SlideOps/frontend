import {
  ApiError,
  downloadCapabilityAction,
  runCapabilityAction,
  type ActionTable,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ChevronLeft, ChevronRight, Database as DatabaseIcon, Download, Table as TableIcon } from '@slideops/icons';
import { DataGrid, Drawer, SearchBar, Toolbar, Tree, type DataGridColumn, type DataGridRow, type TreeNode } from '@slideops/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorNote, Loading } from './Feedback';

/*
 * A Mongoose Compass style browser for the database Capabilities: a Tree of
 * what a server holds on one side, a page of it on the other, searchable, one
 * page at a time. This is what list-tables and browse-rows (or their MongoDB
 * and Redis equivalents) exist to feed; CapabilityManagement's plain
 * ActionRow list stays the way to reach every other Action, list-databases,
 * export, restore, included.
 *
 * Every engine answers the same three questions in its own shape, so one
 * EngineShape describes the difference and the rest of this file does not
 * need to know which engine it is looking at.
 */

interface EngineShape {
  /** The Action that lists what is inside one database: tables or collections. Absent for Redis, which has no second level. */
  listChildren?: string;
  /** The Action that pages through one table, collection, or keyspace. */
  browse: string;
  /** The parameter key browse expects for the child picked from the Tree, if any. */
  childParam?: string;
  /** What to call a child in the Tree and the toolbar: Table, Collection, or nothing for Redis. */
  childLabel?: string;
  /** Whether the search box is a plain text search or a MongoDB JSON filter. */
  searchKind: 'text' | 'filter' | 'pattern';
  /** Whether this engine can export a whole database. Redis deliberately cannot; see its Capability. */
  canExport: boolean;
}

const ENGINE_SHAPES: Record<string, EngineShape> = {
  'install-postgresql': {
    listChildren: 'list-tables',
    browse: 'browse-rows',
    childParam: 'table',
    childLabel: 'Table',
    searchKind: 'text',
    canExport: true,
  },
  'install-mysql': {
    listChildren: 'list-tables',
    browse: 'browse-rows',
    childParam: 'table',
    childLabel: 'Table',
    searchKind: 'text',
    canExport: true,
  },
  'install-mariadb': {
    listChildren: 'list-tables',
    browse: 'browse-rows',
    childParam: 'table',
    childLabel: 'Table',
    searchKind: 'text',
    canExport: true,
  },
  'install-mongodb': {
    listChildren: 'list-collections',
    browse: 'browse-documents',
    childParam: 'collection',
    childLabel: 'Collection',
    searchKind: 'filter',
    canExport: true,
  },
  'install-redis': {
    browse: 'list-keys',
    searchKind: 'pattern',
    canExport: false,
  },
};

/** Redis reports a keyspace as "db0"; list-keys wants the bare number. */
function keyspaceNumber(name: string): string {
  return name.replace(/^db/, '');
}

const PAGE_SIZE = 50;

interface DatabaseExplorerProps {
  capabilityKey: string;
  nodeId: string;
  serviceId?: string;
}

/** Whether this Capability is one DatabaseExplorer knows how to draw. */
export function isExplorableDatabase(capabilityKey: string): boolean {
  return capabilityKey in ENGINE_SHAPES;
}

/**
 * The Action keys DatabaseExplorer already covers visually, so a capability
 * page showing both this and CapabilityManagement's plain Action list is not
 * offered the same thing twice: once as a Tree and a grid, once as a form.
 */
export const DATABASE_EXPLORER_ACTION_KEYS = [
  'list-tables',
  'browse-rows',
  'list-collections',
  'browse-documents',
  'list-keys',
];

export function DatabaseExplorer({ capabilityKey, nodeId, serviceId }: DatabaseExplorerProps) {
  const shape = ENGINE_SHAPES[capabilityKey];
  return shape ? (
    <DatabaseExplorerForShape shape={shape} capabilityKey={capabilityKey} nodeId={nodeId} serviceId={serviceId} />
  ) : null;
}

function DatabaseExplorerForShape({
  shape,
  capabilityKey,
  nodeId,
  serviceId,
}: DatabaseExplorerProps & { shape: EngineShape }) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treeError, setTreeError] = useState<ApiError | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [selected, setSelected] = useState<{ database: string; child?: string } | null>(null);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<ActionTable | null>(null);
  const [pageError, setPageError] = useState<ApiError | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [openRow, setOpenRow] = useState<DataGridRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<ApiError | null>(null);

  // Every render of a database in the Tree needs to know whether its children
  // have already been fetched, so a second expansion does not refetch them.
  const childrenCache = useRef<Map<string, TreeNode[]>>(new Map());

  const run = (actionKey: string, parameters: Record<string, string>, signal?: AbortSignal) =>
    runCapabilityAction(capabilityKey, actionKey, { node_id: nodeId, service_id: serviceId, parameters }).then(
      (t) => {
        if (signal?.aborted) {
          throw new ApiError(0, 'aborted', 'aborted');
        }
        return t;
      },
    );

  // The top level of the Tree: databases for every engine, keyspaces for
  // Redis (list-databases already answers both, in whichever language the
  // engine uses for the row).
  useEffect(() => {
    const controller = new AbortController();
    setTreeLoading(true);
    setTreeError(null);
    run('list-databases', {}, controller.signal)
      .then((table) => {
        setTree(
          table.rows.map((row) => ({
            id: row[0] ?? '',
            label: row[0] ?? '',
            icon: DatabaseIcon,
            meta: row[1],
            // A branch with no known children yet still needs a children array,
            // or Tree renders it as a leaf and it can never be expanded.
            children: shape.listChildren ? [] : undefined,
          })),
        );
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setTreeError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown_error', 'This did not load.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setTreeLoading(false);
        }
      });
    return () => controller.abort();
  }, [capabilityKey, nodeId, serviceId]);

  async function expandDatabase(databaseId: string) {
    if (!shape.listChildren || childrenCache.current.has(databaseId)) {
      return;
    }
    try {
      const table = await run(shape.listChildren, { database: databaseId });
      const children: TreeNode[] = table.rows.map((row) => ({
        id: `${databaseId}/${row[0] ?? ''}`,
        label: row[0] ?? '',
        icon: TableIcon,
        meta: row[1],
      }));
      childrenCache.current.set(databaseId, children);
      setTree((current) =>
        current.map((node) => (node.id === databaseId ? { ...node, children } : node)),
      );
    } catch {
      // A branch that could not be listed stays collapsed with nothing inside
      // rather than breaking the rest of the Tree; the Operator can try again
      // by collapsing and reopening it.
    }
  }

  // Choosing a database already means something on its own: it is what
  // Export acts on, whether or not this engine also has a table or collection
  // to drill into. Redis stops here; every other engine also expands it.
  function selectDatabase(databaseId: string) {
    setSelected({ database: databaseId });
    setSearch('');
    setOffset(0);
    if (shape.listChildren) {
      void expandDatabase(databaseId);
    }
  }

  function selectChild(databaseId: string, childId: string) {
    setSelected({ database: databaseId, child: childId });
    setSearch('');
    setOffset(0);
  }

  // An engine with a second level needs a child chosen before there is
  // anything to page through; one without (Redis) is ready as soon as a
  // keyspace is picked.
  const readyToBrowse = !!selected && (!shape.listChildren || !!selected.child);

  // Paging the selected table, collection, or keyspace. Runs again whenever
  // the selection, the search term, or the page changes.
  useEffect(() => {
    if (!readyToBrowse || !selected) {
      setPage(null);
      return;
    }
    const controller = new AbortController();
    setPageLoading(true);
    setPageError(null);
    const parameters: Record<string, string> = {
      limit: String(PAGE_SIZE),
      offset: String(offset),
    };
    if (shape.childParam && selected.child) {
      parameters[shape.childParam] = selected.child;
    }
    if (shape.searchKind === 'text' && search.trim()) {
      parameters.search = search.trim();
    } else if (shape.searchKind === 'filter' && search.trim()) {
      parameters.filter = search.trim();
    } else if (shape.searchKind === 'pattern') {
      parameters.pattern = search.trim() || '*';
    }
    if (shape.browse === 'list-keys') {
      parameters.database = keyspaceNumber(selected.database);
    } else {
      parameters.database = selected.database;
    }

    run(shape.browse, parameters, controller.signal)
      .then(setPage)
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setPageError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown_error', 'This did not load.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPageLoading(false);
        }
      });
    return () => controller.abort();
  }, [selected, search, offset]);

  const columns: DataGridColumn[] = useMemo(
    () => (page ? page.columns.map((header, index) => ({ key: String(index), header, sortable: true })) : []),
    [page],
  );
  const rows: DataGridRow[] = useMemo(
    () =>
      page
        ? page.rows.map((cells, rowIndex) => ({
            id: String(rowIndex),
            cells: Object.fromEntries(cells.map((cell, index) => [String(index), cell])),
            onClick: () =>
              setOpenRow({
                id: String(rowIndex),
                cells: Object.fromEntries(cells.map((cell, index) => [String(index), cell])),
              }),
          }))
        : [],
    [page],
  );

  async function exportDatabase() {
    if (!selected) {
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      await downloadCapabilityAction(capabilityKey, 'export-database', {
        node_id: nodeId,
        service_id: serviceId,
        parameters: { database: selected.database },
      });
    } catch (caught) {
      setExportError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown_error', 'That export failed.'));
    } finally {
      setExporting(false);
    }
  }

  if (treeLoading) {
    return <Loading label="Reading what this server holds" />;
  }
  if (treeError) {
    return <ErrorNote error={treeError} />;
  }
  if (tree.length === 0) {
    return (
      <Text variant="body-sm" tone="secondary">
        This server has nothing to browse yet.
      </Text>
    );
  }

  const searchLabel =
    shape.searchKind === 'filter' ? 'Filter, as JSON' : shape.searchKind === 'pattern' ? 'Pattern' : 'Search';
  const searchPlaceholder =
    shape.searchKind === 'filter' ? '{"status": "active"}' : shape.searchKind === 'pattern' ? '*' : 'Search rows...';

  return (
    <div className="flex min-h-0 flex-col gap-3 md:flex-row">
      <div className="shrink-0 overflow-y-auto rounded-md border border-border bg-surface p-2 md:w-56">
        <Tree
          nodes={tree}
          selectedId={selected?.child ?? selected?.database}
          onSelect={(node) => {
            if (node.id.includes('/')) {
              const [databaseId, childId] = node.id.split('/');
              selectChild(databaseId!, childId!);
            } else {
              selectDatabase(node.id);
            }
          }}
        />
      </div>
      <div className="min-w-0 flex-1">
        {selected ? (
          <div className="flex flex-col gap-3">
            <Toolbar
              actions={
                shape.canExport ? (
                  <Button size="sm" variant="secondary" disabled={exporting} onClick={exportDatabase}>
                    <Download width={15} height={15} aria-hidden />
                    {exporting ? 'Preparing' : 'Export'}
                  </Button>
                ) : undefined
              }
            >
              <SearchBar
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setOffset(0);
                }}
                label={searchLabel}
                placeholder={searchPlaceholder}
              />
            </Toolbar>
            {exportError ? <ErrorNote error={exportError} /> : null}
            {!readyToBrowse ? (
              <Text variant="body-sm" tone="secondary">
                Pick a {shape.childLabel?.toLowerCase()} to browse it.
              </Text>
            ) : (
              <>
                {pageError ? <ErrorNote error={pageError} /> : null}
                <DataGrid
                  columns={columns}
                  rows={rows}
                  loading={pageLoading}
                  emptyMessage={page?.empty ?? 'Nothing to show.'}
                />
                <div className="flex items-center justify-between">
                  <Text variant="caption" tone="secondary">
                    Showing {offset + 1} to {offset + rows.length}
                  </Text>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    >
                      <ChevronLeft width={15} height={15} aria-hidden />
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={rows.length < PAGE_SIZE}
                      onClick={() => setOffset(offset + PAGE_SIZE)}
                    >
                      Next
                      <ChevronRight width={15} height={15} aria-hidden />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <Text variant="body-sm" tone="secondary">
            {shape.listChildren
              ? `Pick a database, then a ${shape.childLabel?.toLowerCase()}, to browse it.`
              : 'Pick a keyspace to browse its keys.'}
          </Text>
        )}
      </div>
      <Drawer open={openRow !== null} onClose={() => setOpenRow(null)} title="Record">
        {openRow ? (
          <dl className="flex flex-col gap-3">
            {columns.map((column) => (
              <div key={column.key}>
                <dt className="text-xs text-ink-muted">{column.header}</dt>
                <dd className="mt-0.5 break-words font-mono text-sm text-ink">{openRow.cells[column.key]}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Drawer>
    </div>
  );
}
