import {
  ApiError,
  chooseWorkspaceIngress,
  connectDNS,
  disableWorkspaceIngress,
  disconnectDNS,
  getWorkspaceIngress,
  listDNSConnections,
  listNodes,
  type DNSConnection,
  type Node,
  type WorkspaceIngressView,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { AlertTriangle, Check, Globe, KeyRound } from '@slideops/icons';
import { useState, type FormEvent } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorNote, Loading } from './Feedback';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * How a Workspace's domains reach it.
 *
 * Two settings that look unrelated and are not. Connecting DNS decides whether
 * SlideOps writes the record or an Operator does; the ingress decides what the
 * record points at. Somebody setting up a domain for the first time meets both,
 * and putting them on separate pages would make that one journey into two.
 *
 * Both are dangerous in ways worth being plain about rather than tidy. A zone
 * credential can rewrite where a company's mail goes, so the page says what
 * SlideOps will and will not touch with it. An ingress makes one server the path
 * for all public traffic, so the page says that too instead of presenting it as a
 * free improvement.
 */

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export function DomainRouting({ canAdminister }: { canAdminister: boolean }) {
  const connections = useAsyncData<DNSConnection[]>(() => listDNSConnections(), []);
  const ingress = useAsyncData<WorkspaceIngressView>(() => getWorkspaceIngress(), []);
  const nodes = useAsyncData<Node[]>(() => listNodes(), []);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zone, setZone] = useState('');
  const [token, setToken] = useState('');
  const [ingressNode, setIngressNode] = useState('');
  const [ingressHostname, setIngressHostname] = useState('');
  const [disconnecting, setDisconnecting] = useState<DNSConnection | null>(null);

  const run = async (action: () => Promise<unknown>, reload: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      await connectDNS({ kind: 'cloudflare', zone: zone.trim(), token: token.trim() });
      setZone('');
      setToken('');
    }, connections.reload);
  };

  const list = connections.state.status === 'ready' ? connections.state.data : [];
  const current = ingress.state.status === 'ready' ? ingress.state.data : undefined;
  const allNodes = nodes.state.status === 'ready' ? nodes.state.data : [];

  return (
    <>
      <Section
        title="DNS"
        adornment={<KeyRound width={16} height={16} className="text-brand" aria-hidden />}
        description="Connect the service that holds your DNS and SlideOps creates the records your domains need, instead of asking you to."
      >
        {connections.state.status === 'loading' ? <Loading /> : null}
        {connections.state.status === 'error' ? (
          <ErrorNote error={connections.state.error} />
        ) : null}

        <div className="flex flex-col gap-2">
          {list.map((connection) => (
            <div
              key={connection.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border px-4 py-3"
            >
              {connection.usable ? (
                <Check width={16} height={16} className="shrink-0 text-success" aria-hidden />
              ) : (
                <AlertTriangle
                  width={16}
                  height={16}
                  className="shrink-0 text-danger"
                  aria-hidden
                />
              )}
              <div className="min-w-0 flex-1">
                <Text variant="body-sm" className="font-medium font-mono">
                  {connection.zone}
                </Text>
                <Text variant="caption" tone="secondary">
                  {connection.usable
                    ? 'SlideOps can create records for this domain.'
                    : (connection.last_error ?? 'This credential is no longer working.')}
                </Text>
              </div>
              {canAdminister ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setDisconnecting(connection)}
                >
                  Disconnect
                </Button>
              ) : null}
            </div>
          ))}
          {list.length === 0 && connections.state.status === 'ready' ? (
            <Text variant="body-sm" tone="secondary">
              No DNS connected. You can still add domains: SlideOps will show you the exact record
              to create yourself.
            </Text>
          ) : null}
        </div>

        {canAdminister ? (
          <form className="mt-4 flex flex-col gap-3 border-t border-border pt-4" onSubmit={connect}>
            <div className="flex flex-col gap-2">
              <label htmlFor="dns-zone" className="text-sm font-medium text-ink">
                Domain this credential may manage
              </label>
              <input
                id="dns-zone"
                className={`${inputClass} font-mono`}
                placeholder="example.com"
                value={zone}
                onChange={(event) => setZone(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="dns-token" className="text-sm font-medium text-ink">
                Cloudflare API token
              </label>
              <input
                id="dns-token"
                type="password"
                className={`${inputClass} font-mono`}
                placeholder="Paste the token"
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
              {/* Being plain about the blast radius is the point. A zone holds
                  mail routing and ownership proofs, and an Operator handing over
                  a token deserves to know what will and will not be touched. */}
              <Text variant="caption" tone="secondary">
                Give it permission to edit DNS for this domain only. SlideOps only ever changes or
                removes records it created itself: anything already in your zone, including mail and
                verification records, is left alone. The token is stored encrypted and is never
                shown again.
              </Text>
            </div>
            <div>
              <Button type="submit" disabled={busy || zone.trim() === '' || token.trim() === ''}>
                {busy ? 'Checking' : 'Connect'}
              </Button>
            </div>
          </form>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </Section>

      <Section
        title="What answers for your domains"
        adornment={<Globe width={16} height={16} className="text-brand" aria-hidden />}
        description={
          current?.enabled
            ? 'One server answers for every domain in this Workspace and forwards to whichever server runs each Service.'
            : 'Each domain is answered by the server running its Service. That works and needs nothing set up, but moving a Service to another server means changing its DNS record.'
        }
      >
        {ingress.state.status === 'loading' ? <Loading /> : null}

        {current?.enabled ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <Text variant="body-sm" className="font-mono">
                  {current.public_hostname || current.public_address}
                </Text>
                <Text variant="caption" tone="secondary">
                  Every domain in this Workspace points here.
                </Text>
              </div>
              {canAdminister ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => run(disableWorkspaceIngress, ingress.reload)}
                >
                  Stop using it
                </Button>
              ) : null}
            </div>

            {/* The one thing that breaks every hostname in a Workspace at once,
                and it is completely invisible without being told: the records are
                all still correct for an address the server no longer has. */}
            {current.drifted ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-warning bg-subtle px-4 py-3">
                <AlertTriangle
                  width={16}
                  height={16}
                  className="shrink-0 text-warning"
                  aria-hidden
                />
                <Text variant="body-sm" tone="secondary" className="min-w-0 flex-1">
                  This server&apos;s address has changed to {current.current_address}. Every domain
                  in this Workspace still points at {current.public_address}, so they will stop
                  working until the records are updated.
                </Text>
              </div>
            ) : null}
          </div>
        ) : canAdminister ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () => chooseWorkspaceIngress(ingressNode, ingressHostname.trim() || undefined),
                ingress.reload,
              );
            }}
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="ingress-node" className="text-sm font-medium text-ink">
                Server to answer for this Workspace
              </label>
              <select
                id="ingress-node"
                className={inputClass}
                value={ingressNode}
                onChange={(event) => setIngressNode(event.target.value)}
              >
                <option value="">Choose a server</option>
                {allNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))}
              </select>
              <Text variant="caption" tone="secondary">
                All public traffic for this Workspace passes through it, so it needs to stay
                reachable. In return, moving a Service to another server never needs a DNS change.
              </Text>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="ingress-hostname" className="text-sm font-medium text-ink">
                Stable name for it (optional)
              </label>
              <input
                id="ingress-hostname"
                className={`${inputClass} font-mono`}
                placeholder="ingress.example.com"
                value={ingressHostname}
                onChange={(event) => setIngressHostname(event.target.value)}
              />
              {/* Without one, every record is an A record at this server's
                  address, and changing the server means changing all of them.
                  With one, they are CNAMEs and the address behind it can move
                  freely. */}
              <Text variant="caption" tone="secondary">
                If you point a name of your own at this server, your domains can point at that name
                instead of its address, and the address can then change without touching any of
                them.
              </Text>
            </div>
            <div>
              <Button type="submit" disabled={busy || ingressNode === ''}>
                {busy ? 'Setting up' : 'Use one entry point'}
              </Button>
            </div>
          </form>
        ) : (
          <Text variant="caption" tone="secondary">
            Changing this requires the Owner or an Admin.
          </Text>
        )}
      </Section>

      <ConfirmDialog
        open={disconnecting !== null}
        title={disconnecting ? `Disconnect DNS for ${disconnecting.zone}?` : ''}
        description="SlideOps will stop creating and updating records for this domain, and you will get the record to create yourself instead. Records it already created are left exactly where they are, so nothing currently working stops."
        confirmLabel="Disconnect"
        onCancel={() => setDisconnecting(null)}
        onConfirm={() => {
          const target = disconnecting;
          setDisconnecting(null);
          if (target) {
            void run(() => disconnectDNS(target.id), connections.reload);
          }
        }}
      />
    </>
  );
}
