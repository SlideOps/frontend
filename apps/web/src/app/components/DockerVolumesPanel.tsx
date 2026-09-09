import {
  ApiError,
  createDockerVolume,
  dockerInUseContainers,
  inspectDockerVolume,
  isDockerResourceInUse,
  listDockerVolumes,
  removeDockerVolume,
  type DockerVolume,
} from '@slideops/api-client';
import { Button, Field, Text } from '@slideops/design-system';
import { Database, Plus, ScanSearch, Trash2 } from '@slideops/icons';
import { DataGrid, Drawer, EmptyState, SearchBar, Toolbar, type DataGridColumn, type DataGridRow } from '@slideops/ui';
import { useCallback, useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import {
  containersText,
  formatAge,
  inspectEntries,
  searchVolumes,
  volumeSizeText,
} from '../docker-resources-view';
import { useAsyncData } from '../hooks/useAsyncData';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorNote, Loading } from './Feedback';

/*
 * The volumes on one Node.
 *
 * This is the most destructive surface in the Docker control centre, and the
 * reason is one sentence: a volume is data. An image comes back from a
 * registry, a network is three lines of configuration, a container can be
 * started again from the image it ran. A removed volume is a database that was
 * there this morning and is not there now, and nothing in SlideOps or in Docker
 * can put it back.
 *
 * So removal here is not a button with a confirmation on it. The Operator has
 * to type the volume's name, which is the one interaction that cannot be
 * completed by a person who thought they were clicking something else. The
 * dialog also names every container currently mounting it, because "in use" as
 * a badge is a fact somebody skims and "mounted by postgres" is a fact that
 * stops them.
 *
 * Size deserves the same care. The daemon reports it only when it was asked for
 * disk usage, which is slow and often skipped, and it answers -1 when it was
 * asked and could not tell. Both are Unknown here and neither is 0 B: an empty
 * volume is exactly the volume that looks safe to remove, and it is the reading
 * we are least entitled to invent.
 */

const badge = 'inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium';

function asApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError(0, 'unknown_error', 'That did not work. Try again.');
}

/** What the Node said when it declined. An in_use refusal names what is holding it. */
function RefusalNote({ error, subject }: { error: ApiError; subject: string }) {
  const holders = dockerInUseContainers(error);
  return (
    <div role="alert" className="rounded-md border border-border bg-subtle px-4 py-3">
      <Text variant="body-sm" className="font-medium">
        {isDockerResourceInUse(error)
          ? `${subject} is still mounted, so nothing was removed`
          : `${subject} was not changed`}
      </Text>
      <Text variant="body-sm" tone="secondary" className="mt-0.5">
        {error.message}
      </Text>
      {holders.length > 0 ? (
        <Text variant="body-sm" tone="secondary" className="mt-1">
          Mounted by {containersText(holders)}. Stop those containers first if you still want this
          volume gone.
        </Text>
      ) : null}
    </div>
  );
}

/** Create a volume. Creating one is harmless: an empty volume nothing mounts. */
function CreateVolumeForm({
  nodeId,
  onCreated,
  onClose,
}: {
  nodeId: string;
  onCreated: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [driver, setDriver] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const trimmed = name.trim();

  const create = async () => {
    if (!trimmed || working) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      // An empty driver field is an absent driver, not a driver called "".
      // Docker's own default is what the Operator gets when they name none.
      await createDockerVolume(nodeId, {
        name: trimmed,
        driver: driver.trim() || undefined,
      });
      setName('');
      setDriver('');
      onCreated();
      onClose();
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setWorking(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void create();
      }}
    >
      <Field
        label="Volume name"
        placeholder="app-data"
        hint="What containers will mount it by. Docker keeps the name exactly as typed."
        value={name}
        disabled={working}
        onChange={(event) => setName(event.target.value)}
      />
      <Field
        label="Driver (optional)"
        placeholder="local"
        hint="Leave this empty unless this server has a storage driver you mean to use. Docker's own default is local."
        value={driver}
        disabled={working}
        onChange={(event) => setDriver(event.target.value)}
      />
      {error ? <ErrorNote error={error} /> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={working}>
          Cancel
        </Button>
        <Button type="submit" disabled={working || trimmed === ''}>
          {working ? 'Creating' : 'Create this volume'}
        </Button>
      </div>
    </form>
  );
}

/** Everything the daemon knows about one volume, read on demand. */
function VolumeInspectDrawer({
  nodeId,
  volume,
  onClose,
}: {
  nodeId: string;
  volume: DockerVolume;
  onClose: () => void;
}) {
  const result = useAsyncData(
    (signal) => inspectDockerVolume(nodeId, volume.name, signal),
    [nodeId, volume.name],
  );

  return (
    <Drawer open onClose={onClose} title={volume.name}>
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-border bg-subtle px-3 py-2">
          <Text variant="body-sm" tone="secondary">
            Mounted by {containersText(volume.containers)}. Size {volumeSizeText(volume)}.
          </Text>
        </div>
        {result.state.status === 'loading' ? <Loading label="Reading this volume" /> : null}
        {result.state.status === 'error' ? <ErrorNote error={result.state.error} /> : null}
        {result.state.status === 'ready' ? (
          <dl className="flex flex-col gap-2">
            {inspectEntries(result.state.data).map((entry) => (
              <div key={entry.label} className="border-b border-border pb-2 last:border-b-0">
                <dt className="text-xs text-ink-muted">{entry.label}</dt>
                <dd className="break-words font-mono text-sm text-ink">{entry.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </Drawer>
  );
}

const COLUMNS: DataGridColumn[] = [
  { key: 'name', header: 'Volume', sortable: true },
  { key: 'driver', header: 'Driver' },
  { key: 'mountpoint', header: 'Mountpoint' },
  { key: 'age', header: 'Created', sortable: true },
  { key: 'size', header: 'Size', sortable: true, align: 'end' },
  { key: 'mounted', header: 'Mounted by' },
  { key: 'actions', header: 'Actions' },
];

/** The volumes on one Node, and the deliberate way they are removed. */
export function DockerVolumesPanel({ nodeId }: { nodeId: string }) {
  const canWrite = useCanWrite();
  const volumes = useAsyncData((signal) => listDockerVolumes(nodeId, signal), [nodeId]);

  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [inspecting, setInspecting] = useState<DockerVolume | null>(null);
  const [removing, setRemoving] = useState<DockerVolume | null>(null);
  /** What the Operator has typed to confirm the removal. Must match the name. */
  const [typedName, setTypedName] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [refusal, setRefusal] = useState<{ subject: string; error: ApiError } | null>(null);

  const reload = volumes.reload;

  /*
   * Stable across renders on purpose. ConfirmDialog re-runs its focus effect
   * whenever this identity changes, and that effect restores focus to whatever
   * opened the dialog. With a fresh closure each render, the first character
   * typed into the confirmation field moved focus back out of it and the rest
   * of the name went nowhere, which made a deliberately deliberate removal
   * impossible to complete.
   */
  const closeRemoval = useCallback(() => {
    setRemoving(null);
    setTypedName('');
    setMismatch(false);
  }, []);

  if (volumes.state.status === 'loading') {
    return <Loading label="Reading the volumes on this server" />;
  }
  if (volumes.state.status === 'error') {
    return <ErrorNote error={volumes.state.error} />;
  }

  const all = volumes.state.data;
  const shown = searchVolumes(all, query);

  const remove = async () => {
    const volume = removing;
    if (!volume) {
      return;
    }
    // The typed name is checked here rather than by disabling the button,
    // because a removal that will not happen should say why it will not happen.
    // Silence would read as the dialog being broken.
    if (typedName.trim() !== volume.name) {
      setMismatch(true);
      return;
    }
    closeRemoval();
    setRefusal(null);
    try {
      // Never forced from this screen. A volume a container still has open is a
      // volume something is writing to, and the honest answer to that is to stop
      // the container, not to take the disk out from under it.
      await removeDockerVolume(nodeId, volume.name, false);
      reload();
    } catch (caught) {
      setRefusal({ subject: volume.name, error: asApiError(caught) });
    }
  };

  const rows: DataGridRow[] = shown.map((volume) => ({
    id: volume.name,
    sortValues: {
      name: volume.name.toLowerCase(),
      age: Date.parse(volume.created_at ?? '') || 0,
      // A size nobody read sorts last rather than sorting as an empty volume.
      size: typeof volume.size_bytes === 'number' && volume.size_bytes >= 0 ? volume.size_bytes : -1,
    },
    cells: {
      name: (
        <span className="font-medium text-ink" title={volume.name}>
          {volume.name}
        </span>
      ),
      driver: <span className="text-ink-muted">{volume.driver}</span>,
      mountpoint: (
        <span className="truncate font-mono text-xs text-ink-muted" title={volume.mountpoint}>
          {volume.mountpoint}
        </span>
      ),
      age: <span className="text-ink-muted">{formatAge(volume.created_at)}</span>,
      size: volumeSizeText(volume),
      mounted: volume.in_use ? (
        <span className={`${badge} bg-subtle text-success`} title={containersText(volume.containers)}>
          {containersText(volume.containers)}
        </span>
      ) : (
        <span className={`${badge} bg-subtle text-ink-muted`}>Nothing</span>
      ),
      actions: (
        <span className="flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Inspect ${volume.name}`}
            onClick={() => setInspecting(volume)}
          >
            <ScanSearch width={14} height={14} aria-hidden />
            Inspect
          </Button>
          {canWrite ? (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Remove ${volume.name}`}
              onClick={() => {
                setRefusal(null);
                setTypedName('');
                setMismatch(false);
                setRemoving(volume);
              }}
            >
              <Trash2 width={14} height={14} aria-hidden />
              Remove
            </Button>
          ) : null}
        </span>
      ),
    },
  }));

  return (
    <div className="flex flex-col gap-4">
      {all.length === 0 && !creating ? (
        <EmptyState
          icon={Database}
          title="Docker is holding no volumes on this server"
          description="A volume is where a container keeps data that has to survive it being replaced. Nothing here has created one yet."
          action={
            canWrite ? <Button onClick={() => setCreating(true)}>Create a volume</Button> : undefined
          }
        />
      ) : (
        <Toolbar
          actions={
            <>
              <Text variant="body-sm" tone="secondary">
                {shown.length} of {all.length}
              </Text>
              {canWrite ? (
                <Button size="sm" onClick={() => setCreating((was) => !was)}>
                  <Plus width={14} height={14} aria-hidden />
                  Create a volume
                </Button>
              ) : null}
            </>
          }
        >
          <SearchBar
            value={query}
            onChange={setQuery}
            label="Search volumes"
            placeholder="Name, driver, mountpoint, label..."
            className="sm:max-w-xs"
          />
        </Toolbar>
      )}

      {refusal ? <RefusalNote error={refusal.error} subject={refusal.subject} /> : null}

      {creating && canWrite ? (
        <CreateVolumeForm nodeId={nodeId} onCreated={reload} onClose={() => setCreating(false)} />
      ) : null}

      {all.length > 0 ? (
        <DataGrid
          columns={COLUMNS}
          rows={rows}
          loading={volumes.refreshing}
          emptyMessage="No volume on this server matches what you are looking for."
        />
      ) : null}

      {inspecting ? (
        <VolumeInspectDrawer
          nodeId={nodeId}
          volume={inspecting}
          onClose={() => setInspecting(null)}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null && canWrite}
        title={removing ? `Remove the volume ${removing.name}?` : 'Remove this volume?'}
        confirmLabel="Remove this volume and its data"
        confirmVariant="danger"
        onCancel={closeRemoval}
        onConfirm={remove}
        description={
          removing ? (
            <span className="flex flex-col gap-3">
              <span className="text-danger">
                This deletes the data in {removing.name}. It cannot be undone, SlideOps keeps no
                copy, and nothing on this server or anywhere else will bring it back.
              </span>
              <span>
                Size {volumeSizeText(removing)}. Mounted by {containersText(removing.containers)}.
                {volumeSizeText(removing) === 'Unknown'
                  ? ' Docker was not asked how large this volume is, so how much data this deletes is unknown.'
                  : ''}
              </span>
              {removing.in_use ? (
                <span className="text-warning">
                  A container has this volume open right now. Docker will refuse while that is true,
                  and the refusal will name it.
                </span>
              ) : (
                <span>
                  Nothing has it mounted at the moment, which is not the same as nothing needing it.
                  A stopped service still expects its data to be here when it starts again.
                </span>
              )}
              <label className="flex flex-col gap-1.5">
                <span>
                  Type <span className="font-mono text-ink">{removing.name}</span> to confirm.
                </span>
                <input
                  type="text"
                  aria-label="Type the volume name to confirm"
                  autoComplete="off"
                  value={typedName}
                  onChange={(event) => {
                    setTypedName(event.target.value);
                    setMismatch(false);
                  }}
                  className="h-9 rounded-md border border-border bg-surface px-2.5 font-mono text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </label>
              {mismatch ? (
                <span role="alert" className="text-danger">
                  That is not the name of this volume. Nothing has been removed. Type{' '}
                  {removing.name} exactly, or cancel.
                </span>
              ) : null}
            </span>
          ) : null
        }
      />
    </div>
  );
}
