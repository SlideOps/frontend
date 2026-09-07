import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PreflightCheck } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

const diagnoseService = vi.fn();
const applyRemedy = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  diagnoseService: (...a: unknown[]) => diagnoseService(...a),
  applyRemedy: (...a: unknown[]) => applyRemedy(...a),
}));

const { ServiceDiagnosePanel } = await import('./ServiceDiagnosePanel');

/** The outage this whole surface exists for, as the backend reports it. */
const unreachableDependency: PreflightCheck = {
  name: 'Dependencies',
  status: 'fail',
  message:
    'MONGO_URI: 187.7.20.159:27017 did not answer within 4s. Dropped, not refused: a firewall is discarding the traffic.',
  remedy: {
    action: 'run_capability',
    title: 'Let this node reach the database on sali-database-server',
    detail: 'Runs Configure Database Access on sali-database-server.',
    capability_key: 'configure-database-access',
    node_id: 'db-node',
    node_name: 'sali-database-server',
    parameters: { source: '187.7.20.156/32', to_port: '27017', protocol: 'tcp' },
  },
};

beforeEach(() => {
  diagnoseService.mockReset();
  applyRemedy.mockReset();
});

describe('ServiceDiagnosePanel', () => {
  it('reports a failing check with the fix for it', async () => {
    diagnoseService.mockResolvedValue([unreachableDependency]);
    renderInApp(<ServiceDiagnosePanel serviceId="svc-1" />);

    await userEvent.click(screen.getByRole('button', { name: /run checks/i }));

    expect(await screen.findByText('Dependencies')).toBeInTheDocument();
    expect(screen.getByText(/1 problem found/i)).toBeInTheDocument();
    expect(
      screen.getByText('Let this node reach the database on sali-database-server'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fix this/i })).toBeInTheDocument();
  });

  it('applies the fix and re-checks, so the Operator never leaves for a terminal', async () => {
    diagnoseService.mockResolvedValue([unreachableDependency]);
    applyRemedy.mockResolvedValue('op-99');
    renderInApp(<ServiceDiagnosePanel serviceId="svc-1" />);

    await userEvent.click(screen.getByRole('button', { name: /run checks/i }));
    await userEvent.click(await screen.findByRole('button', { name: /fix this/i }));

    await waitFor(() => expect(applyRemedy).toHaveBeenCalledWith('svc-1', unreachableDependency.remedy));
    // The fix runs as an Operation, so the panel says what to follow.
    expect(await screen.findByText(/Follow it in History/i)).toBeInTheDocument();
    // And it looks again, rather than leaving a stale red row on screen.
    await waitFor(() => expect(diagnoseService).toHaveBeenCalledTimes(2));
  });

  it('offers no button for a check nothing can fix', async () => {
    diagnoseService.mockResolvedValue([
      { name: 'Workload', status: 'fail', message: 'The container is crash-looping.' },
    ]);
    renderInApp(<ServiceDiagnosePanel serviceId="svc-1" />);

    await userEvent.click(screen.getByRole('button', { name: /run checks/i }));

    expect(await screen.findByText('Workload')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fix this/i })).not.toBeInTheDocument();
  });

  it('says so when a check comes back clean', async () => {
    diagnoseService.mockResolvedValue([
      { name: 'Dependencies', status: 'pass', message: 'Reachable from this node.' },
    ]);
    renderInApp(<ServiceDiagnosePanel serviceId="svc-1" />);

    await userEvent.click(screen.getByRole('button', { name: /run checks/i }));

    expect(await screen.findByText(/nothing failing/i)).toBeInTheDocument();
  });

  it('reports a failure to run the check itself', async () => {
    diagnoseService.mockRejectedValue(new Error('node unreachable'));
    renderInApp(<ServiceDiagnosePanel serviceId="svc-1" />);

    await userEvent.click(screen.getByRole('button', { name: /run checks/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not run/i);
  });
});
