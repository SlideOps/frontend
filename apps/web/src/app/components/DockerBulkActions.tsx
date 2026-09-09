import {
  ApiError,
  isManagedByService,
  removeDockerContainer,
  runDockerContainerAction,
  type DockerContainer,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { CheckCircle2, XCircle } from '@slideops/icons';
import { useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import {
  bulkActionLabel,
  isDestructiveBulkAction,
  summariseBulkOutcomes,
  type BulkContainerAction,
  type BulkOutcome,
  type BulkReport,
} from '../docker-compose-view';
import { ConfirmDialog } from './ConfirmDialog';

/*
 * Doing one thing to several containers.
 *
 * Two rules shape this. A destructive action names every container it is about
 * to affect, in the dialog, rather than saying "3 containers": an Operator
 * about to remove three things is entitled to read which three. And a run in
 * which anything failed is never reported as a success, because "stopped 11
 * containers" when one refused is a sentence that sends somebody away believing
 * something untrue.
 *
 * The containers are acted on one at a time rather than in parallel. It is
 * slower and it is right: the endpoints act on somebody's running server, and
 * ten simultaneous restarts is a load spike nobody asked for.
 */

const ACTIONS: BulkContainerAction[] = ['start', 'stop', 'restart', 'pause', 'unpause', 'remove'];

/** What went wrong, in the server's words where it gave any. */
function failureMessage(error: unknown): string {
  if (isManagedByService(error)) {
    return 'This container belongs to a SlideOps Service and is removed from there.';
  }
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'That did not go through.';
}

/** The result, told without rounding up. */
function Report({ report }: { report: BulkReport }) {
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-md border border-border bg-subtle px-4 py-3"
    >
      <div className="flex items-start gap-2">
        {report.allSucceeded ? (
          <CheckCircle2
            width={16}
            height={16}
            className="mt-0.5 shrink-0 text-success"
            aria-hidden
          />
        ) : (
          <XCircle width={16} height={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />
        )}
        <Text variant="body-sm">{report.headline}</Text>
      </div>
      {report.failed.length > 0 ? (
        <ul className="flex flex-col gap-1 pl-6">
          {report.failed.map((outcome) => (
            <li key={outcome.name}>
              <Text variant="caption" tone="secondary">
                <span className="font-medium">{outcome.name}</span>: {outcome.message}
              </Text>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The bulk bar, shown only when something is selected.
 *
 * onDone reloads the list: after a bulk run the page's idea of what is running
 * is stale by definition, and a selection acted on is a selection worth
 * clearing.
 */
export function DockerBulkActions({
  nodeId,
  selected,
  onDone,
  onClearSelection,
}: {
  nodeId: string;
  selected: DockerContainer[];
  onDone: () => void;
  onClearSelection: () => void;
}) {
  const canWrite = useCanWrite();
  const [running, setRunning] = useState<BulkContainerAction | null>(null);
  const [confirming, setConfirming] = useState<BulkContainerAction | null>(null);
  const [report, setReport] = useState<BulkReport | null>(null);

  if (selected.length === 0) {
    return null;
  }

  if (!canWrite) {
    return (
      <Card>
        <Text variant="body-sm" tone="secondary">
          {selected.length} selected. Acting on containers needs write access in this workspace, and
          your role here is Viewer.
        </Text>
      </Card>
    );
  }

  const run = async (action: BulkContainerAction) => {
    setRunning(action);
    setReport(null);
    const outcomes: BulkOutcome[] = [];
    // One at a time on purpose: these act on a live server, and a burst of
    // simultaneous restarts is a load spike the Operator did not ask for.
    for (const container of selected) {
      try {
        if (action === 'remove') {
          await removeDockerContainer(nodeId, container.full_id, {
            force: false,
            remove_volumes: false,
          });
        } else {
          await runDockerContainerAction(nodeId, container.full_id, action);
        }
        outcomes.push({ name: container.name, ok: true });
      } catch (error) {
        outcomes.push({ name: container.name, ok: false, message: failureMessage(error) });
      }
    }
    setReport(summariseBulkOutcomes(action, outcomes));
    setRunning(null);
    setConfirming(null);
    onDone();
  };

  const start = (action: BulkContainerAction) => {
    if (isDestructiveBulkAction(action)) {
      setConfirming(action);
      return;
    }
    void run(action);
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text variant="body-sm" className="font-medium">
          {selected.length} selected
        </Text>
        <div className="flex flex-wrap items-center gap-2">
          {ACTIONS.map((action) => (
            <Button
              key={action}
              size="sm"
              variant={isDestructiveBulkAction(action) ? 'danger' : 'secondary'}
              disabled={running !== null}
              onClick={() => start(action)}
            >
              {running === action ? `${bulkActionLabel(action)}...` : bulkActionLabel(action)}
            </Button>
          ))}
          <Button size="sm" variant="ghost" disabled={running !== null} onClick={onClearSelection}>
            Clear
          </Button>
        </div>
      </div>

      {report ? <Report report={report} /> : null}

      <ConfirmDialog
        open={confirming !== null}
        title={confirming ? `${bulkActionLabel(confirming)} ${selected.length} containers?` : ''}
        description={
          <div className="flex flex-col gap-3">
            <p>
              This removes the containers below from this server. It does not remove their volumes,
              so data in a named volume survives.
            </p>
            {/* Naming every one of them. A count is not enough to decide on. */}
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {selected.map((container) => (
                <li key={container.full_id}>
                  <span className="font-medium text-ink">{container.name}</span>{' '}
                  <span className="text-ink-muted">({container.image})</span>
                </li>
              ))}
            </ul>
            <p>
              A container that belongs to a SlideOps Service is removed from that Service instead,
              and will be reported here as refused.
            </p>
          </div>
        }
        confirmLabel={confirming ? bulkActionLabel(confirming) : 'Confirm'}
        confirmVariant="danger"
        onConfirm={() => (confirming ? run(confirming) : undefined)}
        onCancel={() => setConfirming(null)}
      />
    </Card>
  );
}
