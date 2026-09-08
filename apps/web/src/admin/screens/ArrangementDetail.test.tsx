import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
  listArrangementEmailTypes: vi.fn(),
  listAdminTiers: vi.fn(),
  listArrangementCurrencies: vi.fn(),
  quoteArrangement: vi.fn(),
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

/**
 * A quote the way the backend gives one: every figure already worked out, in
 * the currency it would be charged in, with the rate any conversion used.
 */
function quoteFor(input: { tier: string; termMonths?: number; currency?: string }) {
  const months = input.termMonths ?? 1;
  const charged = input.currency || 'USD';
  const subtotal = 100000 * months;
  const discount = months >= 12 ? 120000 : 0;
  return {
    tier: input.tier,
    term_months: months,
    native_currency: 'USD',
    unit_amount_minor: 4900,
    currency: charged,
    subtotal_minor: subtotal,
    annual_discount_minor: discount,
    tax_minor: 5000,
    total_minor: subtotal - discount + 5000,
    fx_rate: charged === 'USD' ? undefined : 1600,
    purchasable: true,
    free_grant: false,
  };
}

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
  api.listArrangementEmailTypes.mockReset().mockResolvedValue([
    { type: 'payment_reminder', label: 'Payment reminder', applicable: true },
    {
      type: 'access_revoked',
      label: 'Access revoked',
      applicable: false,
      reason: 'this arrangement has not ended, so telling the customer their access is gone would not be true',
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
    { name: 'starter', currency: 'USD', amount_minor: 1900, purchasable: true },
    { name: 'pro', currency: 'USD', amount_minor: 4900, purchasable: true },
  ]);
  api.listArrangementCurrencies.mockReset().mockResolvedValue(['USD', 'NGN']);
  api.quoteArrangement.mockReset().mockImplementation((_operatorId, input) =>
    Promise.resolve(quoteFor(input)),
  );
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

/*
 * What the customer is expected to pay.
 *
 * A customer paying for themselves never types an amount: they choose a plan and
 * a billing period and the figure follows from the price table, the annual
 * discount, the exchange rate and the tax. An admin arranging the same access on
 * their behalf was doing that arithmetic in their head, so the CRM's figure and
 * the real charge agreed only by luck. The properties held here are that the
 * figure is asked for rather than typed, that it arrives with everything it was
 * made of, and that it is never quietly wrong.
 *
 * Amounts are matched on their digits rather than their symbol, so a locale
 * decides how money is drawn without deciding whether the test passes.
 */

/** A quote this test holds in flight and releases by hand. */
function heldQuote() {
  let settle: (value: ReturnType<typeof quoteFor>) => void = () => {};
  const promise = new Promise<ReturnType<typeof quoteFor>>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

/**
 * Wait for the breakdown's own Total line to read this.
 *
 * Scoped to that line on purpose: the figure also appears in the summary of what
 * is about to change, and a bare text match cannot tell the two apart.
 */
async function expectTotal(pattern: RegExp) {
  await waitFor(() => {
    const total = screen.getByText('Total').closest('div') as HTMLElement;
    expect(within(total).getByText(pattern)).toBeInTheDocument();
  });
}

/** Open the editor and state the term, which is what turns the pricing on. */
async function priceFor(months: string, currency?: string) {
  await openEditor();
  if (currency) {
    await userEvent.selectOptions(screen.getByLabelText('Currency'), currency);
  }
  await userEvent.type(screen.getByLabelText('Term'), months);
}

describe('pricing an arrangement instead of typing an amount into it', () => {
  it('offers every currency the deployment can charge in, including one no tier is priced in', async () => {
    renderScreen();
    await openEditor();

    const currency = screen.getByLabelText('Currency') as HTMLSelectElement;
    const offered = Array.from(currency.options).map((option) => option.value);
    // Every tier above is priced in USD. Naira is offerable all the same,
    // because checkout converts, and only the server knows whether it can.
    expect(offered).toContain('NGN');
    expect(offered).toContain('USD');
    expect(api.listArrangementCurrencies).toHaveBeenCalled();
  });

  it('offers only currencies somebody can actually be charged in', async () => {
    renderScreen();
    await openEditor();

    const currency = screen.getByLabelText('Currency') as HTMLSelectElement;
    const offered = Array.from(currency.options).map((option) => option.value);

    // The empty choice used to read "The plan's own currency", which asked an
    // Admin to know what a plan is priced in before they could answer, and sat
    // in the list looking like a currency of its own.
    expect(offered).not.toContain('');
    for (const option of Array.from(currency.options)) {
      expect(option.textContent).not.toMatch(/own currency/i);
    }
  });

  it('starts on a real currency rather than on nothing', async () => {
    renderScreen();
    await openEditor();

    const currency = screen.getByLabelText('Currency') as HTMLSelectElement;
    expect(currency.value).not.toBe('');
    expect(['USD', 'NGN']).toContain(currency.value);
  });

  it('has no field for the admin to type the obligation into', async () => {
    renderScreen();
    await priceFor('12', 'USD');
    await screen.findByText('Monthly price');

    expect(screen.queryAllByLabelText(/amount/i)).toHaveLength(0);
  });

  it('asks the backend again when the plan changes', async () => {
    renderScreen();
    await priceFor('1');
    await waitFor(() => expect(api.quoteArrangement).toHaveBeenCalledTimes(1));
    expect(api.quoteArrangement.mock.calls[0]![1]).toMatchObject({ tier: 'pro' });

    await userEvent.selectOptions(screen.getByLabelText('Plan'), 'starter');
    await waitFor(() => expect(api.quoteArrangement).toHaveBeenCalledTimes(2));
    expect(api.quoteArrangement.mock.calls[1]![1]).toMatchObject({ tier: 'starter' });
  });

  it('asks the backend again when the term changes, and the figure follows it', async () => {
    renderScreen();
    await priceFor('1', 'USD');
    // One month: a 1,000.00 subtotal, no annual discount, 50.00 of tax.
    await expectTotal(/1,050\.00/);

    await userEvent.clear(screen.getByLabelText('Term'));
    await userEvent.type(screen.getByLabelText('Term'), '12');
    // Twelve months, less the annual discount, plus the same tax.
    await expectTotal(/10,850\.00/);
  });

  it('asks once for a term the admin typed a digit at a time', async () => {
    renderScreen();
    await priceFor('12', 'USD');
    await waitFor(() => expect(api.quoteArrangement).toHaveBeenCalledTimes(1));

    expect(api.quoteArrangement.mock.calls[0]![1]).toMatchObject({ termMonths: 12 });
  });

  it('shows the monthly price, the term, the discount, the tax and the total behind the figure', async () => {
    renderScreen();
    await priceFor('12', 'USD');

    expect(await screen.findByText('Monthly price')).toBeInTheDocument();
    // The monthly price stays in the currency the tier is written in.
    expect(screen.getByText(/49\.00/)).toBeInTheDocument();
    // Scoped to the breakdown's own Term line, because the term the admin
    // stated is now also named in the summary of what is about to change.
    const term = screen.getByText('Term', { selector: 'dt' }).closest('div') as HTMLElement;
    expect(within(term).getByText('12 months')).toBeInTheDocument();
    expect(screen.getByText('Annual discount')).toBeInTheDocument();
    expect(screen.getByText(/-.*1,200\.00/)).toBeInTheDocument();
    const tax = screen.getByText('Tax').closest('div') as HTMLElement;
    expect(within(tax).getByText(/50\.00/)).toBeInTheDocument();
    const total = screen.getByText('Total').closest('div') as HTMLElement;
    expect(within(total).getByText(/10,850\.00/)).toBeInTheDocument();
  });

  it('names the rate a converted figure was worked out at', async () => {
    renderScreen();
    // The arrangement was agreed in Naira, so this quote converts from the
    // tier's own USD price and has to say so.
    await priceFor('1');

    expect(await screen.findByText(/1 USD = 1,600 NGN/)).toBeInTheDocument();
    expect(screen.getByText(/the rate at the moment this was quoted/)).toBeInTheDocument();
  });

  it('reads a plan with no self serve price as no charge rather than as an error', async () => {
    api.quoteArrangement.mockResolvedValue({
      tier: 'enterprise',
      term_months: 1,
      native_currency: 'USD',
      unit_amount_minor: 0,
      currency: 'USD',
      subtotal_minor: 0,
      annual_discount_minor: 0,
      tax_minor: 0,
      total_minor: 0,
      purchasable: false,
      free_grant: false,
    });
    renderScreen();
    await priceFor('1');

    expect(await screen.findByText('No charge')).toBeInTheDocument();
    expect(screen.getByText(/no self serve price/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows what the backend said when the currency is one this deployment cannot charge', async () => {
    api.quoteArrangement.mockRejectedValue(
      new ApiError(400, 'currency_unsupported', 'This deployment cannot charge in NGN right now.'),
    );
    renderScreen();
    await priceFor('1');

    expect(
      await screen.findByText(/This deployment cannot charge in NGN right now\./),
    ).toBeInTheDocument();
    // And what it will take, so the next choice is informed rather than a guess.
    expect(screen.getByText(/can charge in USD, NGN/)).toBeInTheDocument();
  });

  it('will not save a figure that was never worked out, when the quote fails', async () => {
    api.quoteArrangement.mockRejectedValue(new ApiError(0, 'network_error', 'The network failed.'));
    renderScreen();
    await priceFor('1');
    await userEvent.selectOptions(screen.getByLabelText('Plan'), 'starter');

    expect(await screen.findByText(/could not be worked out/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(api.updateArrangement).not.toHaveBeenCalled();
  });

  it('never lets a slow quote for the plan that was on screen overwrite the one that is', async () => {
    const older = heldQuote();
    const newer = heldQuote();
    api.quoteArrangement
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise);

    renderScreen();
    await priceFor('1');
    await waitFor(() => expect(api.quoteArrangement).toHaveBeenCalledTimes(1));

    await userEvent.selectOptions(screen.getByLabelText('Plan'), 'starter');
    await waitFor(() => expect(api.quoteArrangement).toHaveBeenCalledTimes(2));

    newer.settle(quoteFor({ tier: 'starter', termMonths: 1, currency: 'NGN' }));
    await expectTotal(/1,050\.00/);

    // The answer to the question that is no longer being asked, arriving late.
    older.settle({
      ...quoteFor({ tier: 'pro', termMonths: 1, currency: 'NGN' }),
      total_minor: 9999900,
    });
    await expectTotal(/1,050\.00/);
    expect(screen.queryByText(/99,999\.00/)).toBeNull();
  });

  it('sends the figure the backend worked out, not one the admin wrote', async () => {
    renderScreen();
    await priceFor('12', 'USD');
    await expectTotal(/10,850\.00/);

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateArrangement).toHaveBeenCalledTimes(1));
    // The term goes with it: this arrangement recorded none, so stating one is
    // itself a correction, and it is what the figure was worked out from.
    expect(api.updateArrangement.mock.calls[0]![1]).toEqual({
      termMonths: 12,
      amountMinor: 1085000,
      currency: 'USD',
    });
  });
});

describe('an arrangement that was given away', () => {
  it('reads as no charge rather than as an amount nobody has paid', async () => {
    api.getArrangement.mockResolvedValue({
      ...detail,
      arrangement: { ...detail.arrangement, condition: 'free_grant', status: 'active' },
      access_state: 'active',
      payment_state: '',
      amount_minor: 0,
      currency: '',
      payment_deadline: undefined,
    });
    renderScreen();
    await screen.findByRole('heading', { name: 'chidi@example.test' });

    const payment = screen.getByText('Payment').closest('div') as HTMLElement;
    const owed = screen.getByText('Owed').closest('div') as HTMLElement;
    expect(within(payment).getByText('No charge')).toBeInTheDocument();
    expect(within(owed).getByText('No charge')).toBeInTheDocument();
    expect(within(owed).getByText(/given at no charge, deliberately/i)).toBeInTheDocument();

    // Never a zero, which would read as an obligation of nothing rather than
    // as no obligation at all.
    expect(screen.queryByText(/0\.00/)).toBeNull();
    expect(screen.queryByText(/Overdue/)).toBeNull();
  });
});

/*
 * The reported bug: an edit was made, Save was pressed twice, and nothing
 * happened at all. No save, no error, no message.
 *
 * The currency select moved a value the form was not comparing, so changing
 * only the currency registered as no change, Save stayed disabled, and a
 * disabled button says nothing about why it will not do anything.
 */
describe('an edit that appeared to do nothing', () => {
  it('counts a change of currency as a change, and saves it', async () => {
    renderScreen();
    await openEditor();

    const currency = (await screen.findByLabelText('Currency')) as HTMLSelectElement;
    const other = Array.from(currency.options)
      .map((option) => option.value)
      .find((value) => value && value !== currency.value);
    expect(other).toBeTruthy();

    await userEvent.selectOptions(currency, other as string);

    const save = screen.getByRole('button', { name: /save changes/i });
    expect(save).toBeEnabled();

    await userEvent.click(save);
    await waitFor(() => expect(api.updateArrangement).toHaveBeenCalledTimes(1));
  });

  it('says why it will not save, rather than refusing in silence', async () => {
    renderScreen();
    await openEditor();

    // Nothing has been touched yet, so Save cannot do anything. It must say so.
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    expect(await screen.findByText(/nothing has been changed yet/i)).toBeInTheDocument();
  });
})

/*
 * The term an arrangement was priced from.
 *
 * An arrangement now records how many months its amount covers, so reopening
 * one prices what it already says instead of asking the admin to restate it.
 * A zero is every arrangement agreed before the backend kept one: unknown, and
 * never a term of zero months that could be priced or shown as a fact.
 */

/** The same arrangement, agreed for a stated nine months. */
const detailWithTerm = {
  ...detail,
  arrangement: { ...detail.arrangement, term_months: 9 },
};

describe('an arrangement that remembers what its amount covers', () => {
  it('opens with the recorded term already stated and prices it without the admin typing anything', async () => {
    api.getArrangement.mockResolvedValue(detailWithTerm);
    renderScreen();
    await openEditor();

    expect((screen.getByLabelText('Term') as HTMLInputElement).value).toBe('9');
    await waitFor(() => expect(api.quoteArrangement).toHaveBeenCalledTimes(1));
    expect(api.quoteArrangement.mock.calls[0]![1]).toMatchObject({ termMonths: 9 });
    // Nine months at the price table, no annual discount, the same tax.
    await expectTotal(/9,050\.00/);
  });

  it('opens an arrangement that recorded no term with the term empty, and still saves the rest', async () => {
    renderScreen();
    await openEditor();

    expect((screen.getByLabelText('Term') as HTMLInputElement).value).toBe('');
    await userEvent.selectOptions(screen.getByLabelText('Plan'), 'starter');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(api.updateArrangement).toHaveBeenCalledTimes(1));
    expect(api.updateArrangement.mock.calls[0]![1]).toEqual({ tier: 'starter' });
    // Nothing was priced, because nothing said what there was to price.
    expect(api.quoteArrangement).not.toHaveBeenCalled();
  });

  it('re-quotes when the term changes, and the amount that is saved follows it', async () => {
    api.getArrangement.mockResolvedValue(detailWithTerm);
    renderScreen();
    await openEditor();
    await expectTotal(/9,050\.00/);

    await userEvent.clear(screen.getByLabelText('Term'));
    await userEvent.type(screen.getByLabelText('Term'), '12');
    await expectTotal(/10,850\.00/);

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateArrangement).toHaveBeenCalledTimes(1));
    expect(api.updateArrangement.mock.calls[0]![1]).toMatchObject({
      termMonths: 12,
      amountMinor: 1085000,
    });
  });

  it('prevents a negative term and says why, rather than leaving the backend to refuse it', async () => {
    renderScreen();
    await openEditor();

    fireEvent.change(screen.getByLabelText('Term'), { target: { value: '-3' } });

    const save = screen.getByRole('button', { name: 'Save changes' });
    await waitFor(() => expect(save).toBeDisabled());
    expect(screen.getAllByText(/cannot be negative/i).length).toBeGreaterThan(0);

    await userEvent.click(save);
    expect(api.updateArrangement).not.toHaveBeenCalled();
  });
});

describe('everything on the record being correctable, not just the money', () => {
  it('names the access start, the auto expire, the external reference and the paid at in the summary, and sends them', async () => {
    renderScreen();
    await openEditor();

    fireEvent.change(screen.getByLabelText('Access starts'), {
      target: { value: '2026-07-15T09:30' },
    });
    fireEvent.change(screen.getByLabelText('Paid at'), {
      target: { value: '2026-07-16T10:00' },
    });
    await userEvent.type(screen.getByLabelText('External reference'), 'bank-transfer-9931');
    await userEvent.click(screen.getByLabelText(/Expire access on its own/));

    expect(screen.getByText(/About to change 4 fields/)).toBeInTheDocument();
    expect(screen.getByText(/Access starts:/)).toBeInTheDocument();
    expect(screen.getByText(/External reference:/)).toBeInTheDocument();
    expect(screen.getByText(/Paid at:/)).toBeInTheDocument();
    expect(screen.getByText(/Expire when the deadline passes: No becomes/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateArrangement).toHaveBeenCalledTimes(1));
    expect(api.updateArrangement.mock.calls[0]![1]).toEqual({
      accessStart: new Date('2026-07-15T09:30'),
      paidAt: new Date('2026-07-16T10:00'),
      externalReference: 'bank-transfer-9931',
      autoExpireOnDeadline: true,
    });
  });

  it('says the external reference is the admin own record and is checked against nothing', async () => {
    renderScreen();
    await openEditor();

    expect(screen.getByText(/never checked against anything/i)).toBeInTheDocument();
  });

  it('does not offer what kind of arrangement this is as something to edit', async () => {
    renderScreen();
    await openEditor();

    // Changing a settled payment into a gift after the fact rewrites what
    // happened rather than correcting it, so the condition is not a field.
    const form = screen.getByText('Edit this arrangement').closest('div') as HTMLElement;
    expect(within(form).queryByLabelText(/condition/i)).toBeNull();
    expect(within(form).queryByLabelText(/arrangement type|kind of arrangement/i)).toBeNull();

    for (const control of within(form).queryAllByRole('combobox')) {
      for (const option of Array.from((control as HTMLSelectElement).options)) {
        expect(option.value).not.toMatch(
          /free_grant|offline_settled|temporary_access|payment_required/,
        );
      }
    }
  });
});

/*
 * The message types were never published, so the screen had nothing to offer,
 * no type was ever selected, and the control that sends returned immediately.
 * Pressing it did nothing whatsoever.
 */
describe('choosing a message to send', () => {
  it('offers the messages the server published for this arrangement', async () => {
    renderScreen();

    const chooser = (await screen.findByLabelText('Message type')) as HTMLSelectElement;
    const offered = Array.from(chooser.options).map((option) => option.value);
    expect(offered).toContain('payment_reminder');
    expect(api.listArrangementEmailTypes).toHaveBeenCalled();
  });

  it('opens on one that can actually be sent, not one the server would refuse', async () => {
    renderScreen();

    const chooser = (await screen.findByLabelText('Message type')) as HTMLSelectElement;
    expect(chooser.value).toBe('payment_reminder');
  });

  it('renders the message and then sends it when the send control is chosen', async () => {
    renderScreen();
    await screen.findByLabelText('Message type');

    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(api.previewArrangementEmail).toHaveBeenCalledTimes(1));

    await userEvent.click(await screen.findByRole('button', { name: /send this message/i }));
    await waitFor(() => expect(api.sendArrangementEmail).toHaveBeenCalledTimes(1));
  });

  it('says why a message that would not be true cannot be sent, instead of refusing in silence', async () => {
    renderScreen();
    const chooser = (await screen.findByLabelText('Message type')) as HTMLSelectElement;

    await userEvent.selectOptions(chooser, 'access_revoked');

    expect(await screen.findByText(/has not ended/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
  });
})
