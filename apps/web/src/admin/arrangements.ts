import type { Arrangement, ArrangementCondition } from '@slideops/api-client';

/*
 * How a payment arrangement is phrased on the Admin surface. Pure, so it is
 * testable without a screen, and so the wording lives in one place instead
 * of being scattered through the markup.
 */

export const conditionLabel: Record<ArrangementCondition, string> = {
  offline_settled: 'Offline payment',
  temporary_access: 'Temporary access',
  payment_required: 'Payment required',
};

export const conditionDescription: Record<ArrangementCondition, string> = {
  offline_settled: 'The customer already paid outside SlideOps; recorded for the trail.',
  temporary_access: 'Access granted on trust, ahead of payment, expected by the deadline.',
  payment_required: "A real checkout started on the customer's behalf, awaiting completion.",
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
