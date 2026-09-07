import {
  ApiError,
  inspectNodeRoutes,
  repairNodeRoutes,
  type RouteDrift,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { AlertTriangle, Check, Network, RefreshCw } from '@slideops/icons';
import { useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import { ErrorNote, Loading } from './Feedback';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * What this server is routing, against what SlideOps intends.
 *
 * The two lists mean opposite things and the screen has to say so, because the
 * obvious reading of "SlideOps did not set this up" is that it should be cleaned
 * away, and that is exactly wrong. A site the Operator put there themselves is
 * theirs; SlideOps reports it and leaves it, and Repair only ever puts back what
 * is missing.
 */

export function NodeRoutes({ nodeId }: { nodeId: string }) {
  const canWrite = useCanWrite();
  const drift = useAsyncData<RouteDrift>(() => inspectNodeRoutes(nodeId), [nodeId]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repair = async () => {
    setBusy(true);
    setError(null);
    try {
      await repairNodeRoutes(nodeId);
      drift.reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const data = drift.state.status === 'ready' ? drift.state.data : undefined;

  return (
    <Section
      title="Domain routing"
      adornment={<Network width={16} height={16} className="text-brand" aria-hidden />}
      description="What this server is actually serving, checked against the domains SlideOps put on it."
      collapsible
      summary={data?.summary}
    >
      {drift.state.status === 'loading' ? <Loading /> : null}
      {/* A server that cannot be read is not a server with no routes, and the
          error says which it was rather than showing an empty, healthy-looking
          panel. */}
      {drift.state.status === 'error' ? <ErrorNote error={drift.state.error} /> : null}

      {data ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {data.healthy ? (
              <Check width={16} height={16} className="shrink-0 text-success" aria-hidden />
            ) : (
              <AlertTriangle width={16} height={16} className="shrink-0 text-warning" aria-hidden />
            )}
            <Text variant="body-sm" tone="secondary" className="min-w-0 flex-1">
              {data.summary}
            </Text>
            {canWrite && data.missing.length > 0 ? (
              <Button size="sm" disabled={busy} onClick={repair}>
                <RefreshCw width={15} height={15} aria-hidden />
                {busy ? 'Putting them back' : 'Put them back'}
              </Button>
            ) : null}
          </div>

          {data.missing.length > 0 ? (
            <div className="rounded-md border border-warning bg-subtle px-4 py-3">
              <Text variant="body-sm" className="font-medium">
                Missing a route on this server
              </Text>
              <Text variant="caption" tone="secondary" className="mt-1 block">
                SlideOps put these here and they are gone. Something removed them: a rebuilt server,
                a restored snapshot, or an edit by hand. They can be put back.
              </Text>
              <ul className="mt-2 flex flex-col gap-1">
                {data.missing.map((hostname: string) => (
                  <li key={hostname} className="font-mono text-sm text-ink">
                    {hostname}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.unmanaged.length > 0 ? (
            <div className="rounded-md border border-border px-4 py-3">
              <Text variant="body-sm" className="font-medium">
                Also served here
              </Text>
              {/* Said plainly, because the obvious reading of "SlideOps did not
                  set this up" is that it is a problem to clear away. */}
              <Text variant="caption" tone="secondary" className="mt-1 block">
                Sites on this server that SlideOps did not set up. This is not a problem and nothing
                will touch them: they are left exactly as they are.
              </Text>
              <ul className="mt-2 flex flex-col gap-1">
                {data.unmanaged.map((hostname: string) => (
                  <li key={hostname} className="font-mono text-sm text-ink-muted">
                    {hostname}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Section>
  );
}
