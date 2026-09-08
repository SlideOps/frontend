import type { OperationConnection } from '@slideops/api-client';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildConnectionUrl,
  buildSshSignIn,
  connectionUrlTemplate,
  resolveEndpoint,
  type ResolvedEndpoint,
} from './connection-endpoint';

/** A connection as the server sends one, for a service with a password. */
function postgresConnection(overrides: Partial<OperationConnection> = {}): OperationConnection {
  return {
    scheme: 'postgresql',
    protocol: 'tcp',
    host: '169.58.53.167',
    port: 5432,
    username: 'storefront_app',
    database: 'storefront',
    url: 'postgresql://storefront_app:••••••@169.58.53.167:5432/storefront',
    has_password: true,
    masked_password: '••••••',
    env_prefix: 'DATABASE',
    variables: [
      'DATABASE_DATABASE',
      'DATABASE_HOST',
      'DATABASE_PASSWORD',
      'DATABASE_PORT',
      'DATABASE_URL',
      'DATABASE_USERNAME',
    ],
    ...overrides,
  };
}

/** A connection as the server sends one for a service with no password at all. */
function natsConnection(): OperationConnection {
  return {
    scheme: 'nats',
    protocol: 'tcp',
    host: '169.58.53.167',
    port: 4222,
    url: 'nats://169.58.53.167:4222',
    has_password: false,
    env_prefix: 'DATABASE',
    variables: ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_URL'],
  };
}

describe('resolveEndpoint', () => {
  it('reports what the server said about the service, deriving nothing of its own', () => {
    expect(resolveEndpoint(postgresConnection())).toEqual({
      scheme: 'postgresql',
      host: '169.58.53.167',
      privateHost: null,
      port: 5432,
      username: 'storefront_app',
      database: 'storefront',
      url: 'postgresql://storefront_app:••••••@169.58.53.167:5432/storefront',
      hasPassword: true,
      maskedPassword: '••••••',
      personSignsIn: false,
      variables: [
        'DATABASE_DATABASE',
        'DATABASE_HOST',
        'DATABASE_PASSWORD',
        'DATABASE_PORT',
        'DATABASE_URL',
        'DATABASE_USERNAME',
      ],
    });
  });

  it('reports a scheme, a port and a URL for a service with no password', () => {
    const endpoint = resolveEndpoint(natsConnection());
    expect(endpoint?.scheme).toBe('nats');
    expect(endpoint?.port).toBe(4222);
    expect(endpoint?.url).toBe('nats://169.58.53.167:4222');
    expect(endpoint?.hasPassword).toBe(false);
    expect(endpoint?.maskedPassword).toBeNull();
  });

  it('carries the Docker bridge address as privateHost, which the server cannot resolve', () => {
    const endpoint = resolveEndpoint(postgresConnection(), '10.0.0.1');
    expect(endpoint?.privateHost).toBe('10.0.0.1');
    // The address the server resolved is untouched: both are offered, never one
    // replacing the other.
    expect(endpoint?.host).toBe('169.58.53.167');
  });

  it('never carries a privateHost for a sign in, which nothing containerized calls', () => {
    const endpoint = resolveEndpoint(
      { ...postgresConnection(), scheme: 'ssh', person_signs_in: true },
      '10.0.0.1',
    );
    expect(endpoint?.privateHost).toBeNull();
    expect(endpoint?.personSignsIn).toBe(true);
  });

  it('leaves privateHost null when no Docker bridge address is known', () => {
    expect(resolveEndpoint(postgresConnection())?.privateHost).toBeNull();
  });

  it('reports no endpoint for a Capability the server said has no connection', () => {
    expect(resolveEndpoint(null)).toBeNull();
    expect(resolveEndpoint(undefined)).toBeNull();
  });

  it('leaves the host null when the server could not resolve one', () => {
    const endpoint = resolveEndpoint({ ...natsConnection(), host: undefined });
    expect(endpoint?.host).toBeNull();
    // The port and the variable names are still worth reading on their own.
    expect(endpoint?.port).toBe(4222);
    expect(endpoint?.variables).toContain('DATABASE_PORT');
  });

  it('omits a username and a database the service does not have', () => {
    const endpoint = resolveEndpoint(natsConnection());
    expect(endpoint?.username).toBeNull();
    expect(endpoint?.database).toBeNull();
  });
});

describe('the endpoint helper holds no knowledge about any service', () => {
  // The whole point of the change: this file used to carry a table of five
  // services, their schemes and their ports, which is why ClamAV and NATS were
  // shown a host and nothing else. A port or a Capability key appearing here
  // again is that table growing back.
  const source = readFileSync(new URL('./connection-endpoint.ts', import.meta.url), 'utf8');

  it('names no capability key or scheme as a literal', () => {
    for (const key of ['postgres', 'mysql', 'mariadb', 'mongo', 'redis', 'clamav', 'nats', 'ssh']) {
      expect(source.toLowerCase()).not.toContain(`'${key}`);
      expect(source.toLowerCase()).not.toContain(`"${key}`);
    }
  });

  it('names no port number', () => {
    for (const port of ['5432', '3306', '27017', '6379', '3310', '4222', '11211', '5672']) {
      expect(source).not.toContain(port);
    }
  });
});

describe('buildConnectionUrl', () => {
  const base: ResolvedEndpoint = {
    scheme: 'postgresql',
    host: '169.58.53.167',
    privateHost: null,
    port: 5432,
    username: 'storefront_app',
    database: 'storefront',
    url: '',
    hasPassword: true,
    maskedPassword: '••••••',
    personSignsIn: false,
    variables: [],
  };

  it('assembles a full URL with user, host, port, and database', () => {
    expect(buildConnectionUrl(base, '169.58.53.167', 's3cr3t')).toBe(
      'postgresql://storefront_app:s3cr3t@169.58.53.167:5432/storefront',
    );
  });

  it('URL encodes special characters in the account and secret', () => {
    expect(buildConnectionUrl(base, '169.58.53.167', 'p@ss:w/rd?')).toBe(
      'postgresql://storefront_app:p%40ss%3Aw%2Frd%3F@169.58.53.167:5432/storefront',
    );
  });

  it('uses the empty-user form for a service with a secret and no account', () => {
    const redis: ResolvedEndpoint = { ...base, scheme: 'redis', port: 6379, username: null, database: null };
    expect(buildConnectionUrl(redis, '10.0.0.4', 'pw')).toBe('redis://:pw@10.0.0.4:6379');
  });
});

describe('connectionUrlTemplate', () => {
  const base: ResolvedEndpoint = {
    scheme: 'postgresql',
    host: '169.58.53.167',
    privateHost: null,
    port: 5432,
    username: 'storefront_app',
    database: 'storefront',
    url: '',
    hasPassword: true,
    maskedPassword: '••••••',
    personSignsIn: false,
    variables: [],
  };

  it('masks only the secret and leaves the rest readable', () => {
    expect(connectionUrlTemplate(base, '169.58.53.167', '••••••')).toBe(
      'postgresql://storefront_app:••••••@169.58.53.167:5432/storefront',
    );
  });

  it('writes no empty userinfo for a service with neither account nor secret', () => {
    const nats: ResolvedEndpoint = { ...base, scheme: 'nats', port: 4222, username: null, database: null };
    expect(connectionUrlTemplate(nats, '10.0.0.1', '')).toBe('nats://10.0.0.1:4222');
  });
});

describe('buildSshSignIn', () => {
  it('builds the sign in command for a server login account', () => {
    const endpoint: ResolvedEndpoint = {
      scheme: 'ssh',
      host: '203.0.113.7',
      privateHost: null,
      port: 22,
      username: 'deploy',
      database: null,
      url: 'ssh://deploy@203.0.113.7:22',
      hasPassword: true,
      maskedPassword: '••••••',
      personSignsIn: true,
      variables: [],
    };
    expect(buildSshSignIn(endpoint, '203.0.113.7')).toBe('ssh deploy@203.0.113.7');
  });
});
