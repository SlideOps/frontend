import {
  ApiError,
  downDockerComposeProject,
  getDockerComposeProject,
  listDockerComposeProjects,
  refusalExplanation,
  runDockerComposeAction,
  type DockerComposeAction,
  type DockerComposeProject,
  type DockerComposeProjectDetail,
  type DockerComposeStatus,
  type DockerOwnership,
} from '@slideops/api-client';
import { Button, Card, Section, Text } from '@slideops/design-system';
import {
  AlertTriangle,
  Boxes,
  Database,
  Download,
  FileText,
  Layers,
  Network,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
  Trash2,
} from '@slideops/icons';
import { EmptyState } from '@slideops/ui';
import { useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import { dependencyGraph, formatDependencyChain } from '../docker-compose-view';
import { useAsyncData } from '../hooks/useAsyncData';
import { ConfirmDialog } from './ConfirmDialog';
import { DockerComposeEditor } from './DockerComposeEditor';
import { ErrorNote, Loading } from './Feedback';

/*
 * The Compose workspace for one Node.
 *
 * A Compose stack is the unit an Operator actually thinks in: not "eleven
 * containers" but "the shop, and it is half up". So the list is stacks, the
 * detail is one stack with its services resolved to the containers behind them,
 * and every control acts on the stack rather than on a container at a time.
 *
 * Every action here is gated twice: once on the Operator's role, because a
 * Viewer is not offered controls they cannot use, and once by the backend,
 * which is the actual authority. Down is gated a third time, by a confirmation
 * that treats removing the volumes as a separate question with its own answer.
 *
 * The stack a screen is looking at is local state rather than a route, because
 * this panel is embedded in the Docker workspace and the Node and tab already
 * own the query string.
 */

const STATUS_LABELS: Record<DockerComposeStatus, string> = {
  running: 'Running',
  partial: 'Partly up',
  stopped: 'Stopped',
  unknown: 'Unknown',
};

const STATUS_TONES: Record<DockerComposeStatus, string> = {
  running: 'text-success',
  partial: 'text-warning',
  stopped: 'text-ink-muted',
  unknown: 'text-ink-muted',
};

const OWNERSHIP_LABELS: Record<DockerOwnership, string> = {
  slideops: 'Created by SlideOps',
  external: 'Created outside SlideOps',
  unknown: 'Origin not established',
};

/**
 * The six actions that leave the stack's data alone, in the order an Operator
 * reaches for them. Down is not here: it is the destructive one and it has its
 * own control, its own confirmation, and its own call.
 */
const SAFE_ACTIONS: {
  action: DockerComposeAction;
  label: string;
  icon: typeof Play;
  /** What it does, in one line, for the control's title attribute. */
  hint: string;
}[] = [
  { action: 'up', label: 'Up', icon: Play, hint: 'Create anything missing and start the stack.' },
  { action: 'start', label: 'Start', icon: Play, hint: 'Start the containers that already exist.' },
  { action: 'stop', label: 'Stop', icon: Square, hint: 'Stop the containers, leaving them in place.' },
  { action: 'restart', label: 'Restart', icon: RotateCcw, hint: 'Stop and start every service.' },
  { action: 'pull', label: 'Pull', icon: Download, hint: 'Fetch newer images without changing what is running.' },
  {
    action: 'rebuild',
    label: 'Rebuild',
    icon: RefreshCw,
    hint: 'Rebuild the images and recreate the containers. Volumes are kept.',
  },
];

function statusLabel(status: DockerComposeStatus): string {
  return STATUS_LABELS[status] ?? 'Unknown';
}

/** Read a failure the way the Operator needs it: a refusal, or a plain error. */
function messageFor(error: unknown): string {
  const refusal = refusalExplanation(error);
  if (refusal) {
    return refusal;
  }
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'That did not run. Try again.';
}

export function DockerComposeWorkspace({ nodeId }: { nodeId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { state, reload, refreshing } = useAsyncData(
    (signal) => listDockerComposeProjects(nodeId, signal),
    [nodeId],
  );

  if (state.status === 'loading') {
    return <Loading label="Reading the Compose stacks on this server" />;
  }
  if (state.status === 'error') {
    return <ErrorNote error={state.error} />;
  }

  const projects = state.data;
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No Compose stacks on this server"
        description="Nothing on this server is running under Docker Compose. A stack appears here as soon as one is brought up, whether SlideOps created it or not."
      />
    );
  }

  const active = selected ?? projects[0]?.name ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <ComposeProjectCard
            key={project.name}
            project={project}
            selected={project.name === active}
            onSelect={() => setSelected(project.name)}
          />
        ))}
      </div>
      {active ? (
        <ComposeProjectDetail
          key={active}
          nodeId={nodeId}
          project={active}
          onChanged={reload}
          listRefreshing={refreshing}
        />
      ) : null}
    </div>
  );
}

function ComposeProjectCard({
  project,
  selected,
  onSelect,
}: {
  project: DockerComposeProject;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        selected ? 'border-brand bg-subtle' : 'border-border bg-surface hover:bg-subtle'
      }`}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <Text variant="body" className="truncate font-medium">
          {project.name}
        </Text>
        <Text variant="caption" className={STATUS_TONES[project.status] ?? 'text-ink-muted'}>
          {statusLabel(project.status)}
        </Text>
      </span>
      <Text variant="caption" tone="secondary">
        {project.services.length} services, {project.container_count} containers
      </Text>
      <Text variant="caption" tone="secondary">
        {OWNERSHIP_LABELS[project.ownership] ?? OWNERSHIP_LABELS.unknown}
      </Text>
    </button>
  );
}

function ComposeProjectDetail({
  nodeId,
  project,
  onChanged,
  listRefreshing,
}: {
  nodeId: string;
  project: string;
  onChanged: () => void;
  listRefreshing: boolean;
}) {
  const canWrite = useCanWrite();
  const { state, reload, refreshing } = useAsyncData(
    (signal) => getDockerComposeProject(nodeId, project, signal),
    [nodeId, project],
  );
  const [running, setRunning] = useState<DockerComposeAction | 'down' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [downOpen, setDownOpen] = useState(false);
  // Off by default, and reset every time the dialog opens. Removing the volumes
  // is a decision made once, for one stack, not a setting that persists into
  // the next stack an Operator brings down.
  const [removeVolumes, setRemoveVolumes] = useState(false);

  if (state.status === 'loading') {
    return <Loading label={`Reading ${project}`} />;
  }
  if (state.status === 'error') {
    return <ErrorNote error={state.error} />;
  }

  const detail = state.data;

  const run = async (action: DockerComposeAction) => {
    setRunning(action);
    setError(null);
    setNote(null);
    try {
      await runDockerComposeAction(nodeId, project, action);
      setNote(`${action} finished. The stack below is re-read from the server.`);
      reload();
      onChanged();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setRunning(null);
    }
  };

  const bringDown = async () => {
    setRunning('down');
    setError(null);
    setNote(null);
    try {
      await downDockerComposeProject(nodeId, project, {
        remove_volumes: removeVolumes,
        // The second acknowledgement is sent only when the first was asked for.
        // It says the Operator was told what it costs, not merely what they
        // ticked, so it never travels on its own.
        confirm_data_loss: removeVolumes,
      });
      setNote(
        removeVolumes
          ? 'The stack is down and its volumes were removed.'
          : 'The stack is down. Its volumes were kept.',
      );
      setDownOpen(false);
      setRemoveVolumes(false);
      reload();
      onChanged();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setRunning(null);
    }
  };

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Text variant="h3">{detail.name}</Text>
          <Text variant="body-sm" tone="secondary" className="mt-1">
            {statusLabel(detail.status)}, {detail.services.length} services,{' '}
            {detail.container_count} containers.{' '}
            {OWNERSHIP_LABELS[detail.ownership] ?? OWNERSHIP_LABELS.unknown}.
          </Text>
          <Text variant="caption" tone="secondary" className="mt-1 font-mono">
            {detail.config_path ? detail.config_path : 'Config path not known for this stack'}
          </Text>
        </div>
        {refreshing || listRefreshing ? (
          <Text variant="caption" tone="secondary">
            Refreshing
          </Text>
        ) : null}
      </div>

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2">
          {SAFE_ACTIONS.map(({ action, label, icon: Icon, hint }) => (
            <Button
              key={action}
              size="sm"
              variant="secondary"
              title={hint}
              disabled={running !== null}
              onClick={() => void run(action)}
            >
              <Icon width={14} height={14} aria-hidden />
              {running === action ? 'Working' : label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="danger"
            title="Stop and remove the stack's containers and networks."
            disabled={running !== null}
            onClick={() => {
              setRemoveVolumes(false);
              setDownOpen(true);
            }}
          >
            <Trash2 width={14} height={14} aria-hidden />
            Down
          </Button>
        </div>
      ) : (
        <Text variant="body-sm" tone="secondary">
          Your role in this Workspace is read only, so this stack can be read here but not acted on.
        </Text>
      )}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {note ? (
        <Text variant="body-sm" tone="secondary">
          {note}
        </Text>
      ) : null}

      <ComposeServices detail={detail} />
      <ComposeDependencies detail={detail} />
      <ComposeResources detail={detail} />

      <Section
        title="Compose file"
        description="Read the file behind this stack, check a change, and see exactly what applying it would do before anything runs."
        adornment={<FileText width={16} height={16} className="text-brand" aria-hidden />}
        collapsible
      >
        <DockerComposeEditor nodeId={nodeId} project={project} onApplied={() => {
          reload();
          onChanged();
        }} />
      </Section>

      <ConfirmDialog
        open={downOpen}
        title={`Bring ${detail.name} down?`}
        confirmLabel={removeVolumes ? 'Down and delete the data' : 'Bring it down'}
        confirmVariant="danger"
        onCancel={() => {
          setDownOpen(false);
          setRemoveVolumes(false);
        }}
        onConfirm={bringDown}
        description={
          <span className="flex flex-col gap-3">
            <span>
              This stops and removes the stack&apos;s containers and networks. Running{' '}
              <span className="font-mono">Up</span> again recreates them from the file.
            </span>
            <label className="flex items-start gap-2 rounded-md border border-danger bg-surface p-3 text-left">
              <input
                type="checkbox"
                checked={removeVolumes}
                onChange={(event) => setRemoveVolumes(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
              <span className="flex flex-col gap-1">
                <span className="font-medium text-ink">
                  Also delete this stack&apos;s volumes
                </span>
                <span className="text-ink-muted">
                  This destroys everything the stack has stored: databases, uploads, anything
                  written to a volume. It cannot be undone, and bringing the stack back up will not
                  return it. Leave this off unless you are certain.
                  {detail.volumes.length > 0
                    ? ` ${detail.volumes.length} volumes would be deleted: ${detail.volumes.join(', ')}.`
                    : ''}
                </span>
              </span>
            </label>
          </span>
        }
      />
    </Card>
  );
}

function ComposeServices({ detail }: { detail: DockerComposeProjectDetail }) {
  if (detail.services.length === 0) {
    return (
      <Text variant="body-sm" tone="secondary">
        This stack declares no services.
      </Text>
    );
  }
  return (
    <Section
      title="Services"
      description="Each service in the file, and the containers Docker is running for it."
      adornment={<Boxes width={16} height={16} className="text-brand" aria-hidden />}
    >
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {detail.services.map((service) => (
          <li key={service.name} className="flex flex-col gap-1 px-3 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Text variant="body-sm" className="font-medium">
                {service.name}
              </Text>
              <Text variant="caption" tone="secondary" className="font-mono">
                {service.image ?? 'built from a Dockerfile'}
              </Text>
            </div>
            {service.containers.length === 0 ? (
              <Text variant="caption" tone="secondary">
                No container running for this service.
              </Text>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {service.containers.map((container) => (
                  <li key={container.full_id} className="flex flex-wrap items-baseline gap-2">
                    <Text variant="caption" className="font-mono">
                      {container.name}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {container.status_text}
                    </Text>
                  </li>
                ))}
              </ul>
            )}
            {service.depends_on.length > 0 ? (
              <Text variant="caption" tone="secondary">
                Waits for {service.depends_on.join(', ')}
              </Text>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * The start order the file describes, as text rather than as a picture.
 *
 * `frontend -> backend -> postgres` is a sentence, readable in a screen reader
 * and in a pasted incident note, and it is what an Operator asks for when they
 * ask "what has to come up first". A drawn graph would need a layout library to
 * say the same thing less legibly.
 */
function ComposeDependencies({ detail }: { detail: DockerComposeProjectDetail }) {
  const graph = dependencyGraph(
    detail.services.map((service) => ({ name: service.name, depends_on: service.depends_on })),
  );

  if (graph.cycle === null && graph.chains.length === 0 && graph.missing.length === 0) {
    return null;
  }

  return (
    <Section
      title="Start order"
      description="What this stack's depends_on says has to come up before what."
      adornment={<Network width={16} height={16} className="text-brand" aria-hidden />}
    >
      <div className="flex flex-col gap-3">
        {graph.cycle ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-danger bg-surface px-4 py-3"
          >
            <AlertTriangle width={18} height={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />
            <div>
              <Text variant="body-sm" className="font-medium">
                These services depend on each other in a circle
              </Text>
              <Text variant="body-sm" tone="secondary" className="mt-0.5 font-mono">
                {formatDependencyChain(graph.cycle)}
              </Text>
              <Text variant="body-sm" tone="secondary" className="mt-1">
                There is no order that satisfies this, so no start order is shown and Docker will
                refuse to bring the stack up. Break the loop in the file: one of these services has
                to be able to start without the others.
              </Text>
            </div>
          </div>
        ) : null}

        {graph.chains.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {graph.chains.map((chain) => (
              <li key={chain.join('>')} className="font-mono text-sm text-ink-muted">
                {formatDependencyChain(chain)}
              </li>
            ))}
          </ul>
        ) : null}

        {graph.chainsTruncated ? (
          <Text variant="caption" tone="secondary">
            Showing the first {graph.chains.length} paths. This stack has more.
          </Text>
        ) : null}

        {graph.missing.length > 0 ? (
          <div className="rounded-md border border-warning bg-surface px-4 py-3">
            <Text variant="body-sm" className="font-medium">
              Some services wait for something this stack does not define
            </Text>
            <ul className="mt-1 flex flex-col gap-0.5">
              {graph.missing.map((entry) => (
                <li key={`${entry.service}:${entry.dependsOn}`}>
                  <Text variant="caption" tone="secondary" className="font-mono">
                    {entry.service} waits for {entry.dependsOn}, which is not a service here
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function ComposeResources({ detail }: { detail: DockerComposeProjectDetail }) {
  const bands: { label: string; icon: typeof Database; values: string[] }[] = [
    { label: 'Images', icon: Layers, values: detail.images },
    { label: 'Networks', icon: Network, values: detail.networks },
    { label: 'Volumes', icon: Database, values: detail.volumes },
  ];
  if (bands.every((band) => band.values.length === 0)) {
    return null;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {bands.map(({ label, icon: Icon, values }) => (
        <div key={label} className="rounded-md border border-border bg-surface px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Icon width={14} height={14} className="text-brand" aria-hidden />
            <Text variant="caption" tone="secondary">
              {label}
            </Text>
          </div>
          {values.length === 0 ? (
            <Text variant="caption" tone="secondary" className="mt-1">
              None
            </Text>
          ) : (
            <ul className="mt-1 flex flex-col gap-0.5">
              {values.map((value) => (
                <li key={value} className="truncate font-mono text-xs text-ink" title={value}>
                  {value}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
