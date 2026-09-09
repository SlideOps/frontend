import {
  ApiError,
  isManagedByService,
  managedByServiceId,
  removeDockerContainer,
  runDockerContainerAction,
  type DockerContainer,
  type DockerContainerAction,
  type DockerContainerState,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ArrowUpRight, Pause, Play, RotateCcw, Square, Trash2, XCircle } from '@slideops/icons';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCanWrite } from '../../store/workspace';
import { ConfirmDialog } from './ConfirmDialog';

/*
 * The lifecycle controls for one container.
 *
 * Three rules shape this whole file, and all three exist because the thing on
 * the other end of these buttons is somebody's production server.
 *
 * Only the actions the container's current state can accept are shown. Docker
 * refuses to start a running container and to unpause one that was never
 * paused, so offering either is offering a button whose only outcome is an
 * error. A control that is present, enabled and guaranteed to fail teaches an
 * Operator to distrust every other control on the page.
 *
 * The two actions that cannot be walked back are behind a confirmation that
 * names the container and says what will happen to it, in the words of what it
 * does rather than the name of the verb. "Kill" means nothing to somebody who
 * has not read Docker's manual; "its processes are ended immediately, with no
 * chance to finish what they were doing" means exactly one thing.
 *
 * And nothing here is offered to an Operator whose role cannot act. A Viewer
 * sees the container in full and sees, in a sentence, why the controls are not
 * there -- rather than pressing one and meeting a 403 that reads as a fault.
 */

/**
 * Which lifecycle actions each state can accept.
 *
 * Straight from what the daemon will and will not do. A `dead` container has
 * nothing left to act on but removal, and a `restarting` one is mid-flight, so
 * the only useful things to say to it are stop and kill. Removal is not in this
 * table: it applies in every state and is not reversible, so it is kept apart
 * rather than sitting in a list of things that can be undone.
 */
const ACTIONS_FOR_STATE: Record<DockerContainerState, DockerContainerAction[]> = {
  created: ['start'],
  running: ['stop', 'restart', 'pause', 'kill'],
  paused: ['unpause', 'stop', 'kill'],
  restarting: ['stop', 'kill'],
  exited: ['start', 'restart'],
  dead: [],
};

interface ActionPresentation {
  label: string;
  icon: typeof Play;
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** The sentence an Operator reads before this action runs, when it needs one. */
  confirmation?: (name: string) => string;
}

const ACTION_PRESENTATION: Record<DockerContainerAction, ActionPresentation> = {
  start: { label: 'Start', icon: Play, variant: 'primary' },
  stop: { label: 'Stop', icon: Square, variant: 'secondary' },
  restart: { label: 'Restart', icon: RotateCcw, variant: 'secondary' },
  pause: { label: 'Pause', icon: Pause, variant: 'secondary' },
  // Docker's verb is "unpause". The control says Resume, because that is the
  // word for what it does to a container an Operator paused a moment ago.
  unpause: { label: 'Resume', icon: Play, variant: 'secondary' },
  kill: {
    label: 'Kill',
    icon: XCircle,
    variant: 'danger',
    confirmation: (name) =>
      `Killing ${name} ends its processes immediately. They get no chance to finish what they were doing, so anything held only in memory is lost and any half-written file stays half-written. Stopping asks the container to shut down first; killing does not ask.`,
  },
};

export interface DockerContainerActionsProps {
  /** The Node whose daemon holds this container. */
  nodeId: string;
  container: DockerContainer;
  /** Called with the container the daemon reported after an action it accepted. */
  onChanged: (container: DockerContainer) => void;
  /** Called once the container has been removed and no longer exists. */
  onRemoved: () => void;
}

/** The lifecycle row: only what this state accepts, only for an Operator who may act. */
export function DockerContainerActions({
  nodeId,
  container,
  onChanged,
  onRemoved,
}: DockerContainerActionsProps) {
  const canWrite = useCanWrite();
  const [running, setRunning] = useState<DockerContainerAction | 'remove' | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [confirming, setConfirming] = useState<DockerContainerAction | 'remove' | null>(null);
  // Both removal options start off and stay separate. Neither is a default,
  // because "and delete the data too" is not a detail of "remove this
  // container" -- it is a second decision with a different consequence.
  const [force, setForce] = useState(false);
  const [removeVolumes, setRemoveVolumes] = useState(false);

  if (!canWrite) {
    return (
      <Text variant="body-sm" tone="secondary">
        Starting, stopping and removing containers changes what runs on this server, so it needs
        write access in this workspace. Your role here is Viewer, which reads everything and
        changes nothing.
      </Text>
    );
  }

  const available = ACTIONS_FOR_STATE[container.state] ?? [];

  const run = async (action: DockerContainerAction) => {
    setRunning(action);
    setFailure(null);
    try {
      onChanged(await runDockerContainerAction(nodeId, container.full_id, action));
    } catch (error) {
      setFailure(
        error instanceof ApiError
          ? error
          : new ApiError(0, 'unknown_error', 'That did not reach the server. Try again.'),
      );
    } finally {
      setRunning(null);
      setConfirming(null);
    }
  };

  const remove = async () => {
    setRunning('remove');
    setFailure(null);
    try {
      await removeDockerContainer(nodeId, container.full_id, { force, remove_volumes: removeVolumes });
      setConfirming(null);
      onRemoved();
    } catch (error) {
      setFailure(
        error instanceof ApiError
          ? error
          : new ApiError(0, 'unknown_error', 'That did not reach the server. Try again.'),
      );
      setConfirming(null);
    } finally {
      setRunning(null);
    }
  };

  const press = (action: DockerContainerAction) => {
    if (ACTION_PRESENTATION[action].confirmation) {
      setConfirming(action);
      return;
    }
    void run(action);
  };

  const openRemove = () => {
    setForce(false);
    setRemoveVolumes(false);
    setConfirming('remove');
  };

  const confirmingAction =
    confirming && confirming !== 'remove' ? ACTION_PRESENTATION[confirming] : null;
  const serviceId = managedByServiceId(failure);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {available.map((action) => {
          const presentation = ACTION_PRESENTATION[action];
          const Icon = presentation.icon;
          return (
            <Button
              key={action}
              size="sm"
              variant={presentation.variant}
              disabled={running !== null}
              onClick={() => press(action)}
            >
              <Icon width={14} height={14} aria-hidden />
              {running === action ? 'Working' : presentation.label}
            </Button>
          );
        })}
        <Button size="sm" variant="danger" disabled={running !== null} onClick={openRemove}>
          <Trash2 width={14} height={14} aria-hidden />
          {running === 'remove' ? 'Working' : 'Remove'}
        </Button>
      </div>

      {/* A refusal because a Service owns this container is not a fault, and
          showing it as a red error would send an Operator looking for a broken
          thing. It is a signpost: the same change is supported, on the page
          that would also update the Service's own record of it. */}
      {isManagedByService(failure) ? (
        <div className="rounded-md border border-border bg-subtle px-4 py-3">
          <Text variant="body-sm" className="font-medium">
            A SlideOps Service manages this container
          </Text>
          <Text variant="body-sm" tone="secondary" className="mt-1">
            Removing it here would leave that Service describing a container that no longer exists,
            and the next deploy would put it back. Remove it from the Service instead, where the
            record is kept in step.
          </Text>
          {serviceId ? (
            <Link
              to={`/app/services/${serviceId}`}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Open the Service
              <ArrowUpRight width={14} height={14} aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : failure ? (
        <p role="alert" className="text-sm text-danger">
          {failure.message}
        </p>
      ) : null}

      {confirmingAction ? (
        <ConfirmDialog
          open
          title={`${confirmingAction.label} ${container.name}?`}
          description={confirmingAction.confirmation?.(container.name)}
          confirmLabel={confirmingAction.label}
          confirmVariant="danger"
          onConfirm={() => run(confirming as DockerContainerAction)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}

      {confirming === 'remove' ? (
        <ConfirmDialog
          open
          title={`Remove ${container.name}?`}
          confirmLabel="Remove the container"
          confirmVariant="danger"
          onConfirm={remove}
          onCancel={() => setConfirming(null)}
          description={
            <div className="flex flex-col gap-3">
              <p>
                {container.name} is deleted from this server. Its image stays, and so does anything
                written to a named volume unless you choose otherwise below. This cannot be undone
                from SlideOps.
              </p>
              <RemovalChoice
                checked={force}
                onChange={setForce}
                label="Remove it even if it is running"
                detail="The container is killed first. Its processes get no chance to shut down. Without this, Docker refuses to remove a container that is still running."
              />
              <RemovalChoice
                checked={removeVolumes}
                onChange={setRemoveVolumes}
                label="Also delete its anonymous volumes"
                detail="This destroys data. Anonymous volumes are the ones created with the container and named by nobody, and they are where an unconfigured database keeps its files. Named volumes are not touched."
                destructive
              />
            </div>
          }
        />
      ) : null}
    </div>
  );
}

/**
 * One removal option, as its own explicit choice.
 *
 * Deliberately two checkboxes rather than one "force" that quietly does both.
 * Killing a running container and destroying its data are different acts with
 * different consequences, and an Operator who wants the first almost never
 * wants the second.
 */
function RemovalChoice({
  checked,
  onChange,
  label,
  detail,
  destructive,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  detail: string;
  destructive?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      />
      <span className="min-w-0">
        <span className={`block text-sm font-medium ${destructive ? 'text-danger' : 'text-ink'}`}>
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-ink-muted">{detail}</span>
      </span>
    </label>
  );
}
