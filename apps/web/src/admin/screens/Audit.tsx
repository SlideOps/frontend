import { listAudit, type AuditEntry } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ChevronLeft, ChevronRight, ListChecks } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useMemo, useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { useAsyncData } from '../hooks/useAsyncData';

const PAGE_SIZE = 25;

/** Render an audit metadata object as a compact, readable string. */
function metadataSummary(metadata: AuditEntry['metadata']): string {
  const entries = Object.entries(metadata ?? {});
  if (entries.length === 0) {
    return '';
  }
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(', ');
}

/**
 * Who performed an action. The email leads, because that is what answers "who did
 * this"; the id sits underneath for when the name is ambiguous or the account has
 * since been renamed.
 *
 * An entry whose actor has been deleted, or that was never an Operator, has no
 * email: it falls back to the actor type and the id, so nothing renders blank.
 */
function ActorCell({ entry }: { entry: AuditEntry }) {
  if (!entry.actor_email) {
    return (
      <>
        <span className="font-medium capitalize">{entry.actor_type || 'Unknown'}</span>
        {entry.actor_id ? (
          <span className="block font-mono text-xs text-ink-muted">{entry.actor_id}</span>
        ) : null}
      </>
    );
  }
  return (
    <>
      <span className="font-medium">{entry.actor_email}</span>
      <span
        className="block font-mono text-xs text-ink-muted"
        title={`${entry.actor_type} ${entry.actor_id}`}
      >
        {entry.actor_id}
      </span>
    </>
  );
}

/** Audit log: a paginated table of admin and system actions, newest first. */
export function Audit() {
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;
  const query = useMemo(() => ({ limit: PAGE_SIZE, offset }), [offset]);
  const { state } = useAsyncData((signal) => listAudit(query, signal), [query]);

  const atEnd = state.status === 'ready' && state.data.length < PAGE_SIZE;

  return (
    <AdminShell active="audit">
      <PageHeader
        title="Audit log"
        description="Every admin and system action, newest first. The trail is immutable: emergency switches and suspensions are all recorded here."
        guidanceKey="audit.trail"
      />

      {state.status === 'loading' ? <Loading label="Loading the audit trail" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data.length === 0 && page === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No audit entries yet"
            description="Admin and system actions are recorded here as they happen, with the actor, the action, and the target."
          />
        ) : (
          <>
            <Table label="Audit entries">
              <THead>
                <TH>When</TH>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH>Target</TH>
                <TH>Detail</TH>
                <TH>IP</TH>
              </THead>
              <TBody>
                {state.data.map((entry) => (
                  <TR key={entry.id}>
                    <TD className="whitespace-nowrap text-ink-muted">
                      {new Date(entry.created_at).toLocaleString()}
                    </TD>
                    <TD className="whitespace-nowrap">
                      <ActorCell entry={entry} />
                    </TD>
                    <TD className="whitespace-nowrap font-medium">{entry.action}</TD>
                    <TD className="text-ink-muted">{entry.target}</TD>
                    <TD
                      className="max-w-xs truncate text-ink-muted"
                      title={metadataSummary(entry.metadata)}
                    >
                      {metadataSummary(entry.metadata)}
                    </TD>
                    <TD className="whitespace-nowrap text-ink-muted">{entry.ip}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>

            <div className="mt-4 flex items-center justify-between">
              <Text variant="body-sm" tone="secondary">
                Showing {offset + 1} to {offset + state.data.length}
              </Text>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft width={16} height={16} aria-hidden />
                  Newer
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((value) => value + 1)}
                  disabled={atEnd}
                >
                  Older
                  <ChevronRight width={16} height={16} aria-hidden />
                </Button>
              </div>
            </div>
          </>
        )
      ) : null}
    </AdminShell>
  );
}
