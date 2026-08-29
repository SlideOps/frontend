import { ApiError, runCapabilityAction, type ActionTable as ActionTableResult } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { RefreshCw, type LucideIcon } from '@slideops/icons';
import { DataGrid, Drawer, EmptyState, SearchBar, Toolbar, type DataGridColumn, type DataGridRow } from '@slideops/ui';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ErrorNote, Loading } from './Feedback';

/*
 * The one flat table shape most of Stage E's remaining categories share: web's
 * sites, messaging's queues, search's indexes, runtime's processes, and
 * networking's peers are all a single read Action's rows, searched client
 * side and opened one at a time in a Drawer for the full record, the same way
 * DatabaseExplorer's grid already works. Only storage needs a second level
 * (bucket, then object), which is why it is the one category with its own
 * component rather than this one.
 */

export interface ActionTableProps {
  capabilityKey: string;
  actionKey: string;
  nodeId: string;
  serviceId?: string;
  parameters?: Record<string, string>;
  icon: LucideIcon;
  loadingLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  searchPlaceholder?: string;
  /** Extra toolbar content, such as an interface picker for WireGuard. */
  toolbarExtra?: ReactNode;
}

export function ActionTable({
  capabilityKey,
  actionKey,
  nodeId,
  serviceId,
  parameters,
  icon,
  loadingLabel,
  emptyTitle,
  emptyDescription,
  searchPlaceholder = 'Search...',
  toolbarExtra,
}: ActionTableProps) {
  const [table, setTable] = useState<ActionTableResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [search, setSearch] = useState('');
  const [openRow, setOpenRow] = useState<DataGridRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // parameters is an object literal at the call site, so it is a new
  // reference every render; only its actual values should trigger a reload.
  const parametersKey = JSON.stringify(parameters ?? {});

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    runCapabilityAction(capabilityKey, actionKey, {
      node_id: nodeId,
      service_id: serviceId,
      parameters,
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setTable(result);
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown_error', 'This did not load.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capabilityKey, actionKey, nodeId, serviceId, parametersKey, refreshKey]);

  const columns: DataGridColumn[] = useMemo(
    () => (table ? table.columns.map((header, index) => ({ key: String(index), header, sortable: true })) : []),
    [table],
  );

  const filteredRows = useMemo(() => {
    if (!table) {
      return [];
    }
    const term = search.trim().toLowerCase();
    if (!term) {
      return table.rows;
    }
    return table.rows.filter((cells) => cells.some((cell) => cell.toLowerCase().includes(term)));
  }, [table, search]);

  const rows: DataGridRow[] = useMemo(
    () =>
      filteredRows.map((cells, rowIndex) => {
        const cellMap = Object.fromEntries(cells.map((cell, index) => [String(index), cell]));
        return { id: String(rowIndex), cells: cellMap, onClick: () => setOpenRow({ id: String(rowIndex), cells: cellMap }) };
      }),
    [filteredRows],
  );

  if (loading && !table) {
    return <Loading label={loadingLabel} />;
  }
  if (error) {
    return <ErrorNote error={error} />;
  }
  if (table && table.rows.length === 0) {
    return <EmptyState icon={icon} title={emptyTitle} description={table.empty || emptyDescription} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <Toolbar
        actions={
          <>
            {toolbarExtra}
            <Button size="sm" variant="ghost" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw width={15} height={15} aria-hidden />
              Refresh
            </Button>
          </>
        }
      >
        <SearchBar value={search} onChange={setSearch} label="Search" placeholder={searchPlaceholder} />
      </Toolbar>
      <DataGrid
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage={table?.empty ?? 'Nothing matches that search.'}
      />
      <Drawer open={openRow !== null} onClose={() => setOpenRow(null)} title="Record">
        {openRow ? (
          <dl className="flex flex-col gap-3">
            {columns.map((column) => (
              <div key={column.key}>
                <dt className="text-xs text-ink-muted">{column.header || 'Value'}</dt>
                <dd className="mt-0.5 break-words font-mono text-sm text-ink">{openRow.cells[column.key]}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <Text variant="body-sm" tone="secondary">
            Nothing selected.
          </Text>
        )}
      </Drawer>
    </div>
  );
}
