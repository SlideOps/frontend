import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';

/*
 * Managing a workload that was already running.
 *
 * The bug worth pinning is the silent one. Adopting files a workload into a
 * Project, and with no Project chosen the handler returned before doing
 * anything: no request, no error, no change on screen. Pressing Manage did
 * nothing whatsoever, which reads as a broken button rather than as a missing
 * prerequisite, and there was nothing on screen to suggest a Project was even
 * involved.
 */

const adoptWorkload = vi.fn();
const listNodeWorkloads = vi.fn();
const listProjects = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  adoptWorkload: (...args: unknown[]) => adoptWorkload(...args),
  listNodeWorkloads: () => listNodeWorkloads(),
  listProjects: () => listProjects(),
}));

const { RunningHere } = await import('./RunningHere');

const workload = {
  ref: 'slideops-redis-1',
  name: 'slideops-redis-1',
  runtime: 'container',
  image: 'redis:7',
  status: 'running',
  adopted: false,
};

function show() {
  return renderInApp(
    <MemoryRouter>
      <RunningHere nodeId="n1" />
    </MemoryRouter>,
  );
}

describe('RunningHere', () => {
  beforeEach(() => {
    adoptWorkload.mockReset().mockResolvedValue({});
    listNodeWorkloads.mockResolvedValue([workload]);
    listProjects.mockResolvedValue([{ id: 'p1', name: 'SlideOps Infra' }]);
  });

  it('adopts into the chosen Project', async () => {
    const operator = userEvent.setup();
    show();

    await operator.click(await screen.findByRole('button', { name: 'Manage this' }));

    await waitFor(() =>
      expect(adoptWorkload).toHaveBeenCalledWith('n1', {
        project_id: 'p1',
        ref: 'slideops-redis-1',
        runtime: 'container',
        name: 'slideops-redis-1',
      }),
    );
  });

  it('shows which Project the workloads will be filed under, before acting', async () => {
    show();
    // The choice applies to every row, so it belongs above the list rather than
    // beside a button at the bottom.
    expect(await screen.findByLabelText('Project to manage these under')).toBeInTheDocument();
  });

  // The silent failure, pinned.
  it('says why nothing happened when there is no Project to file it into', async () => {
    listProjects.mockResolvedValue([]);
    show();

    expect(await screen.findByText(/you have none yet/)).toBeInTheDocument();
    // And the control does not sit there looking ready.
    const manage = await screen.findByRole('button', { name: 'Manage this' });
    expect(manage).toBeDisabled();
    expect(adoptWorkload).not.toHaveBeenCalled();
  });

  it('reports a refusal from the server rather than looking like it worked', async () => {
    const { ApiError } = await import('@slideops/api-client');
    adoptWorkload.mockRejectedValue(
      new ApiError(409, 'conflict', 'that workload is already managed'),
    );
    const operator = userEvent.setup();
    show();

    await operator.click(await screen.findByRole('button', { name: 'Manage this' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already managed');
  });

  it('says plainly that adopting changes nothing on the server', async () => {
    const operator = userEvent.setup();
    show();

    await operator.click(await screen.findByRole('button', { name: 'Manage this' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/kept running throughout/);
  });

  it('marks a workload SlideOps already manages instead of offering it again', async () => {
    listNodeWorkloads.mockResolvedValue([{ ...workload, adopted: true }]);
    show();

    expect(await screen.findByText('Managed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage this' })).not.toBeInTheDocument();
  });
});
