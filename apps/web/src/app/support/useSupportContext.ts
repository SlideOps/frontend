import type { SupportContext } from '@slideops/api-client';
import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';

/*
 * What Support knows about where the Operator is, assembled from the route
 * rather than a dedicated "current resource" store -- none exists in this
 * app today, and the route params React Router already resolves for the
 * matched page are the real answer to "what am I looking at."
 *
 * A param is only present on the branch that actually declared it (an
 * `:id`-less route like `nodes/new` yields no `id`), so a static sub-route
 * never gets misread as a resource.
 */

const RESOURCE_SEGMENTS: Record<string, { param: string; type: string }> = {
  nodes: { param: 'id', type: 'node' },
  services: { param: 'id', type: 'service' },
  operations: { param: 'id', type: 'operation' },
  capabilities: { param: 'key', type: 'capability' },
  projects: { param: 'id', type: 'project' },
};

/** Pure resolution, kept apart from the hook so it is testable without
 * rendering a router. */
export function resolveSupportContext(
  pathname: string,
  params: Readonly<Record<string, string | undefined>>,
): SupportContext {
  const segments = pathname.replace(/^\/+|\/+$/g, '').split('/');
  const [area, first, second] = segments;

  if (area === 'app' && first === 'billing' && second === 'transactions' && params.reference) {
    return { route: pathname, resource_type: 'transaction', resource_id: params.reference };
  }

  if (area === 'app' && first) {
    const mapping = RESOURCE_SEGMENTS[first];
    const id = mapping ? params[mapping.param] : undefined;
    if (mapping && id) {
      return { route: pathname, resource_type: mapping.type, resource_id: id };
    }
  }

  return { route: pathname, resource_type: null, resource_id: null };
}

export function useSupportContext(): SupportContext {
  const location = useLocation();
  const params = useParams();
  return useMemo(
    () => resolveSupportContext(location.pathname, params),
    [location.pathname, params],
  );
}
