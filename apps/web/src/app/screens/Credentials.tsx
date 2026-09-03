import {
  ApiError,
  connectCapability,
  controlCapability,
  createOperation,
  getCapabilityConnections,
  listNodes,
  listOperations,
  listProjects,
  listServices,
  revealNodeCredential,
  revealOperationSecret,
  type CapabilityControlAction,
  type Node,
  type NodeCredential,
  type Operation,
  type Project,
  type Service,
  type ServiceConnection,
} from '@slideops/api-client';
import { Button, Text, cn } from '@slideops/design-system';
import { ArrowLeft, KeyRound, Search, Server, Waypoints, capabilityIcon } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { type ComponentType, type ReactNode, type SVGProps, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CredentialsCard } from '../components/CredentialsCard';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { RevealValue } from '../components/RevealValue';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * Credentials, as a classic master-detail app: a searchable list of every
 * Server and every credential a Capability created, and a detail pane beside
 * it (below it, on a narrow screen) for whichever one is selected. Nothing
 * about what this page shows or does changed in this pass, only how it is
 * found and read: a page that used to lay out every credential's full card,
 * one after another, down a long scroll, now shows a scannable list first and
 * the full detail on demand, the way a password manager or a mail client
 * does.
 */

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * The literal a secret parameter carries in an Operation's `parameters`. A
 * parameter is a stored secret, and revealable, exactly when its value is this
 * string; the plaintext lives only behind the reveal endpoint, never in the
 * record. This is the same contract the CredentialsCard reads.
 */
const SECRET_PLACEHOLDER = '[stored securely]';

/** The connection details worth writing into a downloaded file, in scan order. */
const CONNECTION_KEYS = [
  'database',
  'username',
  'user',
  'host',
  'hostname',
  'address',
  'port',
] as const;

/** The filename base for the combined download. */
const ALL_FILE_NAME = 'slideops-credentials.env';

/** A Capability produced credentials exactly when it stored at least one secret. */
function hasStoredSecret(operation: Operation): boolean {
  const parameters = operation.parameters ?? {};
  return Object.values(parameters).some((value) => value === SECRET_PLACEHOLDER);
}

/**
 * The database engine a Capability key belongs to, or null when it is not
 * one of the five SlideOps knows how to install, manage, and control. Every
 * key for one engine (install-X, configure-X, manage-X, remove-X) shares the
 * same suffix, so this is what lets a bare install and a later manage-X
 * credential be recognised as the same engine rather than two unrelated
 * things.
 */
const ENGINE_FAMILIES = ['postgresql', 'redis', 'mariadb', 'mysql', 'mongodb'] as const;
type EngineFamily = (typeof ENGINE_FAMILIES)[number];

function engineFamilyOf(capabilityKey: string): EngineFamily | null {
  // mariadb checked before mysql: install-mariadb would otherwise never match,
  // since it contains no "mysql" substring, but checking mysql first would be
  // fine too -- this order just keeps the two visually paired with their own
  // install-mariadb / install-mysql keys above.
  return ENGINE_FAMILIES.find((family) => capabilityKey.includes(family)) ?? null;
}

/** Whether a Capability key is one of the five engines' own install step. */
function isEngineInstall(capabilityKey: string): boolean {
  return capabilityKey.startsWith('install-') && engineFamilyOf(capabilityKey) !== null;
}

/** A readable Capability name from its key, in Operator language. */
function capabilityName(key: string): string {
  return key
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** An environment-variable-safe key, upper snake case, for a downloaded file. */
function envKey(key: string): string {
  return key
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

/** Quote a value so newlines and quotes in it never break the .env line. */
function envQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

/** A short, stable slug of an Operation id for a per-item filename. */
function shortId(id: string): string {
  return id.replace(/[^A-Za-z0-9]+/g, '').slice(0, 8) || 'credential';
}

/** A row's search text is not what it happens to render, so a match still
 *  works if the visible strings are later reworded. */
function matchesQuery(haystack: (string | null | undefined)[], query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return haystack
    .filter((part): part is string => Boolean(part))
    .some((part) => part.toLowerCase().includes(needle));
}

interface CredentialContext {
  operation: Operation;
  title: string;
  nodeName: string | null;
  /** The Node's address, so the card can form a real connection. */
  host: string | null;
  /** The Node's Docker bridge address, from its most recent Discovery. */
  dockerBridgeAddress: string | null;
  projectName: string | null;
  projectId: string | null;
  completedAt: string | null;
}

/**
 * Build the .env-style text for one credential, revealing each stored secret on
 * demand. Secrets are fetched here, held only in the string that becomes the
 * download, and never logged or placed in any URL.
 */
async function buildCredentialBlock(
  context: CredentialContext,
  signal?: AbortSignal,
): Promise<string> {
  const { operation } = context;
  const parameters = operation.parameters ?? {};

  const lines: string[] = [];
  const heading = [context.nodeName, context.projectName].filter(Boolean).join(' / ');
  lines.push(`# ${context.title}${heading ? ` (${heading})` : ''}`);
  if (context.completedAt) {
    lines.push(`# Completed ${context.completedAt}`);
  }

  for (const key of CONNECTION_KEYS) {
    const value = parameters[key];
    if (value === SECRET_PLACEHOLDER) {
      continue;
    }
    if ((typeof value === 'string' || typeof value === 'number') && String(value).length > 0) {
      lines.push(`${envKey(key)}=${envQuote(String(value))}`);
    }
  }

  const secretKeys = Object.keys(parameters).filter(
    (key) => parameters[key] === SECRET_PLACEHOLDER,
  );
  for (const key of secretKeys) {
    const revealed = await revealOperationSecret(operation.id, key, signal);
    lines.push(`${envKey(key)}=${envQuote(revealed.value)}`);
  }

  return lines.join('\n');
}

/** Trigger a client-side download of text without stealing focus from the page. */
function downloadText(fileName: string, text: string): void {
  const blob = new Blob([`${text}\n`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Manage, Start, Stop, Restart, and Delete for a database engine's own
 * credential card -- reaching the running thing the credential is for, not
 * only the secret itself. Shown for the five engines SlideOps knows how to
 * control; absent for anything else, including a Node's own SSH login,
 * which has no engine to control.
 *
 * Start/Stop/Restart act directly, live over SSH, the same way a Service's
 * own lifecycle actions already do -- there is no separate "pause": a
 * systemd service has nothing in between running and stopped, so Stop is
 * what a pause actually is here, and is not duplicated under another name.
 *
 * Delete does not tear anything down itself. It creates the real Remove-X
 * Operation and hands the Operator straight to it, to review the plan and
 * approve, exactly like starting any other Capability -- deleting a database
 * is not something this page decides on its own behalf.
 */
function CapabilityActionsRow({ context }: { context: CredentialContext }) {
  const navigate = useNavigate();
  const family = engineFamilyOf(context.operation.capability_key);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [dropData, setDropData] = useState(false);

  if (!family) {
    return null;
  }
  const installKey = `install-${family}`;
  const nodeId = context.operation.node_id;

  async function control(action: CapabilityControlAction) {
    setWorking(action);
    setError(null);
    setMessage(null);
    try {
      await controlCapability(nodeId, installKey, action);
      setMessage(action === 'start' ? 'Started.' : action === 'stop' ? 'Stopped.' : 'Restarted.');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : `Could not ${action} it.`);
    } finally {
      setWorking(null);
    }
  }

  async function remove() {
    setWorking('delete');
    setError(null);
    try {
      const operation = await createOperation({
        node_id: nodeId,
        project_id: context.projectId ?? undefined,
        capability_key: `remove-${family}`,
        parameters: { drop_data: dropData },
      });
      navigate(`/app/operations/${operation.id}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'This could not be removed.');
      setWorking(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate(
              `/app/capabilities/${installKey}?node=${encodeURIComponent(nodeId)}${
                context.projectId ? `&project=${encodeURIComponent(context.projectId)}` : ''
              }`,
            )
          }
        >
          Manage
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={working !== null}
          onClick={() => void control('start')}
        >
          {working === 'start' ? 'Starting' : 'Start'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={working !== null}
          onClick={() => void control('stop')}
        >
          {working === 'stop' ? 'Stopping' : 'Stop'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={working !== null}
          onClick={() => void control('restart')}
        >
          {working === 'restart' ? 'Restarting' : 'Restart'}
        </Button>
        {!confirmingDelete ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            disabled={working !== null}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </Button>
        ) : null}
      </div>
      {confirmingDelete ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-subtle px-3 py-2">
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={dropData}
              onChange={(event) => setDropData(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-border text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
            Also delete its data
          </label>
          <Button
            variant="danger"
            size="sm"
            disabled={working !== null}
            onClick={() => void remove()}
          >
            {working === 'delete' ? 'Starting removal' : 'Start removal'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={working !== null}
            onClick={() => setConfirmingDelete(false)}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      {message ? (
        <p role="status" className="text-xs text-ink-muted">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Wire this Capability's credentials straight into a Service's environment,
 * one click -- the "Connect" side of the Connect feature. Also shows "Used
 * by", the reverse direction: every Service already connected to this exact
 * Capability instance, which doubles as the plain "what talks to what" list
 * the Operator asked for, not a diagram.
 *
 * Only offered for the five database engines (the same ones
 * CapabilityActionsRow controls), and only a software Service in the same
 * Project can be a target: a Capability Service has no environment of its
 * own to receive a connection, and a Service in a different Project is not
 * offered since nothing here should wire across Project boundaries silently.
 */
function ConnectSection({ context, services }: { context: CredentialContext; services: Service[] }) {
  const family = engineFamilyOf(context.operation.capability_key);
  const nodeId = context.operation.node_id;
  const installKey = family ? `install-${family}` : '';

  const connections = useAsyncData<ServiceConnection[]>(
    (signal) => (family ? getCapabilityConnections(nodeId, installKey, signal) : Promise.resolve([])),
    [nodeId, installKey, family],
  );

  const [selected, setSelected] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!family) {
    return null;
  }

  const eligible = services.filter(
    (service) =>
      service.deployment_type === 'software' &&
      service.project_id === context.projectId &&
      service.node_id === nodeId,
  );

  const connectedNames = new Set(
    connections.state.status === 'ready'
      ? connections.state.data.map((connection) => connection.service_id)
      : [],
  );
  const usedBy = eligible.filter((service) => connectedNames.has(service.id));

  async function connect() {
    if (!selected) {
      return;
    }
    setConnecting(true);
    setError(null);
    setMessage(null);
    try {
      await connectCapability(selected, {
        node_id: nodeId,
        capability_key: installKey,
        operation_id: context.operation.id,
      });
      const name = eligible.find((service) => service.id === selected)?.name ?? 'the Service';
      setMessage(`Connected to ${name}. Redeploying to apply it.`);
      setSelected('');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not connect this.');
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="flex items-center gap-1.5">
        <Waypoints width={14} height={14} className="text-ink-muted" aria-hidden />
        <Text variant="caption" tone="secondary">
          {usedBy.length > 0
            ? `Used by: ${usedBy.map((service) => service.name).join(', ')}`
            : 'Not connected to any Service yet'}
        </Text>
      </div>
      {eligible.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={selectClass}
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            aria-label="Connect to a Service"
          >
            <option value="">Choose a Service&hellip;</option>
            {eligible.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            disabled={!selected || connecting}
            onClick={() => void connect()}
          >
            {connecting ? 'Connecting' : 'Connect'}
          </Button>
        </div>
      ) : null}
      {message ? (
        <p role="status" className="text-xs text-ink-muted">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const selectClass =
  'h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * The header every detail pane opens with: what is selected, where it lives,
 * a primary action on the right, and, only on a narrow screen where the list
 * and the detail never share the screen, a way back to it.
 */
function DetailHeader({
  title,
  meta,
  onBack,
  action,
}: {
  title: string;
  meta?: string | null;
  onBack: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
      <div className="min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex items-center gap-1 text-xs font-medium text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:hidden"
        >
          <ArrowLeft width={14} height={14} aria-hidden />
          All credentials
        </button>
        <Text variant="h4" className="truncate">
          {title}
        </Text>
        {meta ? (
          <Text variant="caption" tone="secondary" className="mt-0.5 block">
            {meta}
          </Text>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * One Node's own SSH connection credential: the password or private key the
 * Operator gave SlideOps to reach it, revealed on demand. This is the
 * "account at the Node/server level" a Capability's credential is not: it is
 * how SlideOps itself signs in, stored once when the Node was connected or
 * last rotated, not produced by any Operation, so it never appeared here
 * before even though it is exactly the kind of thing this page exists to
 * hold.
 */
function NodeDetailPanel({
  node,
  projectName,
  onBack,
}: {
  node: Node;
  projectName: string | null;
  onBack: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<Error | null>(null);
  const meta = [node.address, projectName].filter(Boolean).join(' / ');

  async function download() {
    setDownloadError(null);
    setDownloading(true);
    try {
      const credential = await revealNodeCredential(node.id);
      const lines = [
        `# ${node.name} connection (${node.address})`,
        `SLIDEOPS_NODE_HOST=${envQuote(node.address)}`,
        `SLIDEOPS_NODE_PORT=${envQuote(String(node.port))}`,
        `SLIDEOPS_NODE_USERNAME=${envQuote(node.ssh_username)}`,
        `SLIDEOPS_NODE_${credential.auth_kind === 'password' ? 'PASSWORD' : 'PRIVATE_KEY'}=${envQuote(
          credential.secret,
        )}`,
      ];
      downloadText(`slideops-node-${shortId(node.id)}.env`, lines.join('\n'));
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error : new Error('This credential could not be prepared.'),
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={node.name}
        meta={meta || 'No Project recorded'}
        onBack={onBack}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void download()}
            disabled={downloading}
            aria-busy={downloading || undefined}
          >
            {downloading ? 'Preparing' : 'Download'}
          </Button>
        }
      />
      {downloadError ? (
        <p role="alert" className="text-sm text-danger">
          {downloadError.message}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Server width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Server login</Text>
      </div>
      <Text variant="body-sm" tone="secondary">
        The credential SlideOps itself uses to sign in to this Node over SSH.
      </Text>
      <dl className="flex flex-col divide-y divide-border rounded-md border border-border px-4">
        <div className="grid gap-1 py-3 first:pt-3 sm:grid-cols-[8rem_1fr] sm:items-center sm:gap-3">
          <dt className="text-xs font-medium text-ink-muted">Host</dt>
          <dd className="min-w-0">
            <RevealValue value={`${node.address}:${node.port}`} label="host" sensitive={false} />
          </dd>
        </div>
        <div className="grid gap-1 py-3 sm:grid-cols-[8rem_1fr] sm:items-center sm:gap-3">
          <dt className="text-xs font-medium text-ink-muted">Username</dt>
          <dd className="min-w-0">
            <RevealValue value={node.ssh_username} label="username" sensitive={false} />
          </dd>
        </div>
        <div className="grid gap-1 py-3 last:pb-3 sm:grid-cols-[8rem_1fr] sm:items-center sm:gap-3">
          <dt className="text-xs font-medium text-ink-muted">
            {node.auth_kind === 'password' ? 'Password' : 'Private key'}
          </dt>
          <dd className="min-w-0">
            <RevealValue
              label={node.auth_kind === 'password' ? 'password' : 'private key'}
              sensitive
              onReveal={() => revealNodeCredential(node.id).then((c: NodeCredential) => c.secret)}
            />
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** A database Capability's full detail: its credentials, the engine it
 *  controls, and the Connect surface -- everything the equivalent card used
 *  to show at once, now the content of the selected row. */
function CapabilityDetailPanel({
  context,
  services,
  onBack,
  onDownload,
  downloading,
}: {
  context: CredentialContext;
  services: Service[];
  onBack: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const meta = [context.nodeName, context.projectName].filter(Boolean).join(' / ');
  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={context.title}
        meta={`${meta || 'No Node recorded'}${context.completedAt ? ` · ${context.completedAt}` : ''}`}
        onBack={onBack}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={onDownload}
            disabled={downloading}
            aria-busy={downloading || undefined}
          >
            {downloading ? 'Preparing' : 'Download'}
          </Button>
        }
      />
      <CredentialsCard
        operation={context.operation}
        host={context.host ?? undefined}
        dockerBridgeAddress={context.dockerBridgeAddress ?? undefined}
      />
      <CapabilityActionsRow context={context} />
      <ConnectSection context={context} services={services} />
    </div>
  );
}

/** One row in the list pane: an icon, a title, an optional subtitle, and a
 *  selected state, matching the classic list-then-detail pattern of a
 *  password manager or a mail client. */
function ListRow({
  icon: Icon,
  title,
  subtitle,
  selected,
  onClick,
}: {
  icon: IconComponent;
  title: string;
  subtitle?: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        selected ? 'bg-brand-subtle' : 'hover:bg-subtle',
      )}
    >
      <span
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
          selected ? 'bg-surface text-brand' : 'bg-subtle text-ink-muted',
        )}
      >
        <Icon width={16} height={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <Text as="span" variant="body-sm" className="block truncate font-medium text-ink">
          {title}
        </Text>
        {subtitle ? (
          <Text as="span" variant="caption" tone="secondary" className="block truncate">
            {subtitle}
          </Text>
        ) : null}
      </span>
    </button>
  );
}

/** The icon for a database Capability's own row: its engine's brand mark when
 *  the key names one of the five known engines, a plain key otherwise. */
function capabilityRowIcon(capabilityKey: string): IconComponent {
  return capabilityIcon({ key: capabilityKey, category: 'security' });
}

/** A selected row, addressed by which list it came from and its own id, so a
 *  Node and a Capability credential can never collide even if their ids ever
 *  happened to match. */
type SelectedRow = { kind: 'node'; id: string } | { kind: 'capability'; id: string };

/**
 * Credentials: every secret SlideOps created for the Operator while running a
 * Capability, gathered from their Operations so each can be revealed, copied,
 * and downloaded for use in other tools. It shows what SlideOps generated
 * (database passwords, service secrets, connection details), not SSH private
 * keys, which SlideOps never holds because create-app-user takes a public key
 * the Operator provides.
 *
 * Presented as a classic master-detail app: a searchable list on the left (or
 * on top, on a narrow screen), the full detail for whichever one is selected
 * beside it. Nothing about what is shown or what it does changed from the
 * card-per-credential layout this replaces, only how it is found and read.
 */
export function Credentials() {
  const { state } = useAsyncData(
    (signal) =>
      Promise.all([
        listOperations({}, signal),
        listNodes(signal),
        listProjects(signal),
        listServices(signal),
      ]).then(([operations, nodes, projects, services]) => ({
        operations,
        nodes,
        projects,
        services,
      })),
    [],
  );

  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SelectedRow | null>(null);
  // Which credential is being prepared for download; 'all' covers the whole set.
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<Error | null>(null);

  const data =
    state.status === 'ready'
      ? state.data
      : {
          operations: [] as Operation[],
          nodes: [] as Node[],
          projects: [] as Project[],
          services: [] as Service[],
        };

  const contexts = useMemo<CredentialContext[]>(() => {
    const nodeById = new Map(data.nodes.map((node) => [node.id, node] as const));
    const projectById = new Map(data.projects.map((project) => [project.id, project] as const));

    const sorted = data.operations
      // Only a completed Operation actually created its credential; a failed
      // attempt left a sealed value but no usable result, so it must not appear
      // (which is what showed a failed run as a duplicate of the real one).
      .filter((operation) => operation.status === 'completed')
      // A run that stored a secret always belongs here. So does a bare
      // install of one of the five database engines, even with no secret at
      // all: install-redis has no password parameter of its own (Redis has
      // no manage step the way the SQL and document engines do, so a
      // password is only ever set later, optionally, by configure-redis),
      // and every engine reads the same way before its first manage-X run
      // creates an actual database. Omitting those left a running, reachable
      // database Operator-invisible on the one page meant to show every
      // credential SlideOps holds -- worse than showing a card with no
      // secret on it, which is exactly what CredentialsCard already renders
      // correctly once given a host and a recognised Capability family.
      .filter((operation) => hasStoredSecret(operation) || isEngineInstall(operation.capability_key))
      .map((operation) => {
        const node = nodeById.get(operation.node_id) ?? null;
        const project = node?.project_id ? (projectById.get(node.project_id) ?? null) : null;
        return {
          operation,
          title: capabilityName(operation.capability_key),
          nodeName: node?.name ?? null,
          host: node?.address ?? null,
          dockerBridgeAddress: node?.docker_bridge_address ?? null,
          projectName: project?.name ?? null,
          projectId: project?.id ?? null,
          completedAt: operation.completed_at
            ? new Date(operation.completed_at).toLocaleString()
            : null,
        };
      })
      .sort((a, b) => {
        const at = a.operation.completed_at ?? a.operation.created_at ?? '';
        const bt = b.operation.completed_at ?? b.operation.created_at ?? '';
        return bt.localeCompare(at);
      });

    // Re-running the same Capability on the same Node for the *same* resource
    // (rotating a database's password, recreating the same account, and so
    // on) is a real, distinct Operation every time, not a duplicate: History
    // keeps every one. But only the most recent run of that one resource is
    // still the credential that actually applies, since a later run may have
    // reset the password.
    //
    // A different resource is not the same thing wearing a new timestamp,
    // though: two Services on the same Node both running manage-postgresql
    // create two different databases, each its own real credential, and
    // deduping on Node and Capability alone collapsed them into one, which
    // is what made stored credentials vanish rather than merely stop
    // repeating. The database or username a run created is what actually
    // names the resource; only Operations naming the same one collapse.
    //
    // A bare install with no resource and no secret is different again: it
    // is not a distinct resource each time, it is the same engine reported
    // again, so it collapses on Node and engine family alone, to the most
    // recent run -- and is dropped entirely once a richer entry (a real
    // secret or a named resource) exists for that same engine on that same
    // Node, so a database that was actually configured is not shadowed by
    // its own, less informative, bare install record.
    const richFamilies = new Set<string>();
    for (const context of sorted) {
      const parameters = context.operation.parameters ?? {};
      const resource = parameters.database ?? parameters.username;
      const family = engineFamilyOf(context.operation.capability_key);
      if (resource || hasStoredSecret(context.operation)) {
        if (family) {
          richFamilies.add(`${context.operation.node_id}:${family}`);
        }
      }
    }

    const seen = new Set<string>();
    return sorted.filter((context) => {
      const parameters = context.operation.parameters ?? {};
      const resource = parameters.database ?? parameters.username;
      const family = engineFamilyOf(context.operation.capability_key);
      const isBare = !resource && !hasStoredSecret(context.operation);

      if (isBare && family && richFamilies.has(`${context.operation.node_id}:${family}`)) {
        return false;
      }

      const key = isBare
        ? `${context.operation.node_id}:${family ?? context.operation.capability_key}:__bare__`
        : `${context.operation.node_id}:${context.operation.capability_key}:${resource ?? context.operation.id}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [data]);

  // Filtered by Project only, independent of the search box: this is what
  // decides whether the Project filter has anything at all to show, so
  // switching to an empty search never has to fight with switching to an
  // empty Project for which empty state wins.
  const byProject = useMemo(() => {
    if (projectFilter === 'all') {
      return contexts;
    }
    if (projectFilter === 'none') {
      return contexts.filter((context) => context.projectName === null);
    }
    return contexts.filter((context) => context.projectName === projectFilter);
  }, [contexts, projectFilter]);

  const visible = useMemo(
    () =>
      byProject.filter((context) =>
        matchesQuery([context.title, context.nodeName, context.projectName], query),
      ),
    [byProject, query],
  );

  // Every Node has its own SSH connection credential regardless of what, if
  // anything, Operations have created on it, so this is built straight from
  // the Nodes list rather than filtered out of it the way capability
  // credentials are: there is no "hasStoredSecret" question to ask here.
  const nodeContexts = useMemo(() => {
    const projectById = new Map(data.projects.map((project) => [project.id, project] as const));
    return data.nodes
      .map((node) => ({
        node,
        projectName: node.project_id ? (projectById.get(node.project_id)?.name ?? null) : null,
      }))
      .sort((a, b) => a.node.name.localeCompare(b.node.name));
  }, [data]);

  const nodesByProject = useMemo(() => {
    if (projectFilter === 'all') {
      return nodeContexts;
    }
    if (projectFilter === 'none') {
      return nodeContexts.filter((entry) => entry.projectName === null);
    }
    return nodeContexts.filter((entry) => entry.projectName === projectFilter);
  }, [nodeContexts, projectFilter]);

  const visibleNodes = useMemo(
    () =>
      nodesByProject.filter((entry) =>
        matchesQuery([entry.node.name, entry.node.address, entry.projectName], query),
      ),
    [nodesByProject, query],
  );

  const usedProjectNames = useMemo(() => {
    const names = new Set<string>();
    for (const context of contexts) {
      if (context.projectName) {
        names.add(context.projectName);
      }
    }
    for (const entry of nodeContexts) {
      if (entry.projectName) {
        names.add(entry.projectName);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [contexts, nodeContexts]);

  const hasUnassigned =
    contexts.some((context) => context.projectName === null) ||
    nodeContexts.some((entry) => entry.projectName === null);

  async function downloadOne(context: CredentialContext) {
    setDownloadError(null);
    setDownloading(context.operation.id);
    try {
      const text = await buildCredentialBlock(context);
      downloadText(
        `slideops-${envKey(context.operation.capability_key).toLowerCase()}-${shortId(
          context.operation.id,
        )}.env`,
        text,
      );
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error : new Error('This credential could not be prepared.'),
      );
    } finally {
      setDownloading(null);
    }
  }

  async function downloadAll() {
    setDownloadError(null);
    setDownloading('all');
    try {
      const blocks: string[] = [];
      for (const context of visible) {
        blocks.push(await buildCredentialBlock(context));
      }
      downloadText(ALL_FILE_NAME, blocks.join('\n\n'));
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error : new Error('These credentials could not be prepared.'),
      );
    } finally {
      setDownloading(null);
    }
  }

  const selectedNode =
    selected?.kind === 'node' ? (visibleNodes.find((entry) => entry.node.id === selected.id) ?? null) : null;
  const selectedCapability =
    selected?.kind === 'capability'
      ? (visible.find((context) => context.operation.id === selected.id) ?? null)
      : null;
  const hasSelection = Boolean(selectedNode || selectedCapability);

  return (
    <OperatorShell active="credentials">
      <PageHeader
        title="Credentials"
        description="Every credential across your workspace: the SSH connection SlideOps itself uses to reach each of your Nodes, and every credential a Capability created for you, such as a database password or a service secret, wherever it was configured. Ready to reveal, copy, and download for another tool."
        actions={
          visible.length > 0 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={downloadAll}
              disabled={downloading !== null}
              aria-busy={downloading === 'all' || undefined}
            >
              {downloading === 'all' ? 'Preparing all' : 'Download all'}
            </Button>
          ) : undefined
        }
      />

      {state.status === 'loading' ? <Loading label="Loading your credentials" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {state.status === 'ready' ? (
        contexts.length === 0 && nodeContexts.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No stored credentials yet"
            description="Connect a Node, or have a Capability create a credential for you, such as a database password, and it appears here so you can reveal it, copy it, and download it to use in another tool."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {downloadError ? (
              <div
                role="alert"
                className="rounded-md border border-border bg-subtle px-4 py-3 text-sm text-danger"
              >
                {downloadError.message}
              </div>
            ) : null}

            {usedProjectNames.length > 0 || hasUnassigned ? (
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <span>Project</span>
                <select
                  className={selectClass}
                  value={projectFilter}
                  onChange={(event) => {
                    setProjectFilter(event.target.value);
                    setSelected(null);
                  }}
                  aria-label="Filter credentials by Project"
                >
                  <option value="all">All Projects</option>
                  {usedProjectNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  {hasUnassigned ? <option value="none">No Project</option> : null}
                </select>
              </label>
            ) : null}

            {byProject.length === 0 && nodesByProject.length === 0 ? (
              <EmptyState
                icon={KeyRound}
                title="No credentials in this Project"
                description="No stored credentials match this filter. Choose All Projects to see every credential in your workspace."
              />
            ) : (
              <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface lg:h-[70vh] lg:flex-row">
                <div
                  className={cn(
                    'flex-col border-border lg:flex lg:w-80 lg:shrink-0 lg:border-r lg:overflow-y-auto',
                    hasSelection ? 'hidden lg:flex' : 'flex',
                  )}
                >
                  <div className="border-b border-border p-3">
                    <div className="relative">
                      <Search
                        width={15}
                        height={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                        aria-hidden
                      />
                      <label htmlFor="credentials-search" className="sr-only">
                        Search credentials
                      </label>
                      <input
                        id="credentials-search"
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search credentials"
                        className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      />
                    </div>
                  </div>

                  {visible.length === 0 && visibleNodes.length === 0 ? (
                    <div className="flex-1 px-4 py-8 text-center">
                      <Text variant="body-sm" tone="secondary">
                        Nothing matches &ldquo;{query}&rdquo;.
                      </Text>
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col gap-4 p-3">
                      {visibleNodes.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          <Text
                            variant="caption"
                            tone="secondary"
                            className="px-3 pb-1 font-medium uppercase tracking-wide"
                          >
                            Servers
                          </Text>
                          {visibleNodes.map((entry) => (
                            <ListRow
                              key={entry.node.id}
                              icon={Server}
                              title={entry.node.name}
                              subtitle={[entry.node.address, entry.projectName]
                                .filter(Boolean)
                                .join(' · ')}
                              selected={selected?.kind === 'node' && selected.id === entry.node.id}
                              onClick={() => setSelected({ kind: 'node', id: entry.node.id })}
                            />
                          ))}
                        </div>
                      ) : null}

                      {visible.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          <Text
                            variant="caption"
                            tone="secondary"
                            className="px-3 pb-1 font-medium uppercase tracking-wide"
                          >
                            Databases
                          </Text>
                          {visible.map((context) => (
                            <ListRow
                              key={context.operation.id}
                              icon={capabilityRowIcon(context.operation.capability_key)}
                              title={context.title}
                              subtitle={[context.nodeName, context.projectName]
                                .filter(Boolean)
                                .join(' · ')}
                              selected={
                                selected?.kind === 'capability' && selected.id === context.operation.id
                              }
                              onClick={() =>
                                setSelected({ kind: 'capability', id: context.operation.id })
                              }
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <div
                  className={cn(
                    'flex-1 p-6 lg:overflow-y-auto',
                    hasSelection ? 'flex flex-col' : 'hidden lg:flex',
                  )}
                >
                  {selectedNode ? (
                    <NodeDetailPanel
                      node={selectedNode.node}
                      projectName={selectedNode.projectName}
                      onBack={() => setSelected(null)}
                    />
                  ) : selectedCapability ? (
                    <CapabilityDetailPanel
                      context={selectedCapability}
                      services={data.services}
                      onBack={() => setSelected(null)}
                      onDownload={() => void downloadOne(selectedCapability)}
                      downloading={downloading === selectedCapability.operation.id}
                    />
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                      <KeyRound width={28} height={28} className="text-ink-muted" aria-hidden />
                      <Text variant="body-sm" tone="secondary">
                        Select a credential from the list to view it.
                      </Text>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      ) : null}
    </OperatorShell>
  );
}
