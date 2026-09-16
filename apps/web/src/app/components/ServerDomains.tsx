import {
  ApiError,
  addServerDomain,
  listServerDomains,
  removeServerDomain,
  type Domain,
  type Node,
  type ServerDomain,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { useState, type FormEvent } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorNote, Loading } from './Feedback';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * A Server Domain is a namespace, not a route.
 *
 * Adding mycompany.com here makes it available for this server's Services to
 * claim subdomains under -- frc.mycompany.com, api.mycompany.com -- from their
 * own "Add a domain" flow, one row up. It is not assigned to any Service by
 * itself: adding one creates no hostname, writes no route, and requests no
 * certificate. Every free-form hostname and every *.nip.io default this server
 * already answers on keeps working exactly as before, whether or not a Server
 * Domain is ever added.
 */

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export function ServerDomains({
  node,
  domains,
  canAdminister,
}: {
  node: Node;
  /** This Workspace's domains, to say how many hostnames use each namespace. */
  domains: Domain[];
  canAdminister: boolean;
}) {
  const serverDomains = useAsyncData<ServerDomain[]>(() => listServerDomains(node.id), [node.id]);
  const [domainInput, setDomainInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ServerDomain | null>(null);

  const list = serverDomains.state.status === 'ready' ? serverDomains.state.data : [];

  const usageCount = (serverDomainId: string) =>
    domains.filter((candidate) => candidate.server_domain_id === serverDomainId).length;

  const add = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addServerDomain(node.id, domainInput.trim());
      setDomainInput('');
      serverDomains.reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (target: ServerDomain) => {
    setBusy(true);
    setError(null);
    try {
      await removeServerDomain(target.id);
      serverDomains.reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <Text variant="body-sm" className="font-medium">
          {node.name}
        </Text>
        <Text variant="caption" tone="secondary">
          {list.length === 0
            ? 'No Server Domains yet'
            : `${list.length} ${list.length === 1 ? 'Server Domain' : 'Server Domains'}`}
        </Text>
      </div>

      {serverDomains.state.status === 'loading' ? <Loading /> : null}
      {serverDomains.state.status === 'error' ? (
        <ErrorNote error={serverDomains.state.error} />
      ) : null}

      {list.length > 0 ? (
        <div className="flex flex-col gap-2">
          {list.map((serverDomain) => {
            const count = usageCount(serverDomain.id);
            return (
              <div
                key={serverDomain.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <Text variant="body-sm" className="font-mono">
                    {serverDomain.domain}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {count === 0
                      ? 'No hostname claimed under it yet.'
                      : `${count} ${count === 1 ? 'hostname claims' : 'hostnames claim'} this namespace.`}
                  </Text>
                </div>
                {canAdminister ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setRemoving(serverDomain)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {canAdminister ? (
        <form className="flex flex-wrap items-end gap-2 border-t border-border pt-3" onSubmit={add}>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label
              htmlFor={`server-domain-${node.id}`}
              className="text-xs uppercase tracking-wide text-ink-muted"
            >
              Add a domain as a namespace
            </label>
            <input
              id={`server-domain-${node.id}`}
              className={`${inputClass} font-mono`}
              placeholder="mycompany.com"
              value={domainInput}
              onChange={(event) => setDomainInput(event.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={busy || domainInput.trim() === ''}>
            {busy ? 'Adding' : 'Add'}
          </Button>
        </form>
      ) : (
        <Text variant="caption" tone="secondary">
          Adding one requires the Owner or an Admin.
        </Text>
      )}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title={removing ? `Remove ${removing.domain} as a namespace?` : ''}
        description="Every hostname already tagged under it keeps its route, its DNS record, and its certificate exactly as they are. This only removes the namespace itself, so it can no longer be chosen for a new one."
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) {
            void remove(target);
          }
        }}
      />
    </div>
  );
}
