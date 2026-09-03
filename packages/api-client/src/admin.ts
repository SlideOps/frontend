import { apiRequest, unwrap } from './http';
import type { TierName } from './tier';
import type { OperationStatus, OperatorRole } from './types';

/*
 * The Admin control-plane surface. Every path sits under /api/v1/admin and rides
 * the single Operator session cookie, which the shared request helper already
 * sends. The backend requires the admin role for these routes and returns 403
 * for a plain Operator. It reads across every tenant for oversight only, and
 * audits every
 * mutation. Single resources come wrapped in a named envelope and lists in a
 * named array, matching the rest of the client; each function unwraps tolerantly
 * so a bare value is accepted when the envelope key is absent.
 */

/** The platform headline shown on the Admin overview. */
export interface Overview {
  operators_total: number;
  nodes_total: number;
  operations_total: number;
  operations_by_status: Record<string, number>;
  active_operations: number;
  failures_last_24h: number;
  executions_paused: boolean;
  operators_suspended: number;
}

/** The lifecycle state of an Operator account on the platform. */
export type OperatorStatus = 'active' | 'suspended';

/** One Operator row in the cross-tenant Operators table. */
export interface AdminOperator {
  id: string;
  email: string;
  role: OperatorRole;
  created_at: string;
  status: OperatorStatus;
  /** The tier this Operator sits on, when the backend includes it. */
  tier?: TierName;
  node_count: number;
  operation_count: number;
  last_active: string | null;
  /** Whether this Operator carries a per-account free season: every tier quota
   *  and feature gate lifted for them alone, with no payment required. */
  free_season: boolean;
}

/** One cross-tenant Operation, enriched with the Operator email where cheap. */
export interface AdminOperation {
  id: string;
  operator_id: string;
  operator_email: string;
  node_id: string;
  /** The Node name, included by the list view when the backend enriches it. */
  node_name?: string;
  capability_key: string;
  /** The Capability name, included by the list view when the backend enriches it. */
  capability_name?: string;
  status: OperationStatus;
  created_at: string;
}

/** An Operator detail, the row plus their most recent Operations. */
export interface AdminOperatorDetail extends AdminOperator {
  recent_operations: AdminOperation[];
}

/** One point on the operations-over-time series. */
export interface OperationsOverTimePoint {
  date: string;
  count: number;
}

/** One bar in the capability-usage breakdown. */
export interface CapabilityUsage {
  capability_key: string;
  count: number;
}

/** The aggregates that back the Admin analytics charts. */
export interface Analytics {
  operations_over_time: OperationsOverTimePoint[];
  success_rate: number;
  capability_usage: CapabilityUsage[];
  operations_by_status: Record<string, number>;
}

/** One entry in the immutable audit trail. */
export interface AuditEntry {
  id: string;
  actor_type: string;
  actor_id: string;
  /**
   * Who acted, by email. An audit trail is read by a person judging whether an
   * action was legitimate, and a bare uuid answers nothing; this is what makes an
   * entry readable at a glance.
   *
   * Empty for a non-Operator actor and for an account since deleted. `actor_id`
   * is always present, so an entry stays traceable even once the name is gone.
   */
  actor_email: string;
  action: string;
  target: string;
  metadata: Record<string, unknown>;
  ip: string;
  created_at: string;
}

/** The current state of the platform-wide execution pause. */
export interface EmergencyStatus {
  executions_paused: boolean;
}

/** Read the platform headline. */
export function getOverview(signal?: AbortSignal): Promise<Overview> {
  return apiRequest<{ overview?: Overview } & Partial<Overview>>('/admin/overview', {
    signal,
  }).then((r) => r.overview ?? (r as Overview));
}

/** List every Operator on the platform, for oversight. */
export function listOperators(signal?: AbortSignal): Promise<AdminOperator[]> {
  return apiRequest<{ operators?: AdminOperator[] } | AdminOperator[]>('/admin/operators', {
    signal,
  }).then((r) => (Array.isArray(r) ? r : (r.operators ?? [])));
}

/** Read one Operator, with their recent Operations. */
export function getOperator(id: string, signal?: AbortSignal): Promise<AdminOperatorDetail> {
  return apiRequest<{ operator?: AdminOperatorDetail } & Partial<AdminOperatorDetail>>(
    `/admin/operators/${id}`,
    { signal },
  ).then((r) => r.operator ?? (r as AdminOperatorDetail));
}

/** Suspend an Operator. Audited. A suspended Operator cannot approve or execute. */
export function suspendOperator(id: string): Promise<void> {
  return apiRequest<void>(`/admin/operators/${id}/suspend`, { method: 'POST' });
}

/** Lift a suspension and restore an Operator to normal. Audited. */
export function unsuspendOperator(id: string): Promise<void> {
  return apiRequest<void>(`/admin/operators/${id}/unsuspend`, { method: 'POST' });
}

/** Grant or revoke the admin role on an Operator. Admin only, audited. */
export function setOperatorRole(id: string, role: OperatorRole): Promise<void> {
  return apiRequest<void>(`/admin/operators/${id}/role`, { method: 'POST', body: { role } });
}

export interface AdminOperationFilter {
  status?: OperationStatus;
  operator_id?: string;
}

/** List cross-tenant Operations, newest first, filterable by status and Operator. */
export function listAdminOperations(
  filter: AdminOperationFilter = {},
  signal?: AbortSignal,
): Promise<AdminOperation[]> {
  return apiRequest<{ operations?: AdminOperation[] } | AdminOperation[]>('/admin/operations', {
    query: { status: filter.status, operator_id: filter.operator_id },
    signal,
  }).then((r) => (Array.isArray(r) ? r : (r.operations ?? [])));
}

/** Read the analytics aggregates that back the charts. */
export function getAnalytics(signal?: AbortSignal): Promise<Analytics> {
  return apiRequest<{ analytics?: Analytics } & Partial<Analytics>>('/admin/analytics', {
    signal,
  }).then((r) => r.analytics ?? (r as Analytics));
}

export interface AuditFilter {
  limit?: number;
  offset?: number;
}

/** Read a page of the audit trail, newest first. */
export function listAudit(filter: AuditFilter = {}, signal?: AbortSignal): Promise<AuditEntry[]> {
  return apiRequest<{ entries?: AuditEntry[]; audit?: AuditEntry[] } | AuditEntry[]>(
    '/admin/audit',
    {
      query: { limit: filter.limit, offset: filter.offset },
      signal,
    },
  ).then((r) => (Array.isArray(r) ? r : (r.entries ?? r.audit ?? [])));
}

/** Pause every execution platform wide. Queued Operations wait, nothing is lost. Audited. */
export function pauseExecutions(): Promise<EmergencyStatus> {
  return apiRequest<{ status?: EmergencyStatus } & Partial<EmergencyStatus>>(
    '/admin/emergency/pause-executions',
    { method: 'POST' },
  ).then((r) => r.status ?? (r as EmergencyStatus));
}

/** Resume executions. Held Operations run again. Audited. */
export function resumeExecutions(): Promise<EmergencyStatus> {
  return apiRequest<{ status?: EmergencyStatus } & Partial<EmergencyStatus>>(
    '/admin/emergency/resume-executions',
    { method: 'POST' },
  ).then((r) => r.status ?? (r as EmergencyStatus));
}

/** Read whether executions are currently paused platform wide. */
export function getEmergencyStatus(signal?: AbortSignal): Promise<EmergencyStatus> {
  return apiRequest<{ status?: EmergencyStatus } & Partial<EmergencyStatus>>(
    '/admin/emergency/status',
    { signal },
  ).then((r) => r.status ?? (r as EmergencyStatus));
}

/**
 * One tier's editable definition: the quotas Operators receive, the feature
 * flags, and the price. Counts and windows use -1 to mean Unlimited (the
 * enterprise tier today). `amount_minor` is the price in the smallest currency
 * unit, so NGN 7,500.00 is 750000 kobo. Field names mirror the backend contract
 * exactly so the wire shape and the type never drift.
 */
export interface AdminTier {
  name: string;
  nodes: number;
  projects: number;
  seats: number;
  history_days: number;
  automations: boolean;
  advanced_monitoring: boolean;
  audit_trail: boolean;
  amount_minor: number;
  currency: string;
  purchasable: boolean;
}

/** List every tier and its current definition, for the Admin tier editor. */
export function listAdminTiers(signal?: AbortSignal): Promise<AdminTier[]> {
  return apiRequest<unknown>('/admin/tiers', { signal }).then((r) =>
    unwrap<AdminTier[]>(r, 'tiers'),
  );
}

/**
 * Update one tier's quotas, feature flags, and price by name. Applied live with
 * no restart, and audited by the backend. A 400 with an `invalid_...` code marks
 * an out-of-range value (counts must be >= -1, amount >= 0).
 */
export function updateAdminTier(name: string, input: Omit<AdminTier, 'name'>): Promise<AdminTier> {
  return apiRequest<unknown>(`/admin/tiers/${name}`, { method: 'PUT', body: input }).then((r) =>
    unwrap<AdminTier>(r, 'tier'),
  );
}

/** One emergency switch: what it is, what engaging it stops, and whether it is on. */
export interface EmergencyControl {
  /** The stable slug used to engage and release it. */
  name: string;
  /** The short human label. */
  title: string;
  /** What this switch stops, and what it deliberately leaves alone. */
  description: string;
  engaged: boolean;
}

/**
 * The whole emergency switchboard. There is one control per mutating path,
 * because holding Operation execution never held a Service deploy, a scheduled
 * Automation, or a sign in.
 */
export interface EmergencyState {
  controls: EmergencyControl[];
  /** True when at least one control is on, for a platform-wide banner. */
  any_engaged: boolean;
  /** The executions control under its original name, for older clients. */
  executions_paused: boolean;
  /**
   * The platform-wide free season: whether it is engaged, and its title and
   * description. Kept apart from `controls` because its effect is the opposite
   * of theirs: it opens access up rather than holding it back, is off by
   * default, and is never touched by lockdown or release-all.
   */
  free_season: EmergencyControl;
}

/** Read every emergency control and its current state. */
export function getEmergencyState(signal?: AbortSignal): Promise<EmergencyState> {
  return apiRequest<EmergencyState>('/admin/emergency/status', { signal });
}

/** Engage or release one emergency control, and get the whole board back. */
export function setEmergencyControl(name: string, engaged: boolean): Promise<EmergencyState> {
  const action = engaged ? 'engage' : 'release';
  return apiRequest<EmergencyState>(
    `/admin/emergency/controls/${encodeURIComponent(name)}/${action}`,
    { method: 'POST' },
  );
}

/**
 * Engage or release the platform-wide free season: lifts every tier quota and
 * feature gate for every Operator, with no payment required, as if every
 * account carried the richest tier. Admins are unaffected; they are unlimited
 * by role regardless. Off by default, and a dedicated pair of routes rather
 * than `setEmergencyControl`, since its effect is the opposite of every other
 * control.
 */
export function setFreeSeason(engaged: boolean): Promise<EmergencyState> {
  const action = engaged ? 'engage' : 'release';
  return apiRequest<EmergencyState>(`/admin/emergency/free-season/${action}`, {
    method: 'POST',
  });
}

/**
 * Engage every control at once. It does not sign anyone out and does not stop
 * work already executing, so you keep the control plane while you work.
 */
export function emergencyLockdown(): Promise<EmergencyState> {
  return apiRequest<EmergencyState>('/admin/emergency/lockdown', { method: 'POST' });
}

/** Release every control, returning the platform to normal service. */
export function emergencyReleaseAll(): Promise<EmergencyState> {
  return apiRequest<EmergencyState>('/admin/emergency/release-all', { method: 'POST' });
}

/**
 * Turn on planned maintenance: the public app shows a maintenance page, and
 * new registrations, new deploys, and new checkouts are held alongside it.
 * Existing running Services, existing sessions, and the Admin control plane
 * are unaffected.
 */
export function emergencyEngageMaintenance(): Promise<EmergencyState> {
  return apiRequest<EmergencyState>('/admin/emergency/maintenance/engage', { method: 'POST' });
}

/** Turn maintenance mode off, releasing every control it engaged. */
export function emergencyReleaseMaintenance(): Promise<EmergencyState> {
  return apiRequest<EmergencyState>('/admin/emergency/maintenance/release', { method: 'POST' });
}

/**
 * Turn on incident mode: holds new Operations of every kind (including a new
 * Capability install), new deploys, new registrations, new checkouts, and new
 * GitHub connections. Sign in, existing sessions, and scheduled Automations
 * are left alone, and nothing is shown to the public.
 */
export function emergencyEngageIncident(): Promise<EmergencyState> {
  return apiRequest<EmergencyState>('/admin/emergency/incident/engage', { method: 'POST' });
}

/** Turn incident mode off, releasing every control it engaged. */
export function emergencyReleaseIncident(): Promise<EmergencyState> {
  return apiRequest<EmergencyState>('/admin/emergency/incident/release', { method: 'POST' });
}

/**
 * End every open session on the platform, so a captured token stops working now
 * rather than at the end of its life.
 *
 * **This signs you out too**: deliberately, since a revocation that spares the
 * person pressing it is not a revocation. Sign back in afterwards.
 */
export function revokeAllSessions(): Promise<number> {
  return apiRequest<{ sessions_revoked: number }>('/admin/emergency/revoke-sessions', {
    method: 'POST',
  }).then((r) => r.sessions_revoked ?? 0);
}

/*
 * Billing oversight. Read only: changing what somebody pays belongs to the
 * payment provider, and where SlideOps must intervene it moves their tier, which
 * is audited and does not pretend to have taken money.
 */

/** One row of the subscribers table. */
export interface AdminSubscriber {
  operator_id: string;
  email: string;
  /**
   * The tier the account is on right now. It can legitimately differ from
   * `subscription_tier`: an Admin granted tier moves the account without touching
   * the subscription, and a lapsed subscription returns the account to Free while
   * the row stays for the record.
   */
  account_tier: string;
  /** Empty when this Operator has only ever attempted a payment. */
  status?: string;
  subscription_tier?: string;
  provider?: string;
  current_period_end?: string;
  started_at?: string;
  /** Every attempt. `paid_minor` counts only the successful ones. */
  payments: number;
  paid_minor: number;
  currency?: string;
  last_paid_at?: string;
  /** The tier this subscription was on immediately before an Admin paused it,
   *  set only while `status` is `'paused'`. Resuming restores exactly this. */
  paused_previous_tier?: string;
  /** Why an Admin paused this subscription, set only while paused. */
  pause_reason?: string;
  /** When the pause is expected to lift on its own, set only while paused and
   *  only when one was given. */
  resume_at?: string;
}

/** One payment attempt, successful or not. */
export interface AdminPayment {
  id: string;
  provider: string;
  /** The provider's own reference, needed to find the same transaction in theirs. */
  reference: string;
  tier: string;
  amount_minor: number;
  currency: string;
  status: 'pending' | 'success' | 'failed';
  promo_code?: string;
  term_months: number;
  /** How much of this payment's base amount the automatic first-time annual
   *  discount took off; absent or zero when it did not apply. */
  annual_discount_minor?: number;
  /** The provider's own transaction reference. Empty when there is nothing to
   *  verify this payment against: one recorded before this was captured, or a
   *  free tier grant that never reached a provider at all. */
  provider_ref?: string;
  /** Set only when an admin's manual recovery ran this payment through the
   *  normal activation path, rather than a webhook confirming it on its own. */
  recovered_at?: string;
  recovery_reason?: string;
  /** When the receipt was last sent, absent if never. */
  receipt_sent_at?: string;
  created_at: string;
}

/** What SlideOps has on record for a payment, against what the provider itself
 *  reports right now. Read only: asking for one changes nothing. */
export interface PaymentReconciliation {
  reference: string;
  local_status: string;
  provider_status: string;
  match: boolean;
}

/**
 * Ask the payment provider directly what it knows about a payment, and show it
 * next to what SlideOps has on record. Changes nothing.
 */
export function verifyPayment(
  reference: string,
  signal?: AbortSignal,
): Promise<PaymentReconciliation> {
  return apiRequest<{ reconciliation?: PaymentReconciliation } & Partial<PaymentReconciliation>>(
    `/admin/payments/${encodeURIComponent(reference)}/verify`,
    { signal },
  ).then((r) => r.reconciliation ?? (r as PaymentReconciliation));
}

/**
 * Run a payment the provider confirms succeeded, but that SlideOps never
 * correctly recorded, through the exact same activation path a real webhook
 * would have used: the tier is granted, the subscription activated, any promo
 * redeemed, and the receipt sent. The provider is asked to confirm the
 * transaction fresh, right before activating; an admin's word alone is never
 * enough.
 *
 * Safe to call twice: a payment already successful comes back unchanged.
 */
export function recoverPayment(reference: string, reason: string): Promise<AdminPayment> {
  return apiRequest<{ payment?: AdminPayment } & Partial<AdminPayment>>(
    `/admin/payments/${encodeURIComponent(reference)}/recover`,
    { method: 'POST', body: { reason } },
  ).then((r) => r.payment ?? (r as AdminPayment));
}

/**
 * Resend the receipt for an already-successful payment. Only ever resends the
 * email: no tier is granted again, no promo is redeemed again, no subscription
 * state changes.
 */
export function resendPaymentReceipt(reference: string): Promise<AdminPayment> {
  return apiRequest<{ payment?: AdminPayment } & Partial<AdminPayment>>(
    `/admin/payments/${encodeURIComponent(reference)}/resend-receipt`,
    { method: 'POST' },
  ).then((r) => r.payment ?? (r as AdminPayment));
}

/** A subscriber with their payment history. */
export interface AdminSubscriberDetail extends AdminSubscriber {
  payment_history: AdminPayment[];
}

/** The headline above the subscribers table. */
export interface AdminSubscriberTotals {
  active: number;
  canceled: number;
  expired: number;
  /** Active subscriptions whose paid period ends within thirty days. */
  expiring_within_30_days: number;
  paid_minor: number;
  currency?: string;
  /** Unsuccessful attempts. A rise looks identical to nobody trying if only
   *  successful payments are counted. */
  failed_payments: number;
}

/**
 * List everyone who has ever paid or tried to, with the platform headline.
 *
 * Lapsed and cancelled accounts are included, and so are Operators who only ever
 * attempted a payment and failed. A list that shows active subscribers alone
 * cannot answer why revenue moved.
 */
export function listSubscribers(
  signal?: AbortSignal,
): Promise<{ subscribers: AdminSubscriber[]; totals: AdminSubscriberTotals }> {
  return apiRequest<{ subscribers?: AdminSubscriber[]; totals?: AdminSubscriberTotals }>(
    '/admin/subscribers',
    { signal },
  ).then((r) => ({
    subscribers: r.subscribers ?? [],
    totals: r.totals ?? {
      active: 0,
      canceled: 0,
      expired: 0,
      expiring_within_30_days: 0,
      paid_minor: 0,
      failed_payments: 0,
    },
  }));
}

/** Read one subscriber and every payment attempt behind them. */
export function getSubscriber(id: string, signal?: AbortSignal): Promise<AdminSubscriberDetail> {
  return apiRequest<{ subscriber?: AdminSubscriberDetail } & Partial<AdminSubscriberDetail>>(
    `/admin/subscribers/${encodeURIComponent(id)}`,
    { signal },
  ).then((r) => r.subscriber ?? (r as AdminSubscriberDetail));
}

/** A subscription as returned by a pause or resume action. */
export interface AdminSubscriptionAction {
  tier: string;
  status: string;
  paused_previous_tier?: string;
  pause_reason?: string;
  resume_at?: string;
}

/**
 * Hold a subscriber's benefits without canceling them: the Account moves to
 * Free immediately, through the same tier-set path a real subscribe or cancel
 * already uses, and the tier it was paused from is recorded so a resume
 * restores exactly that. A reason is required so the action is always
 * auditable; resumeAt is optional and, when given, the pause lifts itself.
 *
 * Safe to call twice: a subscription already paused comes back unchanged
 * rather than paused again, which would overwrite the real previous tier.
 */
export function pauseSubscriber(
  operatorId: string,
  reason: string,
  resumeAt?: Date,
): Promise<AdminSubscriptionAction> {
  return apiRequest<{ subscription?: AdminSubscriptionAction } & Partial<AdminSubscriptionAction>>(
    `/admin/subscribers/${encodeURIComponent(operatorId)}/pause`,
    { method: 'POST', body: { reason, resume_at: resumeAt ? resumeAt.toISOString() : undefined } },
  ).then((r) => r.subscription ?? (r as AdminSubscriptionAction));
}

/** Lift a pause: restores the tier recorded when the subscription was paused. */
export function resumeSubscriber(operatorId: string): Promise<AdminSubscriptionAction> {
  return apiRequest<{ subscription?: AdminSubscriptionAction } & Partial<AdminSubscriptionAction>>(
    `/admin/subscribers/${encodeURIComponent(operatorId)}/resume`,
    { method: 'POST' },
  ).then((r) => r.subscription ?? (r as AdminSubscriptionAction));
}

/*
 * Entitlement grants: an Admin override on top of an Operator's tier (extra
 * Nodes, Projects, or Seats), for support compensation or anything else that
 * does not fit a promo campaign. Summed into the same effective quota every
 * enforcement point already reads on the backend, so this is not a second,
 * unenforced entitlement system.
 */

/** One entitlement grant, as the Admin surface reads it. */
export interface EntitlementGrant {
  id: string;
  operator_id: string;
  granted_by_operator_id: string;
  reason: string;
  bonus_nodes: number;
  bonus_projects: number;
  bonus_seats: number;
  granted_at: string;
  /** Absent when the grant lasts until an Admin revokes it by hand. */
  expires_at?: string;
  /** Present only once an Admin has revoked this grant. */
  revoked_at?: string;
  /** Computed: not revoked, and not past its own expiry. */
  active: boolean;
}

/** Every grant ever issued to an Operator, newest first, active or not. */
export function listEntitlementGrants(
  operatorId: string,
  signal?: AbortSignal,
): Promise<EntitlementGrant[]> {
  return apiRequest<{ grants?: EntitlementGrant[] } | EntitlementGrant[]>(
    `/admin/operators/${encodeURIComponent(operatorId)}/entitlements`,
    { signal },
  ).then((r) => (Array.isArray(r) ? r : (r.grants ?? [])));
}

/**
 * Grant extra Nodes, Projects, or Seats on top of an Operator's tier. A
 * reason is required; the grant lasts until the optional expiry, or until an
 * Admin revokes it by hand.
 */
export function grantEntitlement(
  operatorId: string,
  input: { reason: string; bonusNodes?: number; bonusProjects?: number; bonusSeats?: number; expiresAt?: Date },
): Promise<EntitlementGrant> {
  return apiRequest<{ grant?: EntitlementGrant } & Partial<EntitlementGrant>>(
    `/admin/operators/${encodeURIComponent(operatorId)}/entitlements`,
    {
      method: 'POST',
      body: {
        reason: input.reason,
        bonus_nodes: input.bonusNodes ?? 0,
        bonus_projects: input.bonusProjects ?? 0,
        bonus_seats: input.bonusSeats ?? 0,
        expires_at: input.expiresAt ? input.expiresAt.toISOString() : undefined,
      },
    },
  ).then((r) => r.grant ?? (r as EntitlementGrant));
}

/** Revoke a grant before its own expiry, or before it would otherwise last indefinitely. */
export function revokeEntitlement(operatorId: string, grantId: string): Promise<void> {
  return apiRequest<void>(
    `/admin/operators/${encodeURIComponent(operatorId)}/entitlements/${encodeURIComponent(grantId)}/revoke`,
    { method: 'POST' },
  );
}

/*
 * Feature flags: a deliberate rollout or an internal/admin-only gate an Admin
 * creates and toggles at runtime, distinct from the emergency switchboard.
 */

/** One centralized feature flag. */
export interface FeatureFlag {
  key: string;
  title: string;
  description?: string;
  enabled: boolean;
  created_by_operator_id?: string;
  created_at: string;
  updated_by_operator_id?: string;
  updated_at: string;
}

/** Every feature flag, ordered by key. */
export function listFeatureFlags(signal?: AbortSignal): Promise<FeatureFlag[]> {
  return apiRequest<{ flags?: FeatureFlag[] } | FeatureFlag[]>('/admin/feature-flags', {
    signal,
  }).then((r) => (Array.isArray(r) ? r : (r.flags ?? [])));
}

/**
 * Create a new flag, off by default unless enabled is set. The key may only
 * use lowercase letters, digits, and hyphens, since it is never renamed once
 * real code depends on it.
 */
export function createFeatureFlag(input: {
  key: string;
  title: string;
  description?: string;
  enabled?: boolean;
}): Promise<FeatureFlag> {
  return apiRequest<{ flag?: FeatureFlag } & Partial<FeatureFlag>>('/admin/feature-flags', {
    method: 'POST',
    body: {
      key: input.key,
      title: input.title,
      description: input.description ?? '',
      enabled: input.enabled ?? false,
    },
  }).then((r) => r.flag ?? (r as FeatureFlag));
}

/** Turn a flag on or off, immediately. */
export function setFeatureFlagEnabled(key: string, enabled: boolean): Promise<FeatureFlag> {
  return apiRequest<{ flag?: FeatureFlag } & Partial<FeatureFlag>>(
    `/admin/feature-flags/${encodeURIComponent(key)}/enabled`,
    { method: 'POST', body: { enabled } },
  ).then((r) => r.flag ?? (r as FeatureFlag));
}

/**
 * Delete a flag entirely. A flag carries no user-facing or billing
 * consequence of its own, so deleting one nobody reads anymore is safe.
 */
export function deleteFeatureFlag(key: string): Promise<void> {
  return apiRequest<void>(`/admin/feature-flags/${encodeURIComponent(key)}`, { method: 'DELETE' });
}

/*
 * Webhook deliveries: a read-only log of every inbound payment provider
 * webhook (Paystack, Flutterwave), so an Admin can see whether a provider's
 * webhook ever arrived, whether its signature checked out, and what it did,
 * without shelling into server logs. This is what diagnosing a payment stuck
 * pending -- its webhook never arrived, arrived with a bad signature, or
 * errored while being applied -- reaches for before Verify/Recover.
 */

/** One recorded delivery attempt from a payment provider's webhook. */
export interface WebhookDelivery {
  id: string;
  provider: string;
  reference?: string;
  outcome: string;
  detail?: string;
  received_at: string;
}

/** The most recent webhook deliveries, newest first. */
export function listWebhookDeliveries(limit?: number, signal?: AbortSignal): Promise<WebhookDelivery[]> {
  const query = limit ? `?limit=${encodeURIComponent(String(limit))}` : '';
  return apiRequest<{ deliveries?: WebhookDelivery[] } | WebhookDelivery[]>(
    `/admin/webhook-deliveries${query}`,
    { signal },
  ).then((r) => (Array.isArray(r) ? r : (r.deliveries ?? [])));
}
