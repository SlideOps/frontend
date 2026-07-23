import { listOperations, type Operation } from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import { Activity, ChevronRight } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
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

/** History: every past Operation, newest first, each opening its full record. */
export function History() {
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => listOperations({}, signal), []);

  return (
    <OperatorShell active="operations">
      <PageHeader
        title="History"
        description="Every Operation you have run, newest first. Open one to see its full record, replayed and, if it is still running, live."
        guidanceKey="dashboard.operations"
      />

      {state.status === 'loading' ? <Loading label="Loading your Operations" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No Operations yet"
            description="When you run a Capability on a Node, it appears here with its status, its plan, and its verification."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {state.data.map((operation) => (
              <OperationRow
                key={operation.id}
                operation={operation}
                onOpen={() => navigate(`/operations/${operation.id}`)}
              />
            ))}
          </div>
        )
      ) : null}
    </OperatorShell>
  );
}
