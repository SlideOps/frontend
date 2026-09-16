import {
  ApiError,
  chooseWorkspaceIngress,
  disableWorkspaceIngress,
  getWorkspaceIngress,
  listNodes,
  type Node,
  type WorkspaceIngressView,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { AlertTriangle, Globe } from '@slideops/icons';
import { useState } from 'react';
import { ErrorNote, Loading } from './Feedback';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * What answers for a Workspace's domains: the Caddy/routing entry point.
 *
 * An ingress makes one server the path for all public traffic in a Workspace,
 * so a domain's DNS record can point at a stable name instead of moving every
 * time a Service does. That is a real cost as well as a convenience, so the
 * page says both rather than only selling the upside.
 */

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export function WorkspaceIngress({ canAdminister }: { canAdminister: boolean }) {
  const ingress = useAsyncData<WorkspaceIngressView>(() => getWorkspaceIngress(), []);
  const nodes = useAsyncData<Node[]>(() => listNodes(), []);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingressNode, setIngressNode] = useState('');
  const [ingressHostname, setIngressHostname] = useState('');

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

  const current = ingress.state.status === 'ready' ? ingress.state.data : undefined;
  const allNodes = nodes.state.status === 'ready' ? nodes.state.data : [];

  return (
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

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {ingress.state.status === 'error' ? <ErrorNote error={ingress.state.error} /> : null}
    </Section>
  );
}
