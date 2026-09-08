import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@slideops/api-client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { ArrangementDetail } from './ArrangementDetail';

/*
 * One arrangement's lifecycle.
 *
 * The properties worth holding here are the ones that protect a customer's
 * account: an edit says only what it changed, a second admin's change is never
 * overwritten, access is not taken away without a stated reason, and a preview
 * sends nothing.
 */

const api = vi.hoisted(() => ({
  getArrangement: vi.fn(),
  listArrangementTimeline: vi.fn(),
  listArrangementEmails: vi.fn(),
  listAdminTiers: vi.fn(),
  updateArrangement: vi.fn(),
  revokeArrangementAccess: vi.fn(),
  restoreArrangementAccess: vi.fn(),
  previewArrangementEmail: vi.fn(),
  sendArrangementEmail: vi.fn(),
  extendArrangementDeadline: vi.fn(),
}));

// The real ApiError is kept: the screen tells a stale editor and a missing
// endpoint apart by the status and code on it, so replacing it would test a
// stand-in instead of the behaviour.
vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

const detail = {
  arrangement: {
    id: 'arr-1',
    operator_id: 'op-1',
    tier: 'pro',
    amount_minor: 15000000,
    currency: 'NGN',
    condition: 'temporary_access',
    status: 'awaiting_payment',
    auto_expire_on_deadline: false,
    created_by_operator_id: 'admin-1',
    created_at: '2026-07-01T00:00:00Z',
    notes: 'Agreed on a call with their finance lead',
  },
  operator_id: 'op-1',
  operator_email: 'chidi@example.test',
  access_state: 'active',
  payment_state: 'pending',
  amount_minor: 15000000,
  currency: 'NGN',
  access_start: '2026-07-01T00:00:00Z',
  access_end: '2126-10-01T00:00:00Z',
  payment_deadline: '2126-09-22T00:00:00Z',
  updated_at: '2026-07-04T09:00:00Z',
  email_types: [
    { type: 'payment_reminder', label: 'Payment reminder', description: 'Asks them to pay.' },
  ],
};

beforeEach(() => {
  api.getArrangement.mockReset().mockResolvedValue(detail);
  api.listArrangementTimeline.mockReset().mockResolvedValue([
    {
      id: 'ev-1',
      action: 'arrangement.created',
      actor_email: 'admin@example.test',
      created_at: '2026-07-01T00:00:00Z',
    },
  ]);
  api.listArrangementEmails.mockReset().mockResolvedValue([
    {
      id: 'em-1',
      type: 'temporary_access_granted',
      to: 'chidi@example.test',
      outcome: 'sent',
      sent_at: '2026-07-01T00:05:00Z',
      sent_by_email: 'admin@example.test',
    },
  ]);
  api.listAdminTiers.mockReset().mockResolvedValue([
    { name: 'starter', currency: 'USD', amount_minor: 1900 },
    { name: 'pro', currency: 'NGN', amount_minor: 15000000 },
  ]);
  api.updateArrangement.mockReset().mockResolvedValue(detail);
  api.revokeArrangementAccess.mockReset().mockResolvedValue(detail);
  api.restoreArrangementAccess.mockReset().mockResolvedValue(detail);
  api.previewArrangementEmail.mockReset().mockResolvedValue({
    type: 'payment_reminder',
    to: 'chidi@example.test',
    subject: 'Your payment is due',
    body: 'Hello, the 150,000.00 for Pro is due on 22 September.',
  });
  api.sendArrangementEmail.mockReset().mockResolvedValue({
    id: 'em-2',
    type: 'payment_reminder',
    to: 'chidi@example.test',
    outcome: 'sent',
    sent_at: '2026-07-05T09:00:00Z',
  });
  api.extendArrangementDeadline.mockReset().mockResolvedValue(undefined);
});

function renderScreen() {
  return renderInApp(
    <MemoryRouter initialEntries={['/admin/arrangements/arr-1']}>
      <Routes>
        <Route path="/admin/arrangements/:id" element={<ArrangementDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Open the edit form and wait for it. */
async function openEditor() {
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  return screen.findByRole('button', { name: /Save changes/ });
}

describe('managing one arrangement', () => {
  it('reads access, payment and what is owed as three separate answers', async () => {
    renderScreen();
    await screen.findByRole('heading', { name: 'chidi@example.test' });

    const access = screen.getByText('Access').closest('div') as HTMLElement;
    const payment = screen.getByText('Payment').closest('div') as HTMLElement;
    const owed = screen.getByText('Owed').closest('div') as HTMLElement;

    expect(within(access).getByText('Active')).toBeInTheDocument();
    expect(within(payment).getByText('Pending')).toBeInTheDocument();
    expect(within(owed).getByText(/150,000/)).toBeInTheDocument();
  });

  it('marks an internal note as one the customer never sees', async () => {
    renderScreen();
    expect(
      await screen.findByText(/Internal note, never shown to the customer/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Agreed on a call with their finance lead/)).toBeInTheDocument();
  });

  it('sends only the fields the admin changed, with the revision it was read at', async () => {
    renderScreen();
    await openEditor();

    await userEvent.selectOptions(screen.getByLabelText('Plan'), 'starter');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(api.updateArrangement).toHaveBeenCalledTimes(1));
    expect(api.updateArrangement).toHaveBeenCalledWith(
      'arr-1',
      { tier: 'starter' },
      '2026-07-04T09:00:00Z',
    );
  });

  it('shows what is about to change before it is saved', async () => {
    renderScreen();
    await openEditor();
    await userEvent.selectOptions(screen.getByLabelText('Plan'), 'starter');
    expect(screen.getByText(/About to change 1 field/)).toBeInTheDocument();
    expect(screen.getByText(/Plan: pro becomes/)).toBeInTheDocument();
  });

  it('refuses to save when nothing was changed', async () => {
    renderScreen();
    const save = await openEditor();
    expect(save).toBeDisabled();
    expect(screen.getByText('Nothing has changed yet')).toBeInTheDocument();
  });

  it('tells the admin it changed under them and saves nothing, when the revision is refused', async () => {
    api.updateArrangement.mockRejectedValue(new ApiError(409, 'conflict', 'it moved'));
    renderScreen();
    await openEditor();

    await userEvent.selectOptions(screen.getByLabelText('Plan'), 'starter');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/changed since you opened it/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload it/ })).toBeInTheDocument();
    // One attempt, refused. Never a silent retry, never a resend of older values.
    expect(api.updateArrangement).toHaveBeenCalledTimes(1);
  });

  it('will not revoke access until a reason is typed, and states what is being taken away', async () => {
    renderScreen();
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/pro/)).toBeInTheDocument();
    expect(within(dialog).getByText(/chidi@example.test/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Outstanding: .*150,000/)).toBeInTheDocument();

    const confirm = within(dialog).getByRole('button', { name: 'Revoke access' });
    expect(confirm).toBeDisabled();
    await userEvent.click(confirm);
    expect(api.revokeArrangementAccess).not.toHaveBeenCalled();

    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Never paid');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke access' }));
    await waitFor(() =>
      expect(api.revokeArrangementAccess).toHaveBeenCalledWith(
        'arr-1',
        'Never paid',
        '2026-07-04T09:00:00Z',
      ),
    );
  });

  it('renders a message without sending it', async () => {
    renderScreen();
    await userEvent.click(await screen.findByRole('button', { name: /Preview/ }));

    expect(await screen.findByText(/Preview only. Nothing has been sent./)).toBeInTheDocument();
    expect(screen.getByText('Your payment is due')).toBeInTheDocument();
    expect(screen.getByText(/Hello, the 150,000.00 for Pro is due/)).toBeInTheDocument();
    expect(api.sendArrangementEmail).not.toHaveBeenCalled();
  });

  it('sends the message only when the send control is chosen, and says it changed nothing else', async () => {
    renderScreen();
    await userEvent.click(await screen.findByRole('button', { name: /Preview/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Send this message/ }));

    await waitFor(() =>
      expect(api.sendArrangementEmail).toHaveBeenCalledWith('arr-1', 'payment_reminder'),
    );
    expect(await screen.findByText(/Nothing else about this arrangement changed/)).toBeInTheDocument();
  });

  it('lists what was already sent to the customer, with who sent it and how it went', async () => {
    renderScreen();
    expect(await screen.findByText('temporary_access_granted')).toBeInTheDocument();
    const row = screen.getByText('temporary_access_granted').closest('tr') as HTMLElement;
    expect(within(row).getByText('sent')).toBeInTheDocument();
    expect(within(row).getByText('admin@example.test')).toBeInTheDocument();
  });

  it('shows the activity behind the arrangement', async () => {
    renderScreen();
    expect(await screen.findByText('arrangement.created')).toBeInTheDocument();
  });

  it('shows the backend message as it came, when a save is rejected for its own reason', async () => {
    api.updateArrangement.mockRejectedValue(
      new ApiError(400, 'invalid_amount', 'The amount must be greater than zero.'),
    );
    renderScreen();
    await openEditor();
    await userEvent.selectOptions(screen.getByLabelText('Plan'), 'starter');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('The amount must be greater than zero.'),
    ).toBeInTheDocument();
  });
});

describe('a server build without the lifecycle endpoints', () => {
  it('says so plainly instead of taking the page down', async () => {
    const missing = new ApiError(404, 'unknown_error', 'no route');
    api.getArrangement.mockRejectedValue(missing);
    api.listArrangementTimeline.mockRejectedValue(missing);
    api.listArrangementEmails.mockRejectedValue(missing);

    renderScreen();
    expect(
      await screen.findByText(/cannot be opened on this server build/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/still work from the Subscriber page/i)).toBeInTheDocument();
  });
});
