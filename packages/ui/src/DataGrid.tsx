import { cn, Text } from '@slideops/design-system';
import { ChevronsUpDown, ChevronUp, ChevronDown } from '@slideops/icons';
import { useMemo, useState, type ReactNode } from 'react';

/*
 * A page of rows an Operator can actually read: sortable, searchable by
 * whoever is above it, one page at a time, the way a spreadsheet browses a
 * sheet.
 *
 * This replaced ResultTable, which rendered whatever a read Action returned as
 * static columns with no paging, sorting, or way to open a row for a closer
 * look. That was enough to prove an Action worked and nothing else: it could
 * not be how an Operator manages an actual table or collection.
 *
 * Sorting is client side and scoped to the page already loaded. A grid holding
 * one page of a browse Action has no way to sort the rows it has not fetched,
 * and pretending otherwise, sorting a page and calling it a sorted table, would
 * be a worse answer than sorting what is genuinely in front of the Operator and
 * no more.
 */

export interface DataGridColumn {
  key: string;
  header: ReactNode;
  sortable?: boolean;
  align?: 'start' | 'end';
  /** A fixed width hint, for a column whose content should not crowd the rest. */
  width?: string;
}

export interface DataGridRow {
  id: string;
  cells: Record<string, ReactNode>;
  /**
   * Raw values to sort by, when a cell's rendered content is not itself
   * comparable (a badge, a formatted date). Falls back to the cell's own string
   * form when a column has none.
   */
  sortValues?: Record<string, string | number>;
  onClick?: () => void;
}

export interface DataGridProps {
  columns: DataGridColumn[];
  rows: DataGridRow[];
  /** Shown in place of the body when there are no rows, in the Operator's language. */
  emptyMessage?: ReactNode;
  /** Dims the body without unmounting it, so a refresh does not flash empty first. */
  loading?: boolean;
  className?: string;
}

type SortDirection = 'asc' | 'desc';

function sortValueFor(row: DataGridRow, key: string): string | number {
  const explicit = row.sortValues?.[key];
  if (explicit !== undefined) {
    return explicit;
  }
  const cell = row.cells[key];
  if (typeof cell === 'string' || typeof cell === 'number') {
    return cell;
  }
  return '';
}

export function DataGrid({ columns, rows, emptyMessage, loading, className }: DataGridProps) {
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const sortedRows = useMemo(() => {
    if (!sort) {
      return rows;
    }
    const { key, direction } = sort;
    const withIndex = rows.map((row, index) => ({ row, index }));
    withIndex.sort((a, b) => {
      const av = sortValueFor(a.row, key);
      const bv = sortValueFor(b.row, key);
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      if (cmp === 0) {
        // A stable sort: rows that compare equal keep the order they arrived in,
        // rather than shuffling every time the same data is sorted again.
        cmp = a.index - b.index;
      }
      return direction === 'asc' ? cmp : -cmp;
    });
    return withIndex.map((entry) => entry.row);
  }, [rows, sort]);

  function toggleSort(column: DataGridColumn) {
    if (!column.sortable) {
      return;
    }
    setSort((current) => {
      if (!current || current.key !== column.key) {
        return { key: column.key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key: column.key, direction: 'desc' };
      }
      return null;
    });
  }

  return (
    // Its own horizontal scroll container: a wide grid must not make the page
    // scroll, only the grid itself.
    <div className={cn('overflow-x-auto rounded-md border border-border', className)}>
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-subtle">
            {columns.map((column) => {
              const active = sort?.key === column.key;
              const Icon = active ? (sort?.direction === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
              return (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  aria-sort={active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(
                    'px-3 py-2 font-medium text-ink-muted',
                    column.align === 'end' ? 'text-right' : 'text-left',
                  )}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className={cn(
                        'group inline-flex items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                        column.align === 'end' ? 'flex-row-reverse' : '',
                      )}
                    >
                      <span>{column.header}</span>
                      <Icon
                        width={13}
                        height={13}
                        aria-hidden
                        className={cn('shrink-0', active ? 'text-ink' : 'text-ink-muted opacity-0 group-hover:opacity-100')}
                      />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className={cn(loading ? 'opacity-60' : '')}>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center">
                <Text variant="body-sm" tone="secondary">
                  {emptyMessage ?? 'Nothing to show.'}
                </Text>
              </td>
            </tr>
          ) : (
            sortedRows.map((row) => (
              <tr
                key={row.id}
                onClick={row.onClick}
                tabIndex={row.onClick ? 0 : undefined}
                onKeyDown={
                  row.onClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          row.onClick?.();
                        }
                      }
                    : undefined
                }
                className={cn(
                  'border-b border-border last:border-b-0',
                  row.onClick
                    ? 'cursor-pointer hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset'
                    : '',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'max-w-xs truncate px-3 py-2 text-ink',
                      column.align === 'end' ? 'text-right' : 'text-left',
                    )}
                  >
                    {row.cells[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
