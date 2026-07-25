import { listOperations, type Operation } from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import { Activity, ChevronRight } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

function OperationRow({ operation, onOpen }: { operation: Operation; onOpen: () => void }) {
  const when = operation.created_at ? new Date(operation.created_at).toLocaleString() : '';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-md border border-border bg-surface px-4 py-3 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
        <Activity width={18} height={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <Text variant="body-sm" className="font-medium">
          {operation.capability_key}
        </Text>
        <Text variant="body-sm" tone="secondary" className="truncate">
          {when}
        </Text>
      </span>
      <StatusBadge status={operation.status} />
      <ChevronRight width={18} height={18} className="shrink-0 text-ink-muted" aria-hidden />
    </button>
  );
}

/** Which slice of History the Operator is looking at. */
type HistoryFilter = 'all' | 'required';

/**
 * History: every past Operation, newest first, each opening its full record.
 * The Required actions filter narrows the list to Operations that are waiting
 * for the Operator's approval, so a missed one is easy to find.
 */
export function History() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  // The load is keyed on the filter so switching it refetches the right slice.
  const { state } = useAsyncData(
    (signal) =>
      listOperations(filter === 'required' ? { status: 'awaiting_approval' } : {}, signal),
    [filter],
  );

  const requiredCount =
    state.status === 'ready'
      ? filter === 'required'
        ? state.data.length
        : state.data.filter((operation) => operation.status === 'awaiting_approval').length
      : undefined;

  const tabBase =
    'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

  return (
    <OperatorShell active="operations">
      <PageHeader
        title="History"
        description="Every Operation you have run, newest first. Open one to see its full record, replayed and, if it is still running, live."
        guidanceKey="dashboard.operations"
      />

      <div
        role="group"
        aria-label="Filter Operations"
        className="mb-4 inline-flex gap-1 rounded-lg border border-border bg-surface p-1"
      >
        <button
          type="button"
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
          className={
            filter === 'all'
              ? `${tabBase} bg-subtle text-ink`
              : `${tabBase} text-ink-muted hover:text-ink`
          }
        >
          All
        </button>
        <button
          type="button"
          aria-pressed={filter === 'required'}
          onClick={() => setFilter('required')}
          className={
            filter === 'required'
              ? `${tabBase} bg-subtle text-ink`
              : `${tabBase} text-ink-muted hover:text-ink`
          }
        >
          Required actions
          {requiredCount !== undefined && requiredCount > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill border border-warning bg-raised px-1.5 text-xs font-semibold text-warning">
              {requiredCount}
            </span>
          ) : null}
        </button>
      </div>

      {state.status === 'loading' ? <Loading label="Loading your Operations" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data.length === 0 ? (
          filter === 'required' ? (
            <EmptyState
              icon={Activity}
              title="Nothing needs your approval right now"
              description="When an Operation reaches its plan and waits for you, it appears here so you can review and approve it."
            />
          ) : (
            <EmptyState
              icon={Activity}
              title="No Operations yet"
              description="When you run a Capability on a Node, it appears here with its status, its plan, and its verification."
            />
          )
        ) : (
          <div className="flex flex-col gap-2">
            {state.data.map((operation) => (
              <OperationRow
                key={operation.id}
                operation={operation}
                onOpen={() => navigate(`/app/operations/${operation.id}`)}
              />
            ))}
          </div>
        )
      ) : null}
    </OperatorShell>
  );
}
