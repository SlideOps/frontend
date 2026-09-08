import {
  ApiError,
  type Arrangement,
  type ArrangementCondition,
  type ArrangementDetail,
  type ArrangementQuote,
  type ArrangementStatus,
  type ArrangementUpdate,
  type ArrangementWithOperator,
} from '@slideops/api-client';
import { formatAmount } from './subscribers';

/*
 * How a payment arrangement is phrased on the Admin surface. Pure, so it is
 * testable without a screen, and so the wording lives in one place instead
 * of being scattered through the markup.
 */

export const conditionLabel: Record<ArrangementCondition, string> = {
  offline_settled: 'Offline payment',
  temporary_access: 'Temporary access',
  payment_required: 'Payment required',
  free_grant: 'Free grant',
};

export const conditionDescription: Record<ArrangementCondition, string> = {
  offline_settled: 'The customer already paid outside SlideOps; recorded for the trail.',
  temporary_access: 'Access granted on trust, ahead of payment, expected by the deadline.',
  payment_required: "A real checkout started on the customer's behalf, awaiting completion.",
  free_grant: 'Given at no charge, deliberately. Nothing is owed and nothing is collected.',
};

/** How urgently a deadline reads, and why. */
export type DeadlineUrgency = {
  label: string;
  tone: 'good' | 'warning' | 'bad' | 'neutral';
};

/** The window in which an approaching deadline is worth flagging. */
const deadlineSoonDays = 3;

/**
 * Read the urgency of a payment arrangement's deadline.
 *
 * Only meaningful while the arrangement is still awaiting payment: a completed,
 * expired, or cancelled arrangement has nothing left to warn about, and showing
 * "3 days left" on one that already completed would read as a live countdown on
 * a settled matter.
 */
export function deadlineUrgency(
  arrangement: Arrangement,
  now: Date = new Date(),
): DeadlineUrgency | null {
  if (arrangement.status !== 'awaiting_payment' || !arrangement.payment_deadline) {
    return null;
  }
  const ms = new Date(arrangement.payment_deadline).getTime() - now.getTime();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));

  if (days < 0) {
    return { label: 'Deadline passed', tone: 'bad' };
  }
  if (days === 0) {
    return { label: 'Due today', tone: 'bad' };
  }
  if (days <= deadlineSoonDays) {
    return { label: `Due in ${days} day${days === 1 ? '' : 's'}`, tone: 'warning' };
  }
  return { label: `Due in ${days} days`, tone: 'neutral' };
}

/** Whether this arrangement can still be cancelled or have its deadline moved. */
export function isEditable(arrangement: Arrangement): boolean {
  return arrangement.status === 'awaiting_payment';
}

/*
 * The three readings.
 *
 * Whether the customer has access, whether the payment arrived, and what they
 * owe and by when are three different questions with three different answers,
 * and an arrangement routinely answers them differently at the same moment.
 * Temporary access is exactly that case: access active, payment pending, a named
 * sum due on a named date. Collapsing those into one status is what makes an
 * admin open a record to find out something the list already knew.
 *
 * Where the backend states a reading itself, its words are shown. Where it does
 * not, the reading is derived from the condition and the status the list has
 * always carried, so nothing here waits on an endpoint to be useful.
 */

/** How one reading is phrased and how strongly it should be shown. */
export interface ArrangementReading {
  label: string;
  tone: 'good' | 'warning' | 'bad' | 'neutral';
  /** Why it reads that way, said rather than left to be inferred. */
  detail: string;
}

/** Whether the customer currently has access, independent of any payment. */
export type AccessStanding = 'granted' | 'not_granted' | 'ended' | 'revoked';

/** Whether the expected payment has arrived, independent of any access. */
export type PaymentStanding = 'settled' | 'pending' | 'overdue' | 'not_expected';

/**
 * The fields the readings need. A list row and a detail both satisfy it, so one
 * set of rules answers the same question on both screens and they cannot drift
 * apart.
 */
export interface ArrangementFacts {
  condition: ArrangementCondition;
  status: ArrangementStatus;
  amount_minor?: number | null;
  currency?: string;
  amount_applicable?: boolean;
  payment_deadline?: string;
  access_end?: string;
  /** The backend's own word for access, when it has one. */
  access_state?: string;
  /** The backend's own word for payment, when it has one. */
  payment_state?: string;
}

/** Read an Admin-wide list row. */
export function factsOfRow(row: ArrangementWithOperator): ArrangementFacts {
  return {
    condition: row.condition,
    status: row.status,
    amount_minor: row.amount_minor,
    currency: row.currency,
    payment_deadline: row.payment_deadline,
    access_end: row.access_end,
    access_state: row.access_state,
    payment_state: row.payment_state,
  };
}

/** Read one arrangement opened on its own. */
export function factsOfDetail(detail: ArrangementDetail): ArrangementFacts {
  return {
    condition: detail.arrangement.condition,
    status: detail.arrangement.status,
    amount_minor: detail.amount_minor,
    currency: detail.currency,
    amount_applicable: detail.amount_applicable,
    payment_deadline: detail.payment_deadline,
    access_end: detail.access_end,
    access_state: detail.access_state,
    payment_state: detail.payment_state,
  };
}

/** Turn a backend token such as `not_granted` into something readable. */
function humanize(token: string): string {
  const words = token.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
}

/** Backend access words this surface recognises, mapped onto a standing. */
const accessStateStandings: Record<string, AccessStanding> = {
  active: 'granted',
  granted: 'granted',
  none: 'not_granted',
  pending: 'not_granted',
  not_granted: 'not_granted',
  scheduled: 'not_granted',
  ended: 'ended',
  expired: 'ended',
  lapsed: 'ended',
  revoked: 'revoked',
};

/** Backend payment words this surface recognises, mapped onto a standing. */
const paymentStateStandings: Record<string, PaymentStanding> = {
  paid: 'settled',
  settled: 'settled',
  succeeded: 'settled',
  successful: 'settled',
  complete: 'settled',
  completed: 'settled',
  pending: 'pending',
  awaiting: 'pending',
  unpaid: 'pending',
  overdue: 'overdue',
  late: 'overdue',
  failed: 'overdue',
  not_expected: 'not_expected',
  none: 'not_expected',
  waived: 'not_expected',
  cancelled: 'not_expected',
  refunded: 'not_expected',
};

/** Whether a moment has already passed. */
function hasPassed(when: string | undefined, now: Date): boolean {
  return Boolean(when) && new Date(when as string).getTime() < now.getTime();
}

/**
 * Whether the customer has access right now.
 *
 * Temporary access grants first and asks for payment afterwards, so an
 * arrangement awaiting payment can perfectly well be one the customer is
 * already working under. A payment-required arrangement is the opposite: it
 * grants nothing until the payment lands.
 */
export function accessStandingOf(facts: ArrangementFacts, now: Date = new Date()): AccessStanding {
  const stated = facts.access_state ? accessStateStandings[facts.access_state] : undefined;
  if (stated) {
    return stated;
  }
  if (facts.status === 'expired') {
    return 'ended';
  }
  if (hasPassed(facts.access_end, now)) {
    return 'ended';
  }
  if (facts.condition === 'payment_required') {
    // Nothing is granted under this condition until the payment completes,
    // which is what makes it a different arrangement from a temporary grant.
    return facts.status === 'completed' || facts.status === 'active' ? 'granted' : 'not_granted';
  }
  if (facts.status === 'cancelled') {
    // Cancelling calls off the agreement. It does not itself take back access
    // already granted under it, which is a separate, deliberate decision.
    return 'granted';
  }
  return 'granted';
}

/** Whether the expected payment has arrived. */
export function paymentStandingOf(
  facts: ArrangementFacts,
  now: Date = new Date(),
): PaymentStanding {
  const stated = facts.payment_state ? paymentStateStandings[facts.payment_state] : undefined;
  if (stated) {
    return stated;
  }
  if (facts.condition === 'free_grant') {
    // A gift is not a payment that has failed to arrive. Reading it as pending
    // or overdue is what made a deliberate decision sit in every list as a debt.
    return 'not_expected';
  }
  if (facts.condition === 'offline_settled') {
    return 'settled';
  }
  if (facts.status === 'completed') {
    return 'settled';
  }
  if (facts.status === 'cancelled') {
    return 'not_expected';
  }
  if (facts.status === 'expired') {
    return 'overdue';
  }
  return hasPassed(facts.payment_deadline, now) ? 'overdue' : 'pending';
}

const accessStandingReadings: Record<AccessStanding, ArrangementReading> = {
  granted: {
    label: 'Active',
    tone: 'good',
    detail: 'The customer has access under this arrangement right now.',
  },
  not_granted: {
    label: 'Not granted',
    tone: 'neutral',
    detail: 'Access has not started. It begins when the payment completes.',
  },
  ended: {
    label: 'Ended',
    tone: 'bad',
    detail: 'Access under this arrangement has run out.',
  },
  revoked: {
    label: 'Revoked',
    tone: 'bad',
    detail: 'Access under this arrangement was deliberately taken back.',
  },
};

const paymentStandingReadings: Record<PaymentStanding, ArrangementReading> = {
  settled: {
    label: 'Paid',
    tone: 'good',
    detail: 'The expected payment has arrived.',
  },
  pending: {
    label: 'Pending',
    tone: 'warning',
    detail: 'The expected payment has not arrived yet.',
  },
  overdue: {
    label: 'Overdue',
    tone: 'bad',
    detail: 'The expected payment has not arrived and its deadline has passed.',
  },
  not_expected: {
    label: 'Not expected',
    tone: 'neutral',
    detail: 'No payment is expected under this arrangement.',
  },
};

/** The first reading: whether the customer currently has access. */
export function accessReading(facts: ArrangementFacts, now: Date = new Date()): ArrangementReading {
  const standing = accessStandingOf(facts, now);
  const base = accessStandingReadings[standing];
  // An unfamiliar word from the backend is shown as the backend said it rather
  // than being rewritten into one of ours, which would be a claim we cannot make.
  if (facts.access_state && !accessStateStandings[facts.access_state]) {
    return {
      label: humanize(facts.access_state),
      tone: 'neutral',
      detail: `The server reports access as "${facts.access_state}".`,
    };
  }
  return base;
}

/** The second reading: whether the expected payment has arrived. */
export function paymentReading(
  facts: ArrangementFacts,
  now: Date = new Date(),
): ArrangementReading {
  const standing = paymentStandingOf(facts, now);
  if (facts.condition === 'free_grant' && standing === 'not_expected') {
    return {
      label: 'No charge',
      tone: 'good',
      detail: 'This access was given deliberately at no charge, so nothing is owed.',
    };
  }
  if (facts.payment_state && !paymentStateStandings[facts.payment_state]) {
    return {
      label: humanize(facts.payment_state),
      tone: 'neutral',
      detail: `The server reports payment as "${facts.payment_state}".`,
    };
  }
  return paymentStandingReadings[standing];
}

/**
 * The third reading: what is owed and by when.
 *
 * `unknown` is a real answer and is never rendered as a zero. A zero on a
 * screen reads as "owes nothing", which is a statement about the customer's
 * account that nobody made.
 */
export type Obligation =
  | { kind: 'due'; amountMinor: number; currency?: string; deadline?: string }
  | { kind: 'settled'; amountMinor: number; currency?: string }
  /** Given away on purpose. A decision, and never rendered as a zero owed. */
  | { kind: 'free'; reason: string }
  | { kind: 'none'; reason: string }
  | { kind: 'unknown'; reason: string };

/** What this arrangement obliges the customer to pay, and by when. */
export function obligationOf(facts: ArrangementFacts, now: Date = new Date()): Obligation {
  if (facts.condition === 'free_grant') {
    // Checked before any amount, so a zero the backend happens to carry can
    // never be shown as an obligation of nothing rather than as no obligation.
    return { kind: 'free', reason: 'This access was given at no charge, deliberately.' };
  }
  if (facts.amount_applicable === false) {
    return { kind: 'none', reason: 'This arrangement carries no payment.' };
  }
  if (facts.status === 'cancelled') {
    return { kind: 'none', reason: 'This arrangement was called off.' };
  }
  const amount = facts.amount_minor;
  if (amount === undefined || amount === null) {
    return { kind: 'unknown', reason: 'No amount has been recorded for this arrangement.' };
  }
  if (amount === 0) {
    // A zero here is the placeholder an arrangement carries when it was never
    // priced, not a customer who owes nothing, so it is reported as the absence
    // it is and an admin is told to set the amount.
    return { kind: 'unknown', reason: 'No amount has been recorded for this arrangement.' };
  }
  if (paymentStandingOf(facts, now) === 'settled') {
    return { kind: 'settled', amountMinor: amount, currency: facts.currency };
  }
  return {
    kind: 'due',
    amountMinor: amount,
    currency: facts.currency,
    deadline: facts.payment_deadline,
  };
}

/** How an obligation reads in one line, money formatted in its own currency. */
export function obligationText(obligation: Obligation): string {
  if (obligation.kind === 'unknown') {
    return 'Amount not recorded';
  }
  if (obligation.kind === 'free') {
    return 'No charge';
  }
  if (obligation.kind === 'none') {
    return 'Nothing owed';
  }
  const money = formatAmount(obligation.amountMinor, obligation.currency);
  if (obligation.kind === 'settled') {
    return `${money} paid`;
  }
  return obligation.deadline
    ? `${money} due by ${new Date(obligation.deadline).toLocaleDateString()}`
    : `${money} due`;
}

/**
 * Why an obligation reads as it does, for the kinds that are an explanation
 * rather than a figure. A figure speaks for itself; "nothing owed" does not.
 */
export function obligationReason(obligation: Obligation): string | null {
  return obligation.kind === 'unknown' ||
    obligation.kind === 'none' ||
    obligation.kind === 'free'
    ? obligation.reason
    : null;
}

/** The tone an obligation should be shown in, matching the other two readings. */
export function obligationTone(
  obligation: Obligation,
  facts: ArrangementFacts,
  now: Date = new Date(),
): ArrangementReading['tone'] {
  if (obligation.kind === 'unknown' || obligation.kind === 'none') {
    return 'neutral';
  }
  // A gift reads as good rather than neutral: it is a decision that went the
  // customer's way, not the absence of information.
  if (obligation.kind === 'free' || obligation.kind === 'settled') {
    return 'good';
  }
  return paymentStandingOf(facts, now) === 'overdue' ? 'bad' : 'warning';
}

/*
 * Narrowing the list.
 *
 * The condition and status selects query the backend and page with it. These
 * two narrow the page already on screen, which is what makes them instant and
 * what makes them honest about their scope: they cannot claim to have searched
 * arrangements the server has not sent.
 */

export type ArrangementLifecycleFilter =
  | 'all'
  | 'active'
  | 'pending_payment'
  | 'expiring_soon'
  | 'expired'
  | 'revoked'
  | 'paid'
  | 'unpaid';

export const lifecycleFilterOptions: {
  value: ArrangementLifecycleFilter;
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending_payment', label: 'Pending payment' },
  { value: 'expiring_soon', label: 'Expiring soon' },
  { value: 'expired', label: 'Expired' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
];

/** The window in which an arrangement is worth calling out as expiring. */
const expiringSoonDays = 7;

/** Days from now until a moment, negative once it has passed. */
function daysUntil(when: string, now: Date): number {
  return Math.ceil((new Date(when).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

/** Whether one arrangement belongs under a lifecycle filter. */
export function matchesLifecycleFilter(
  facts: ArrangementFacts,
  filter: ArrangementLifecycleFilter,
  now: Date = new Date(),
): boolean {
  if (filter === 'all') {
    return true;
  }
  const access = accessStandingOf(facts, now);
  const payment = paymentStandingOf(facts, now);

  switch (filter) {
    case 'active':
      return access === 'granted';
    case 'pending_payment':
      return payment === 'pending';
    case 'expired':
      return access === 'ended';
    case 'revoked':
      return access === 'revoked';
    case 'paid':
      return payment === 'settled';
    case 'unpaid':
      // Everything still owed, whether or not its deadline has passed. Pending
      // payment is the subset that has not yet run late.
      return payment === 'pending' || payment === 'overdue';
    case 'expiring_soon': {
      if (access !== 'granted' && payment !== 'pending') {
        return false;
      }
      const moments = [facts.access_end, facts.payment_deadline].filter(Boolean) as string[];
      return moments.some((moment) => {
        const days = daysUntil(moment, now);
        return days >= 0 && days <= expiringSoonDays;
      });
    }
  }
}

/**
 * Whether a row answers a typed search, across the customer, their email, the
 * plan, and the amount. The amount is matched both as it is stored and as it is
 * displayed, so typing what is on the screen finds the row that shows it.
 */
export function matchesArrangementSearch(row: ArrangementWithOperator, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const amount = row.amount_minor;
  const haystack = [
    row.operator_email,
    row.operator_id,
    row.tier,
    conditionLabel[row.condition],
    row.status,
    amount === undefined || amount === null ? '' : String(amount),
    amount ? formatAmount(amount, row.currency) : '',
    row.currency ?? '',
  ]
    .join(' ')
    .toLowerCase();

  if (haystack.includes(needle)) {
    return true;
  }
  // Money is read with separators and typed without them, or the other way
  // around, and neither should miss the row that is plainly on the screen.
  const plain = (value: string) => value.replace(/[\s,]/g, '');
  return plain(haystack).includes(plain(needle));
}

/*
 * Editing one arrangement.
 *
 * An edit sends the fields that changed and nothing else, so the audit trail
 * records a correction rather than a rewrite, and so two admins editing
 * different fields do not overwrite each other's work with stale values they
 * never looked at.
 */

/** The edit form's values, as typed. Amounts are in minor units, as the API takes them. */
export interface ArrangementEditDraft {
  tier: string;
  amountMinor: string;
  currency: string;
  /** A local datetime as an `<input type="datetime-local">` produces it, or empty. */
  paymentDeadline: string;
  accessEnd: string;
  notes: string;
}

/** One field an edit would change, phrased for the confirmation before saving. */
export interface ArrangementFieldChange {
  field: keyof ArrangementEditDraft;
  label: string;
  from: string;
  to: string;
}

/** What an edit would change, and the patch that would change it. */
export interface ArrangementEdit {
  changes: ArrangementFieldChange[];
  patch: ArrangementUpdate;
}

const editFieldLabels: Record<keyof ArrangementEditDraft, string> = {
  tier: 'Plan',
  amountMinor: 'Amount',
  currency: 'Currency',
  paymentDeadline: 'Payment deadline',
  accessEnd: 'Access ends',
  notes: 'Internal notes',
};

/** How a value reads in the summary, with a name for the absence of one. */
function shownValue(field: keyof ArrangementEditDraft, value: string, currency: string): string {
  if (!value) {
    return 'Not set';
  }
  if (field === 'amountMinor') {
    const minor = Number(value);
    return Number.isFinite(minor) ? formatAmount(minor, currency || undefined) : value;
  }
  if (field === 'paymentDeadline' || field === 'accessEnd') {
    const when = new Date(value);
    return Number.isNaN(when.getTime()) ? value : when.toLocaleString();
  }
  return value;
}

/**
 * Compare what was loaded with what is now in the form.
 *
 * A blank amount is left out of the patch rather than sent as a zero: an admin
 * who cleared the box has not told us the customer owes nothing.
 */
export function arrangementEdit(
  before: ArrangementEditDraft,
  after: ArrangementEditDraft,
): ArrangementEdit {
  const changes: ArrangementFieldChange[] = [];
  const patch: ArrangementUpdate = {};

  const fields = Object.keys(editFieldLabels) as (keyof ArrangementEditDraft)[];
  for (const field of fields) {
    if (before[field] === after[field]) {
      continue;
    }
    if (field === 'amountMinor' && !Number.isFinite(Number(after[field]))) {
      continue;
    }
    if (field === 'amountMinor' && after[field].trim() === '') {
      continue;
    }
    changes.push({
      field,
      label: editFieldLabels[field],
      from: shownValue(field, before[field], before.currency),
      to: shownValue(field, after[field], after.currency),
    });

    switch (field) {
      case 'tier':
        patch.tier = after.tier;
        break;
      case 'amountMinor':
        patch.amountMinor = Math.trunc(Number(after.amountMinor));
        break;
      case 'currency':
        patch.currency = after.currency;
        break;
      case 'paymentDeadline':
        patch.paymentDeadline = after.paymentDeadline ? new Date(after.paymentDeadline) : null;
        break;
      case 'accessEnd':
        patch.accessEnd = after.accessEnd ? new Date(after.accessEnd) : null;
        break;
      case 'notes':
        patch.notes = after.notes;
        break;
    }
  }

  return { changes, patch };
}

/**
 * What to say when the arrangement moved under the editor.
 *
 * Never a silent retry and never an overwrite: the admin is told plainly that
 * somebody else changed it, that nothing of theirs was saved, and what to do.
 */
export const staleEditorMessage =
  'This arrangement changed since you opened it, so nothing was saved. Reload it to see the current state, then make your change again.';

/** Whether a failure is the backend refusing a stale revision. */
export function isStaleEditorError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

/**
 * Read something the running server may not have yet, and report its absence as
 * an absence rather than as a failure.
 *
 * The lifecycle endpoints are being added to the backend now. Until a given
 * deployment has them, the section that needs one says so quietly instead of
 * taking the page down. A real "no such arrangement" still throws: the backend
 * sends an error envelope with its own code for that, whereas a route the server
 * does not have produces a 404 with nothing to read.
 */
export async function readIfSupported<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.code === 'unknown_error') {
      return null;
    }
    throw error;
  }
}

/** What a section says when this deployment has not got the endpoint behind it yet. */
export const notOnThisServerYet =
  'This server build does not have this yet. Everything else on the page is unaffected.';

/*
 * What an arrangement costs, and how that figure is said.
 *
 * The amount is never typed for an obligation. A customer paying for themselves
 * chooses a plan and a billing period and the price follows from the price
 * table, the annual discount, the exchange rate and the tax; an admin arranging
 * the same access on their behalf gets the same figure from the same place. All
 * of the arithmetic stays on the backend, so what follows only phrases what came
 * back.
 */

/**
 * The billing periods the product already sells, offered wherever a term is
 * entered so the common ones are one keystroke away. The term itself is a plain
 * month count, because an arrangement made by hand is not obliged to match a
 * self serve billing period.
 */
export const billingPeriodMonths: number[] = [1, 12, 24, 36];

/** A month count, written out. */
export function termText(months: number): string {
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

/** One line of a quote's breakdown. */
export interface QuoteLine {
  label: string;
  value: string;
  /** True for the line that is the figure itself, so it can be shown as such. */
  total?: boolean;
}

/**
 * The lines behind a quoted amount, in the order they add up.
 *
 * A total on its own is not enough to act on. An admin who cannot see the
 * monthly price, the term it was multiplied by, what the annual discount took
 * off and what tax was added has no way to check the figure or to explain it to
 * the customer, and this is money.
 */
export function quoteLines(quote: ArrangementQuote): QuoteLine[] {
  if (quote.free_grant) {
    // A gift is priced at nothing because somebody decided so, which is a
    // different fact from a tier that carries no price, and reads differently.
    return [
      { label: 'Term', value: termText(quote.term_months) },
      { label: 'Total', value: 'Free', total: true },
    ];
  }
  if (!quote.purchasable) {
    return [
      { label: 'Term', value: termText(quote.term_months) },
      { label: 'Total', value: 'No charge', total: true },
    ];
  }

  const lines: QuoteLine[] = [
    {
      label: 'Monthly price',
      value: formatAmount(quote.unit_amount_minor, quote.native_currency),
    },
    { label: 'Term', value: termText(quote.term_months) },
    { label: 'Subtotal', value: formatAmount(quote.subtotal_minor, quote.currency) },
  ];
  if (quote.annual_discount_minor > 0) {
    lines.push({
      label: 'Annual discount',
      value: `-${formatAmount(quote.annual_discount_minor, quote.currency)}`,
    });
  }
  lines.push({ label: 'Tax', value: formatAmount(quote.tax_minor, quote.currency) });
  lines.push({
    label: 'Total',
    value: formatAmount(quote.total_minor, quote.currency),
    total: true,
  });
  return lines;
}

/**
 * How a converted quote says so.
 *
 * The rate is named rather than folded silently into the total, because the
 * figure has to be explainable on the day it was quoted and a rate moves.
 */
export function quoteConversionNote(quote: ArrangementQuote): string | null {
  if (quote.free_grant || !quote.fx_rate || quote.currency === quote.native_currency) {
    return null;
  }
  return `Converted from ${quote.native_currency} at 1 ${quote.native_currency} = ${quote.fx_rate.toLocaleString()} ${quote.currency}, the rate at the moment this was quoted.`;
}

/**
 * Why a gift costs nothing.
 *
 * Said in terms of the decision rather than the absence of a price, so it never
 * reads as the same thing as a tier that has no price to begin with.
 */
export function freeGrantReason(quote: ArrangementQuote): string {
  return `${quote.tier} is being given away at no charge. The tier is deliberately not priced for this, so there is no figure to show and none to collect.`;
}

/** Why a tier with no self serve price quotes as nothing. */
export function noChargeReason(quote: ArrangementQuote): string {
  return `${quote.tier} has no self serve price, so this arrangement carries no charge. That is a real arrangement, not a missing figure.`;
}

/** The backend's code for a currency this deployment cannot charge in. */
export const unsupportedCurrencyCode = 'currency_unsupported';

/** Whether a failure is the backend refusing the chosen currency. */
export function isUnsupportedCurrencyError(error: unknown): boolean {
  return error instanceof ApiError && error.code === unsupportedCurrencyCode;
}

/**
 * What to say when a quote could not be worked out.
 *
 * A refused currency is shown as what it is, together with what this deployment
 * will actually take, so the next choice is an informed one rather than a guess.
 */
export function quoteFailureText(error: ApiError, available: string[]): string {
  if (isUnsupportedCurrencyError(error) && available.length > 0) {
    return `${error.message} This deployment can charge in ${available.join(', ')}.`;
  }
  return error.message;
}

/**
 * What to say when the amount could not be worked out at all.
 *
 * Falling back to a typed number here is exactly the drift this exists to
 * remove, so nothing is saved instead.
 */
export const quoteUnavailableMessage =
  'The amount could not be worked out, so this cannot be saved. What the customer is expected to pay comes from the price table, never from a figure typed here.';

/**
 * How an entered payment differs from what the price table gives, when it does.
 *
 * An offline payment records what a customer actually paid, which may be a
 * partial payment, a negotiated figure, or a refund adjustment, so the amount
 * stays enterable there. Saying plainly that it differs is what stops a typo
 * being recorded as a fact.
 */
export function amountDifferenceNote(
  enteredMinor: number,
  quote: ArrangementQuote,
): string | null {
  if (!Number.isFinite(enteredMinor) || enteredMinor === quote.total_minor) {
    return null;
  }
  const quoted = quote.purchasable
    ? formatAmount(quote.total_minor, quote.currency)
    : 'no charge';
  const entered = formatAmount(enteredMinor, quote.currency);
  const direction = enteredMinor > quote.total_minor ? 'more than' : 'less than';
  return `${entered} is ${direction} the ${quoted} this plan and term price at. It is recorded exactly as entered.`;
}
