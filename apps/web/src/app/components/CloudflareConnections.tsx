import {
  ApiError,
  connectDNS,
  disconnectDNS,
  listDNSConnections,
  type DNSConnection,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { AlertTriangle, Check, KeyRound } from '@slideops/icons';
import { useState, type FormEvent } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorNote, Loading } from './Feedback';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * Cloudflare credential and zone connection management, and nothing else.
 *
 * Connecting one is what lets SlideOps create the records a domain needs, and
 * what a certificate proved through Cloudflare's DNS ultimately depends on --
 * but neither the records themselves nor the certificate strategy live here.
 * This is deliberately narrow: a zone credential can rewrite where a
 * company's mail goes, and keeping this page to only "is it connected, and
 * to which zone" is what makes that blast radius legible on its own, instead
 * of buried in a longer form about domains or certificates.
 */

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export function CloudflareConnections({ canAdminister }: { canAdminister: boolean }) {
  const connections = useAsyncData<DNSConnection[]>(() => listDNSConnections(), []);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zone, setZone] = useState('');
  const [token, setToken] = useState('');
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

  return (
    <>
      <Section
        title="Cloudflare"
        adornment={<KeyRound width={16} height={16} className="text-brand" aria-hidden />}
        description="Connect a Cloudflare API token scoped to a zone, and SlideOps creates the records your domains in that zone need, instead of asking you to. The same connection is what a domain's DNS-01 certificate and Server Domain both rely on."
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
        ) : (
          <Text variant="caption" tone="secondary" className="mt-4 block border-t border-border pt-4">
            Connecting or disconnecting Cloudflare requires the Owner or an Admin.
          </Text>
        )}

        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
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
