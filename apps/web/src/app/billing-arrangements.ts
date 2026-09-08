import type {
  ArrangementCondition,
  BillingArrangement,
  BillingArrangementStatus,
} from '@slideops/api-client';
import { formatMoney } from './billing-format';

/*
 * How an arrangement made for the Operator reads on their own Billing page.
 *
 * Pure, so the wording and the rules about what may be offered live in one
 * testable place instead of being scattered through markup. The Admin surface
 * has its own module for the same reason; this one speaks to the person who
 * owes the money rather than about them, and knows nothing an Admin keeps
 * private.
 */

/** A deadline three days out or closer is worth flagging rather than listing. */
const soonDays = 3;

const dayMs = 24 * 60 * 60 * 1000;

/** One date, written the way every other billing surface writes one. */
export function formatDay(when: Date): string {
  return when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** One date from the wire, or null when there is nothing readable there. A
 *  field the API omits and a field carrying a date nobody can parse are the
 *  same answer to a screen: there is no date to show. */
export function readDay(iso: string | undefined): string | null {
  if (!iso) {
    return null;
  }
  const when = new Date(iso);
  return Number.isNaN(when.getTime()) ? null : formatDay(when);
}

/**
 * The tier's name, cased for display straight from whatever the API said.
 *
 * Deliberately not a lookup table. A table would have to be edited every time a
 * tier is added, and until it was, a real tier would render as a raw token or,
 * worse, as some other tier's name.
 */
export function tierName(tier: string): string {
  const words = tier.replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
}

/** Whether this arrangement is still live, as opposed to already finished. */
export function isOpen(arrangement: BillingArrangement): boolean {
  return arrangement.status === 'awaiting_payment' || arrangement.status === 'active';
}

/**
 * Whether money is actually still expected.
 *
 * A free grant is never outstanding however it is phrased: it is a gift, not a
 * debt, and it must never appear as an amount owed or as a zero owed. Neither
 * is anything already settled, cancelled, expired, or revoked, and returning
 * somebody to a checkout for one of those would be worse than saying nothing.
 */
export function isOutstanding(arrangement: BillingArrangement): boolean {
  return arrangement.status === 'awaiting_payment' && arrangement.condition !== 'free_grant';
}

/**
 * Whether the Operator can be offered a way to finish paying.
 *
 * Requires a payment that already exists and can still be returned to. Without
 * a reference there is nothing to resume, and the one thing this panel must
 * never do is start a second charge beside a payment already waiting.
 */
export function canComplete(arrangement: BillingArrangement): boolean {
  // The server decides this, and says so in one field. It used to be worked out
  // here from `resumable` and the presence of a reference, which asks a
  // different question: whether a checkout is already open. An arrangement whose
  // price an Admin has just corrected has no open checkout, because the one
  // charging the old figure was voided, and it is exactly the arrangement the
  // customer most needs to be able to pay.
  //
  // `payable` is absent on a server that predates it, and the old reading is
  // what answers then. It is narrower rather than wrong: it offers no button
  // where the newer server would have offered one, which is the safe direction
  // to be out of date in.
  if (typeof arrangement.payable === 'boolean') {
    return arrangement.payable;
  }
  return (
    isOutstanding(arrangement) &&
    arrangement.resumable === true &&
    Boolean(arrangement.payment_reference)
  );
}

/** What the Operator was given, said plainly. */
export const conditionHeadline: Record<ArrangementCondition, string> = {
  temporary_access: 'Access granted ahead of payment',
  payment_required: 'Access granted, payment required',
  offline_settled: 'Payment recorded outside SlideOps',
  free_grant: 'Access given at no charge',
};

/** Why it exists, in the second person. */
export const conditionExplainer: Record<ArrangementCondition, string> = {
  temporary_access:
    'You were given this plan on trust, before paying, so you could get started right away.',
  payment_required: 'This plan was opened for you with a payment left for you to complete.',
  offline_settled: 'You paid for this plan outside SlideOps and it was recorded here.',
  free_grant: 'This plan was given to you deliberately, at no charge. There is nothing to pay.',
};

/** The statuses that mean an arrangement is over and carries no action. */
type EndedStatus = Extract<
  BillingArrangementStatus,
  'completed' | 'expired' | 'cancelled' | 'revoked'
>;

const endedSummaries: Record<EndedStatus, string> = {
  completed: 'Settled. Nothing is outstanding on it.',
  expired: 'Expired without payment.',
  cancelled: 'Cancelled. Nothing is owed on it.',
  revoked: 'Access on this arrangement was withdrawn.',
};

/** How a finished arrangement reads, in the past tense, with nothing to do. */
export function endedSummary(arrangement: BillingArrangement): string {
  return endedSummaries[arrangement.status as EndedStatus] ?? 'This arrangement is closed.';
}

/**
 * What the money line says.
 *
 * `free` and `unstated` are separate answers on purpose. Both would collapse
 * into a zero if this returned a number, and a zero says "you owe nothing",
 * which is true of the first and unknown of the second.
 */
export type AmountReading =
  { kind: 'free' } | { kind: 'unstated' } | { kind: 'amount'; text: string };

export function amountReading(arrangement: BillingArrangement): AmountReading {
  if (arrangement.condition === 'free_grant') {
    return { kind: 'free' };
  }
  if (typeof arrangement.amount_minor !== 'number') {
    return { kind: 'unstated' };
  }
  return { kind: 'amount', text: formatMoney(arrangement.amount_minor, arrangement.currency) };
}

/** How the deadline reads, and how loudly. */
export interface DeadlineReading {
  label: string;
  overdue: boolean;
  tone: 'neutral' | 'warning' | 'bad';
}

/**
 * Read the payment deadline, or nothing when there is none to read.
 *
 * Only an arrangement that still expects money has a deadline worth showing. A
 * date on a settled or gifted arrangement is a countdown on a matter that is
 * closed, which reads as a demand nobody can satisfy.
 */
export function deadlineReading(
  arrangement: BillingArrangement,
  now: Date = new Date(),
): DeadlineReading | null {
  if (!arrangement.payment_deadline || !isOutstanding(arrangement)) {
    return null;
  }
  const due = new Date(arrangement.payment_deadline);
  if (Number.isNaN(due.getTime())) {
    return null;
  }
  const day = formatDay(due);
  const remaining = due.getTime() - now.getTime();
  // Tested on the raw milliseconds rather than on whole days, so a deadline
  // that passed an hour ago reads as overdue and not as still due today.
  if (remaining < 0) {
    return { label: `Overdue since ${day}`, overdue: true, tone: 'bad' };
  }
  // Compared as calendar days rather than as elapsed hours, so a deadline late
  // tonight reads as today and one early tomorrow does not.
  if (due.toDateString() === now.toDateString()) {
    return { label: `Due today, ${day}`, overdue: false, tone: 'bad' };
  }
  const days = Math.ceil(remaining / dayMs);
  if (days <= soonDays) {
    return {
      label: `Due in ${days} day${days === 1 ? '' : 's'}, by ${day}`,
      overdue: false,
      tone: 'warning',
    };
  }
  return { label: `Due by ${day}`, overdue: false, tone: 'neutral' };
}

/** The arrangements still in force, which is what the panel leads with. */
export function openArrangements(arrangements: BillingArrangement[]): BillingArrangement[] {
  return arrangements.filter(isOpen);
}

/**
 * How many finished arrangements are worth keeping on the page.
 *
 * Enough to explain a recent change the Operator may be asking about, few
 * enough that a long-standing customer's Billing page does not turn into an
 * archive of settled matters.
 */
const endedShown = 3;

/** The most recent finished arrangements, as history only. */
export function endedArrangements(arrangements: BillingArrangement[]): BillingArrangement[] {
  return arrangements.filter((arrangement) => !isOpen(arrangement)).slice(0, endedShown);
}

/**
 * The arrangement's own status, as a label and a tone.
 *
 * The summary card never needed this: it says what an arrangement is by what it
 * offers to do about it. Opened in full, the status is one of the facts being
 * asked for, and "awaiting_payment" is not a thing to show a person.
 */
export interface StatusReading {
  label: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

const statusReadings: Record<BillingArrangementStatus, StatusReading> = {
  awaiting_payment: { label: 'Awaiting payment', tone: 'warning' },
  active: { label: 'Active', tone: 'success' },
  completed: { label: 'Settled', tone: 'success' },
  expired: { label: 'Expired', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  revoked: { label: 'Withdrawn', tone: 'danger' },
};

export function statusReading(arrangement: BillingArrangement): StatusReading {
  return statusReadings[arrangement.status] ?? { label: arrangement.status, tone: 'neutral' };
}

/**
 * How long the amount covers, in words, or null when nobody recorded a term.
 *
 * An absent term is not a term of one month. Arrangements made before the term
 * was stored carry none, and printing a month there would state a billing
 * period that was never agreed.
 */
export function termReading(arrangement: BillingArrangement): string | null {
  const months = arrangement.term_months;
  if (typeof months !== 'number' || months < 1) {
    return null;
  }
  if (months === 12) {
    return '1 year';
  }
  return `${months} month${months === 1 ? '' : 's'}`;
}

/**
 * When the access itself runs, which is deliberately not the payment deadline.
 *
 * Temporary access is exactly the case where the two differ: the plan may be
 * live for a month while the money is due on Friday. A customer asking what
 * they were actually given is asking about this one, and the summary card
 * shows only the other.
 */
export interface AccessReading {
  /** The period itself, as one line. */
  period: string;
  /** What that period means right now, when there is anything to say. */
  note: string | null;
}

export function accessReading(
  arrangement: BillingArrangement,
  now: Date = new Date(),
): AccessReading | null {
  const start = readDay(arrangement.access_start);
  const end = readDay(arrangement.access_end);
  if (!start && !end) {
    return null;
  }
  const period = start && end ? `${start} to ${end}` : (end ?? `From ${start}`);
  if (!end) {
    return { period, note: null };
  }

  const until = new Date(arrangement.access_end as string).getTime() - now.getTime();
  if (until < 0) {
    return { period, note: 'This access has ended.' };
  }
  // Whole days remaining, rounded up, so the last day of access reads as a day
  // left rather than as none.
  const days = Math.ceil(until / dayMs);
  return { period, note: `${days} day${days === 1 ? '' : 's'} of access left.` };
}

/**
 * What the customer should do about this, in one sentence.
 *
 * The card explains what the arrangement is; this answers the question that
 * follows, which is what is now expected of them. It is written from the same
 * facts the button is enabled from, so it can never tell somebody to pay
 * something the panel gives them no way to pay.
 */
export function nextStep(arrangement: BillingArrangement): string {
  if (!isOpen(arrangement)) {
    return endedSummary(arrangement);
  }
  if (arrangement.condition === 'free_grant') {
    return 'Nothing is expected of you. Use the plan.';
  }
  if (arrangement.condition === 'offline_settled') {
    return 'This is already paid. Nothing is expected of you.';
  }
  if (!canComplete(arrangement)) {
    return (
      arrangement.unpayable_reason ??
      'There is nothing to pay here right now. Ask whoever arranged this if you were expecting one.'
    );
  }
  const deadline = deadlineReading(arrangement);
  if (deadline?.overdue) {
    return 'This payment is past its deadline. Completing it now settles it.';
  }
  const due = readDay(arrangement.payment_deadline);
  if (deadline && due) {
    return `Complete the payment by ${due}.`;
  }
  return 'Complete the payment when you are ready. No deadline was set.';
}
