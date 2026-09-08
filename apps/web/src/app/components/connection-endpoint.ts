import type { OperationConnection } from '@slideops/api-client';

/**
 * Turning the connection the server resolved for an Operation into the shape the
 * CredentialsCard renders. The logic here is pure and knows nothing about the
 * DOM.
 *
 * This file used to hold a table of "the services SlideOps knows": five
 * entries, each with a scheme and a default port, matched against the Capability
 * key. Everything else fell through it and was shown whatever raw parameters
 * happened to exist, which is why an Operator who installed ClamAV was given a
 * host and no port, and why neither ClamAV nor NATS ever produced a connection
 * string. The server has held eleven of these for some time, and the table here
 * had drifted the moment the sixth was added.
 *
 * So there is no table. A scheme, a port, a URL and the names of the environment
 * variables all arrive from the API, and adding a service to SlideOps stops
 * meaning editing this file at all.
 */

/**
 * A resolved endpoint for an Operation: what the server said, plus the one
 * address it cannot know.
 */
export interface ResolvedEndpoint {
  scheme: string;
  host: string | null;
  /**
   * Where a container on this same Node reaches this service — the Docker
   * bridge address, never `host` above, which is the Node's own address and is
   * correctly unreachable from a container by design once a firewall is in
   * place. It comes from the Node's own Discovery rather than from the
   * connection, and is always null for a service a person signs in to: a login
   * account is what you reach the Node itself with, never something a container
   * on it calls.
   */
  privateHost: string | null;
  port: number;
  username: string | null;
  database: string | null;
  /**
   * The whole connection string as the server built it, for the host the server
   * resolved. Where a password exists it carries `maskedPassword` in its place
   * and never the secret.
   */
  url: string;
  /** Whether a secret exists to reveal. */
  hasPassword: boolean;
  /** The mark standing in for the password, so a template built here matches. */
  maskedPassword: string | null;
  /** A service a person signs in to rather than one an application connects to. */
  personSignsIn: boolean;
  /** The exact environment variable names to write, in the server's order. */
  variables: string[];
}

/**
 * Resolve the endpoint the card renders, or null when the Operation's Capability
 * is not a network service and so has no connection to report. A null result
 * means the card still shows whatever parameters exist but offers no connection
 * string, which for an installed runtime or a hardening measure is the truth.
 *
 * dockerBridgeAddress is the Node's own Docker bridge address, from its most
 * recent Discovery. It becomes privateHost, and is never applied to a sign in.
 */
export function resolveEndpoint(
  connection: OperationConnection | null | undefined,
  dockerBridgeAddress?: string | null,
): ResolvedEndpoint | null {
  if (!connection) {
    return null;
  }
  const personSignsIn = connection.person_signs_in === true;
  return {
    scheme: connection.scheme,
    host: connection.host ?? null,
    privateHost: personSignsIn ? null : (dockerBridgeAddress ?? null),
    port: connection.port,
    username: connection.username ?? null,
    database: connection.database ?? null,
    url: connection.url,
    hasPassword: connection.has_password,
    maskedPassword: connection.masked_password ?? null,
    personSignsIn,
    variables: connection.variables ?? [],
  };
}

/** The userinfo part of a URL, or "" when there is neither account nor secret. */
function userInfo(account: string, secret: string): string {
  if (secret !== '') {
    return `${account}:${secret}@`;
  }
  return account === '' ? '' : `${account}@`;
}

/**
 * Assemble the full connection URL for the given host, URL encoding the account
 * and secret so any special character in them stays safe. A service with no
 * account takes the empty-user form `redis://:secret@host:port`.
 *
 * This is the one string the server will not build, and must not: it carries the
 * plaintext, so it is assembled here from what the reveal endpoint returned and
 * goes straight to the clipboard.
 */
export function buildConnectionUrl(
  endpoint: ResolvedEndpoint,
  host: string,
  secret: string,
): string {
  const account = endpoint.username ? encodeURIComponent(endpoint.username) : '';
  const base = `${endpoint.scheme}://${userInfo(account, encodeURIComponent(secret))}${host}:${endpoint.port}`;
  return endpoint.database ? `${base}/${encodeURIComponent(endpoint.database)}` : base;
}

/**
 * A display-only template of the connection URL with the secret masked. It is
 * never used to connect, only shown before the Operator reveals the real one, so
 * the account, host, port, and database read plainly rather than URL encoded.
 *
 * It exists for the addresses the server did not resolve for itself, the Docker
 * bridge among them. For the server's own host, prefer `endpoint.url`.
 */
export function connectionUrlTemplate(
  endpoint: ResolvedEndpoint,
  host: string,
  maskedSecret: string,
): string {
  const base = `${endpoint.scheme}://${userInfo(endpoint.username ?? '', maskedSecret)}${host}:${endpoint.port}`;
  return endpoint.database ? `${base}/${endpoint.database}` : base;
}

/** The sign in command for a server login account. */
export function buildSshSignIn(endpoint: ResolvedEndpoint, host: string): string {
  return endpoint.username ? `${endpoint.scheme} ${endpoint.username}@${host}` : `${endpoint.scheme} ${host}`;
}
