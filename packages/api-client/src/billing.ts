import { apiRequest, unwrap } from './http';
import type { TierName } from './tier';

/*
 * The Billing surface. An ordinary Operator subscribes to a self-serve tier
 * through a hosted checkout: they pick a provider (Paystack for local payments,
 * Flutterwave for international), optionally apply a promo code, and are sent to
 * the provider's page. A signature-verified webhook grants the tier out of band,
 * so this client only starts the checkout and reads the resulting subscription.
 * Admins are unlimited by role and never subscribe. The Admin promo surface below
 * creates and governs the codes Operators redeem. Field names mirror the backend
 * contract exactly so the wire shape and the type never drift, and each read
 * unwraps its envelope tolerantly, matching the rest of the client.
 */

/** The two tiers an Operator can buy. Free is never charged; Enterprise is contact-sales. */
export type PurchasableTier = 'starter' | 'pro';

/** The payment providers. Paystack serves local payments; Flutterwave international. */
export type PaymentProvider = 'paystack' | 'flutterwave';

/** The currencies a checkout may be paid in. USD is every plan's own price;
 *  NGN converts it to Naira at the live exchange rate. */
export type PayCurrency = 'USD' | 'NGN';

/** The lifecycle state of a paid subscription. */
export type SubscriptionStatus = 'active' | 'canceled' | 'expired';

/**
 * An Operator's current paid plan. It carries the tier, the provider that took
 * the payment, the status, and when the paid period ends. It never carries a
 * provider secret.
 */
export interface Subscription {
  tier: TierName;
  provider: string;
  status: SubscriptionStatus;
  /** When the paid period ends. Absent when not set. */
  current_period_end?: string;
}

/**
 * The subscription read: the current plan (null when the Operator has never
 * subscribed) plus whether billing is configured on this platform, so the UI can
 * hide checkout when no provider is set.
 */
export interface BillingSubscription {
  configured: boolean;
  subscription: Subscription | null;
}

/** What a checkout starts with. term_months defaults to one month on the backend.
 *  currency defaults to the plan's own currency (USD) when omitted. */
export interface CheckoutInput {
  tier: PurchasableTier;
  provider: PaymentProvider;
  promo_code?: string;
  term_months?: number;
  currency?: PayCurrency;
}

/**
 * The started checkout. checkout_url is where the Operator is sent to pay; it is
 * empty when granted is true, which happens when a free tier-grant promo
 * activated the tier immediately with no payment.
 */
export interface CheckoutResult {
  checkout_url: string;
  reference: string;
  provider: string;
  granted: boolean;
}

/** The five things a promo effect can do. The kind selects which fields are read. */
export type PromoEffectKind =
  'percent_discount' | 'fixed_discount' | 'duration_conditional' | 'value_add' | 'tier_grant';

/**
 * One thing a promo code does. A percent discount reads percent; a fixed discount
 * reads amount_minor; a duration-conditional deal reads term_months and percent; a
 * value-add reads the bonus fields; a tier grant reads tier and free_days.
 */
export interface PromoEffect {
  kind: PromoEffectKind;
  /** Percentage off for a percent or duration-conditional discount (1 to 100). */
  percent?: number;
  /** The fixed amount off for a fixed discount, in the smallest currency unit. */
  amount_minor?: number;
  /** The multi-month term a duration-conditional discount is conditioned on. */
  term_months?: number;
  /** Extra servers a value-add grants on top of the tier. */
  bonus_nodes?: number;
  /** Extra Projects a value-add grants on top of the tier. */
  bonus_projects?: number;
  /** Extra team seats a value-add grants on top of the tier. */
  bonus_seats?: number;
  /** The tier a tier grant activates. */
  tier?: string;
  /** How many days a tier grant activates the tier for, with no charge. */
  free_days?: number;
}

/** What a promo code would do at checkout, without redeeming it. */
export interface PromoPreview {
  code: string;
  tier: string;
  /** The currency of the amounts, when the backend includes it. */
  currency?: string;
  term_months: number;
  /** The undiscounted term total in the smallest currency unit. */
  original_amount_minor: number;
  /** The amount to charge after the discount, in the smallest currency unit. */
  discounted_amount_minor: number;
  /** True when the code is a tier grant applied with no payment. */
  free_grant: boolean;
  /** The tier a free grant activates. */
  grant_tier?: string;
  free_days?: number;
  bonus_nodes: number;
  bonus_projects: number;
  bonus_seats: number;
  /** Short human-readable lines describing each effect for the checkout UI. */
  descriptions: string[];
}

/** What a promo preview is asked for: a code against a tier and term. */
export interface ValidatePromoInput {
  code: string;
  tier: PurchasableTier;
  term_months?: number;
}

/** What a checkout quote is asked for: a tier and currency, and an optional
 *  promo code and term. */
export interface QuoteInput {
  tier: PurchasableTier;
  currency?: PayCurrency;
  promo_code?: string;
  term_months?: number;
}

/**
 * The exact total a checkout would charge right now: the tier price after any
 * promo discount and currency conversion, the platform fee charged on top of it,
 * and the total. It changes nothing; it is what the checkout UI shows before the
 * Operator commits to pay. When free_grant is true the promo code activates a
 * tier with no charge at all, and the amount fields are zero.
 */
export interface Quote {
  tier: string;
  currency?: string;
  term_months: number;
  base_amount_minor: number;
  fee_label?: string;
  fee_amount_minor: number;
  total_amount_minor: number;
  /** The USD to NGN rate used, present only for a Naira quote. */
  fx_rate?: number;
  promo_applied: boolean;
  promo_descriptions: string[];
  free_grant: boolean;
  grant_tier?: string;
  free_days?: number;
}

/**
 * An Admin-created promo code and the effects it carries. The code is matched
 * case-insensitively at checkout. starts_at and ends_at bound an optional validity
 * window; enabled is the kill switch; max_redemptions is the overall cap (0 for
 * unlimited); max_per_operator is how many times one Operator may redeem it.
 */
export interface PromoCode {
  id: string;
  code: string;
  description?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  enabled: boolean;
  max_redemptions: number;
  max_per_operator: number;
  effects: PromoEffect[];
  created_at: string;
  /** How many times the code has been redeemed, when the backend includes it. */
  redemption_count?: number;
}

/** The fields required to create a promo code. Audited server-side. */
export interface CreatePromoCodeInput {
  code: string;
  description?: string;
  starts_at?: string;
  ends_at?: string;
  enabled?: boolean;
  max_redemptions?: number;
  max_per_operator?: number;
  effects: PromoEffect[];
}

/** Read the current subscription and whether billing is configured on this platform. */
export function getSubscription(signal?: AbortSignal): Promise<BillingSubscription> {
  return apiRequest<BillingSubscription>('/billing/subscription', { signal });
}

/**
 * Start a hosted checkout for a self-serve tier. On success the Operator is sent
 * to checkout_url, unless a free tier-grant promo activated the tier immediately.
 */
export function startCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  return apiRequest<CheckoutResult>('/billing/checkout', { method: 'POST', body: input });
}

/** Price a checkout before starting it: the total a checkout would charge right
 *  now, including the platform fee and any Naira conversion. Changes nothing. */
export function quoteCheckout(input: QuoteInput): Promise<Quote> {
  return apiRequest<unknown>('/billing/quote', { method: 'POST', body: input }).then((r) =>
    unwrap<Quote>(r, 'quote'),
  );
}

/** Cancel the subscription and return the Operator to the Free tier. */
export function cancelSubscription(): Promise<void> {
  return apiRequest<void>('/billing/cancel', { method: 'POST' });
}

/** Preview a promo code against a tier and term without redeeming it. */
export function validatePromo(input: ValidatePromoInput): Promise<PromoPreview> {
  return apiRequest<unknown>('/billing/promo/validate', { method: 'POST', body: input }).then((r) =>
    unwrap<PromoPreview>(r, 'promo'),
  );
}

/** List every promo code, newest first, with its window, caps, and effects. Admin only. */
export function listPromoCodes(signal?: AbortSignal): Promise<PromoCode[]> {
  return apiRequest<unknown>('/admin/promo-codes', { signal }).then((r) =>
    unwrap<PromoCode[]>(r, 'promo_codes'),
  );
}

/** Create a promo code. Admin only, audited. */
export function createPromoCode(input: CreatePromoCodeInput): Promise<PromoCode> {
  return apiRequest<unknown>('/admin/promo-codes', { method: 'POST', body: input }).then((r) =>
    unwrap<PromoCode>(r, 'promo_code'),
  );
}

/** Flip a promo code's kill switch on or off. Admin only, audited. */
export function setPromoCodeEnabled(id: string, enabled: boolean): Promise<void> {
  const action = enabled ? 'enable' : 'disable';
  return apiRequest<void>(`/admin/promo-codes/${id}/${action}`, { method: 'POST' });
}

/** Delete a promo code and its redemptions. Admin only, audited. */
export function deletePromoCode(id: string): Promise<void> {
  return apiRequest<void>(`/admin/promo-codes/${id}`, { method: 'DELETE' });
}
