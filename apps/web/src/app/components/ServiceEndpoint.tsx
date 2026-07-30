import { type Service } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { ArrowUpRight, Globe } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
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

export function ServiceEndpoint({ service }: { service: Service }) {
  const state = serviceEndpointState(service);

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
            mobile app, or another Service. The published port was opened on the host firewall as
            part of the deploy, so it answers as it stands, with no domain to set up first.
          </Text>

          <ul className="flex flex-col gap-2">
            {state.urls.map((url) => (
              <li key={url} className="flex min-w-0 flex-wrap items-center gap-2">
                <RevealValue value={url} sensitive={false} label="address" />
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md text-sm text-ink-muted transition-colors duration-fast ease-standard hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  Open
                  <ArrowUpRight width={15} height={15} aria-hidden />
                </a>
              </li>
            ))}
          </ul>

          {!state.answering ? (
            <EndpointNote>
              This Service is {service.status}, so the address will not answer until it is running.
              The address itself does not change.
            </EndpointNote>
          ) : null}

          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <Text variant="caption" tone="secondary">
              Two things worth knowing before you wire a frontend to it:
            </Text>
            <Text variant="caption" tone="secondary">
              A page served over HTTPS cannot call an <code>http://</code> address, so a browser
              frontend on a secure origin needs a domain and a certificate in front of this. Run the
              Configure HTTPS Capability on this Node and call that address instead.
            </Text>
            <Text variant="caption" tone="secondary">
              A call from a different origin has to be allowed by your application itself. SlideOps
              does not add CORS headers to what you deployed.
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
          anything sharing its network. Publish a port to give it an address: edit the Service, add a
          mapping written host:container, then redeploy to apply it.
        </EndpointNote>
      )}
    </Card>
  );
}
