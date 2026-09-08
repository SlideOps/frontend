import type { ArrangementCondition } from './admin';
import { apiRequest } from './http';

/*
 * The Operator's own view of the payment arrangements made for them.
 *
 * An Admin can grant access ahead of payment. Until now the only place that
 * decision reached the customer was the email announcing it, so the person who
 * owed money had nowhere in the product to see what for, or to finish paying
 * it. This is that place.
 *
 * The request is scoped to the session, so there is no id to pass and no way
 * to name somebody else's arrangement. The response is deliberately narrower
 * than the Admin one: the Admin's private note and their external reference
 * are not in it, and nothing here goes looking for them.
 */

/**
 * The arrangement's own lifecycle as the customer sees it.
 *
 * Wider than the Admin list's vocabulary by one value: `revoked`, for access
 * that was withdrawn rather than allowed to lapse. The customer surface is the
 * one that has to tell those two apart, since only one of them is something
 * that happened *to* them.
 */
export type BillingArrangementStatus =
  'awaiting_payment' | 'active' | 'completed' | 'expired' | 'cancelled' | 'revoked';

/** One arrangement, as the Operator's own Billing page shows it. */
export interface BillingArrangement {
  id: string;
  tier: string;
  /**
   * What is owed, in minor units. Absent when nothing was stated, which is not
   * the same as zero: rendering an absent amount as a zero would tell the
   * customer they owe nothing when nobody has said so.
   */
  amount_minor?: number;
  /** The currency the amount is in, absent whenever the amount is. */
  currency?: string;
  condition: ArrangementCondition;
  status: BillingArrangementStatus;
  /** When payment is expected, absent when no deadline was set. */
  payment_deadline?: string;
  /** The payment already open for this debt, absent when there is none. */
  payment_reference?: string;
  /** Whether that payment can still be returned to. */
  resumable?: boolean;
  created_at: string;
}

/** The arrangements made for the signed-in Operator, newest first. */
export function listBillingArrangements(signal?: AbortSignal): Promise<BillingArrangement[]> {
  return apiRequest<{ arrangements?: BillingArrangement[] } | BillingArrangement[]>(
    '/billing/arrangements',
    { signal },
  ).then((response) => (Array.isArray(response) ? response : (response.arrangements ?? [])));
}
