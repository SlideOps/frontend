import { describe, expect, it } from 'vitest';
import {
  buildConnectionUrl,
  buildSshSignIn,
  connectionUrlTemplate,
  resolveEndpoint,
} from './connection-endpoint';

describe('resolveEndpoint', () => {
  it('maps the PostgreSQL family to its scheme and default port', () => {
    const endpoint = resolveEndpoint(
      'manage-postgresql',
      { database: 'storefront', username: 'storefront_app' },
      '169.58.53.167',
    );
    expect(endpoint).toEqual({
      scheme: 'postgresql',
      host: '169.58.53.167',
      privateHost: null,
      port: 5432,
      username: 'storefront_app',
      database: 'storefront',
    });
  });

  it('carries the Docker bridge address as privateHost for a data store family', () => {
    const endpoint = resolveEndpoint('manage-postgresql', {}, '169.58.53.167', '10.0.0.1');
    expect(endpoint?.privateHost).toBe('10.0.0.1');
    // The public address is untouched: both are offered, never one replacing
    // the other.
    expect(endpoint?.host).toBe('169.58.53.167');
  });

  it('never carries a privateHost for ssh, which nothing containerized calls', () => {
    const endpoint = resolveEndpoint('manage-server-user', { username: 'deploy' }, 'h', '10.0.0.1');
    expect(endpoint?.privateHost).toBeNull();
  });

  it('leaves privateHost null when no Docker bridge address is known', () => {
    expect(resolveEndpoint('manage-postgresql', {}, 'h')?.privateHost).toBeNull();
  });

  it('maps MySQL and MariaDB to the same scheme and port', () => {
    expect(resolveEndpoint('manage-mysql', {}, 'h')?.port).toBe(3306);
    expect(resolveEndpoint('manage-mysql', {}, 'h')?.scheme).toBe('mysql');
    expect(resolveEndpoint('manage-mariadb', {}, 'h')?.port).toBe(3306);
    expect(resolveEndpoint('manage-mariadb', {}, 'h')?.scheme).toBe('mysql');
  });

  it('maps MongoDB and Redis to their default ports', () => {
    expect(resolveEndpoint('manage-mongodb', {}, 'h')?.port).toBe(27017);
    expect(resolveEndpoint('configure-redis', {}, 'h')?.port).toBe(6379);
  });

  it('maps a server login account to the ssh scheme on port 22', () => {
    const endpoint = resolveEndpoint('manage-server-user', { username: 'deploy' }, 'h');
    expect(endpoint?.scheme).toBe('ssh');
    expect(endpoint?.port).toBe(22);
    expect(endpoint?.username).toBe('deploy');
  });

  it('returns null for an unknown Capability', () => {
    expect(resolveEndpoint('configure-https', { domain: 'example.com' }, 'h')).toBeNull();
  });

  it('prefers a configured port and host from the parameters', () => {
    const endpoint = resolveEndpoint(
      'manage-postgresql',
      { port: 6543, host: '10.0.0.9', database: 'app', username: 'app' },
      '169.58.53.167',
    );
    expect(endpoint?.port).toBe(6543);
    expect(endpoint?.host).toBe('10.0.0.9');
  });

  it('accepts a numeric-string port and ignores an invalid one', () => {
    expect(resolveEndpoint('manage-postgresql', { port: '6543' }, 'h')?.port).toBe(6543);
    expect(resolveEndpoint('manage-postgresql', { port: 'nope' }, 'h')?.port).toBe(5432);
  });

  it('leaves the host null when neither a parameter nor the Node address is known', () => {
    expect(resolveEndpoint('manage-postgresql', {}, null)?.host).toBeNull();
  });
});

describe('buildConnectionUrl', () => {
  const base = {
    scheme: 'postgresql' as const,
    host: '169.58.53.167',
    privateHost: null,
    port: 5432,
    username: 'storefront_app',
    database: 'storefront',
  };

  it('assembles a full URL with user, host, port, and database', () => {
    expect(buildConnectionUrl(base, base.host, 's3cr3t')).toBe(
      'postgresql://storefront_app:s3cr3t@169.58.53.167:5432/storefront',
    );
  });

  it('URL encodes special characters in the account and secret', () => {
    expect(buildConnectionUrl(base, base.host, 'p@ss:w/rd?')).toBe(
      'postgresql://storefront_app:p%40ss%3Aw%2Frd%3F@169.58.53.167:5432/storefront',
    );
  });

  it('uses the empty-user form for Redis with no account', () => {
    const redis = {
      scheme: 'redis' as const,
      host: '10.0.0.4',
      privateHost: null,
      port: 6379,
      username: null,
      database: null,
    };
    expect(buildConnectionUrl(redis, redis.host, 'pw')).toBe('redis://:pw@10.0.0.4:6379');
  });
});

describe('connectionUrlTemplate', () => {
  it('masks only the secret and leaves the rest readable', () => {
    const endpoint = {
      scheme: 'postgresql' as const,
      host: '169.58.53.167',
      privateHost: null,
      port: 5432,
      username: 'storefront_app',
      database: 'storefront',
    };
    expect(connectionUrlTemplate(endpoint, endpoint.host, '••••••')).toBe(
      'postgresql://storefront_app:••••••@169.58.53.167:5432/storefront',
    );
  });
});

describe('buildSshSignIn', () => {
  it('builds the ssh command for a server login account', () => {
    const endpoint = {
      scheme: 'ssh' as const,
      host: '203.0.113.7',
      privateHost: null,
      port: 22,
      username: 'deploy',
      database: null,
    };
    expect(buildSshSignIn(endpoint, endpoint.host)).toBe('ssh deploy@203.0.113.7');
  });
});
