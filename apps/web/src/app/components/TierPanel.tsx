import { getTier, type TierInfo, type TierName } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { Gauge } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { ErrorNote, Loading } from './Feedback';
import { Meter } from './Meter';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * The tier and usage panel. It reads the Operator's tier once and shows each
 * quota with its current usage and a meter, so the headroom on Nodes, Projects,
 * Services, vCPU, and memory is obvious at a glance and a near-limit reading is
 * plain to see. Every value comes from the backend; nothing here mutates.
 */

const tierLabel: Record<TierName, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

/** Format a memory reading in MB, stepping up to GB once it is large. */
function memory(mb: number): string {
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

/** Round a vCPU reading to at most two decimals without trailing zeros. */
function vcpu(value: number): string {
  return `${Math.round(value * 100) / 100}`;
}

function TierQuotas({ tier }: { tier: TierInfo }) {
  const { limits, usage } = tier;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Meter
        label="Nodes"
        used={usage.nodes}
        limit={limits.nodes}
        valueText={`${usage.nodes} / ${limits.nodes}`}
      />
      <Meter
        label="Projects"
        used={usage.projects}
        limit={limits.projects}
        valueText={`${usage.projects} / ${limits.projects}`}
      />
      <Meter
        label="Services"
        used={usage.services}
        limit={limits.services}
        valueText={`${usage.services} / ${limits.services}`}
      />
      <Meter
        label="vCPU"
        used={usage.vcpu_allocated}
        limit={limits.vcpu}
        valueText={`${vcpu(usage.vcpu_allocated)} / ${vcpu(limits.vcpu)}`}
      />
      <Meter
        label="Memory"
        used={usage.memory_allocated_mb}
        limit={limits.memory_mb}
        valueText={`${memory(usage.memory_allocated_mb)} / ${memory(limits.memory_mb)}`}
      />
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
            Your tier fixes how much you can run. When a meter is close to full, remove something or
            ask an admin to raise your tier.
          </Text>
          <TierQuotas tier={state.data} />
        </div>
      ) : null}
    </Card>
  );
}
