import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { SubscriberDetail } from './SubscriberDetail';

/*
 * The three ways an arrangement is created.
 *
 * The lifecycle console added around arrangements extends this page; it does not
 * replace it. What is held here is that the create flows still work exactly as
 * they did: the tier, the amount, the deadline, the term, the provider and the
 * currency all reach the API unchanged, and each flow still calls its own
 * endpoint rather than a shared one.
 */

const api = vi.hoisted(() => ({
  getSubscriber: vi.fn(),
  listArrangements: vi.fn(),
  recordOfflinePayment: vi.fn(),
  grantTemporaryAccess: vi.fn(),
  createPaymentRequiredArrangement: vi.fn(),
}));

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

const subscriber = {
  operator_id: 'op-1',
  email: 'chidi@example.test',
  account_tier: 'free',
  payments: 0,
  paid_minor: 0,
  payment_history: [],
};

const arrangement = {
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
};

beforeEach(() => {
  api.getSubscriber.mockReset().mockResolvedValue(subscriber);
  api.listArrangements.mockReset().mockResolvedValue([]);
  api.recordOfflinePayment.mockReset().mockResolvedValue(arrangement);
  api.grantTemporaryAccess
    .mockReset()
    .mockResolvedValue({ arrangement, checkout_url: 'https://pay.example.test/abc' });
  api.createPaymentRequiredArrangement
    .mockReset()
    .mockResolvedValue({ arrangement, checkout_url: 'https://pay.example.test/def' });
});

function renderScreen() {
  return renderInApp(
    <MemoryRouter initialEntries={['/admin/subscribers/op-1']}>
      <Routes>
        <Route path="/admin/subscribers/:id" element={<SubscriberDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Open one of the create dialogs and hand back its panel. */
async function openDialog(action: string): Promise<HTMLElement> {
  await userEvent.click(await screen.findByRole('button', { name: action }));
  return screen.getByRole('dialog');
}

describe('creating an arrangement from the subscriber page', () => {
  it('records a payment already made outside SlideOps, with its own tier, amount and currency', async () => {
    renderScreen();
    const dialog = await openDialog('Record offline payment');

    await userEvent.selectOptions(within(dialog).getByLabelText('Tier'), 'pro');
    await userEvent.type(within(dialog).getByLabelText('Amount (minor units)'), '15000000');
    await userEvent.clear(within(dialog).getByLabelText('Currency'));
    await userEvent.type(within(dialog).getByLabelText('Currency'), 'NGN');
    await userEvent.type(within(dialog).getByLabelText('Reference'), 'bank-transfer-9921');
    await userEvent.selectOptions(within(dialog).getByLabelText('Term paid for'), '12');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));

    await waitFor(() => expect(api.recordOfflinePayment).toHaveBeenCalledTimes(1));
    expect(api.recordOfflinePayment).toHaveBeenCalledWith(
      'op-1',
      expect.objectContaining({
        tier: 'pro',
        amountMinor: 15000000,
        currency: 'NGN',
        reference: 'bank-transfer-9921',
        termMonths: 12,
      }),
    );
  });

  it('grants access ahead of payment, with the deadline and the expiry choice made in the form', async () => {
    renderScreen();
    const dialog = await openDialog('Grant temporary access');

    await userEvent.selectOptions(within(dialog).getByLabelText('Tier'), 'pro');
    await userEvent.type(within(dialog).getByLabelText('Payment deadline'), '2126-09-22');
    await userEvent.click(
      within(dialog).getByLabelText(/Automatically expire access if the deadline passes/),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Grant access' }));

    await waitFor(() => expect(api.grantTemporaryAccess).toHaveBeenCalledTimes(1));
    // Non null: the waitFor above has already established there is a first call,
    // and destructuring a possibly-undefined tuple is what the compiler objects to.
    const [operatorId, input] = api.grantTemporaryAccess.mock.calls[0]!;
    expect(operatorId).toBe('op-1');
    expect(input.tier).toBe('pro');
    expect(input.autoExpireOnDeadline).toBe(true);
    expect(input.paymentDeadline?.toISOString()).toMatch(/^2126-09-22/);
  });

  it('starts a real checkout on the customer behalf and shows the link it came back with', async () => {
    renderScreen();
    const dialog = await openDialog('Start a checkout');

    await userEvent.selectOptions(within(dialog).getByLabelText('Provider'), 'flutterwave');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start checkout' }));

    await waitFor(() => expect(api.createPaymentRequiredArrangement).toHaveBeenCalledTimes(1));
    const [, input] = api.createPaymentRequiredArrangement.mock.calls[0]!;
    expect(input.provider).toBe('flutterwave');
    expect(await screen.findByText('https://pay.example.test/def')).toBeInTheDocument();
  });

  it('shows the backend message as it came when a create is refused', async () => {
    const { ApiError } = await import('@slideops/api-client');
    api.recordOfflinePayment.mockRejectedValue(
      new ApiError(400, 'invalid_amount', 'The amount must be greater than zero.'),
    );
    renderScreen();
    const dialog = await openDialog('Record offline payment');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));

    expect(await screen.findByText('The amount must be greater than zero.')).toBeInTheDocument();
  });
});
