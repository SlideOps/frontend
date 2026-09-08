import { ApiError, inspectNodeRoutes, repairNodeRoutes, type RouteDrift } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { AlertTriangle, Check } from '@slideops/icons';
import { useState } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import { ErrorNote, Loading } from './Feedback';
import { ExpectedFound } from './DomainStatus';

/*
 * What a server is actually routing, against what SlideOps intends.
 *
 * Drift is a question about a server, not about a hostname: the only call that
 * answers it is scoped to a Node, and there is no per domain equivalent. So this
 * asks it once per server that has domains on it, and says which hostnames the
 * answer is about, rather than pretending each domain carries its own drift.
 *
 * The two lists mean opposite things. A hostname SlideOps expects and does not
 * find has been removed by something and can be put back. A site the server
 * answers for that no domain claims is almost always the Operator's own work: it
 * is reported and left exactly where it is, and repair never touches it. The
 * summary from the API deliberately ignores those, which is worth saying out
 * loud rather than leaving somebody to infer.
 */

export function RoutingDrift({ nodeId, nodeName }: { nodeId: string; nodeName: string }) {
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
    <div className="rounded-md border border-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {data ? (
          data.healthy ? (
            <Check width={16} height={16} className="shrink-0 text-success" aria-hidden />
          ) : (
            <AlertTriangle width={16} height={16} className="shrink-0 text-warning" aria-hidden />
          )
        ) : null}
        <Text variant="body-sm" className="min-w-0 flex-1 font-medium">
          {nodeName}
        </Text>
      </div>

      {drift.state.status === 'loading' ? <Loading label={`Reading routing on ${nodeName}`} /> : null}
      {/* A server that could not be read is not a server with no drift, and
          saying which it was is the difference between a fix and a guess. */}
      {drift.state.status === 'error' ? (
        <div className="mt-2">
          <ErrorNote error={drift.state.error} />
        </div>
      ) : null}

      {data ? (
        <div className="mt-2 flex flex-col gap-3">
          <Text variant="body-sm" tone="secondary">
            {data.summary}
          </Text>

          {data.missing.length > 0 ? (
            <div className="rounded-md border border-warning bg-subtle px-3 py-2">
              <Text variant="body-sm" className="font-medium">
                Routes SlideOps expects and did not find
              </Text>
              <Text variant="caption" tone="secondary" className="mt-1 block">
                SlideOps put these on {nodeName} and they are gone. Something removed them: a
                rebuilt server, a restored snapshot, or an edit by hand.
              </Text>
              <div className="mt-2 flex flex-col gap-2">
                {data.missing.map((hostname) => (
                  <ExpectedFound
                    key={hostname}
                    expected={`a route for ${hostname}`}
                    found={`no route on ${nodeName}`}
                  />
                ))}
              </div>
              <div className="mt-3">
                <Text variant="caption" tone="secondary" className="block">
                  Putting them back writes only the routes listed here. Nothing else on this server
                  is changed or removed, and it does not run until you press this.
                </Text>
                <Button className="mt-2" size="sm" disabled={busy} onClick={repair}>
                  {busy ? 'Putting them back' : 'Put back the missing routes'}
                </Button>
              </div>
            </div>
          ) : null}

          {data.unmanaged.length > 0 ? (
            <div className="rounded-md border border-border px-3 py-2">
              <Text variant="body-sm" className="font-medium">
                Also served here
              </Text>
              <Text variant="caption" tone="secondary" className="mt-1 block">
                Sites on {nodeName} that no SlideOps domain claims. This is not a problem and
                nothing will touch them. They are left out of the summary above on purpose, so a
                server described as routed may still be serving these.
              </Text>
              <ul className="mt-2 flex flex-col gap-1">
                {data.unmanaged.map((hostname) => (
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
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
