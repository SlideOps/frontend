import { ApiError, runCapabilityAction, type ActionTable } from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import { Folder, HardDrive } from '@slideops/icons';
import { DataGrid, Drawer, EmptyState, SearchBar, Toolbar, Tree, type DataGridColumn, type DataGridRow, type TreeNode } from '@slideops/ui';
import { useEffect, useMemo, useState } from 'react';
import { ErrorNote, Loading } from './Feedback';

/**
 * A bucket-then-object browser for MinIO, the same Tree-plus-grid shape
 * DatabaseExplorer already uses for a database and its tables. MinIO's own
 * data directory cannot be read as plain files (an object is stored as its
 * own versioned directory internally), so list-buckets and list-objects speak
 * to the server's real API instead; this component just draws what comes
 * back.
 */

interface StorageExplorerProps {
  capabilityKey: string;
  nodeId: string;
  serviceId?: string;
}

/** Whether StorageExplorer knows how to draw this Capability. */
export function isStorageCapability(capabilityKey: string): boolean {
  return capabilityKey === 'install-minio';
}

export function StorageExplorer({ capabilityKey, nodeId, serviceId }: StorageExplorerProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState<ApiError | null>(null);
  const [bucket, setBucket] = useState<string | null>(null);
  const [objects, setObjects] = useState<ActionTable | null>(null);
  const [objectsLoading, setObjectsLoading] = useState(false);
  const [objectsError, setObjectsError] = useState<ApiError | null>(null);
  const [search, setSearch] = useState('');
  const [openRow, setOpenRow] = useState<DataGridRow | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setTreeLoading(true);
    setTreeError(null);
    runCapabilityAction(capabilityKey, 'list-buckets', { node_id: nodeId, service_id: serviceId })
      .then((table) => {
        if (controller.signal.aborted) {
          return;
        }
        setTree(table.rows.map((row) => ({ id: row[0] ?? '', label: row[0] ?? '', icon: Folder, meta: row[1] })));
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

  useEffect(() => {
    if (!bucket) {
      setObjects(null);
      return;
    }
    const controller = new AbortController();
    setObjectsLoading(true);
    setObjectsError(null);
    runCapabilityAction(capabilityKey, 'list-objects', {
      node_id: nodeId,
      service_id: serviceId,
      parameters: { bucket },
    })
      .then((table) => {
        if (!controller.signal.aborted) {
          setObjects(table);
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setObjectsError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown_error', 'This did not load.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setObjectsLoading(false);
        }
      });
    return () => controller.abort();
  }, [capabilityKey, nodeId, serviceId, bucket]);

  const columns: DataGridColumn[] = useMemo(
    () => (objects ? objects.columns.map((header, index) => ({ key: String(index), header, sortable: true })) : []),
    [objects],
  );

  const rows: DataGridRow[] = useMemo(() => {
    if (!objects) {
      return [];
    }
    const term = search.trim().toLowerCase();
    const filtered = term ? objects.rows.filter((cells) => cells.some((c) => c.toLowerCase().includes(term))) : objects.rows;
    return filtered.map((cells, rowIndex) => {
      const cellMap = Object.fromEntries(cells.map((cell, index) => [String(index), cell]));
      return { id: String(rowIndex), cells: cellMap, onClick: () => setOpenRow({ id: String(rowIndex), cells: cellMap }) };
    });
  }, [objects, search]);

  if (treeLoading) {
    return <Loading label="Reading buckets" />;
  }
  if (treeError) {
    return <ErrorNote error={treeError} />;
  }
  if (tree.length === 0) {
    return (
      <EmptyState
        icon={HardDrive}
        title="No buckets yet"
        description="Create a bucket on this server, and it will show up here."
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-3 md:flex-row">
      <div className="shrink-0 overflow-y-auto rounded-md border border-border bg-surface p-2 md:w-56">
        <Tree nodes={tree} selectedId={bucket ?? undefined} onSelect={(node) => setBucket(node.id)} />
      </div>
      <div className="min-w-0 flex-1">
        {!bucket ? (
          <Text variant="body-sm" tone="secondary">
            Pick a bucket to browse what is inside it.
          </Text>
        ) : (
          <div className="flex flex-col gap-3">
            <Toolbar>
              <SearchBar value={search} onChange={setSearch} label="Search objects" placeholder="Search objects..." />
            </Toolbar>
            {objectsError ? <ErrorNote error={objectsError} /> : null}
            <DataGrid
              columns={columns}
              rows={rows}
              loading={objectsLoading}
              emptyMessage={objects?.empty ?? 'Nothing to show.'}
            />
          </div>
        )}
      </div>
      <Drawer open={openRow !== null} onClose={() => setOpenRow(null)} title="Object">
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
