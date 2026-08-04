import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';

/*
 * The Service trail.
 *
 * The workload's output says what the application is saying right now. It cannot
 * say that somebody changed the environment nine minutes ago, which deploy
 * failed and why, or which commit is actually running. Those are the questions
 * asked during an incident, and the platform used to watch all of them happen
 * and write none of it down.
 */

const getServiceActivity = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getServiceActivity: (...args: unknown[]) => getServiceActivity(...args),
}));

const { ServiceActivityTrail } = await import('./ServiceActivity');

const entries = [
  {
    id: 'a3',
    kind: 'deploy.failed',
    message: 'The deploy failed.',
    outcome: 'failed',
    detail: { error: 'Could not parse SQLAlchemy URL from string ""' },
    created_at: '2026-07-31T09:14:00Z',
  },
  {
    id: 'a2',
    kind: 'config.changed',
    message: 'Environment added FRONTEND_URL; removed DATABASE_URL, SECRET_KEY.',
    outcome: 'ok',
    detail: { env: { added: ['FRONTEND_URL'], removed: ['DATABASE_URL', 'SECRET_KEY'] } },
    created_at: '2026-07-31T09:05:00Z',
  },
  {
    id: 'a1',
    kind: 'deploy.succeeded',
    message: 'Deployed, and the Service is running.',
    outcome: 'ok',
    detail: { commit: '4f2a1c9e8b7d6a5', domain: 'app.example.com' },
    created_at: '2026-07-30T18:00:00Z',
  },
];

describe('ServiceActivityTrail', () => {
  beforeEach(() => {
    getServiceActivity.mockReset().mockResolvedValue(entries);
  });

  it('reads the trail for the Service it is shown on', async () => {
    renderInApp(<ServiceActivityTrail id="svc-1" />);
    await waitFor(() => expect(getServiceActivity).toHaveBeenCalledWith('svc-1', 100, expect.anything()));
  });

  /*
   * This is the sequence that took an application down: a configuration change,
   * then a deploy that failed on an empty value. Read together it explains
   * itself, which is the entire reason the trail exists.
   */
  it('puts a failed deploy next to the change that preceded it', async () => {
    renderInApp(<ServiceActivityTrail id="svc-1" />);

    expect(await screen.findByText('The deploy failed.')).toBeInTheDocument();
    expect(screen.getByText(/removed DATABASE_URL, SECRET_KEY/)).toBeInTheDocument();
    expect(screen.getByText(/Could not parse SQLAlchemy URL/)).toBeInTheDocument();
  });

  // "Deployed at 18:00" answers very little. The commit is what says whether the
  // change somebody is looking for is actually in what is running.
  it('names the commit a deploy built from', async () => {
    renderInApp(<ServiceActivityTrail id="svc-1" />);
    expect(await screen.findByText(/4f2a1c9/)).toBeInTheDocument();
  });

  it('says plainly when there is nothing yet, rather than showing a blank', async () => {
    getServiceActivity.mockResolvedValue([]);
    renderInApp(<ServiceActivityTrail id="svc-1" />);
    expect(await screen.findByText(/Nothing recorded yet/)).toBeInTheDocument();
  });

  it('reports a failure to read the trail', async () => {
    const { ApiError } = await import('@slideops/api-client');
    getServiceActivity.mockRejectedValue(new ApiError(500, 'internal', 'the activity could not be read'));
    renderInApp(<ServiceActivityTrail id="svc-1" />);
    expect(await screen.findByText(/the activity could not be read/)).toBeInTheDocument();
  });

  it('can be reread without leaving the page', async () => {
    renderInApp(<ServiceActivityTrail id="svc-1" />);
    await screen.findByText('The deploy failed.');

    await userEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(getServiceActivity).toHaveBeenCalledTimes(2));
  });

  // An Operator pasting this into a support ticket wants the trail as text,
  // newest first, the same order it reads on screen.
  it('copies the trail as plain text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    renderInApp(<ServiceActivityTrail id="svc-1" />);
    await screen.findByText('The deploy failed.');

    await userEvent.click(screen.getByRole('button', { name: /copy the activity trail/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copied = writeText.mock.calls[0]![0] as string;
    expect(copied.split('\n')).toHaveLength(3);
    expect(copied).toContain('The deploy failed.');
    expect(copied).toContain('Deployed, and the Service is running.');

    vi.unstubAllGlobals();
  });
});
