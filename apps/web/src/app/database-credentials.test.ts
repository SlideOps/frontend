import { describe, expect, it } from 'vitest';
import { databaseManageStep } from './database-credentials';

describe('databaseManageStep', () => {
  it('maps each database install to its manage step and name', () => {
    expect(databaseManageStep('install-postgresql')).toEqual({
      manageKey: 'manage-postgresql',
      name: 'PostgreSQL',
    });
    expect(databaseManageStep('install-mysql')).toEqual({
      manageKey: 'manage-mysql',
      name: 'MySQL',
    });
    expect(databaseManageStep('install-mariadb')).toEqual({
      manageKey: 'manage-mariadb',
      name: 'MariaDB',
    });
    expect(databaseManageStep('install-mongodb')).toEqual({
      manageKey: 'manage-mongodb',
      name: 'MongoDB',
    });
  });

  it('returns null for a non-database install Capability', () => {
    expect(databaseManageStep('install-docker')).toBeNull();
    expect(databaseManageStep('manage-postgresql')).toBeNull();
    expect(databaseManageStep('')).toBeNull();
  });
});
