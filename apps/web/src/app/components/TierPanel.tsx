import { getTier, type TierInfo, type TierName } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { Check, Gauge, Minus } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { ErrorNote, Loading } from './Feedback';
import { Meter } from './Meter';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * The tier and usage panel. It reads the Operator's tier once and shows what the
 * tier provides, the servers, Projects, and seats it allows, the history it
 * keeps, and the features it includes, with usage where we track it. SlideOps
 * meters only what it provides, never the server's own resources. Every value
 * comes from the backend; nothing here mutates.
 */

const tierLabel: Record<TierName, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

/** Render a limit, showing Unlimited for the -1 sentinel. */
function limitText(value: number): string {
  return value < 0 ? 'Unlimited' : String(value);
}

/** A quota row: a meter when the limit is finite, a plain count when unlimited. */
function Quota({ label, used, limit }: { label: string; used: number; limit: number }) {
  if (limit < 0) {
    return (
      <div className="rounded-lg border border-border bg-app px-3 py-2.5">
        <Text as="span" variant="caption" tone="secondary" className="block">
          {label}
        </Text>
        <Text as="span" variant="body-sm" className="font-semibold">
          {used}
          <span className="font-normal text-ink-muted"> used, Unlimited</span>
        </Text>
      </div>
    );
  }
  return <Meter label={label} used={used} limit={limit} valueText={`${used} / ${limit}`} />;
}

/** A feature row: included or not, read at a glance. */
function Feature({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {on ? (
        <Check width={15} height={15} className="text-accent" aria-hidden />
      ) : (
        <Minus width={15} height={15} className="text-ink-muted" aria-hidden />
      )}
      <Text as="span" variant="body-sm" tone={on ? undefined : 'secondary'}>
        {label}
      </Text>
    </div>
  );
}

function TierQuotas({ tier }: { tier: TierInfo }) {
  // Defend against a partial payload so a shape surprise never takes down the
  // whole Workspace; a real read always carries both.
  const limits = tier.limits ?? {
    nodes: 0,
    projects: 0,
    seats: 0,
    workspaces: 0,
    history_days: 0,
    automations: false,
    advanced_monitoring: false,
    audit_trail: false,
  };
  const usage = tier.usage ?? { nodes: 0, projects: 0, workspaces: 0 };
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Quota label="Workspaces" used={usage.workspaces} limit={limits.workspaces} />
        <Quota label="Servers" used={usage.nodes} limit={limits.nodes} />
        <Quota label="Projects" used={usage.projects} limit={limits.projects} />
        <div className="rounded-lg border border-border bg-app px-3 py-2.5">
          <Text as="span" variant="caption" tone="secondary" className="block">
            Team seats
          </Text>
          <Text as="span" variant="body-sm" className="font-semibold">
            {limitText(limits.seats)}
          </Text>
        </div>
        <div className="rounded-lg border border-border bg-app px-3 py-2.5">
          <Text as="span" variant="caption" tone="secondary" className="block">
            History
          </Text>
          <Text as="span" variant="body-sm" className="font-semibold">
            {limits.history_days < 0 ? 'Unlimited' : `${limits.history_days} days`}
          </Text>
        </div>
      </div>
      <div className="grid gap-2.5 border-t border-border pt-4 sm:grid-cols-3">
        <Feature label="Automations" on={limits.automations} />
        <Feature label="Advanced monitoring" on={limits.advanced_monitoring} />
        <Feature label="Audit trail" on={limits.audit_trail} />
      </div>
    </div>
  );
}

/** The tier and usage panel for the Workspace home. */
export function TierPanel() {
  const { state } = useAsyncData((signal) => getTier(signal), []);

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Gauge width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Tier and usage</Text>
        <Guidance for="tier.panel" />
        {state.status === 'ready' ? (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-ink">
            {tierLabel[state.data.tier] ?? state.data.tier}
          </span>
        ) : null}
      </div>

      {state.status === 'loading' ? <Loading label="Reading your tier" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        <div className="flex flex-col gap-4">
          <Text variant="body-sm" tone="secondary">
            Your tier sets what SlideOps provides, the servers, Projects, and seats you can run, the
            history it keeps, and the features it includes. Your servers' own resources are always
            yours to use in full.
          </Text>
          <TierQuotas tier={state.data} />
        </div>
      ) : null}
    </Card>
  );
}
