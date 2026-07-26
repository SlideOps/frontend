import {
  ApiError,
  clearOperations,
  deleteOperation,
  listOperations,
  type Operation,
  type OperationStatus,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { Activity, ChevronRight, Trash2 } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

/**
 * Whether an Operation has finished and so may be deleted. One still planning,
 * awaiting approval, or executing must stay: deleting it would orphan a change
 * about to be written to a server.
 */
function isFinished(status: OperationStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

function OperationRow({
  operation,
  onOpen,
  onDelete,
}: {
  operation: Operation;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const when = operation.created_at ? new Date(operation.created_at).toLocaleString() : '';
  return (
    <div className="flex w-full items-center gap-2 rounded-md border border-border bg-surface pr-2 transition-colors duration-fast ease-standard hover:bg-subtle">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
          <Activity width={18} height={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <Text variant="body-sm" className="truncate font-medium">
            {operation.capability_key}
          </Text>
          <Text variant="body-sm" tone="secondary" className="truncate">
            {when}
          </Text>
        </span>
        <StatusBadge status={operation.status} />
        <ChevronRight width={18} height={18} className="shrink-0 text-ink-muted" aria-hidden />
      </button>
      {isFinished(operation.status) ? (
        <button
          type="button"
          aria-label={`Delete this ${operation.status} Operation from your History`}
          title="Delete from History"
          onClick={onDelete}
          className="shrink-0 rounded-md p-2 text-ink-muted transition-colors duration-fast ease-standard hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Trash2 width={16} height={16} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Which slice of History the Operator is looking at. */
type HistoryFilter = 'all' | 'required' | 'running' | 'completed' | 'failed' | 'cancelled';

/** The filter tabs: a label and the Operation status each narrows to. */
const FILTER_TABS: { key: HistoryFilter; label: string; status?: OperationStatus }[] = [
  { key: 'all', label: 'All' },
  { key: 'required', label: 'Required actions', status: 'awaiting_approval' },
  { key: 'running', label: 'Running', status: 'executing' },
  { key: 'completed', label: 'Completed', status: 'completed' },
  { key: 'failed', label: 'Failed', status: 'failed' },
  { key: 'cancelled', label: 'Cancelled', status: 'cancelled' },
];

/**
 * History: every past Operation, newest first, each opening its full record.
 * The filter tabs narrow the list by status, so completed, failed, cancelled, or
 * approval-waiting Operations are each easy to find.
 */
export function History() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const activeTab = FILTER_TABS.find((tab) => tab.key === filter) ?? { key: 'all', label: 'All' };
  // The load is keyed on the filter so switching it refetches the right slice.
  const { state, reload } = useAsyncData(
    (signal) => listOperations(activeTab.status ? { status: activeTab.status } : {}, signal),
    [filter],
  );

  // Tidying History. Deleting a record never touches infrastructure: whatever an
  // Operation did to a server stays done, and only the record of it goes.
  const [pendingDelete, setPendingDelete] = useState<Operation | null>(null);
  const [clearing, setClearing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const runDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    setBusy(true);
    setActionError(null);
    setNote(null);
    try {
      await deleteOperation(pendingDelete.id);
      setNote('That Operation was removed from your History.');
      setPendingDelete(null);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That Operation could not be deleted. Try again.',
      );
      setPendingDelete(null);
    } finally {
      setBusy(false);
    }
  };

  // Clearing is scoped to whatever the Operator is currently looking at, so the
  // action always matches what is on screen rather than quietly reaching wider.
  // On the All tab that means every finished Operation.
  const clearableStatus = activeTab.status && isFinished(activeTab.status) ? activeTab.status : null;
  const canClear = filter === 'all' || clearableStatus !== null;

  const runClear = async () => {
    setBusy(true);
    setActionError(null);
    setNote(null);
    try {
      const deleted = await clearOperations(clearableStatus ? [clearableStatus] : []);
      setNote(
        deleted === 0
          ? 'There was nothing finished to clear.'
          : `Cleared ${deleted} Operation${deleted === 1 ? '' : 's'} from your History.`,
      );
      setClearing(false);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'History could not be cleared. Try again.',
      );
      setClearing(false);
    } finally {
      setBusy(false);
    }
  };

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
        description="Every Operation you have run, newest first. Open one to see its full record, replayed and, if it is still running, live. Finished Operations can be deleted to keep this readable."
        guidanceKey="dashboard.operations"
        actions={
          canClear && state.status === 'ready' && state.data.some((op) => isFinished(op.status)) ? (
            <Button variant="secondary" disabled={busy} onClick={() => setClearing(true)}>
              <Trash2 width={16} height={16} aria-hidden />
              {clearableStatus ? `Clear ${activeTab.label.toLowerCase()}` : 'Clear finished'}
            </Button>
          ) : undefined
        }
      />

      {note ? (
        <p role="status" className="mb-4 text-sm text-success">
          {note}
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {actionError}
        </p>
      ) : null}

      <div
        role="group"
        aria-label="Filter Operations"
        className="mb-4 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1"
      >
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={filter === tab.key}
            onClick={() => setFilter(tab.key)}
            className={
              filter === tab.key
                ? `${tabBase} bg-subtle text-ink`
                : `${tabBase} text-ink-muted hover:text-ink`
            }
          >
            {tab.label}
            {tab.key === 'required' && requiredCount !== undefined && requiredCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill border border-warning bg-raised px-1.5 text-xs font-semibold text-warning">
                {requiredCount}
              </span>
            ) : null}
          </button>
        ))}
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
          ) : filter === 'all' ? (
            <EmptyState
              icon={Activity}
              title="No Operations yet"
              description="When you run a Capability on a Node, it appears here with its status, its plan, and its verification."
            />
          ) : (
            <EmptyState
              icon={Activity}
              title={`No ${activeTab.label.toLowerCase()} Operations`}
              description="Try a different filter to see your other Operations."
            />
          )
        ) : (
          <div className="flex flex-col gap-2">
            {state.data.map((operation) => (
              <OperationRow
                key={operation.id}
                operation={operation}
                onOpen={() => navigate(`/app/operations/${operation.id}`)}
                onDelete={() => setPendingDelete(operation)}
              />
            ))}
          </div>
        )
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this Operation from your History?"
        description={
          pendingDelete === null
            ? ''
            : `This removes the record of "${pendingDelete.capability_key}" and its event log. It does not undo anything it did to your server — whatever it changed stays changed. The deletion itself is recorded in the audit trail.`
        }
        confirmLabel="Delete it"
        confirmVariant="danger"
        onConfirm={runDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={clearing}
        title={clearableStatus ? `Clear every ${clearableStatus} Operation?` : 'Clear every finished Operation?'}
        description={
          clearableStatus
            ? `This removes every ${clearableStatus} Operation from your History, along with its event log. Nothing still running or waiting on you is touched, and nothing on your servers changes.`
            : 'This removes every completed, failed, and cancelled Operation from your History. Anything still planning, waiting on your approval, or executing is left exactly where it is, and nothing on your servers changes.'
        }
        confirmLabel="Clear them"
        confirmVariant="danger"
        onConfirm={runClear}
        onCancel={() => setClearing(false)}
      />
    </OperatorShell>
  );
}
