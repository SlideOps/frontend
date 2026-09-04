import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Readiness, ReadinessMeasure } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

/*
 * The guided path through a server's own readiness baseline, in dependency
 * order. It must read the exact same Blocked state the Capabilities tab and
 * the Operation engine's hard gate use, so it can never offer a step the
 * backend would refuse, and it must extend to the whole baseline rather than
 * stopping at the first three measures.
 */

const getReadiness = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getReadiness: (...a: unknown[]) => getReadiness(...a),
}));

const { SecureServer } = await import('./SecureServer');

function measure(overrides: Partial<ReadinessMeasure> = {}): ReadinessMeasure {
  return {
    capability_key: 'configure-firewall',
    title: 'A host firewall',
    why: 'Without one every port anything opens is reachable.',
    category: 'security',
    essential: true,
    state: 'missing',
    severity: 'critical',
    ...overrides,
  };
}

function report(overrides: Partial<Readiness> = {}): Readiness {
  return {
    discovered: true,
    summary: 'Some steps remain.',
    essentials_missing: 1,
    satisfied: [],
    missing: [],
    ...overrides,
  };
}

function show(data: Readiness) {
  getReadiness.mockResolvedValue(data);
  return renderInApp(
    <MemoryRouter>
      <SecureServer nodeId="n1" onDiscover={() => {}} discovering={false} onRotate={() => {}} />
    </MemoryRouter>,
  );
}

describe('SecureServer', () => {
  it('shows every baseline measure, not only the first three', async () => {
    show(
      report({
        missing: [
          measure({ capability_key: 'create-app-user', title: 'A non root account to work as' }),
          measure({
            capability_key: 'secure-ssh',
            title: 'SSH hardened',
            blocked: true,
            blocked_by: ['create-app-user'],
          }),
          measure({
            capability_key: 'configure-firewall',
            title: 'A host firewall',
            blocked: true,
            blocked_by: ['secure-ssh'],
          }),
          measure({
            capability_key: 'install-fail2ban',
            title: 'Brute force protection',
            blocked: true,
            blocked_by: ['configure-firewall'],
          }),
          measure({ capability_key: 'enable-auto-updates', title: 'Automatic security updates' }),
        ],
      }),
    );

    // The title appears twice for a ready measure (the heading, and the
    // start button's own label), so any match at all is enough here.
    expect((await screen.findAllByText('A non root account to work as')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('SSH hardened').length).toBeGreaterThan(0);
    expect(screen.getAllByText('A host firewall').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Brute force protection').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Automatic security updates').length).toBeGreaterThan(0);
  });

  it('shows a blocked measure with the real prerequisite name, no start action that would only be refused', async () => {
    show(
      report({
        missing: [
          measure({ capability_key: 'create-app-user', title: 'A non root account to work as' }),
          measure({
            capability_key: 'secure-ssh',
            title: 'SSH hardened',
            blocked: true,
            blocked_by: ['create-app-user'],
          }),
        ],
      }),
    );

    expect(
      await screen.findByRole('button', { name: /Complete A non root account to work as first/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'SSH hardened' })).not.toBeInTheDocument();
  });

  it('offers a normal start action for a measure that is ready, not blocked', async () => {
    show(
      report({
        missing: [
          measure({ capability_key: 'create-app-user', title: 'A non root account to work as' }),
        ],
      }),
    );

    expect(
      await screen.findByRole('button', { name: 'A non root account to work as' }),
    ).toBeInTheDocument();
  });

  it('offers the generated-key alternative only for create-app-user', async () => {
    show(
      report({
        missing: [
          measure({ capability_key: 'create-app-user', title: 'A non root account to work as' }),
          measure({ capability_key: 'enable-auto-updates', title: 'Automatic security updates' }),
        ],
      }),
    );

    await screen.findAllByText('A non root account to work as');
    expect(
      screen.getAllByRole('button', { name: 'Or create one with a generated key' }),
    ).toHaveLength(1);
  });

  it('offers to switch the connection only once both the account and SSH hardening are satisfied', async () => {
    show(
      report({
        satisfied: [
          measure({ capability_key: 'create-app-user', state: 'done' }),
          measure({ capability_key: 'secure-ssh', state: 'done' }),
        ],
        missing: [measure({ capability_key: 'configure-firewall' })],
      }),
    );

    expect(await screen.findByText('Switch to the new account')).toBeInTheDocument();
  });

  it('does not offer to switch the connection while the account or SSH hardening is still missing', async () => {
    show(report({ missing: [measure({ capability_key: 'create-app-user' })] }));

    await screen.findAllByText(/Run the quick check/);
    expect(screen.queryByText('Switch to the new account')).not.toBeInTheDocument();
  });
});
