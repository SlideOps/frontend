import { getServiceActivity, type ServiceActivity } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { RefreshCw } from '@slideops/icons';
import { useAsyncData } from '../hooks/useAsyncData';
import { CopyButton } from './CopyButton';
import { ErrorNote, Loading } from './Feedback';
import { Refreshing } from './Refreshing';

/*
 * What has happened to this Service.
 *
 * The workload's output says what the application is saying right now. It cannot
 * say that somebody changed the environment nine minutes ago, that the deploy
 * before this one failed for a different reason, or which commit is actually
 * running. Those are the questions asked during an incident, and until this
 * existed the platform had watched every one of them happen and written none of
 * it down.
 *
 * It sits with the logs rather than on a page of its own because they are read
 * together: the output says something broke, and the trail says what changed.
 */

/** How an entry reads at a glance. Failure is the only thing worth colouring. */
function toneFor(outcome: ServiceActivity['outcome']): string {
  if (outcome === 'failed') {
    return 'text-danger';
  }
  if (outcome === 'pending') {
    return 'text-ink-muted';
  }
  return 'text-ink';
}

/** A dot rather than a word, so the trail scans as a column of events. */
function markerFor(outcome: ServiceActivity['outcome']): string {
  if (outcome === 'failed') {
    return 'bg-danger';
  }
  if (outcome === 'pending') {
    return 'bg-border';
  }
  return 'bg-brand';
}

/**
 * The detail worth putting on the line, in the Operator's language.
 *
 * Only the keys that answer something. Rendering the whole object would put
 * `{"status":"running"}` beside a line that already says it started.
 */
function detailText(entry: ServiceActivity): string | null {
  const detail = entry.detail ?? {};
  const parts: string[] = [];

  const commit = detail.commit;
  if (typeof commit === 'string' && commit) {
    parts.push(`commit ${commit.slice(0, 7)}`);
  }
  const domain = detail.domain;
  if (typeof domain === 'string' && domain) {
    parts.push(domain);
  }
  const error = detail.error;
  if (typeof error === 'string' && error) {
    parts.push(error);
  }
  if (detail.elevated === true) {
    parts.push('elevated');
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** One entry, as a line of plain text: when, what, and the detail beside it,
 * in the same words the trail already shows. */
function entryText(entry: ServiceActivity): string {
  const when = new Date(entry.created_at).toLocaleString();
  const detail = detailText(entry);
  return detail ? `${when}: ${entry.message} (${detail})` : `${when}: ${entry.message}`;
}

/** The trail, newest first. */
export function ServiceActivityTrail({ id }: { id: string }) {
  const { state, reload, refreshing, refreshError } = useAsyncData(
    (signal) => getServiceActivity(id, 100, signal),
    [id],
  );
  const entries = state.status === 'ready' ? state.data : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Text variant="body-sm" tone="secondary">
          Deploys, restarts, configuration changes and shells, newest first.
        </Text>
        <span className="flex items-center gap-2">
          <Refreshing label="Reading" show={refreshing} />
          <CopyButton value={entries.map(entryText).join('\n')} label="the activity trail" />
          <Button variant="ghost" size="sm" onClick={reload} disabled={refreshing}>
            <RefreshCw width={14} height={14} aria-hidden />
            Refresh
          </Button>
        </span>
      </div>

      {state.status === 'loading' ? <Loading label="Reading the activity" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {refreshError ? (
        <p role="alert" className="text-sm text-danger">
          {refreshError.message}
        </p>
      ) : null}

      {state.status === 'ready' ? (
        state.data.length > 0 ? (
          <ol className="flex flex-col">
            {state.data.map((entry) => (
              <li key={entry.id} className="flex gap-3 border-b border-border py-2 last:border-b-0">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${markerFor(entry.outcome)}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${toneFor(entry.outcome)}`}>{entry.message}</p>
                  {detailText(entry) ? (
                    <p className="mt-0.5 break-words font-mono text-xs text-ink-muted">
                      {detailText(entry)}
                    </p>
                  ) : null}
                </div>
                <time
                  dateTime={entry.created_at}
                  className="shrink-0 text-xs text-ink-muted"
                  title={new Date(entry.created_at).toLocaleString()}
                >
                  {new Date(entry.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <Text variant="body-sm" tone="secondary">
            Nothing recorded yet. Deploys, restarts and configuration changes appear here as they
            happen.
          </Text>
        )
      ) : null}
    </div>
  );
}
