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
  listAdminTiers: vi.fn(),
  listArrangementCurrencies: vi.fn(),
  quoteArrangement: vi.fn(),
  recordOfflinePayment: vi.fn(),
  grantTemporaryAccess: vi.fn(),
  createPaymentRequiredArrangement: vi.fn(),
  createFreeGrant: vi.fn(),
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

/**
 * A quote the way the backend gives one. Every tier here is priced in USD, so a
 * Naira figure can only come from a conversion the backend did.
 */
function quoteFor(input: {
  tier: string;
  termMonths?: number;
  currency?: string;
  free?: boolean;
}) {
  const months = input.termMonths ?? 1;
  if (input.free) {
    // The gift is never priced, so the real figure is not carried alongside
    // where a screen could show it or a save could pick it up.
    return {
      tier: input.tier,
      term_months: months,
      native_currency: 'USD',
      unit_amount_minor: 0,
      currency: '',
      subtotal_minor: 0,
      annual_discount_minor: 0,
      tax_minor: 0,
      total_minor: 0,
      purchasable: true,
      free_grant: true,
    };
  }
  const charged = input.currency || 'USD';
  const total = 1250000 * months;
  return {
    tier: input.tier,
    term_months: months,
    native_currency: 'USD',
    unit_amount_minor: 4900,
    currency: charged,
    subtotal_minor: total,
    annual_discount_minor: 0,
    tax_minor: 0,
    total_minor: total,
    fx_rate: charged === 'USD' ? undefined : 1600,
    purchasable: true,
    free_grant: false,
  };
}

beforeEach(() => {
  api.getSubscriber.mockReset().mockResolvedValue(subscriber);
  api.listArrangements.mockReset().mockResolvedValue([]);
  api.listAdminTiers.mockReset().mockResolvedValue([
    { name: 'starter', currency: 'USD', amount_minor: 1900, purchasable: true },
    { name: 'pro', currency: 'USD', amount_minor: 4900, purchasable: true },
    { name: 'enterprise', currency: 'USD', amount_minor: 0, purchasable: false },
  ]);
  api.listArrangementCurrencies.mockReset().mockResolvedValue(['USD', 'NGN']);
  api.quoteArrangement.mockReset().mockImplementation((_operatorId, input) =>
    Promise.resolve(quoteFor(input)),
  );
  api.recordOfflinePayment.mockReset().mockResolvedValue(arrangement);
  api.grantTemporaryAccess
    .mockReset()
    .mockResolvedValue({ arrangement, checkout_url: 'https://pay.example.test/abc' });
  api.createPaymentRequiredArrangement
    .mockReset()
    .mockResolvedValue({ arrangement, checkout_url: 'https://pay.example.test/def' });
  api.createFreeGrant
    .mockReset()
    .mockResolvedValue({ ...arrangement, condition: 'free_grant', amount_minor: 0 });
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
    await userEvent.selectOptions(within(dialog).getByLabelText('Currency'), 'NGN');
    await userEvent.clear(within(dialog).getByLabelText('Term paid for'));
    await userEvent.type(within(dialog).getByLabelText('Term paid for'), '12');
    await userEvent.type(within(dialog).getByLabelText('Reference'), 'bank-transfer-9921');
    // The figure is filled in from the price table rather than typed.
    await waitFor(() =>
      expect(
        within(dialog).getByLabelText('Amount actually paid (minor units)'),
      ).toHaveValue(15000000),
    );
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

/*
 * The figure, and the one place it is still the admin's to state.
 *
 * Everywhere an amount is an obligation it comes from the price table. The one
 * exception is a payment that already happened, which is a fact about what the
 * customer did rather than a price, and can legitimately be a partial payment, a
 * negotiated figure or a refund adjustment.
 */
describe('pricing an arrangement from the subscriber page', () => {
  it('offers the currencies the deployment published rather than a list written into the screen', async () => {
    renderScreen();
    const dialog = await openDialog('Record offline payment');

    const currency = within(dialog).getByLabelText('Currency') as HTMLSelectElement;
    const offered = Array.from(currency.options).map((option) => option.value);
    // Every tier above is priced in USD, so Naira can only have come from the
    // server saying what it is able to charge.
    expect(offered).toEqual(['USD', 'NGN']);
    expect(api.listArrangementCurrencies).toHaveBeenCalled();
  });

  it('records an offline payment for an amount that differs from the price, and says that it does', async () => {
    renderScreen();
    const dialog = await openDialog('Record offline payment');

    await userEvent.selectOptions(within(dialog).getByLabelText('Tier'), 'pro');
    const amount = within(dialog).getByLabelText('Amount actually paid (minor units)');
    await waitFor(() => expect(amount).toHaveValue(1250000));

    // What they actually sent, which is less than the price.
    await userEvent.clear(amount);
    await userEvent.type(amount, '1000000');
    await userEvent.type(within(dialog).getByLabelText('Reference'), 'bank-transfer-9921');

    expect(within(dialog).getByText(/is less than the/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(api.recordOfflinePayment).toHaveBeenCalledTimes(1));
    expect(api.recordOfflinePayment).toHaveBeenCalledWith(
      'op-1',
      expect.objectContaining({ amountMinor: 1000000 }),
    );
  });
});

/*
 * Giving access away, as a decision.
 *
 * Distinct from granting it ahead of a payment that is still expected. Both stay
 * possible, and the difference has to survive into the record: a gift recorded
 * as an unsettled grant is a debt nobody owes, sitting in every chasing list.
 */
describe('giving access at no charge', () => {
  /** Open the grant dialog and tick the gift box. */
  async function openGift(): Promise<HTMLElement> {
    const dialog = await openDialog('Grant temporary access');
    await userEvent.click(within(dialog).getByLabelText('Give this away at no charge'));
    return dialog;
  }

  it('reads as no charge and never prices the tier', async () => {
    renderScreen();
    const dialog = await openGift();

    expect(await within(dialog).findByText('Free')).toBeInTheDocument();
    expect(within(dialog).getByText(/deliberately not priced/)).toBeInTheDocument();
    // The real figure is never asked for, so it can never be shown by mistake.
    await waitFor(() => expect(api.quoteArrangement).toHaveBeenCalled());
    const asked = api.quoteArrangement.mock.calls.at(-1)![1];
    expect(asked.free).toBe(true);
    expect(asked.currency).toBeUndefined();
    expect(within(dialog).queryByText(/1,250\.00/)).toBeNull();
  });

  it('takes the currency choice away, rather than leaving a stale one showing', async () => {
    renderScreen();
    const dialog = await openDialog('Grant temporary access');
    expect(within(dialog).getByLabelText('Currency')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByLabelText('Give this away at no charge'));
    expect(within(dialog).queryByLabelText('Currency')).toBeNull();
  });

  it('goes through the free grant endpoint and never the temporary access one', async () => {
    renderScreen();
    const dialog = await openGift();

    await userEvent.selectOptions(within(dialog).getByLabelText('Tier'), 'pro');
    await userEvent.clear(within(dialog).getByLabelText('Term to grant'));
    await userEvent.type(within(dialog).getByLabelText('Term to grant'), '12');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Give access' }));

    await waitFor(() => expect(api.createFreeGrant).toHaveBeenCalledTimes(1));
    expect(api.createFreeGrant).toHaveBeenCalledWith(
      'op-1',
      expect.objectContaining({ tier: 'pro', termMonths: 12 }),
    );
    expect(api.grantTemporaryAccess).not.toHaveBeenCalled();
    expect(await screen.findByText(/Nothing is owed and nothing will be collected/)).toBeInTheDocument();
  });

  it('goes back to pricing the plan when the gift box is unticked', async () => {
    renderScreen();
    const dialog = await openGift();
    await within(dialog).findByText('Free');

    await userEvent.click(within(dialog).getByLabelText('Give this away at no charge'));

    expect(await within(dialog).findByText('Monthly price')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Currency')).toBeInTheDocument();
    const asked = api.quoteArrangement.mock.calls.at(-1)![1];
    expect(asked.free).toBeUndefined();
  });

  it('shows a free grant as no charge and never as an amount outstanding', async () => {
    api.listArrangements.mockResolvedValue([
      { ...arrangement, condition: 'free_grant', status: 'active', amount_minor: 0 },
    ]);
    renderScreen();

    const row = (await screen.findByText('Free grant')).closest('tr') as HTMLElement;
    expect(within(row).getByText('No charge')).toBeInTheDocument();
    expect(within(row).queryByText(/due/i)).toBeNull();
    expect(within(row).queryByText(/0\.00/)).toBeNull();
  });
});
