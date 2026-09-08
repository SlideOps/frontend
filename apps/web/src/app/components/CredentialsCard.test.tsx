import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Operation, OperationConnection } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

/*
 * A database or cache installed directly on a Node is only ever reachable
 * from a container on that same Node at the Docker bridge address — never
 * the Node's own public address, which a correctly configured firewall keeps
 * such a service unreachable from on purpose. This is exactly the guessing
 * the Operator asked never to have to do again: both addresses, labelled,
 * whenever credentials are shown.
 *
 * The second half of the same complaint is what the connection below carries.
 * A Capability with no password at all used to show no port, no connection
 * string, and no statement of what its environment variables are called,
 * because every one of those was gated on there being a secret to reveal.
 */

const revealOperationSecret = vi.fn(async (_operationId: unknown, parameter: unknown) => ({
  parameter,
  value:
    parameter === 'private_key'
      ? '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----'
      : 's3cr3t',
}));

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  revealOperationSecret: (operationId: unknown, parameter: unknown) =>
    revealOperationSecret(operationId, parameter),
}));

const { CredentialsCard } = await import('./CredentialsCard');

/** The connection the server resolves for a PostgreSQL database. */
function postgresConnection(): OperationConnection {
  return {
    scheme: 'postgresql',
    protocol: 'tcp',
    host: '169.58.53.167',
    port: 5432,
    username: 'app_user',
    database: 'app',
    url: 'postgresql://app_user:••••••@169.58.53.167:5432/app',
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
  };
}

/** The connection the server resolves for a service with no authentication. */
function clamavConnection(): OperationConnection {
  return {
    scheme: 'clamav',
    protocol: 'tcp',
    host: '169.58.53.167',
    port: 3310,
    url: 'clamav://169.58.53.167:3310',
    has_password: false,
    env_prefix: 'CLAMAV',
    variables: ['CLAMAV_HOST', 'CLAMAV_PORT', 'CLAMAV_URL'],
  };
}

/** The connection the server resolves for a server login account. */
function signInConnection(): OperationConnection {
  return {
    scheme: 'ssh',
    protocol: 'tcp',
    host: '169.58.53.167',
    port: 22,
    username: 'deploy',
    url: 'ssh://deploy:••••••@169.58.53.167:22',
    has_password: true,
    masked_password: '••••••',
    person_signs_in: true,
  };
}

function operationWith(overrides: Partial<Operation> = {}): Operation {
  return {
    id: 'op-1',
    node_id: 'node-1',
    capability_key: 'manage-postgresql',
    status: 'completed',
    plan: null,
    verification: null,
    error: null,
    parameters: {
      database: 'app',
      username: 'app_user',
      password: '[stored securely]',
    },
    connection: postgresConnection(),
    created_at: '2026-01-01T00:00:00Z',
    approved_at: null,
    started_at: null,
    completed_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Operation;
}

/** A ClamAV Operation: installed, running, and holding no secret of any kind. */
function clamavOperation(): Operation {
  return operationWith({
    capability_key: 'configure-clamav',
    parameters: {},
    connection: clamavConnection(),
  });
}

describe('CredentialsCard', () => {
  it('shows both the container and the public connection string when both hosts are known', async () => {
    renderInApp(
      <CredentialsCard
        operation={operationWith()}
        host="169.58.53.167"
        dockerBridgeAddress="10.0.0.1"
      />,
    );

    expect(
      await screen.findByText(/Connection string — from a container on this Node/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Connection string — from outside this Node/)).toBeInTheDocument();
    // The row list also carries the private address plainly, not only inside
    // the connection string.
    expect(screen.getByText('From a container')).toBeInTheDocument();
  });

  it('shows only the container connection string when the public host is unknown', async () => {
    renderInApp(
      <CredentialsCard
        operation={operationWith({ connection: { ...postgresConnection(), host: undefined } })}
        dockerBridgeAddress="10.0.0.1"
      />,
    );

    expect(
      await screen.findByText(/Connection string — from a container on this Node/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Connection string — from outside this Node/),
    ).not.toBeInTheDocument();
  });

  it('falls back to a single, unlabelled connection string when no Docker bridge address is known', async () => {
    renderInApp(<CredentialsCard operation={operationWith()} host="169.58.53.167" />);

    expect(await screen.findByText('Connection string')).toBeInTheDocument();
    expect(
      screen.queryByText(/Connection string — from a container on this Node/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('From a container')).not.toBeInTheDocument();
  });

  it('never shows a container connection string for a sign in, even when one is known', async () => {
    renderInApp(
      <CredentialsCard
        operation={operationWith({
          capability_key: 'manage-server-user',
          parameters: { username: 'deploy', password: '[stored securely]' },
          connection: signInConnection(),
        })}
        host="169.58.53.167"
        dockerBridgeAddress="10.0.0.1"
      />,
    );

    expect(await screen.findByText('Server login')).toBeInTheDocument();
    expect(
      screen.queryByText(/Connection string — from a container on this Node/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('From a container')).not.toBeInTheDocument();
  });

  it('reveals and copies the container connection string using the private host', async () => {
    renderInApp(
      <CredentialsCard
        operation={operationWith()}
        host="169.58.53.167"
        dockerBridgeAddress="10.0.0.1"
      />,
    );

    const buttons = await screen.findAllByRole('button', {
      name: 'Reveal and copy connection string',
    });
    // The container block is rendered first.
    await userEvent.click(buttons[0]!);

    expect(
      await screen.findByText(/postgresql:\/\/app_user:s3cr3t@10\.0\.0\.1:5432\/app/),
    ).toBeInTheDocument();
  });

  it('shows a generated private key with its own copy and download actions, not the generic reveal row', async () => {
    renderInApp(
      <CredentialsCard
        operation={operationWith({
          capability_key: 'manage-server-user',
          parameters: { username: 'deploy', private_key: '[stored securely]' },
          connection: signInConnection(),
        })}
        host="169.58.53.167"
      />,
    );

    expect(await screen.findByText('Your private key')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download deploy\.pem/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy private key/ })).toBeInTheDocument();
    // Not also rendered as a generic masked row.
    expect(screen.queryByLabelText('Reveal private key')).not.toBeInTheDocument();
  });

  it('reveals the private key once on copy, and reuses the cached value on download', async () => {
    revealOperationSecret.mockClear();
    // jsdom does not implement the Blob URL APIs the real download uses, and
    // logs a benign "not implemented: navigation" warning when the anchor's
    // click() is left to run for real against a fake blob: href.
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderInApp(
      <CredentialsCard
        operation={operationWith({
          capability_key: 'manage-server-user',
          parameters: { username: 'deploy', private_key: '[stored securely]' },
          connection: signInConnection(),
        })}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /Copy private key/ }));
    expect(await screen.findByRole('button', { name: /Copied/ })).toBeInTheDocument();
    expect(revealOperationSecret).toHaveBeenCalledTimes(1);
    expect(revealOperationSecret).toHaveBeenCalledWith('op-1', 'private_key');

    await userEvent.click(screen.getByRole('button', { name: /Download deploy\.pem/ }));
    // Cached: no second network call for the same secret.
    expect(revealOperationSecret).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('a Capability with no password', () => {
  // ClamAV and NATS have no authentication of any kind. Everything below used
  // to be gated on a secret existing, so an Operator who installed one opened
  // its page for the values to put in a .env file and was shown a host and
  // nothing else.
  it('still shows its host, its port and its connection URL', async () => {
    renderInApp(<CredentialsCard operation={clamavOperation()} host="169.58.53.167" />);

    expect(await screen.findByText('Connection string')).toBeInTheDocument();
    expect(screen.getAllByText('clamav://169.58.53.167:3310').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Host').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Port').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3310').length).toBeGreaterThan(0);
  });

  it('offers its connection URL to copy without asking anything to be revealed', async () => {
    renderInApp(<CredentialsCard operation={clamavOperation()} host="169.58.53.167" />);

    expect(
      await screen.findByRole('button', { name: /Copy the connection string/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reveal and copy connection string' }),
    ).not.toBeInTheDocument();
  });

  it('offers no password row and no password variable', async () => {
    renderInApp(<CredentialsCard operation={clamavOperation()} host="169.58.53.167" />);

    await userEvent.click(await screen.findByText('Or copy the parts separately'));

    expect(screen.queryByText('Password')).not.toBeInTheDocument();
    expect(screen.queryByText(/_PASSWORD$/)).not.toBeInTheDocument();
  });

  it('omits the rows for a username and a database the service does not have', async () => {
    renderInApp(<CredentialsCard operation={clamavOperation()} host="169.58.53.167" />);

    await userEvent.click(await screen.findByText('Or copy the parts separately'));

    expect(screen.queryByText('Username')).not.toBeInTheDocument();
    expect(screen.queryByText('Database')).not.toBeInTheDocument();
  });
});

describe('a Capability with a password', () => {
  it('still masks its connection URL until the Operator reveals it', async () => {
    renderInApp(<CredentialsCard operation={operationWith()} host="169.58.53.167" />);

    // Once as the string itself and once as the copyable Connection URL row.
    expect(
      (await screen.findAllByText('postgresql://app_user:••••••@169.58.53.167:5432/app')).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/s3cr3t/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reveal and copy connection string' }),
    ).toBeInTheDocument();
  });

  it('names the password variable among the names it states', async () => {
    renderInApp(<CredentialsCard operation={operationWith()} host="169.58.53.167" />);

    expect(await screen.findByText('DATABASE_PASSWORD')).toBeInTheDocument();
  });
});

describe('the environment variable names', () => {
  it('are shown outright, so nothing about them has to be guessed', async () => {
    renderInApp(<CredentialsCard operation={clamavOperation()} host="169.58.53.167" />);

    expect(await screen.findByText('Environment variable names')).toBeInTheDocument();
    for (const name of ['CLAMAV_HOST', 'CLAMAV_PORT', 'CLAMAV_URL']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('each carry their own copy button', async () => {
    renderInApp(<CredentialsCard operation={clamavOperation()} host="169.58.53.167" />);

    for (const name of ['CLAMAV_HOST', 'CLAMAV_PORT', 'CLAMAV_URL']) {
      expect(
        await screen.findByRole('button', { name: `Copy the ${name} variable name` }),
      ).toBeInTheDocument();
    }
  });

  it('are not offered for a sign in, which no application reads', async () => {
    renderInApp(
      <CredentialsCard
        operation={operationWith({
          capability_key: 'manage-server-user',
          parameters: { username: 'deploy', password: '[stored securely]' },
          connection: signInConnection(),
        })}
        host="169.58.53.167"
      />,
    );

    expect(await screen.findByText('Server login')).toBeInTheDocument();
    expect(screen.queryByText('Environment variable names')).not.toBeInTheDocument();
  });
});

describe('CredentialsCard connection parts', () => {
  // The production outage this exists to prevent: an application configured with
  // the whole connection string where it expected a hostname, crash-looping on
  // "getaddrinfo ENOTFOUND postgresql://user:password@host:5432/database".
  //
  // The card offered exactly one artifact, a whole URI, so an Operator wiring an
  // application that reads DB_HOST separately had nothing else to copy.
  it('offers the host, the port and the whole URL on their own', async () => {
    renderInApp(<CredentialsCard operation={operationWith()} dockerBridgeAddress="10.0.0.1" />);

    // One disclosure per address; opening the first is enough.
    await userEvent.click((await screen.findAllByText('Or copy the parts separately'))[0]!);

    expect(screen.getAllByText('Host').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Port').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5432').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Connection URL').length).toBeGreaterThan(0);
  });

  it('says plainly why a whole connection string does not belong in a host setting', async () => {
    renderInApp(<CredentialsCard operation={operationWith()} dockerBridgeAddress="10.0.0.1" />);

    await userEvent.click((await screen.findAllByText('Or copy the parts separately'))[0]!);

    expect(
      screen.getAllByText(/host setting expects an address and nothing else/i).length,
    ).toBeGreaterThan(0);
  });
});

describe('the card decides nothing about any service itself', () => {
  // Every port, scheme and Capability key here is a chance to disagree with the
  // server, which is how the one that mattered went wrong.
  // Read from the working directory rather than import.meta.url: this suite
  // runs under jsdom, where that is not a file URL.
  // Comments stripped: the outage this card was rewritten for is quoted in one
  // of them, port and all, and quoting a failure is not deciding anything.
  const source = readFileSync(
    resolve(process.cwd(), 'src/app/components/CredentialsCard.tsx'),
    'utf8',
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  it('hardcodes no capability key', () => {
    for (const key of ['postgres', 'mysql', 'mariadb', 'mongo', 'clamav', 'nats', 'server-user']) {
      expect(source.toLowerCase()).not.toContain(`'${key}`);
      expect(source.toLowerCase()).not.toContain(`"${key}`);
    }
  });

  it('hardcodes no port or scheme', () => {
    for (const literal of ['5432', '3306', '27017', '6379', '3310', '4222', "'ssh'", "'redis'"]) {
      expect(source).not.toContain(literal);
    }
  });
});
