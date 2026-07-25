import { cn } from '@slideops/design-system';
import type { Capability, OperationStatus, RiskLevel, ServiceStatus } from '@slideops/api-client';
import { Boxes, CheckCircle2, ShieldCheck } from '@slideops/icons';

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

const serviceTone: Record<ServiceStatus, Tone> = {
  deploying: 'info',
  running: 'success',
  stopped: 'neutral',
  failed: 'danger',
  removed: 'neutral',
};

const serviceLabel: Record<ServiceStatus, string> = {
  deploying: 'Deploying',
  running: 'Running',
  stopped: 'Stopped',
  failed: 'Failed',
  removed: 'Removed',
};

export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  const tone = serviceTone[status] ?? 'neutral';
  return <span className={cn(badgeBase, toneClass[tone])}>{serviceLabel[status] ?? status}</span>;
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

/**
 * A badge marking a Capability that has already been carried out on the Node,
 * the way an app store marks an app as installed. The label is the outcome word
 * (Installed, Enabled, Configured, Secured, or Done); the success tone and check
 * icon read the same in both themes.
 */
export function CompletionBadge({ label }: { label: string }) {
  return (
    <span className={cn(badgeBase, toneClass.success)}>
      <CheckCircle2 width={12} height={12} aria-hidden />
      {label}
    </span>
  );
}

/** Whether a Capability comes from the pre-installed Core bundle. */
function isCoreSource(capability: Pick<Capability, 'plugin_id' | 'source'>): boolean {
  const id = (capability.plugin_id ?? capability.source ?? '').toLowerCase();
  return id === '' || id === 'core';
}

/**
 * A small badge naming where a Capability comes from: the Core bundle, or the
 * Plugin that added it. It reads directly from the Capability metadata so the
 * catalog shows the source without any extra lookup.
 */
export function PluginSourceBadge({ capability }: { capability: Capability }) {
  const core = isCoreSource(capability);
  const label = core ? 'Core' : capability.source || capability.plugin_id || 'Plugin';
  return (
    <span
      className={cn(badgeBase, 'bg-subtle text-ink-muted')}
      title={core ? 'Part of the pre-installed Core bundle' : `Added by the ${label} Plugin`}
    >
      {core ? (
        <ShieldCheck width={12} height={12} aria-hidden />
      ) : (
        <Boxes width={12} height={12} aria-hidden />
      )}
      {label}
    </span>
  );
}
