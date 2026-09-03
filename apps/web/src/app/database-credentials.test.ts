import { describe, expect, it } from 'vitest';
import { databaseManageStep } from './database-credentials';

describe('databaseManageStep', () => {
  it('maps each database install to its manage step and name', () => {
    expect(databaseManageStep('install-postgresql')?.manageKey).toBe('manage-postgresql');
    expect(databaseManageStep('install-postgresql')?.name).toBe('PostgreSQL');
    expect(databaseManageStep('install-mysql')?.manageKey).toBe('manage-mysql');
    expect(databaseManageStep('install-mariadb')?.manageKey).toBe('manage-mariadb');
    expect(databaseManageStep('install-mongodb')?.manageKey).toBe('manage-mongodb');
  });

  it('maps install-redis to configure-redis, since Redis has no manage step', () => {
    const step = databaseManageStep('install-redis');
    expect(step?.manageKey).toBe('configure-redis');
    expect(step?.name).toBe('Redis');
    // Redis has no per-app database, so it must never be scoped to one Service
    // the way the SQL and document engines are.
    expect(step?.perDatabase).toBe(false);
  });

  it('marks every SQL and document engine as per-database, unlike Redis', () => {
    for (const key of ['install-postgresql', 'install-mysql', 'install-mariadb', 'install-mongodb']) {
      expect(databaseManageStep(key)?.perDatabase).toBe(true);
    }
  });

  it('carries a review description naming what can still be changed once the step has already run', () => {
    // This is the actual bridge back in once a database already exists --
    // without it, an Operator with an existing database has no way from the
    // install Capability's own page to reach settings like pgvector.
    expect(databaseManageStep('install-postgresql')?.reviewDescription).toMatch(/pgvector/);
  });

  it('returns null for a non-database install Capability', () => {
    expect(databaseManageStep('install-docker')).toBeNull();
    expect(databaseManageStep('manage-postgresql')).toBeNull();
    expect(databaseManageStep('')).toBeNull();
  });
});
