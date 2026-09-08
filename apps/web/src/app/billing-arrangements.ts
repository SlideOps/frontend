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
function formatDay(when: Date): string {
  return when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
