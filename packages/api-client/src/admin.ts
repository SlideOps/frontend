import type { PaymentProvider } from './billing';
import { apiBase, apiRequest, unwrap } from './http';
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

/** One payment attempt, successful or not. Matches the Operator's own
 *  Transaction status vocabulary exactly -- there is one status system, not
 *  a separate Admin one. */
export type AdminPaymentStatus =
  'pending' | 'success' | 'failed' | 'cancelled' | 'refunded' | 'disputed';

/** One payment attempt, successful or not. */
export interface AdminPayment {
  id: string;
  provider: string;
  /** The provider's own reference, needed to find the same transaction in theirs. */
  reference: string;
  tier: string;
  amount_minor: number;
  currency: string;
  status: AdminPaymentStatus;
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
  /** When the automatic Pending Payment reminder sweep last sent one,
   *  absent if never. manual_reminder_sent_at/by is an Admin's own "Send
   *  Pending Payment Email" click, tracked separately from the automatic
   *  one -- either may have happened regardless of the other. */
  pending_reminder_sent_at?: string;
  manual_reminder_sent_at?: string;
  manual_reminder_sent_by?: string;
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

/**
 * Send the Pending Payment reminder for one payment, on demand -- exactly
 * the same email the automatic sweep would send. Only ever sends an email:
 * no payment, subscription, tier, or entitlement state changes. Refuses
 * (throwing ApiError with code "not_pending") when the payment is no
 * longer genuinely pending, checked fresh immediately before sending.
 */
/** The URL to view or download any payment's PDF receipt in a new tab --
 *  admin-scoped, unlike the Operator's own /billing/payments/.../invoice.pdf.
 *  Cookie-authenticated, same as every other request; not a signed link. */
export function adminInvoiceURL(reference: string): string {
  return `${apiBase()}/admin/payments/${encodeURIComponent(reference)}/invoice.pdf`;
}

export function sendPendingPaymentReminder(reference: string): Promise<AdminPayment> {
  return apiRequest<{ payment?: AdminPayment } & Partial<AdminPayment>>(
    `/admin/payments/${encodeURIComponent(reference)}/send-pending-reminder`,
    { method: 'POST' },
  ).then((r) => r.payment ?? (r as AdminPayment));
}

/** The Pending Payment reminder's own settings: whether it runs, and how
 *  long a payment must sit pending before it fires. Never hardcoded. */
export interface CommunicationSettings {
  pending_reminder_enabled: boolean;
  pending_reminder_delay_minutes: number;
  updated_by_operator_id?: string;
  updated_at?: string;
}

/** Read the current Pending Payment reminder settings. A fresh deployment
 *  that has never saved one reads the default: enabled, 10 minutes. */
export function getCommunicationSettings(signal?: AbortSignal): Promise<CommunicationSettings> {
  return apiRequest<{ settings?: CommunicationSettings } & Partial<CommunicationSettings>>(
    '/admin/billing/communication-settings',
    { signal },
  ).then((r) => r.settings ?? (r as CommunicationSettings));
}

/**
 * Save the Pending Payment reminder settings. Takes effect for every
 * payment that becomes eligible for a reminder from this point on --
 * nothing already sent is retried or undone.
 */
export function setCommunicationSettings(input: {
  enabled: boolean;
  delayMinutes: number;
}): Promise<CommunicationSettings> {
  return apiRequest<{ settings?: CommunicationSettings } & Partial<CommunicationSettings>>(
    '/admin/billing/communication-settings',
    {
      method: 'PUT',
      body: {
        pending_reminder_enabled: input.enabled,
        pending_reminder_delay_minutes: input.delayMinutes,
      },
    },
  ).then((r) => r.settings ?? (r as CommunicationSettings));
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
  input: {
    reason: string;
    bonusNodes?: number;
    bonusProjects?: number;
    bonusSeats?: number;
    expiresAt?: Date;
  },
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
export function listWebhookDeliveries(
  limit?: number,
  signal?: AbortSignal,
): Promise<WebhookDelivery[]> {
  const query = limit ? `?limit=${encodeURIComponent(String(limit))}` : '';
  return apiRequest<{ deliveries?: WebhookDelivery[] } | WebhookDelivery[]>(
    `/admin/webhook-deliveries${query}`,
    { signal },
  ).then((r) => (Array.isArray(r) ? r : (r.deliveries ?? [])));
}

/*
 * Login rate limits: the support scenario is an Operator locked out by too
 * many login attempts. The login limiter keys its counter on email plus the
 * caller's IP, so a lookup or reset by email alone reaches every IP that has
 * contributed to it.
 */

/** One active login attempt counter, one per IP that has attempted it. */
export interface RateLimitEntry {
  subject: string;
  attempts: number;
  max: number;
  resets_in_seconds: number;
}

/** Every active login rate limit counter for the given email. */
export function lookupLoginRateLimit(
  email: string,
  signal?: AbortSignal,
): Promise<RateLimitEntry[]> {
  return apiRequest<{ entries?: RateLimitEntry[] } | RateLimitEntry[]>(
    `/admin/rate-limits/login?email=${encodeURIComponent(email)}`,
    { signal },
  ).then((r) => (Array.isArray(r) ? r : (r.entries ?? [])));
}

/** Clears every active login rate limit counter for the given email. Returns how many were cleared. */
export function resetLoginRateLimit(email: string): Promise<number> {
  return apiRequest<{ cleared?: number }>('/admin/rate-limits/login/reset', {
    method: 'POST',
    body: { email },
  }).then((r) => r.cleared ?? 0);
}

/*
 * Email deliveries: the sending-side mirror of the webhook delivery log,
 * every attempted transactional email SlideOps sends (a receipt, a seat
 * invitation, anything else), whether it succeeded or failed.
 */

/** One recorded transactional email send attempt. */
export interface EmailDelivery {
  id: string;
  to: string;
  subject?: string;
  provider: string;
  outcome: string;
  detail?: string;
  sent_at: string;
}

/** The most recent email deliveries, newest first. */
export function listEmailDeliveries(
  limit?: number,
  signal?: AbortSignal,
): Promise<EmailDelivery[]> {
  const query = limit ? `?limit=${encodeURIComponent(String(limit))}` : '';
  return apiRequest<{ deliveries?: EmailDelivery[] } | EmailDelivery[]>(
    `/admin/email-deliveries${query}`,
    { signal },
  ).then((r) => (Array.isArray(r) ? r : (r.deliveries ?? [])));
}

/*
 * Support notes: free-text context an Admin writes on an Operator's record,
 * visible only to Admins, never surfaced to the Operator.
 */

/** One Admin-written note on an Operator's record. */
export interface SupportNote {
  id: string;
  operator_id: string;
  author_operator_id: string;
  body: string;
  created_at: string;
}

/** Every support note on an Operator's record, newest first. */
export function listSupportNotes(operatorId: string, signal?: AbortSignal): Promise<SupportNote[]> {
  return apiRequest<{ notes?: SupportNote[] } | SupportNote[]>(
    `/admin/operators/${encodeURIComponent(operatorId)}/support-notes`,
    { signal },
  ).then((r) => (Array.isArray(r) ? r : (r.notes ?? [])));
}

/** Writes a new note on an Operator's record. */
export function addSupportNote(operatorId: string, body: string): Promise<SupportNote> {
  return apiRequest<{ note?: SupportNote } & Partial<SupportNote>>(
    `/admin/operators/${encodeURIComponent(operatorId)}/support-notes`,
    { method: 'POST', body: { body } },
  ).then((r) => r.note ?? (r as SupportNote));
}

/** Removes a note nobody meant to write. */
export function deleteSupportNote(operatorId: string, noteId: string): Promise<void> {
  return apiRequest<void>(
    `/admin/operators/${encodeURIComponent(operatorId)}/support-notes/${encodeURIComponent(noteId)}`,
    { method: 'DELETE' },
  );
}

/*
 * Payment arrangements: the real-world situations self-serve checkout does
 * not cover -- an offline payment already made, temporary access granted
 * ahead of payment, or a real checkout started on a customer's behalf.
 * Every mutation reuses billing's own tier activation, checkout, and email
 * machinery on the backend rather than a second parallel payment system,
 * and a payment-required arrangement completes itself automatically,
 * through the normal payment webhook, once the customer actually pays.
 */

/**
 * Why this arrangement exists, which decides how it reached its Status.
 *
 * `free_grant` is a deliberate gift and not a debt: access given at no charge,
 * as a decision, distinct from access granted with a payment still pending.
 */
export type ArrangementCondition =
  'offline_settled' | 'temporary_access' | 'payment_required' | 'free_grant';

/** The arrangement's own lifecycle, distinct from the subscription or payment it may involve. */
export type ArrangementStatus =
  'awaiting_payment' | 'active' | 'completed' | 'expired' | 'cancelled';

/** One payment arrangement. */
export interface Arrangement {
  id: string;
  operator_id: string;
  tier: string;
  /**
   * What is owed, in minor units. Absent or null when the backend has not
   * stated one, which is not the same as zero: a zero would read as "owes
   * nothing" on every screen that shows it.
   */
  amount_minor?: number | null;
  currency?: string;
  /**
   * How many months the amount covers, and what the figure was worked out from.
   *
   * Zero means no term was recorded, which is true of every arrangement made
   * before the backend started keeping one. That is an unknown term and never a
   * term of zero months, so nothing may be priced or displayed from it.
   */
  term_months?: number;
  /**
   * When this arrangement last changed, which is the revision a mutation echoes
   * back as `if_unchanged_since`.
   *
   * It was missing from this type while the backend had always returned it, so
   * nothing could reach for it and the detail reader fell through to
   * `created_at` instead. That sent the moment the arrangement was made in place
   * of the moment it last changed, and every save after the first was correctly
   * refused as overtaken.
   */
  updated_at?: string;
  condition: ArrangementCondition;
  status: ArrangementStatus;
  /** When an offline payment was actually made, set only for offline_settled. */
  paid_at?: string;
  /** When payment is expected, set for temporary_access and payment_required. */
  payment_deadline?: string;
  /** Whether the arrangement expires itself once the deadline passes with no payment. */
  auto_expire_on_deadline: boolean;
  /** The SlideOps payment reference this arrangement is tied to, when one exists. */
  payment_reference?: string;
  /** The Admin's own paper trail for an offline payment: a bank reference, a receipt number. */
  external_reference?: string;
  notes?: string;
  created_by_operator_id: string;
  created_at: string;
}

/** Every payment arrangement ever created for one Operator, newest first. */
export function listArrangements(operatorId: string, signal?: AbortSignal): Promise<Arrangement[]> {
  return apiRequest<{ arrangements?: Arrangement[] } | Arrangement[]>(
    `/admin/operators/${encodeURIComponent(operatorId)}/arrangements`,
    { signal },
  ).then((r) => (Array.isArray(r) ? r : (r.arrangements ?? [])));
}

/**
 * One arrangement on the Admin-wide list, with the Operator it belongs to.
 *
 * The lifecycle fields are optional because the list endpoint predates them.
 * Where the backend states access and payment itself, the list shows what it
 * says; where it does not, the reading is derived from the condition and the
 * status, which the list has always carried. Either way the list never has to
 * be opened to see what an arrangement is doing.
 */
export interface ArrangementWithOperator extends Arrangement {
  operator_email: string;
  /** Whether the customer currently has access. */
  access_state?: string;
  /** Whether the expected payment has arrived. */
  payment_state?: string;
  /** When access under this arrangement ends, when it is time limited. */
  access_end?: string;
  /** When the customer was last written to about this arrangement. */
  last_communication_at?: string;
  /** The revision, for an editor opened straight from the list. */
  updated_at?: string;
}

/** Filters listAllArrangements accepts. An empty filter matches everything. */
export interface ArrangementListFilter {
  condition?: ArrangementCondition;
  status?: ArrangementStatus;
  limit?: number;
  offset?: number;
}

/** One page of the Admin-wide arrangements activity feed. */
export interface ArrangementPage {
  arrangements: ArrangementWithOperator[];
  limit: number;
  offset: number;
  has_more: boolean;
}

/**
 * Every payment arrangement across every Operator, newest first: the
 * Admin-wide activity feed, distinct from listArrangements's one-Operator
 * scope that the Subscriber detail page uses.
 */
export function listAllArrangements(
  filter: ArrangementListFilter = {},
  signal?: AbortSignal,
): Promise<ArrangementPage> {
  return apiRequest<ArrangementPage>('/admin/arrangements', {
    query: {
      condition: filter.condition,
      status: filter.status,
      limit: filter.limit,
      offset: filter.offset,
    },
    signal,
  });
}

/*
 * Pricing an arrangement.
 *
 * A customer paying for themselves never types an amount: they choose a plan
 * and a billing period and the figure follows from the price table, the annual
 * discount, the exchange rate and the tax. An admin arranging the same access
 * on the customer's behalf gets that same figure from the same place, so the
 * CRM and the real charge cannot drift apart.
 */

/**
 * The currencies this deployment can actually charge in.
 *
 * Deliberately not the currencies the tiers happen to be priced in. Every tier
 * price is written in one currency, and checkout has always been able to charge
 * another by converting at a live rate, so the price table answers a different
 * question from the one an admin is asking. Naira appears here only while a
 * live rate is available, which is why this is read rather than assumed.
 */
export function listArrangementCurrencies(signal?: AbortSignal): Promise<string[]> {
  return apiRequest<{ currencies?: string[] } | string[]>('/admin/arrangements/currencies', {
    signal,
  }).then((r) => (Array.isArray(r) ? r : (r.currencies ?? [])));
}

/**
 * What an arrangement would cost, worked out by the same pricing the customer's
 * own checkout uses.
 *
 * The breakdown is carried in full rather than as one total because an admin who
 * cannot see where a figure came from will not trust it, and because the figure
 * has to be explainable on the day it was quoted: the monthly price in the
 * tier's own currency, the term it is multiplied by, what a full year takes off,
 * the tax, and the rate any conversion used.
 */
export interface ArrangementQuote {
  tier: string;
  term_months: number;
  /** The currency the tier's own price is written in. */
  native_currency: string;
  /** One month at the tier's own price, in native_currency. */
  unit_amount_minor: number;
  /** What the customer would be charged in. */
  currency: string;
  /** Price times term, converted, before tax. */
  subtotal_minor: number;
  /** What a full year takes off, already converted. */
  annual_discount_minor: number;
  tax_minor: number;
  /** What the customer would actually be charged. */
  total_minor: number;
  /** The rate the conversion used, absent when no conversion happened. */
  fx_rate?: number;
  /**
   * True when this was asked for as a gift. The tier is deliberately not priced
   * in that case and the currency comes back empty, so the real figure is never
   * carried alongside where it could be shown or saved by mistake.
   */
  free_grant: boolean;
  /**
   * False for a tier with no self serve price, which quotes as zero. That is a
   * real answer and not a failure: granting such a tier at no charge is an
   * ordinary thing for an admin to arrange.
   */
  purchasable: boolean;
}

/** What a quote is asked for: a plan, how long for, and what to charge in. */
export interface ArrangementQuoteInput {
  tier: string;
  /** Months of access being arranged. One month when omitted. */
  termMonths?: number;
  /** What to charge in. Omitted means the tier's own currency. */
  currency?: string;
  /** Ask for this as a gift, which quotes as nothing and prices nothing. */
  free?: boolean;
}

/**
 * Quote one arrangement without creating anything. A currency this deployment
 * cannot charge is refused with a 400 carrying `currency_unsupported`.
 */
export function quoteArrangement(
  operatorId: string,
  input: ArrangementQuoteInput,
  signal?: AbortSignal,
): Promise<ArrangementQuote> {
  return apiRequest<{ quote?: ArrangementQuote } & Partial<ArrangementQuote>>(
    `/admin/operators/${encodeURIComponent(operatorId)}/arrangements/quote`,
    {
      query: {
        tier: input.tier,
        term_months: input.termMonths,
        currency: input.currency,
        free: input.free ? true : undefined,
      },
      signal,
    },
  ).then((r) => r.quote ?? (r as ArrangementQuote));
}

/**
 * Record a payment the customer already made outside SlideOps. Activates
 * the tier immediately under an explicit manual payment source, never a
 * fabricated online provider transaction, and sends the manual payment
 * confirmation email.
 */
export function recordOfflinePayment(
  operatorId: string,
  input: {
    tier: string;
    amountMinor: number;
    currency: string;
    reference: string;
    paidAt?: Date;
    termMonths?: number;
    notes?: string;
  },
): Promise<Arrangement> {
  return apiRequest<{ arrangement?: Arrangement } & Partial<Arrangement>>(
    `/admin/operators/${encodeURIComponent(operatorId)}/arrangements/offline-payment`,
    {
      method: 'POST',
      body: {
        tier: input.tier,
        amount_minor: input.amountMinor,
        currency: input.currency,
        reference: input.reference,
        paid_at: input.paidAt ? input.paidAt.toISOString() : undefined,
        term_months: input.termMonths ?? 1,
        notes: input.notes ?? '',
      },
    },
  ).then((r) => r.arrangement ?? (r as Arrangement));
}

/**
 * Grant a tier immediately, ahead of payment, expected to complete by the
 * deadline. Access is never conditioned on payment -- that is the point --
 * but a real, correctly priced pending payment for what is owed is also
 * started through the same checkout pipeline self-serve checkout uses, so
 * it shows up in the Operator's own Billing -> Transactions and they can
 * Complete Payment themselves. Sends one email that says both facts: access
 * is active, and (when provider names a configured provider) what is owed
 * and a link to pay it. A deployment with no provider configured still
 * grants access, just with checkout_url coming back empty.
 */
export function grantTemporaryAccess(
  operatorId: string,
  input: {
    tier: string;
    paymentDeadline?: Date;
    autoExpireOnDeadline?: boolean;
    termMonths?: number;
    provider?: PaymentProvider;
    currency?: string;
    notes?: string;
  },
): Promise<PaymentRequiredArrangement> {
  return apiRequest<
    { arrangement?: Arrangement; checkout_url?: string } & Partial<PaymentRequiredArrangement>
  >(`/admin/operators/${encodeURIComponent(operatorId)}/arrangements/temporary-access`, {
    method: 'POST',
    body: {
      tier: input.tier,
      payment_deadline: input.paymentDeadline ? input.paymentDeadline.toISOString() : undefined,
      auto_expire_on_deadline: input.autoExpireOnDeadline ?? false,
      term_months: input.termMonths ?? 1,
      provider: input.provider,
      currency: input.currency,
      notes: input.notes ?? '',
    },
  }).then((r) => ({
    arrangement: r.arrangement as Arrangement,
    checkout_url: r.checkout_url ?? '',
  }));
}

/**
 * Give a tier away at no charge, as a deliberate decision.
 *
 * Distinct from temporary access, which grants ahead of a payment that is still
 * expected. Nothing is owed here and nothing is ever collected, which is why the
 * body carries no amount and no currency: there is no charge to denominate, and
 * a figure sent here could only ever be shown as a debt that does not exist.
 */
export function createFreeGrant(
  operatorId: string,
  input: { tier: string; termMonths?: number; notes?: string },
): Promise<Arrangement> {
  return apiRequest<{ arrangement?: Arrangement } & Partial<Arrangement>>(
    `/admin/operators/${encodeURIComponent(operatorId)}/arrangements/free-grant`,
    {
      method: 'POST',
      body: {
        tier: input.tier,
        term_months: input.termMonths ?? 1,
        notes: input.notes ?? '',
      },
    },
  ).then((r) => r.arrangement ?? (r as Arrangement));
}

/** The result of starting a payment-required arrangement: the arrangement plus the real checkout link. */
export interface PaymentRequiredArrangement {
  arrangement: Arrangement;
  checkout_url: string;
}

/**
 * Start a real checkout on the customer's behalf, through the exact same
 * pipeline a self-serve checkout already uses, and track it with a
 * deadline. No access changes: the tier activates only once the customer
 * completes that checkout, through the normal payment webhook, same as
 * any other payment. Sends the payment-required email with the checkout
 * link.
 */
export function createPaymentRequiredArrangement(
  operatorId: string,
  input: {
    tier: string;
    provider: PaymentProvider;
    currency?: string;
    paymentDeadline?: Date;
    termMonths?: number;
    notes?: string;
  },
): Promise<PaymentRequiredArrangement> {
  return apiRequest<
    { arrangement?: Arrangement; checkout_url?: string } & Partial<PaymentRequiredArrangement>
  >(`/admin/operators/${encodeURIComponent(operatorId)}/arrangements/payment-required`, {
    method: 'POST',
    body: {
      tier: input.tier,
      provider: input.provider,
      currency: input.currency,
      payment_deadline: input.paymentDeadline ? input.paymentDeadline.toISOString() : undefined,
      term_months: input.termMonths ?? 1,
      notes: input.notes ?? '',
    },
  }).then((r) => ({
    arrangement: r.arrangement as Arrangement,
    checkout_url: r.checkout_url ?? '',
  }));
}

/**
 * Call off an arrangement that no longer applies. Only the arrangement's
 * own record changes: access already granted under it is not
 * automatically revoked, since undoing access is a separate, deliberate
 * decision.
 */
export function cancelArrangement(arrangementId: string, reason: string): Promise<void> {
  return apiRequest<void>(`/admin/arrangements/${encodeURIComponent(arrangementId)}/cancel`, {
    method: 'POST',
    body: { reason },
  });
}

/**
 * Move an awaiting-payment arrangement's deadline out. Refused for one
 * that is not awaiting payment, since there is no deadline left to move.
 */
export function extendArrangementDeadline(arrangementId: string, newDeadline: Date): Promise<void> {
  return apiRequest<void>(
    `/admin/arrangements/${encodeURIComponent(arrangementId)}/extend-deadline`,
    { method: 'POST', body: { new_deadline: newDeadline.toISOString() } },
  );
}

/*
 * The arrangement lifecycle: everything that happens to an arrangement after
 * it is created.
 *
 * Creating one is already covered above. What was missing was the rest of the
 * customer relationship: reading one arrangement on its own, correcting what
 * was agreed, taking access back, putting it back, writing to the customer,
 * and seeing what was already done to it and by whom.
 *
 * Two rules hold across every mutation here.
 *
 * The revision, `if_unchanged_since`, is the `updated_at` the caller last read,
 * echoed back. The backend refuses with 409 when the arrangement moved in the
 * meantime, which is the only way a second admin's correction does not get
 * silently overwritten by a form that was opened before it.
 *
 * The states are carried as plain strings rather than a union. The backend owns
 * that vocabulary and can add to it; a union here would make this client reject
 * a value the server legitimately sends, which is a worse failure than showing
 * an unfamiliar word.
 */

/** How the customer was last written to under an arrangement. */
export interface ArrangementEmail {
  id: string;
  /** The message type the backend knows it by. */
  type: string;
  /** The address it went to. */
  to: string;
  subject?: string;
  /** Whether the send succeeded, in the backend's own words. */
  outcome: string;
  detail?: string;
  sent_at: string;
  /** Which admin sent it, when the backend records that. */
  sent_by_email?: string;
}

/** A message type this arrangement can be sent, as the backend names it. */
export interface ArrangementEmailType {
  type: string;
  label?: string;
  description?: string;
}

/** A rendered message, produced without sending anything. */
export interface ArrangementEmailPreview {
  type: string;
  to: string;
  subject: string;
  body: string;
}

/**
 * One arrangement read on its own.
 *
 * Access, payment, and what is owed are three separate fields because they are
 * three separate questions. An arrangement whose access is active, whose payment
 * has not arrived, and which owes a named sum by a named date is not in a
 * contradictory state; it is the ordinary state of temporary access, and
 * collapsing the three into one status is what loses that.
 */
export interface ArrangementDetail {
  arrangement: Arrangement;
  operator_id: string;
  operator_email: string;
  /** Whether the customer currently has access. */
  access_state: string;
  /** Whether the expected payment has arrived. */
  payment_state: string;
  /** What is owed, in minor units. Absent when the backend has not stated one. */
  amount_minor?: number | null;
  currency?: string;
  /** False when this arrangement carries no payment obligation at all. */
  amount_applicable?: boolean;
  /** When access under this arrangement began. */
  access_start?: string;
  /** When access under this arrangement ends, when it is time limited. */
  access_end?: string;
  payment_deadline?: string;
  /** The revision to echo back as if_unchanged_since on the next mutation. */
  updated_at: string;
  /** When the customer was last written to about this arrangement. */
  last_communication_at?: string;
  /** The message types this arrangement can be sent, named by the backend. */
  email_types?: ArrangementEmailType[];
}

/**
 * Read whatever shape the detail arrives in.
 *
 * The backend may send the arrangement nested under `arrangement` alongside the
 * lifecycle fields, or send one flat object. Both are accepted, the same way the
 * create calls above accept either, so this client does not break on an envelope
 * decision made after it shipped.
 */
function toArrangementDetail(raw: unknown): ArrangementDetail {
  const body = (raw ?? {}) as Record<string, unknown>;
  const nested = body.arrangement as Arrangement | undefined;
  const arrangement = nested ?? (body as unknown as Arrangement);
  const amount = body.amount_minor as number | null | undefined;

  return {
    arrangement,
    operator_id: (body.operator_id as string) ?? arrangement.operator_id ?? '',
    operator_email: (body.operator_email as string) ?? '',
    access_state: (body.access_state as string) ?? '',
    payment_state: (body.payment_state as string) ?? '',
    // The amount is read from the envelope first and from the arrangement only
    // as a fallback, and an absent one stays absent: turning "not stated" into
    // a zero here would put "owes nothing" on a screen the backend never said it.
    amount_minor: amount === undefined ? arrangement.amount_minor : amount,
    currency: (body.currency as string) ?? arrangement.currency,
    amount_applicable: body.amount_applicable as boolean | undefined,
    access_start: body.access_start as string | undefined,
    access_end: body.access_end as string | undefined,
    payment_deadline: (body.payment_deadline as string) ?? arrangement.payment_deadline,
    // The revision, and nothing that merely looks like one.
    //
    // The detail endpoint calls this "revision"; the arrangement inside it
    // calls the same instant "updated_at". This read neither, so it fell
    // through to created_at, and every save echoed back the moment the
    // arrangement was made instead of the moment it last changed. For any
    // arrangement that had ever been touched those differ, so the server
    // correctly refused every edit as overtaken, and an Admin was told to
    // reload and try again forever.
    //
    // There is no fallback to another timestamp on purpose. A wrong revision is
    // worse than none: none means last write wins, wrong means nothing can ever
    // be saved.
    updated_at:
      (body.revision as string) || (arrangement.updated_at as string) || '',
    last_communication_at: body.last_communication_at as string | undefined,
    email_types: body.email_types as ArrangementEmailType[] | undefined,
  };
}

/** One arrangement, with the access, payment, and obligation readings behind it. */
export function getArrangement(
  arrangementId: string,
  signal?: AbortSignal,
): Promise<ArrangementDetail> {
  return apiRequest<unknown>(`/admin/arrangements/${encodeURIComponent(arrangementId)}`, {
    signal,
  }).then(toArrangementDetail);
}

/**
 * A correction to an arrangement. Every field is optional and only the ones
 * present are sent, so an edit says exactly what it changed and nothing else.
 * A null clears a date the arrangement no longer has.
 *
 * The condition is deliberately absent. Turning a settled payment into a gift
 * after the fact rewrites what happened rather than correcting it, and revoking,
 * restoring and granting already exist for changing the arrangement itself.
 */
export interface ArrangementUpdate {
  tier?: string;
  amountMinor?: number;
  currency?: string;
  /** How many months the amount covers. Refused with `invalid_term` when negative. */
  termMonths?: number;
  paymentDeadline?: Date | null;
  accessStart?: Date | null;
  accessEnd?: Date | null;
  /** Whether access lapses on its own once the deadline passes with no payment. */
  autoExpireOnDeadline?: boolean;
  /** The admin's own paper trail. Recorded as given and never verified. */
  externalReference?: string;
  /** When the customer actually paid, for a settlement dated wrongly. */
  paidAt?: Date | null;
  notes?: string;
}

/** Serialize a date field for the wire, keeping an explicit null as a clear. */
function isoOrNull(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/**
 * Correct what was agreed. Sends only the fields that changed, plus the
 * revision the editor was working from. A 409 means another admin changed this
 * first and the caller must show what happened rather than resend. A 400
 * carrying `invalid_term` means the term was negative.
 */
export function updateArrangement(
  arrangementId: string,
  changes: ArrangementUpdate,
  ifUnchangedSince: string,
): Promise<ArrangementDetail> {
  // Sent only when there is one. An empty revision is not a revision, and
  // sending one would ask the server to compare against nothing.
  const body: Record<string, unknown> = ifUnchangedSince
    ? { if_unchanged_since: ifUnchangedSince }
    : {};
  if (changes.tier !== undefined) {
    body.tier = changes.tier;
  }
  if (changes.amountMinor !== undefined) {
    body.amount_minor = changes.amountMinor;
  }
  if (changes.currency !== undefined) {
    body.currency = changes.currency;
  }
  if (changes.termMonths !== undefined) {
    body.term_months = changes.termMonths;
  }
  if (changes.paymentDeadline !== undefined) {
    body.payment_deadline = isoOrNull(changes.paymentDeadline);
  }
  if (changes.accessStart !== undefined) {
    body.access_start = isoOrNull(changes.accessStart);
  }
  if (changes.accessEnd !== undefined) {
    body.access_end = isoOrNull(changes.accessEnd);
  }
  if (changes.autoExpireOnDeadline !== undefined) {
    body.auto_expire_on_deadline = changes.autoExpireOnDeadline;
  }
  if (changes.externalReference !== undefined) {
    body.external_reference = changes.externalReference;
  }
  if (changes.paidAt !== undefined) {
    body.paid_at = isoOrNull(changes.paidAt);
  }
  if (changes.notes !== undefined) {
    body.notes = changes.notes;
  }
  return apiRequest<unknown>(`/admin/arrangements/${encodeURIComponent(arrangementId)}`, {
    method: 'PATCH',
    body,
  }).then(toArrangementDetail);
}

/**
 * Take back the access this arrangement granted. Distinct from cancelling the
 * arrangement, which calls off the agreement and leaves granted access alone;
 * this is the deliberate withdrawal of what the customer currently has, so it
 * demands a reason and carries the revision.
 */
export function revokeArrangementAccess(
  arrangementId: string,
  reason: string,
  ifUnchangedSince: string,
): Promise<ArrangementDetail> {
  return apiRequest<unknown>(`/admin/arrangements/${encodeURIComponent(arrangementId)}/revoke`, {
    method: 'POST',
    body: { reason, if_unchanged_since: ifUnchangedSince },
  }).then(toArrangementDetail);
}

/** Put back access that was revoked or that lapsed. */
export function restoreArrangementAccess(
  arrangementId: string,
  reason?: string,
): Promise<ArrangementDetail> {
  return apiRequest<unknown>(`/admin/arrangements/${encodeURIComponent(arrangementId)}/restore`, {
    method: 'POST',
    body: reason ? { reason } : {},
  }).then(toArrangementDetail);
}

/** One audited thing that happened to an arrangement. */
export interface ArrangementTimelineEntry {
  id: string;
  /** What happened, as the backend names it. */
  action: string;
  actor_email?: string;
  actor_operator_id?: string;
  detail?: string;
  created_at: string;
}

/** Everything that has happened to one arrangement, newest first. */
export function listArrangementTimeline(
  arrangementId: string,
  signal?: AbortSignal,
): Promise<ArrangementTimelineEntry[]> {
  return apiRequest<{ entries?: ArrangementTimelineEntry[] } | ArrangementTimelineEntry[]>(
    `/admin/arrangements/${encodeURIComponent(arrangementId)}/timeline`,
    { signal },
  ).then((r) => (Array.isArray(r) ? r : (r.entries ?? [])));
}

/** Every message sent to the customer about one arrangement, newest first. */
export function listArrangementEmails(
  arrangementId: string,
  signal?: AbortSignal,
): Promise<ArrangementEmail[]> {
  return apiRequest<{ emails?: ArrangementEmail[] } | ArrangementEmail[]>(
    `/admin/arrangements/${encodeURIComponent(arrangementId)}/emails`,
    { signal },
  ).then((r) => (Array.isArray(r) ? r : (r.emails ?? [])));
}

/**
 * Render a message without sending it. Nothing about the arrangement changes
 * and the customer is not written to, which is the whole point of being able
 * to read it first.
 */
export function previewArrangementEmail(
  arrangementId: string,
  type: string,
): Promise<ArrangementEmailPreview> {
  return apiRequest<{ preview?: ArrangementEmailPreview } & Partial<ArrangementEmailPreview>>(
    `/admin/arrangements/${encodeURIComponent(arrangementId)}/emails/preview`,
    { method: 'POST', body: { type } },
  ).then((r) => r.preview ?? (r as ArrangementEmailPreview));
}

/**
 * Send the message. This is a communication and nothing else: no tier moves,
 * no access changes, no payment is recorded.
 */
export function sendArrangementEmail(
  arrangementId: string,
  type: string,
): Promise<ArrangementEmail> {
  return apiRequest<{ email?: ArrangementEmail } & Partial<ArrangementEmail>>(
    `/admin/arrangements/${encodeURIComponent(arrangementId)}/emails`,
    { method: 'POST', body: { type } },
  ).then((r) => r.email ?? (r as ArrangementEmail));
}

/**
 * One hostname on the platform with the whole chain behind it.
 *
 * The four states are separate because they fail separately, and the question an
 * admin has is which of them broke: a domain whose DNS is verified and whose
 * certificate is missing is a different problem from one that never resolved.
 */
export interface AdminDomain {
  hostname: string;
  workspace_id: string;
  project_id?: string;
  service_id: string;
  node_id?: string;
  state: string;
  state_detail: string;
  dns_observed?: string;
  tls_state: string;
  serving: boolean;
  target_port: number;
  ingress_kind: string;
  dns_mode: string;
  last_error?: string;
  dns_checked_at?: string;
  last_verified_at?: string;
  tls_expires_at?: string;
  created_at: string;
}

/** Every domain on the platform, newest first. Admin only, and read only. */
export function listAdminDomains(): Promise<AdminDomain[]> {
  return apiRequest<{ domains: AdminDomain[] }>('/admin/domains').then((r) => r.domains ?? []);
}
