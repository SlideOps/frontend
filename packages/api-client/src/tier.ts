import { apiRequest, unwrap } from './http';

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

/** The hard ceilings a tier fixes. Memory and disk are whole numbers of MB and GB. */
export interface TierLimits {
  nodes: number;
  projects: number;
  services: number;
  vcpu: number;
  memory_mb: number;
  disk_gb: number;
}

/** What the Operator is using right now against their tier ceilings. */
export interface TierUsage {
  nodes: number;
  projects: number;
  services: number;
  vcpu_allocated: number;
  memory_allocated_mb: number;
}

/** The tier read: the name, the ceilings, and current usage in one shape. */
export interface TierInfo {
  tier: TierName;
  limits: TierLimits;
  usage: TierUsage;
}

/** Read the Operator's tier, its limits, and current usage. */
export function getTier(signal?: AbortSignal): Promise<TierInfo> {
  return apiRequest<unknown>('/tier', { signal }).then((r) => unwrap<TierInfo>(r, 'tier'));
}

/** Move an Operator to a tier. Admin only, audited by the backend. */
export function adminSetTier(id: string, tier: TierName): Promise<void> {
  return apiRequest<void>(`/admin/operators/${id}/tier`, { method: 'POST', body: { tier } });
}
