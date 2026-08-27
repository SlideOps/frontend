import { apiRequest } from './http';

/*
 * The Tier surface. Every Operator sits on one of four tiers, and each tier
 * fixes a set of quotas: how many Nodes, Projects, and Services they may run,
 * and the total vCPU and memory their Services may allocate. The read endpoint
 * returns the tier, its limits, and current usage together so the Workspace can
 * show headroom at a glance. The admin set endpoint moves an Operator between
 * tiers and is audited by the backend. Field names mirror the backend contract
 * exactly so the wire shape and the type never drift.
 */

/** The four tiers an Operator can sit on, cheapest to richest. */
export type TierName = 'free' | 'starter' | 'pro' | 'enterprise';

/** What a tier provides. We meter only what SlideOps provides, never the server's
 *  own resources. A limit of -1 means unlimited. */
export interface TierLimits {
  nodes: number;
  projects: number;
  seats: number;
  workspaces: number;
  history_days: number;
  automations: boolean;
  advanced_monitoring: boolean;
  audit_trail: boolean;
}

/** What the Operator is using right now against their tier ceilings. */
export interface TierUsage {
  nodes: number;
  projects: number;
  workspaces: number;
}

/** The tier read: the name, the ceilings, and current usage in one shape. */
export interface TierInfo {
  tier: TierName;
  limits: TierLimits;
  usage: TierUsage;
}

/** Read the Operator's tier, its limits, and current usage. */
export function getTier(signal?: AbortSignal): Promise<TierInfo> {
  // The tier read is a flat object: tier is the plan name, alongside limits and
  // usage. It is not wrapped under a "tier" key, so it is returned as is (a bare
  // envelope value would still be this shape).
  return apiRequest<TierInfo>('/tier', { signal });
}

/** Move an Operator to a tier. Admin only, audited by the backend. */
export function adminSetTier(id: string, tier: TierName): Promise<void> {
  return apiRequest<void>(`/admin/operators/${id}/tier`, { method: 'POST', body: { tier } });
}
