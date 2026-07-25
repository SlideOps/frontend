/*
 * The bridge between installing a database server and getting a credential for it.
 * Installing a database (for example install-postgresql) starts the server but
 * creates no application database, account, or password, so an Operator is left
 * with nothing to connect with and no obvious next step. The matching manage
 * Capability (manage-postgresql) creates a database, an account, and a password,
 * which is the credential. This map lets a done install offer that next step.
 */

/** The manage Capability that creates a credential, and the database's name. */
export interface DatabaseManageStep {
  /** The Capability key that creates a database, an account, and a password. */
  manageKey: string;
  /** The database's Operator-facing name, for example "PostgreSQL". */
  name: string;
}

/**
 * The install Capability keys that stand up a database server, each mapped to the
 * manage Capability that turns it into something connectable and the database's
 * display name. Only these keys carry the nudge; anything else has no entry.
 */
const INSTALL_TO_MANAGE: Record<string, DatabaseManageStep> = {
  'install-postgresql': { manageKey: 'manage-postgresql', name: 'PostgreSQL' },
  'install-mysql': { manageKey: 'manage-mysql', name: 'MySQL' },
  'install-mariadb': { manageKey: 'manage-mariadb', name: 'MariaDB' },
  'install-mongodb': { manageKey: 'manage-mongodb', name: 'MongoDB' },
};

/**
 * The manage step for a database install Capability, or null when the Capability
 * is not a database install. A null answer means no credential nudge applies, so
 * callers render nothing.
 */
export function databaseManageStep(capabilityKey: string): DatabaseManageStep | null {
  return INSTALL_TO_MANAGE[capabilityKey] ?? null;
}
