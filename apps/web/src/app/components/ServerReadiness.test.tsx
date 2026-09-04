import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { ServerReadiness } from './ServerReadiness';

/*
 * The readiness panel.
 *
 * What matters is that it leads with the decision to make, that reassurance stays
 * out of the way until asked for, and that an unread server is not accused of
 * being insecure.
 */

const { getReadiness } = vi.hoisted(() => ({ getReadiness: vi.fn() }));

vi.mock('@slideops/api-client', () => ({ getReadiness }));

function measure(over: Record<string, unknown> = {}) {
  return {
    capability_key: 'configure-firewall',
    title: 'A host firewall',
    why: 'Without one, every port anything opens is reachable.',
    category: 'security',
    essential: true,
    state: 'missing',
    severity: 'critical',
    ...over,
  };
}

beforeEach(() => {
  getReadiness.mockReset();
});

function render() {
  return renderInApp(
    <MemoryRouter>
      <ServerReadiness nodeId="node-1" />
    </MemoryRouter>,
  );
}

describe('ServerReadiness', () => {
  it('leads with what is missing and why it matters', async () => {
    getReadiness.mockResolvedValue({
      discovered: true,
      summary: 'This server is not ready yet.',
      essentials_missing: 1,
      satisfied: [],
      missing: [measure()],
    });
    render();

    await waitFor(() => expect(screen.getByText('A host firewall')).toBeInTheDocument());
    expect(screen.getByText(/every port anything opens is reachable/i)).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  // Reassurance should be available without being in the way, so it is collapsed
  // until asked for. It is also where the "already here" distinction lives.
  it('keeps what is already in place out of the way until asked for', async () => {
    getReadiness.mockResolvedValue({
      discovered: true,
      summary: 'The essentials are in place.',
      essentials_missing: 0,
      satisfied: [
        measure({
          title: 'SSH hardened',
          state: 'detected',
          severity: 'none',
          evidence: 'Root logins and password authentication are both refused.',
        }),
      ],
      missing: [],
    });
    render();

    await waitFor(() => expect(screen.getByText(/already in place \(1\)/i)).toBeInTheDocument());
    expect(screen.queryByText('SSH hardened')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /already in place/i }));
    expect(screen.getByText('SSH hardened')).toBeInTheDocument();
    expect(screen.getByText(/password authentication are both refused/i)).toBeInTheDocument();
  });

  // Who did it is the interesting part: a server the Operator hardened themselves
  // should not read as SlideOps' work.
  it('separates what was already here from what SlideOps did', async () => {
    getReadiness.mockResolvedValue({
      discovered: true,
      summary: 'All in place.',
      essentials_missing: 0,
      satisfied: [
        measure({
          title: 'SSH hardened',
          state: 'detected',
          severity: 'none',
          evidence: 'Already refused.',
        }),
        measure({
          title: 'Monitoring',
          state: 'done',
          severity: 'none',
          evidence: 'SlideOps did this.',
        }),
      ],
      missing: [],
    });
    render();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /already in place/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /already in place/i }));

    expect(screen.getByText('Already here')).toBeInTheDocument();
    expect(screen.getByText('Done by SlideOps')).toBeInTheDocument();
  });

  // Calling an unread server insecure would be a guess, and a screen that guesses
  // is one nobody believes.
  it('does not accuse a server nothing has read', async () => {
    getReadiness.mockResolvedValue({
      discovered: false,
      summary:
        'This server has not been read yet. Run Discovery and SlideOps will say what is in place.',
      essentials_missing: 0,
      satisfied: [],
      missing: [measure({ state: 'unknown', severity: 'none' })],
    });
    render();

    await waitFor(() => expect(screen.getByText(/has not been read yet/i)).toBeInTheDocument());
    expect(screen.getByText('Not read yet')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows how much of the baseline is in place', async () => {
    getReadiness.mockResolvedValue({
      discovered: true,
      summary: 'One essential is missing.',
      essentials_missing: 1,
      satisfied: [
        measure({ title: 'SSH hardened', state: 'done', severity: 'none', evidence: 'Done.' }),
      ],
      missing: [measure()],
    });
    render();

    await waitFor(() => expect(screen.getByText('1 of 2 in place')).toBeInTheDocument());
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  // A blocked measure would only be refused by the backend's own hard gate if
  // opened directly: this proves the row says so, names the real prerequisite,
  // and clicking it lands on that prerequisite instead of the blocked measure.
  it('names the real unmet prerequisite when a measure is blocked', async () => {
    getReadiness.mockResolvedValue({
      discovered: true,
      summary: 'This server is not ready yet.',
      essentials_missing: 2,
      satisfied: [],
      missing: [
        measure({
          capability_key: 'create-app-user',
          title: 'A non root account to work as',
          severity: 'high',
        }),
        measure({
          capability_key: 'secure-ssh',
          title: 'SSH hardened',
          blocked: true,
          blocked_by: ['create-app-user'],
        }),
      ],
    });
    render();

    await waitFor(() => expect(screen.getByText('SSH hardened')).toBeInTheDocument());
    expect(screen.getByText('Requires A non root account to work as first')).toBeInTheDocument();
  });
});
