/*
 * The bridge between installing a database server and getting a credential for it.
 * Installing a database (for example install-postgresql) starts the server but
 * creates no application database, account, or password, so an Operator is left
 * with nothing to connect with and no obvious next step. The matching manage
 * Capability (manage-postgresql) creates a database, an account, and a password,
 * which is the credential; Redis has no per-app database concept, so its own next
 * step is configure-redis instead, which is where its password and tuning live.
 * This map lets a done install offer that next step -- and keeps offering it
 * afterwards too, so an Operator who already has a database still has a direct
 * way back in to change a setting on it, such as turning on pgvector.
 */

/** The next-step Capability that turns a bare install into something connectable
 *  or configurable, and how to talk about it. */
export interface DatabaseManageStep {
  /** The Capability key that creates a credential, or configures the server. */
  manageKey: string;
  /** The database's Operator-facing name, for example "PostgreSQL". */
  name: string;
  /**
   * Whether this step models one database and account per application (true for
   * every SQL and document engine) versus one configuration for the whole server
   * (false for Redis, which has no per-app database to create). Only a
   * per-database step can be scoped to a single Service's own credential.
   */
  perDatabase: boolean;
  /** Shown before this step has ever run: what running it gets you. Follows the
   *  database's name directly, for example "is installed and running. Create...". */
  setupDescription: string;
  /** Shown once this step has already run at least once: this step never fully
   *  "completes" the way an install does, since a setting on it (a password, an
   *  extension, a tuning value) can always be changed later, so an Operator who
   *  already has one still has a direct way back in rather than the nudge simply
   *  disappearing once there is nothing left to set up for the first time. */
  reviewDescription: string;
  /** The action button's label before this step has run. */
  actionLabel: string;
  /** The action button's label once this step has already run at least once,
   *  worded as opening it again rather than creating it for the first time. */
  reviewActionLabel: string;
}

/**
 * The install Capability keys that stand up a database server, each mapped to
 * its own next step. Only these keys carry the nudge; anything else has no
 * entry.
 */
const INSTALL_TO_MANAGE: Record<string, DatabaseManageStep> = {
  'install-postgresql': {
    manageKey: 'manage-postgresql',
    name: 'PostgreSQL',
    perDatabase: true,
    setupDescription:
      'is installed and running. Create a database and account to get connection credentials, including a password, that you can use in your app.',
    reviewDescription:
      'already has a database and account set up. Open it to review those credentials or change its settings, including turning on the pgvector extension.',
    actionLabel: 'Create database and account',
    reviewActionLabel: 'Manage database and account',
  },
  'install-mysql': {
    manageKey: 'manage-mysql',
    name: 'MySQL',
    perDatabase: true,
    setupDescription:
      'is installed and running. Create a database and account to get connection credentials, including a password, that you can use in your app.',
    reviewDescription:
      'already has a database and account set up. Open it to review those credentials or create another one.',
    actionLabel: 'Create database and account',
    reviewActionLabel: 'Manage database and account',
  },
  'install-mariadb': {
    manageKey: 'manage-mariadb',
    name: 'MariaDB',
    perDatabase: true,
    setupDescription:
      'is installed and running. Create a database and account to get connection credentials, including a password, that you can use in your app.',
    reviewDescription:
      'already has a database and account set up. Open it to review those credentials or create another one.',
    actionLabel: 'Create database and account',
    reviewActionLabel: 'Manage database and account',
  },
  'install-mongodb': {
    manageKey: 'manage-mongodb',
    name: 'MongoDB',
    perDatabase: true,
    setupDescription:
      'is installed and running. Create a database and account to get connection credentials, including a password, that you can use in your app.',
    reviewDescription:
      'already has a database and account set up. Open it to review those credentials or create another one.',
    actionLabel: 'Create database and account',
    reviewActionLabel: 'Manage database and account',
  },
  'install-redis': {
    manageKey: 'configure-redis',
    name: 'Redis',
    // Redis has no per-app database or account to create, so there is nothing
    // here to scope to one Service the way the SQL and document engines are.
    perDatabase: false,
    setupDescription:
      'is installed and running. Configure it to set a password and tune memory and eviction, if you want to.',
    reviewDescription:
      'is installed and running, with its own configuration already set. Open it to review or change settings such as the password, memory limit, and eviction policy.',
    actionLabel: 'Configure Redis',
    reviewActionLabel: 'Open Redis configuration',
  },
};

/**
 * The next step for a database install Capability, or null when the Capability
 * is not a database install. A null answer means no nudge applies, so callers
 * render nothing.
 */
export function databaseManageStep(capabilityKey: string): DatabaseManageStep | null {
  return INSTALL_TO_MANAGE[capabilityKey] ?? null;
}
