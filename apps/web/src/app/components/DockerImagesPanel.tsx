import {
  ApiError,
  dockerInUseContainers,
  inspectDockerImage,
  isDockerResourceInUse,
  listDockerImages,
  pullDockerImage,
  removeDockerImage,
  tagDockerImage,
  type DockerImage,
} from '@slideops/api-client';
import { Button, Field, Text } from '@slideops/design-system';
import { Download, HardDrive, ScanSearch, Tag, Trash2 } from '@slideops/icons';
import {
  DataGrid,
  Drawer,
  EmptyState,
  SearchBar,
  Toolbar,
  type DataGridColumn,
  type DataGridRow,
} from '@slideops/ui';
import { useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import { formatBytes } from '../docker-inventory';
import {
  IMAGE_LENSES,
  containersText,
  countImagesByLens,
  filterImagesByLens,
  formatAge,
  imageReference,
  inspectEntries,
  reclaimableImagesText,
  searchImages,
  type ImageLens,
} from '../docker-resources-view';
import { useAsyncData } from '../hooks/useAsyncData';
import { ConfirmDialog } from './ConfirmDialog';
import { CopyButton } from './CopyButton';
import { ErrorNote, Loading } from './Feedback';

/*
 * The images Docker is holding on one Node, and the four things an Operator
 * does with them: pull one, give one another name, look one over, remove one.
 *
 * Images are the least dangerous thing on this surface and the panel is written
 * that way. An image that goes can be pulled again from the registry it came
 * from, so removal here is a confirmation rather than a ceremony, and the
 * weight is spent instead on the one thing that is genuinely irreversible next
 * door: a volume.
 *
 * The refusal is the part worth getting right. Docker declines to remove an
 * image a container still holds, and it says which containers, and that
 * sentence is the whole answer to "why did nothing happen". A panel that
 * swallowed it and showed "Removal failed" would send somebody to the daemon
 * logs for something the daemon already told us.
 */

const inputClass =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

const badge = 'inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium';

/** Normalize anything thrown into the typed error the panels render. */
function asApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError(0, 'unknown_error', 'That did not work. Try again.');
}

/**
 * What the Node said when it declined, in the Operator's terms.
 *
 * An `in_use` refusal is not a failure and must not read as one: nothing was
 * changed, the request was answered, and the answer names what is holding the
 * image. Everything else falls back to the backend's own message.
 */
function RefusalNote({ error, subject }: { error: ApiError; subject: string }) {
  const holders = dockerInUseContainers(error);
  const refused = isDockerResourceInUse(error);
  return (
    <div role="alert" className="rounded-md border border-border bg-subtle px-4 py-3">
      <Text variant="body-sm" className="font-medium">
        {refused
          ? `${subject} is still in use, so nothing was removed`
          : `${subject} was not changed`}
      </Text>
      <Text variant="body-sm" tone="secondary" className="mt-0.5">
        {error.message}
      </Text>
      {holders.length > 0 ? (
        <Text variant="body-sm" tone="secondary" className="mt-1">
          Held by {containersText(holders)}. Stop or remove those containers first.
        </Text>
      ) : null}
    </div>
  );
}

/** Pull an image by reference, and say plainly that it takes as long as it takes. */
function PullImageForm({
  nodeId,
  onPulled,
  onClose,
}: {
  nodeId: string;
  onPulled: () => void;
  onClose: () => void;
}) {
  const [reference, setReference] = useState('');
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [pulled, setPulled] = useState('');

  const trimmed = reference.trim();

  const pull = async () => {
    if (!trimmed || pulling) {
      return;
    }
    setPulling(true);
    setError(null);
    setPulled('');
    try {
      await pullDockerImage(nodeId, trimmed);
      setPulled(trimmed);
      setReference('');
      // The image list is the only evidence of what actually landed, so it is
      // re-read rather than the panel assuming the reference it sent.
      onPulled();
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setPulling(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void pull();
      }}
    >
      <Field
        label="Image to pull"
        placeholder="nginx:latest"
        hint="A repository with a tag or digest, exactly as you would type it after docker pull. SlideOps sends it as written and adds no tag of its own."
        value={reference}
        disabled={pulling}
        onChange={(event) => setReference(event.target.value)}
      />
      {pulling ? (
        <Text variant="body-sm" tone="secondary" role="status">
          Pulling {trimmed} onto this server. A large image over a slow link takes minutes, and
          leaving this page does not stop it.
        </Text>
      ) : null}
      {pulled && !pulling ? (
        <Text variant="body-sm" tone="secondary" role="status">
          {pulled} is on this server. The list below has been re-read.
        </Text>
      ) : null}
      {error ? <ErrorNote error={error} /> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={pulling}>
          Close
        </Button>
        <Button type="submit" disabled={pulling || trimmed === ''}>
          {pulling ? 'Pulling' : 'Pull this image'}
        </Button>
      </div>
    </form>
  );
}

/** Give an image another name. Adds a reference; the image itself does not move. */
function TagImageDrawer({
  nodeId,
  image,
  onClose,
  onTagged,
}: {
  nodeId: string;
  image: DockerImage;
  onClose: () => void;
  onTagged: () => void;
}) {
  const [reference, setReference] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const trimmed = reference.trim();

  const apply = async () => {
    if (!trimmed || working) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await tagDockerImage(nodeId, image.id, trimmed);
      onTagged();
      onClose();
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Drawer open onClose={onClose} title={`Tag ${imageReference(image)}`}>
      <div className="flex flex-col gap-4">
        <Text variant="body-sm" tone="secondary">
          A tag is another name for the same image. Nothing is copied and nothing is moved, and the
          name it already has stays where it is.
        </Text>
        <Field
          label="New reference"
          placeholder="internal/web:blue"
          hint="Repository and tag, such as internal/web:blue."
          value={reference}
          disabled={working}
          onChange={(event) => setReference(event.target.value)}
        />
        {error ? <ErrorNote error={error} /> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={working}>
            Cancel
          </Button>
          <Button onClick={() => void apply()} disabled={working || trimmed === ''}>
            {working ? 'Tagging' : 'Add this tag'}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

/** Everything the daemon knows about one image, read on demand. */
function ImageInspectDrawer({
  nodeId,
  image,
  onClose,
}: {
  nodeId: string;
  image: DockerImage;
  onClose: () => void;
}) {
  const result = useAsyncData(
    (signal) => inspectDockerImage(nodeId, image.id, signal),
    [nodeId, image.id],
  );

  return (
    <Drawer open onClose={onClose} title={imageReference(image)}>
      {result.state.status === 'loading' ? <Loading label="Reading this image" /> : null}
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
    </Drawer>
  );
}

const COLUMNS: DataGridColumn[] = [
  { key: 'reference', header: 'Image', sortable: true },
  { key: 'id', header: 'Id' },
  { key: 'age', header: 'Created', sortable: true },
  { key: 'size', header: 'Size', sortable: true, align: 'end' },
  { key: 'state', header: 'In use' },
  { key: 'actions', header: 'Actions' },
];

/** The images on one Node, and what an Operator may do with them. */
export function DockerImagesPanel({ nodeId }: { nodeId: string }) {
  const canWrite = useCanWrite();
  const images = useAsyncData((signal) => listDockerImages(nodeId, signal), [nodeId]);

  const [query, setQuery] = useState('');
  const [lens, setLens] = useState<ImageLens>('all');
  const [pulling, setPulling] = useState(false);
  const [tagging, setTagging] = useState<DockerImage | null>(null);
  const [inspecting, setInspecting] = useState<DockerImage | null>(null);
  const [removing, setRemoving] = useState<DockerImage | null>(null);
  const [force, setForce] = useState(false);
  const [refusal, setRefusal] = useState<{ subject: string; error: ApiError } | null>(null);

  const reload = images.reload;

  if (images.state.status === 'loading') {
    return <Loading label="Reading the images on this server" />;
  }
  if (images.state.status === 'error') {
    return <ErrorNote error={images.state.error} />;
  }

  const all = images.state.data;
  const counts = countImagesByLens(all);
  const shown = filterImagesByLens(searchImages(all, query), lens);
  const reclaimable = reclaimableImagesText(all);

  const remove = async () => {
    const image = removing;
    if (!image) {
      return;
    }
    setRemoving(null);
    setRefusal(null);
    try {
      await removeDockerImage(nodeId, image.id, force);
      reload();
    } catch (caught) {
      // The refusal outlives the dialog on purpose. It names containers the
      // Operator has to go and deal with, and a message that vanishes with the
      // dialog is a message nobody finishes reading.
      setRefusal({ subject: imageReference(image), error: asApiError(caught) });
    } finally {
      setForce(false);
    }
  };

  const rows: DataGridRow[] = shown.map((image) => ({
    id: image.id,
    sortValues: {
      reference: imageReference(image).toLowerCase(),
      size: image.size_bytes,
      age: image.created_at ? Date.parse(image.created_at) || 0 : 0,
    },
    cells: {
      reference: (
        <span className="font-medium text-ink" title={imageReference(image)}>
          {imageReference(image)}
        </span>
      ),
      id: (
        <span className="flex items-center gap-1">
          <span className="truncate font-mono text-xs text-ink-muted" title={image.id}>
            {image.id}
          </span>
          <CopyButton value={image.id} label={`the id of ${imageReference(image)}`} />
        </span>
      ),
      age: <span className="text-ink-muted">{formatAge(image.created_at)}</span>,
      size: formatBytes(image.size_bytes),
      state: (
        <span className="flex flex-wrap gap-1">
          {image.in_use ? (
            <span className={`${badge} bg-subtle text-success`}>
              {image.containers} {image.containers === 1 ? 'container' : 'containers'}
            </span>
          ) : (
            <span className={`${badge} bg-subtle text-ink-muted`}>Unused</span>
          )}
          {image.dangling ? (
            <span className={`${badge} bg-subtle text-warning`}>Dangling</span>
          ) : null}
        </span>
      ),
      actions: (
        <span className="flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Inspect ${imageReference(image)}`}
            onClick={() => setInspecting(image)}
          >
            <ScanSearch width={14} height={14} aria-hidden />
            Inspect
          </Button>
          {canWrite ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Tag ${imageReference(image)}`}
                onClick={() => setTagging(image)}
              >
                <Tag width={14} height={14} aria-hidden />
                Tag
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove ${imageReference(image)}`}
                onClick={() => {
                  setForce(false);
                  setRefusal(null);
                  setRemoving(image);
                }}
              >
                <Trash2 width={14} height={14} aria-hidden />
                Remove
              </Button>
            </>
          ) : null}
        </span>
      ),
    },
  }));

  if (all.length === 0) {
    return (
      <EmptyState
        icon={HardDrive}
        title="Docker is holding no images on this server"
        description="Nothing has been pulled or built here yet. Pulling an image downloads it onto this server and starts nothing."
        action={
          canWrite ? <Button onClick={() => setPulling(true)}>Pull an image</Button> : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        actions={
          <>
            <Text variant="body-sm" tone="secondary">
              {shown.length} of {all.length}
            </Text>
            {canWrite ? (
              <Button size="sm" onClick={() => setPulling((was) => !was)}>
                <Download width={14} height={14} aria-hidden />
                Pull an image
              </Button>
            ) : null}
          </>
        }
      >
        <SearchBar
          value={query}
          onChange={setQuery}
          label="Search images"
          placeholder="Repository, tag or id..."
          className="sm:max-w-xs"
        />
        <label className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-ink-muted">Show</span>
          <select
            aria-label="Show"
            className={inputClass}
            value={lens}
            onChange={(event) => setLens(event.target.value as ImageLens)}
          >
            {IMAGE_LENSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({counts[option.value]})
              </option>
            ))}
          </select>
        </label>
      </Toolbar>

      {reclaimable ? (
        <div className="rounded-md border border-border bg-surface px-4 py-3">
          <Text variant="body-sm" className="font-medium">
            {reclaimable}
          </Text>
          <Text variant="body-sm" tone="secondary" className="mt-0.5">
            That is every image no container is using, added up as Docker reports each one. Images
            that share layers release less than the sum when they go, so treat it as the most this
            could free rather than a promise.
          </Text>
        </div>
      ) : null}

      {refusal ? <RefusalNote error={refusal.error} subject={refusal.subject} /> : null}

      {pulling && canWrite ? (
        <PullImageForm nodeId={nodeId} onPulled={reload} onClose={() => setPulling(false)} />
      ) : null}

      <DataGrid
        columns={COLUMNS}
        rows={rows}
        loading={images.refreshing}
        emptyMessage="No image on this server matches what you are looking for."
      />

      {inspecting ? (
        <ImageInspectDrawer
          nodeId={nodeId}
          image={inspecting}
          onClose={() => setInspecting(null)}
        />
      ) : null}

      {tagging && canWrite ? (
        <TagImageDrawer
          nodeId={nodeId}
          image={tagging}
          onClose={() => setTagging(null)}
          onTagged={reload}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null && canWrite}
        title={`Remove ${removing ? imageReference(removing) : 'this image'}?`}
        confirmLabel="Remove this image"
        confirmVariant="danger"
        onCancel={() => {
          setRemoving(null);
          setForce(false);
        }}
        onConfirm={remove}
        description={
          removing ? (
            <span className="flex flex-col gap-2">
              <span>
                This removes {imageReference(removing)} ({formatBytes(removing.size_bytes)}) from
                this server. It can be pulled again from wherever it came from, and no container is
                started or stopped by this.
              </span>
              {removing.in_use ? (
                <span className="text-warning">
                  {removing.containers}{' '}
                  {removing.containers === 1 ? 'container is' : 'containers are'} using this image.
                  Docker will refuse to remove it while that is true, and will say which.
                </span>
              ) : null}
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(event) => setForce(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Remove it even where a stopped container still references it. A running container
                  keeps the image whatever this says.
                </span>
              </label>
            </span>
          ) : null
        }
      />
    </div>
  );
}
