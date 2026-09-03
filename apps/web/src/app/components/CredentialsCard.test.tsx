import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Operation } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

/*
 * A database or cache installed directly on a Node is only ever reachable
 * from a container on that same Node at the Docker bridge address — never
 * the Node's own public address, which a correctly configured firewall keeps
 * such a service unreachable from on purpose. This is exactly the guessing
 * the Operator asked never to have to do again: both addresses, labelled,
 * whenever credentials are shown.
 */

const revealOperationSecret = vi.fn(async (..._a: unknown[]) => ({
  parameter: 'password',
  value: 's3cr3t',
}));

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  revealOperationSecret: (...a: unknown[]) => revealOperationSecret(...a),
}));

const { CredentialsCard } = await import('./CredentialsCard');

function postgresOperation(overrides: Partial<Operation> = {}): Operation {
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
    created_at: '2026-01-01T00:00:00Z',
    approved_at: null,
    started_at: null,
    completed_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Operation;
}

describe('CredentialsCard', () => {
  it('shows both the container and the public connection string when both hosts are known', async () => {
    renderInApp(
      <CredentialsCard
        operation={postgresOperation()}
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
    renderInApp(<CredentialsCard operation={postgresOperation()} dockerBridgeAddress="10.0.0.1" />);

    expect(
      await screen.findByText(/Connection string — from a container on this Node/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Connection string — from outside this Node/),
    ).not.toBeInTheDocument();
  });

  it('falls back to a single, unlabelled connection string when no Docker bridge address is known', async () => {
    renderInApp(<CredentialsCard operation={postgresOperation()} host="169.58.53.167" />);

    expect(await screen.findByText('Connection string')).toBeInTheDocument();
    expect(
      screen.queryByText(/Connection string — from a container on this Node/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('From a container')).not.toBeInTheDocument();
  });

  it('never shows a container connection string for an SSH server login, even when one is known', async () => {
    renderInApp(
      <CredentialsCard
        operation={postgresOperation({
          capability_key: 'manage-server-user',
          parameters: { username: 'deploy', password: '[stored securely]' },
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
        operation={postgresOperation()}
        host="169.58.53.167"
        dockerBridgeAddress="10.0.0.1"
      />,
    );

    const buttons = await screen.findAllByRole('button', {
      name: 'Reveal and copy connection string',
    });
    // The container block is rendered first.
    await userEvent.click(buttons[0]!);

    expect(await screen.findByText(/postgresql:\/\/app_user:s3cr3t@10\.0\.0\.1:5432\/app/)).toBeInTheDocument();
  });
});
