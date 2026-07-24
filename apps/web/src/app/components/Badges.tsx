import { cn } from '@slideops/design-system';
import type { OperationStatus, RiskLevel } from '@slideops/api-client';

/*
 * Small status and risk badges. Every color is a semantic design token, so the
 * badges read correctly in both themes and never hard-code a value.
 */

const badgeBase =
  'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-subtle text-ink-muted',
  info: 'bg-subtle text-info',
  success: 'bg-subtle text-success',
  warning: 'bg-subtle text-warning',
  danger: 'bg-subtle text-danger',
};

const statusTone: Record<OperationStatus, Tone> = {
  created: 'neutral',
  discovering: 'info',
  assessing: 'info',
  planning: 'info',
  awaiting_approval: 'warning',
  approved: 'info',
  executing: 'info',
  verifying: 'info',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

const statusLabel: Record<OperationStatus, string> = {
  created: 'Created',
  discovering: 'Discovering',
  assessing: 'Assessing',
  planning: 'Planning',
  awaiting_approval: 'Awaiting approval',
  approved: 'Approved',
  executing: 'Executing',
  verifying: 'Verifying',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }: { status: OperationStatus }) {
  const tone = statusTone[status] ?? 'neutral';
  return <span className={cn(badgeBase, toneClass[tone])}>{statusLabel[status] ?? status}</span>;
}

const riskTone: Record<RiskLevel, Tone> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
};

const riskLabel: Record<RiskLevel, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
};

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const tone = riskTone[risk] ?? 'neutral';
  return <span className={cn(badgeBase, toneClass[tone])}>{riskLabel[risk] ?? risk}</span>;
}
