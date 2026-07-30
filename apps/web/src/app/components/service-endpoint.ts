import type { Service } from '@slideops/api-client';

/**
 * Working out what to tell an Operator about reaching a Service from outside the
 * server. The logic here is pure and knows nothing about the DOM; ServiceEndpoint
 * renders what this returns.
 *
 * There are only three honest answers, and which one applies is not a detail to
 * decide inline in a view: the Service has addresses, or it publishes a port but
 * its Node has no address to build one from, or nothing is published at all and it
 * is reachable only from the server itself. Saying "no address" for the last two
 * would collapse two different problems with two different fixes into one.
 */
export type ServiceEndpointState =
  | {
      kind: 'addresses';
      /** One base URL per published port. */
      urls: string[];
      /** Whether it answers right now. The address is the same either way. */
      answering: boolean;
    }
  | { kind: 'no-node-address' }
  | { kind: 'nothing-published' };

/** What this Service's reachability amounts to. */
export function serviceEndpointState(
  service: Pick<Service, 'public_urls' | 'ports' | 'status'>,
): ServiceEndpointState {
  const urls = (service.public_urls ?? []).filter((url) => url.trim() !== '');
  if (urls.length > 0) {
    return { kind: 'addresses', urls, answering: service.status === 'running' };
  }
  // A published port with no address means the Node is the thing to look at, not
  // the Service: the deploy did its part and there is simply nothing to build a
  // URL from.
  if ((service.ports ?? []).length > 0) {
    return { kind: 'no-node-address' };
  }
  return { kind: 'nothing-published' };
}
