import {
  ApiError,
  connectDockerNetwork,
  createDockerNetwork,
  disconnectDockerNetwork,
  dockerInUseContainers,
  isDockerResourceInUse,
  listDockerNetworks,
  removeDockerNetwork,
  type DockerNetwork,
} from '@slideops/api-client';
import { Button, Field, Text } from '@slideops/design-system';
import { Network as NetworkIcon, Plus, ScanSearch, Trash2, X } from '@slideops/icons';
import { DataGrid, Drawer, EmptyState, SearchBar, Toolbar, type DataGridColumn, type DataGridRow } from '@slideops/ui';
import { useCallback, useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import { containersText, isProtectedNetworkName } from '../docker-resources-view';
import { useAsyncData } from '../hooks/useAsyncData';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorNote, Loading } from './Feedback';

/*
 * The Docker networks on one Node: what exists, what is attached to each, and
 * the four things an Operator does with them.
 *
 * Two decisions shape this panel.
 *
 * `bridge`, `host` and `none` are Docker's own, and every container on the Node
 * depends on at least one of them. They are shown as built in, with no Remove
 * control at all, rather than with a control that fails when pressed. A refusal
 * after the click teaches an Operator that the buttons on this page are
 * guesses; saying so before the click teaches them something true about their
 * server. The backend refuses these too, and that refusal is the safety net
 * rather than the design.
 *
 * Connecting and disconnecting live in the network's own panel rather than as
 * row buttons, because both need a container named and neither is a thing you
 * do to a row in passing. Disconnecting in particular is reversible and still
 * disruptive: a container cut off from the network its database is on stays up
 * and stops working, which reads from the outside as the application breaking
 * for no reason. So it is confirmed like anything else that changes what a
 * running workload can reach.
 */

const badge = 'inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium';

function asApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError(0, 'unknown_error', 'That did not work. Try again.');
}

/** What the Node said when it declined. An in_use refusal names what is attached. */
function RefusalNote({ error, subject }: { error: ApiError; subject: string }) {
  const holders = dockerInUseContainers(error);
  return (
    <div role="alert" className="rounded-md border border-border bg-subtle px-4 py-3">
      <Text variant="body-sm" className="font-medium">
        {isDockerResourceInUse(error)
          ? `${subject} still has containers attached, so nothing was removed`
          : `${subject} was not changed`}
      </Text>
      <Text variant="body-sm" tone="secondary" className="mt-0.5">
        {error.message}
      </Text>
      {holders.length > 0 ? (
        <Text variant="body-sm" tone="secondary" className="mt-1">
          Attached: {containersText(holders)}. Disconnect or remove those containers first.
        </Text>
      ) : null}
    </div>
  );
}

/** Create a network. Nothing joins it until something is connected to it. */
function CreateNetworkForm({
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
  const [subnet, setSubnet] = useState('');
  const [gateway, setGateway] = useState('');
  const [internal, setInternal] = useState(false);
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
      // Empty fields are absent fields. A client that filled these in itself
      // would be choosing this server's addressing on the Operator's behalf.
      await createDockerNetwork(nodeId, {
        name: trimmed,
        driver: driver.trim() || undefined,
        subnet: subnet.trim() || undefined,
        gateway: gateway.trim() || undefined,
        internal: internal || undefined,
      });
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
        label="Network name"
        placeholder="backend"
        hint="What containers will join by name."
        value={name}
        disabled={working}
        onChange={(event) => setName(event.target.value)}
      />
      <Field
        label="Driver (optional)"
        placeholder="bridge"
        hint="Leave this empty for Docker's default, which is bridge on a single server."
        value={driver}
        disabled={working}
        onChange={(event) => setDriver(event.target.value)}
      />
      <Field
        label="Subnet (optional)"
        placeholder="10.10.0.0/24"
        hint="Leave this empty and Docker picks a range that does not collide with the ones already on this server."
        value={subnet}
        disabled={working}
        onChange={(event) => setSubnet(event.target.value)}
      />
      <Field
        label="Gateway (optional)"
        placeholder="10.10.0.1"
        hint="Only meaningful alongside a subnet you chose yourself."
        value={gateway}
        disabled={working}
        onChange={(event) => setGateway(event.target.value)}
      />
      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={internal}
          disabled={working}
          onChange={(event) => setInternal(event.target.checked)}
          className="mt-1"
        />
        <span>
          Internal: containers on this network can reach each other and nothing outside the server.
          This is what you want for a database that should never be reachable from the internet.
        </span>
      </label>
      {error ? <ErrorNote error={error} /> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={working}>
          Cancel
        </Button>
        <Button type="submit" disabled={working || trimmed === ''}>
          {working ? 'Creating' : 'Create this network'}
        </Button>
      </div>
    </form>
  );
}

/**
 * One network in full: what it is, what is on it, and how to change that.
 *
 * The attachments and the daemon's own record sit in the same panel because
 * they answer one question between them. "What is on this network" is the thing
 * an Operator came here to find out, and it is also the thing that decides
 * whether the network can be removed.
 */
function NetworkDrawer({
  nodeId,
  network,
  canWrite,
  onClose,
  onChanged,
}: {
  nodeId: string;
  network: DockerNetwork;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [container, setContainer] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const trimmed = container.trim();

  const connect = async () => {
    if (!trimmed || working) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await connectDockerNetwork(nodeId, network.id, trimmed);
      setContainer('');
      onChanged();
      onClose();
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setWorking(false);
    }
  };

  const disconnect = async () => {
    const name = disconnecting;
    if (!name) {
      return;
    }
    setDisconnecting(null);
    setError(null);
    try {
      await disconnectDockerNetwork(nodeId, network.id, name);
      onChanged();
      onClose();
    } catch (caught) {
      setError(asApiError(caught));
    }
  };

  const facts: { label: string; value: string }[] = [
    { label: 'Driver', value: network.driver },
    { label: 'Scope', value: network.scope },
    { label: 'Subnet', value: network.subnet || 'Unknown' },
    { label: 'Gateway', value: network.gateway || 'Unknown' },
    { label: 'Reaches outside this server', value: network.internal ? 'No' : 'Yes' },
    { label: 'Id', value: network.id },
  ];

  return (
    <>
      <Drawer open onClose={onClose} title={network.name}>
      <div className="flex flex-col gap-5">
        <dl className="flex flex-col gap-2">
          {facts.map((fact) => (
            <div key={fact.label} className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-xs text-ink-muted">{fact.label}</dt>
              <dd className="break-all text-right font-mono text-sm text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>

        {Object.keys(network.labels).length > 0 ? (
          <div>
            <Text variant="h4">Labels</Text>
            <dl className="mt-2 flex flex-col gap-2">
              {Object.entries(network.labels).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-xs text-ink-muted">{key}</dt>
                  <dd className="break-all text-right font-mono text-sm text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div>
          <Text variant="h4">Attached containers</Text>
          {network.containers.length === 0 ? (
            <Text variant="body-sm" tone="secondary" className="mt-2">
              Nothing is attached to this network.
            </Text>
          ) : (
            <ul className="mt-2 flex flex-col">
              {network.containers.map((name) => (
                <li
                  key={name}
                  className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0"
                >
                  <span className="truncate text-sm text-ink">{name}</span>
                  {canWrite ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Disconnect ${name} from ${network.name}`}
                      onClick={() => setDisconnecting(name)}
                    >
                      <X width={14} height={14} aria-hidden />
                      Disconnect
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {canWrite ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void connect();
            }}
          >
            <Text variant="h4">Connect a container</Text>
            <Field
              label="Container"
              placeholder="web"
              hint="Its name or its id. The container keeps every network it is already on."
              value={container}
              disabled={working}
              onChange={(event) => setContainer(event.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={working || trimmed === ''}>
                {working ? 'Connecting' : 'Connect to this network'}
              </Button>
            </div>
          </form>
        ) : null}

        {error ? <ErrorNote error={error} /> : null}
      </div>
      </Drawer>

      <ConfirmDialog
        open={disconnecting !== null}
        title={`Disconnect ${disconnecting ?? 'this container'}?`}
        confirmLabel="Disconnect it"
        confirmVariant="danger"
        onCancel={() => setDisconnecting(null)}
        onConfirm={disconnect}
        description={
          <span>
            {disconnecting} keeps running and stops being able to reach anything else on{' '}
            {network.name}. If its database or its API is on this network, the application will
            start failing without the container stopping, which looks from the outside like it broke
            on its own. Connecting it again puts it back.
          </span>
        }
      />
    </>
  );
}

const COLUMNS: DataGridColumn[] = [
  { key: 'name', header: 'Network', sortable: true },
  { key: 'driver', header: 'Driver' },
  { key: 'scope', header: 'Scope' },
  { key: 'subnet', header: 'Subnet' },
  { key: 'gateway', header: 'Gateway' },
  { key: 'attached', header: 'Attached' },
  { key: 'reach', header: 'Reach' },
  { key: 'actions', header: 'Actions' },
];

/** The Docker networks on one Node. */
export function DockerNetworksPanel({ nodeId }: { nodeId: string }) {
  const canWrite = useCanWrite();
  const networks = useAsyncData((signal) => listDockerNetworks(nodeId, signal), [nodeId]);

  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [opened, setOpened] = useState<DockerNetwork | null>(null);
  const [removing, setRemoving] = useState<DockerNetwork | null>(null);
  const [refusal, setRefusal] = useState<{ subject: string; error: ApiError } | null>(null);

  const reload = networks.reload;

  // Stable across renders, so ConfirmDialog does not re-run its focus effect
  // and pull focus back out of the dialog on every keystroke elsewhere.
  const closeRemoval = useCallback(() => setRemoving(null), []);

  if (networks.state.status === 'loading') {
    return <Loading label="Reading the networks on this server" />;
  }
  if (networks.state.status === 'error') {
    return <ErrorNote error={networks.state.error} />;
  }

  const all = networks.state.data;
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? all.filter((network) =>
        [network.name, network.driver, network.scope, network.subnet ?? '', network.gateway ?? '', ...network.containers]
          .join('\n')
          .toLowerCase()
          .includes(needle),
      )
    : all;

  const remove = async () => {
    const network = removing;
    if (!network) {
      return;
    }
    setRemoving(null);
    setRefusal(null);
    try {
      await removeDockerNetwork(nodeId, network.id);
      reload();
    } catch (caught) {
      setRefusal({ subject: network.name, error: asApiError(caught) });
    }
  };

  const rows: DataGridRow[] = shown.map((network) => {
    const builtIn = isProtectedNetworkName(network.name);
    return {
      id: network.id,
      sortValues: { name: network.name.toLowerCase() },
      cells: {
        name: (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-ink">{network.name}</span>
            {builtIn ? <span className={`${badge} bg-subtle text-ink-muted`}>Built in</span> : null}
          </span>
        ),
        driver: <span className="text-ink-muted">{network.driver}</span>,
        scope: <span className="text-ink-muted">{network.scope}</span>,
        // An absent subnet is one Docker did not report, not a network with no
        // addressing. It reads as unknown rather than as blank.
        subnet: <span className="font-mono text-xs text-ink-muted">{network.subnet || 'Unknown'}</span>,
        gateway: <span className="font-mono text-xs text-ink-muted">{network.gateway || 'Unknown'}</span>,
        attached: (
          <span className="text-ink-muted" title={containersText(network.containers)}>
            {network.containers.length === 0 ? 'Nothing' : containersText(network.containers)}
          </span>
        ),
        reach: network.internal ? (
          <span className={`${badge} bg-subtle text-info`}>Internal</span>
        ) : (
          <span className="text-xs text-ink-muted">Reaches out</span>
        ),
        actions: (
          <span className="flex flex-wrap items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Inspect ${network.name}`}
              onClick={() => setOpened(network)}
            >
              <ScanSearch width={14} height={14} aria-hidden />
              Inspect
            </Button>
            {/* No Remove control at all for Docker's own three, rather than one
                that is refused on the click. */}
            {builtIn ? (
              <span className="text-xs text-ink-muted" title="Docker creates this network and every container depends on it.">
                Docker&rsquo;s own, cannot be removed
              </span>
            ) : canWrite ? (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove ${network.name}`}
                onClick={() => {
                  setRefusal(null);
                  setRemoving(network);
                }}
              >
                <Trash2 width={14} height={14} aria-hidden />
                Remove
              </Button>
            ) : null}
          </span>
        ),
      },
    };
  });

  return (
    <div className="flex flex-col gap-4">
      {all.length === 0 && !creating ? (
        <EmptyState
          icon={NetworkIcon}
          title="This server has no Docker networks"
          description="Docker normally keeps three of its own here. Reading none at all usually means the daemon has only just started."
          action={
            canWrite ? <Button onClick={() => setCreating(true)}>Create a network</Button> : undefined
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
                  Create a network
                </Button>
              ) : null}
            </>
          }
        >
          <SearchBar
            value={query}
            onChange={setQuery}
            label="Search networks"
            placeholder="Name, driver, subnet, container..."
            className="sm:max-w-xs"
          />
        </Toolbar>
      )}

      {refusal ? <RefusalNote error={refusal.error} subject={refusal.subject} /> : null}

      {creating && canWrite ? (
        <CreateNetworkForm nodeId={nodeId} onCreated={reload} onClose={() => setCreating(false)} />
      ) : null}

      {all.length > 0 ? (
        <DataGrid
          columns={COLUMNS}
          rows={rows}
          loading={networks.refreshing}
          emptyMessage="No network on this server matches what you are looking for."
        />
      ) : null}

      {opened ? (
        <NetworkDrawer
          nodeId={nodeId}
          network={opened}
          canWrite={canWrite}
          onClose={() => setOpened(null)}
          onChanged={reload}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null && canWrite}
        title={removing ? `Remove the network ${removing.name}?` : 'Remove this network?'}
        confirmLabel="Remove this network"
        confirmVariant="danger"
        onCancel={closeRemoval}
        onConfirm={remove}
        description={
          removing ? (
            <span className="flex flex-col gap-2">
              <span>
                This removes the network {removing.name} from this server. No container is stopped
                and no data is touched, but anything that expects to reach another container over
                this network will stop being able to.
              </span>
              {removing.containers.length > 0 ? (
                <span className="text-warning">
                  {containersText(removing.containers)} {removing.containers.length === 1 ? 'is' : 'are'}{' '}
                  still attached. Docker refuses to remove a network with containers on it, so this
                  will most likely be declined.
                </span>
              ) : null}
            </span>
          ) : null
        }
      />
    </div>
  );
}
