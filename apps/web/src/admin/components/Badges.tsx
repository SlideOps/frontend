import { cn } from '@slideops/design-system';
import type { ArrangementStatus, OperationStatus, OperatorStatus } from '@slideops/api-client';
import type { ArrangementReading } from '../arrangements';

/*
 * Status badges for the control plane. Every color is a semantic design token,
 * so the badges read correctly in both themes and never hard-code a value.
 */

const badgeBase = 'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium';

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

const operatorTone: Record<OperatorStatus, Tone> = {
  active: 'success',
  suspended: 'danger',
};

const operatorLabel: Record<OperatorStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
};

export function OperatorStatusBadge({ status }: { status: OperatorStatus }) {
  const tone = operatorTone[status] ?? 'neutral';
  return <span className={cn(badgeBase, toneClass[tone])}>{operatorLabel[status] ?? status}</span>;
}

const arrangementTone: Record<ArrangementStatus, Tone> = {
  awaiting_payment: 'warning',
  active: 'success',
  completed: 'success',
  expired: 'danger',
  cancelled: 'neutral',
};

const arrangementLabel: Record<ArrangementStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  active: 'Active',
  completed: 'Completed',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export function ArrangementStatusBadge({ status }: { status: ArrangementStatus }) {
  const tone = arrangementTone[status] ?? 'neutral';
  return (
    <span className={cn(badgeBase, toneClass[tone])}>{arrangementLabel[status] ?? status}</span>
  );
}

const readingTone: Record<ArrangementReading['tone'], Tone> = {
  good: 'success',
  warning: 'warning',
  bad: 'danger',
  neutral: 'neutral',
};

/**
 * One of an arrangement's three readings: whether access is live, whether the
 * payment arrived, or what is owed. Each carries its own reason, so an admin
 * does not have to infer why a word was chosen.
 */
export function ReadingBadge({ reading }: { reading: ArrangementReading }) {
  return (
    <span title={reading.detail} className={cn(badgeBase, toneClass[readingTone[reading.tone]])}>
      {reading.label}
    </span>
  );
}
