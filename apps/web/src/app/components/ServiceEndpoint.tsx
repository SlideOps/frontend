import { ApiError, exposeService, type Service } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowUpRight, Globe } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useState } from 'react';
import { RevealValue } from './RevealValue';
import { serviceEndpointState } from './service-endpoint';

/*
 * Where a Service answers from outside the server.
 *
 * The Preview embeds a running app over the SSH tunnel, which is the right answer
 * for something that renders a page and no answer at all for an API: an iframe of
 * a JSON endpoint tells an Operator nothing. What they need for a backend is the
 * address another program calls, so it is given here plainly and copyably, next to
 * the two things that actually stop a call from working: a secure page cannot call
 * an insecure address, and a cross origin call needs the application itself to
 * allow that origin. Saying so here is cheaper than an Operator debugging it later.
 *
 * The addresses come from the API, computed from the Node address on read, so this
 * component only ever presents them.
 */

/** A calm placeholder, matching the Preview's, for when there is no address yet. */
function EndpointNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-app p-4">
      <Text variant="body-sm" tone="secondary">
        {children}
      </Text>
    </div>
  );
}

export function ServiceEndpoint({
  service,
  onChanged,
}: {
  service: Service;
  onChanged?: () => void;
}) {
  const state = serviceEndpointState(service);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Offered when a Service has a port but no name of its own. That is either one
  // deployed before hostnames existed, or one whose routing did not take, and the
  // alternative for both used to be redeploying a working application to rename it.
  const canBeNamed = state.kind === 'addresses' && !service.domain;

  const giveAddress = async () => {
    setWorking(true);
    setError(null);
    try {
      await exposeService(service.id);
      onChanged?.();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'The address could not be set up. Try again.',
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Globe width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Reach it from anywhere</Text>
        <Guidance for="service.endpoint" />
      </div>

      {state.kind === 'addresses' ? (
        <div className="flex flex-col gap-3">
          <Text variant="body-sm" tone="secondary">
            The base URL to call this Service from outside the server. Give it to a frontend, a
            mobile app, or another Service.
          </Text>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <RevealValue value={state.primary} sensitive={false} label="address" />
            <a
              href={state.primary}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md text-sm text-ink-muted transition-colors duration-fast ease-standard hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Open
              <ArrowUpRight width={15} height={15} aria-hidden />
            </a>
          </div>

          {state.alternates.length > 0 ? (
            <div>
              <Text variant="caption" tone="secondary" className="block">
                Also reachable directly on the server, which is useful for a quick check but not the
                address to build against: it has no certificate, and it changes if the port does.
              </Text>
              <ul className="mt-2 flex flex-col gap-2">
                {state.alternates.map((url) => (
                  <li key={url} className="flex min-w-0 flex-wrap items-center gap-2">
                    <RevealValue value={url} sensitive={false} label="address" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!state.answering ? (
            <EndpointNote>
              This Service is {service.status}, so the address will not answer until it is running.
              The address itself does not change.
            </EndpointNote>
          ) : null}

          {canBeNamed ? (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-subtle p-3">
              <Text variant="body-sm" tone="secondary">
                This Service answers on a port but has no web address of its own. Giving it one
                routes it by name over HTTPS. Nothing is rebuilt and it keeps running throughout.
              </Text>
              <div>
                <Button variant="secondary" onClick={giveAddress} disabled={working}>
                  <Globe width={15} height={15} aria-hidden />
                  {working ? 'Setting up the address' : 'Give it a web address'}
                </Button>
              </div>
              {error ? (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            {state.primary.startsWith('https://') ? (
              <Text variant="caption" tone="secondary">
                This address is served over HTTPS, so a browser frontend on a secure origin can call
                it. The certificate renews itself.
              </Text>
            ) : (
              <Text variant="caption" tone="secondary">
                This address is not yet served over HTTPS, so a page on a secure origin cannot call
                it. Run the Configure HTTPS Capability on this Node to give it a certificate.
              </Text>
            )}
            <Text variant="caption" tone="secondary">
              A call from a different origin still has to be allowed by your application itself.
              SlideOps does not add CORS headers to what you deployed.
            </Text>
          </div>
        </div>
      ) : state.kind === 'no-node-address' ? (
        <EndpointNote>
          This Service publishes a port, but its Node has no address recorded, so there is no
          address to give yet. Check the Node.
        </EndpointNote>
      ) : (
        <EndpointNote>
          Nothing is published, so this Service is reachable only from the server itself, and from
          anything sharing its network. Publish a port to give it an address: edit the Service, add
          a mapping written host:container, then redeploy to apply it.
        </EndpointNote>
      )}
    </Card>
  );
}
