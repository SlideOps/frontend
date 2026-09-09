import {
  ApiError,
  isDockerConfirmationRequired,
  previewDockerCleanup,
  runDockerCleanup,
  type DockerCleanupCategory,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { Sparkles } from '@slideops/icons';
import { EmptyState } from '@slideops/ui';
import { useCallback, useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import { formatBytes } from '../docker-inventory';
import {
  categoryHoldsData,
  cleanupActionLabel,
  reclaimableSummary,
} from '../docker-resources-view';
import { useAsyncData } from '../hooks/useAsyncData';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorNote, Loading } from './Feedback';

/*
 * What Docker could release on this Node, one category at a time.
 *
 * There is no "clean everything" control here and there must never be one.
 * `docker system prune -a --volumes` is one command and two very different
 * acts: throwing away Docker's own leftovers, which is housekeeping, and
 * deleting volumes nothing currently has open, which is deleting somebody's
 * database while their service happens to be stopped. A single button over both
 * would eventually do the second on a click that read as the first, and the
 * Operator would find out days later.
 *
 * So each category has its own row, its own count, its own figure, and its own
 * button that says exactly what it will do before it is pressed. A total is
 * shown because it answers "is this page worth reading", and it is a sentence
 * rather than a control.
 *
 * The unused volumes row is the one that carries data, and it is treated as
 * such: an extra, explicit consent to losing it, and plain words about what
 * "unused" actually means. Docker calls a volume unused when no container has
 * it open right now, which is also true of every volume belonging to a service
 * that is currently stopped.
 */

function asApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError(0, 'unknown_error', 'That did not work. Try again.');
}

/** One category: what it holds, what it would release, and the button for it. */
function CleanupRow({
  category,
  canWrite,
  busy,
  onRun,
}: {
  category: DockerCleanupCategory;
  canWrite: boolean;
  busy: boolean;
  onRun: () => void;
}) {
  const holdsData = categoryHoldsData(category);
  const empty = category.count <= 0;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <Text variant="body-sm" className="font-medium">
          {category.label}
        </Text>
        <Text variant="body-sm" tone="secondary" className="mt-0.5">
          {empty
            ? 'Nothing here to release.'
            : `${category.count} ${category.count === 1 ? 'item' : 'items'}, ${
                category.reclaimable_bytes > 0
                  ? `${formatBytes(category.reclaimable_bytes)} on disk`
                  : 'no disk figure reported'
              }.`}
        </Text>
        {holdsData ? (
          <Text variant="body-sm" tone="secondary" className="mt-1 text-warning">
            Volumes hold data. Unused means no container has one open right now, which is also true
            of every volume belonging to a service that happens to be stopped.
          </Text>
        ) : null}
      </div>
      {canWrite && !empty ? (
        <Button
          size="sm"
          variant={holdsData ? 'danger' : 'secondary'}
          disabled={busy}
          onClick={onRun}
        >
          {busy ? 'Working' : cleanupActionLabel(category)}
        </Button>
      ) : (
        <Text variant="body-sm" tone="secondary">
          {empty ? 'Nothing to remove' : 'Read only'}
        </Text>
      )}
    </li>
  );
}

/** What Docker could release on one Node, and the per-category way to release it. */
export function DockerCleanupPanel({ nodeId }: { nodeId: string }) {
  const canWrite = useCanWrite();
  const preview = useAsyncData((signal) => previewDockerCleanup(nodeId, signal), [nodeId]);

  const [pending, setPending] = useState<DockerCleanupCategory | null>(null);
  /** Consent to losing data, for the one category that holds any. */
  const [consented, setConsented] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [released, setReleased] = useState<string | null>(null);

  const reload = preview.reload;

  // Stable across renders: ConfirmDialog restores focus whenever this identity
  // changes, which would move focus out of the consent checkbox as it is ticked.
  const close = useCallback(() => {
    setPending(null);
    setConsented(false);
    setNeedsConsent(false);
  }, []);

  if (preview.state.status === 'loading') {
    return <Loading label="Reading what could be released on this server" />;
  }
  if (preview.state.status === 'error') {
    return <ErrorNote error={preview.state.error} />;
  }

  const categories = preview.state.data.categories;
  const summary = reclaimableSummary(categories);

  const run = async () => {
    const category = pending;
    if (!category) {
      return;
    }
    const holdsData = categoryHoldsData(category);
    // The consent is checked here rather than by disabling the button, so a
    // press that will not act says why instead of doing nothing silently.
    if (holdsData && !consented) {
      setNeedsConsent(true);
      return;
    }
    close();
    setError(null);
    setReleased(null);
    setBusyKey(category.key);
    try {
      const result = await runDockerCleanup(nodeId, category.key, holdsData && consented);
      setReleased(
        typeof result.reclaimed_bytes === 'number'
          ? `${formatBytes(result.reclaimed_bytes)} released from ${category.label.toLowerCase()}.`
          : `${category.label} released. The server did not report how much disk that freed.`,
      );
      reload();
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setBusyKey('');
    }
  };

  if (categories.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="There is nothing to clean up on this server"
        description="Docker is holding no leftovers it could release. Nothing here needs doing."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border bg-surface px-4 py-3">
        <Text variant="body-sm" className="font-medium">
          {summary.text ?? 'Nothing on this server can be reclaimed right now'}
        </Text>
        <Text variant="body-sm" tone="secondary" className="mt-0.5">
          Every category below is released on its own terms, because they are not the same kind of
          thing. There is deliberately no single control that does all of them: Docker&rsquo;s
          leftovers can be thrown away, and your volumes are data.
        </Text>
      </div>

      {error ? (
        isDockerConfirmationRequired(error) ? (
          <div role="alert" className="rounded-md border border-border bg-subtle px-4 py-3">
            <Text variant="body-sm" className="font-medium">
              Nothing was removed
            </Text>
            <Text variant="body-sm" tone="secondary" className="mt-0.5">
              {error.message} SlideOps will not retry this for you. Press the button again and
              confirm the data loss if that is what you mean to do.
            </Text>
          </div>
        ) : (
          <ErrorNote error={error} />
        )
      ) : null}

      {released ? (
        <div role="status" className="rounded-md border border-border bg-subtle px-4 py-3">
          <Text variant="body-sm">{released}</Text>
        </div>
      ) : null}

      <ul className="rounded-md border border-border bg-surface">
        {categories.map((category) => (
          <CleanupRow
            key={category.key}
            category={category}
            canWrite={canWrite}
            busy={busyKey === category.key}
            onRun={() => {
              setError(null);
              setReleased(null);
              setConsented(false);
              setNeedsConsent(false);
              setPending(category);
            }}
          />
        ))}
      </ul>

      <ConfirmDialog
        open={pending !== null && canWrite}
        title={pending ? `Release ${pending.label.toLowerCase()}?` : 'Release this?'}
        confirmLabel={pending ? cleanupActionLabel(pending) : 'Remove'}
        confirmVariant="danger"
        onCancel={close}
        onConfirm={run}
        description={
          pending ? (
            <span className="flex flex-col gap-3">
              <span>
                This removes {pending.count} {pending.count === 1 ? 'item' : 'items'} from{' '}
                {pending.label.toLowerCase()} on this server
                {pending.reclaimable_bytes > 0
                  ? `, and Docker reports that as ${formatBytes(pending.reclaimable_bytes)} of disk`
                  : ''}
                . No running container is stopped.
              </span>
              {categoryHoldsData(pending) ? (
                <>
                  <span className="text-danger">
                    A volume is data. Anything in these volumes is deleted, SlideOps keeps no copy,
                    and nothing can bring it back. A volume counts as unused when no container has
                    it open at this moment, so a database belonging to a service you stopped
                    yesterday is in this list.
                  </span>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={consented}
                      onChange={(event) => {
                        setConsented(event.target.checked);
                        setNeedsConsent(false);
                      }}
                      className="mt-0.5"
                    />
                    <span>
                      I understand this deletes data in {pending.count}{' '}
                      {pending.count === 1 ? 'volume' : 'volumes'} and that it cannot be recovered.
                    </span>
                  </label>
                  {needsConsent ? (
                    <span role="alert" className="text-danger">
                      Nothing has been removed. Tick the box above to confirm you accept losing this
                      data, or cancel.
                    </span>
                  ) : null}
                </>
              ) : (
                <span>
                  Everything in this category is Docker&rsquo;s own leftovers. It can be rebuilt or
                  pulled again, and no data of yours is in it.
                </span>
              )}
            </span>
          ) : null
        }
      />
    </div>
  );
}
