import { apiRequest } from './http';

/**
 * Whether planned maintenance is on, right now. Public and unauthenticated:
 * the app shell reads this before an Operator has even signed in, to decide
 * whether to show the maintenance page. It is the one boolean the emergency
 * switchboard exposes outside the admin role -- nothing else about it is
 * reachable here.
 */
export function getMaintenanceStatus(signal?: AbortSignal): Promise<boolean> {
  return apiRequest<{ maintenance?: boolean }>('/maintenance', { signal }).then(
    (r) => r.maintenance ?? false,
  );
}
