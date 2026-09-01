/**
 * Deriving a usable service endpoint from an Operation, so the credentials an
 * Operator holds become an actual connection: a host, a port, and a ready to
 * copy connection string. The logic here is pure and knows nothing about the
 * DOM; the CredentialsCard renders what these functions return.
 */

/** The service families whose default port and URL scheme SlideOps knows. */
export type EndpointScheme = 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'ssh';

/** A service family, matched by a substring of the Capability key. */
interface EndpointFamily {
  /** True when a Capability key belongs to this family. */
  matches: (capabilityKey: string) => boolean;
  scheme: EndpointScheme;
  /** The port the service listens on by default. */
  defaultPort: number;
}

/**
 * The families in match order. A database URL is built for the data stores; a
 * server login account (manage-server-user) is an SSH sign in, not a database,
 * so it carries the ssh scheme and is presented as a login rather than a URL.
 */
const FAMILIES: EndpointFamily[] = [
  { matches: (key) => key.includes('postgres'), scheme: 'postgresql', defaultPort: 5432 },
  {
    matches: (key) => key.includes('mysql') || key.includes('mariadb'),
    scheme: 'mysql',
    defaultPort: 3306,
  },
  { matches: (key) => key.includes('mongo'), scheme: 'mongodb', defaultPort: 27017 },
  { matches: (key) => key.includes('redis'), scheme: 'redis', defaultPort: 6379 },
  { matches: (key) => key.includes('server-user'), scheme: 'ssh', defaultPort: 22 },
];

/** The keys, in preference order, an explicit host may arrive under. */
const HOST_PARAM_KEYS = ['host', 'hostname', 'address'] as const;
/** The keys, in preference order, that carry the database name. */
const DATABASE_PARAM_KEYS = ['database', 'db', 'dbname'] as const;
/** The keys, in preference order, that carry the connecting account name. */
const USER_PARAM_KEYS = ['username', 'user'] as const;

/** The first parameter among `keys` that holds a non-empty string, else null. */
function firstString(parameters: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = parameters[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

/** A configured port from the parameters, when it is a real positive integer. */
function paramPort(parameters: Record<string, unknown>): number | null {
  const raw = parameters['port'];
  const value =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : NaN;
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * A resolved endpoint for an Operation: the scheme, the effective host (a host
 * carried in the parameters wins over the Node address passed in, and either may
 * be absent), the effective port (a configured port wins over the family
 * default), plus the account and database the connection string needs.
 */
export interface ResolvedEndpoint {
  scheme: EndpointScheme;
  host: string | null;
  /**
   * Where a container on this same Node reaches this service — the Docker
   * bridge address, never `host` above, which is the Node's own address and
   * is correctly unreachable from a container by design once a firewall is
   * in place. Always null for `ssh`: a login account is what you reach the
   * Node itself with, never something a container on it calls.
   */
  privateHost: string | null;
  port: number;
  username: string | null;
  database: string | null;
}

/**
 * Resolve the service endpoint for an Operation, or null when its Capability is
 * not one whose endpoint SlideOps knows. A null result means the card still
 * shows whatever parameters exist but offers no connection string.
 *
 * dockerBridgeAddress is the Node's own Docker bridge address, from its most
 * recent Discovery. It becomes privateHost for a data store family, and is
 * never applied to `ssh`, which is never something a container reaches.
 */
export function resolveEndpoint(
  capabilityKey: string,
  parameters: Record<string, unknown>,
  host: string | null,
  dockerBridgeAddress?: string | null,
): ResolvedEndpoint | null {
  const family = FAMILIES.find((candidate) => candidate.matches(capabilityKey));
  if (!family) {
    return null;
  }
  return {
    scheme: family.scheme,
    host: firstString(parameters, HOST_PARAM_KEYS) ?? host,
    privateHost: family.scheme === 'ssh' ? null : (dockerBridgeAddress ?? null),
    port: paramPort(parameters) ?? family.defaultPort,
    username: firstString(parameters, USER_PARAM_KEYS),
    database: firstString(parameters, DATABASE_PARAM_KEYS),
  };
}

/**
 * Assemble the full connection URL for a data store, URL encoding the account
 * and secret so any special character in them stays safe. Redis with no account
 * takes the empty-user form `redis://:secret@host:port`.
 */
export function buildConnectionUrl(
  endpoint: ResolvedEndpoint,
  host: string,
  secret: string,
): string {
  const account = endpoint.username ? encodeURIComponent(endpoint.username) : '';
  const authority = `${account}:${encodeURIComponent(secret)}@${host}:${endpoint.port}`;
  const base = `${endpoint.scheme}://${authority}`;
  return endpoint.database ? `${base}/${encodeURIComponent(endpoint.database)}` : base;
}

/**
 * A display-only template of the connection URL with the secret masked. It is
 * never used to connect, only shown before the Operator reveals the real one, so
 * the account, host, port, and database read plainly rather than URL encoded.
 */
export function connectionUrlTemplate(
  endpoint: ResolvedEndpoint,
  host: string,
  maskedSecret: string,
): string {
  const authority = `${endpoint.username ?? ''}:${maskedSecret}@${host}:${endpoint.port}`;
  const base = `${endpoint.scheme}://${authority}`;
  return endpoint.database ? `${base}/${endpoint.database}` : base;
}

/** The SSH sign in command for a server login account. */
export function buildSshSignIn(endpoint: ResolvedEndpoint, host: string): string {
  return endpoint.username ? `ssh ${endpoint.username}@${host}` : `ssh ${host}`;
}
