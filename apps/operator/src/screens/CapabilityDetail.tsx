import {
  getCapability,
  listNodes,
  type Capability,
  type Node,
} from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { ArrowLeft, Layers, Play, Server, ShieldCheck } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState } from '@slideops/ui';
import type { ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { RiskBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { StartOperation } from '../components/StartOperation';
import { useAsyncData } from '../hooks/useAsyncData';

function Section({
  title,
  guidanceKey,
  children,
}: {
  title: string;
  guidanceKey?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Text variant="caption" tone="secondary">
          {title}
        </Text>
        {guidanceKey ? <Guidance for={guidanceKey} size={14} /> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * The Capability detail: the outcome it delivers, the intent behind it, its
 * risk, the platforms it supports, and how verification proves it worked. From
 * here an Operator starts an Operation on a chosen Node, filling in any inputs
 * the Capability declares through the generated form.
 */
export function CapabilityDetail() {
  const { key = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedNode = searchParams.get('node') ?? undefined;

  const capabilityResult = useAsyncData<Capability>((signal) => getCapability(key, signal), [key]);
  const nodesResult = useAsyncData<Node[]>((signal) => listNodes(signal), []);
  const nodes = nodesResult.state.status === 'ready' ? nodesResult.state.data : [];

  return (
    <OperatorShell active="capabilities">
      <button
        type="button"
        onClick={() => navigate('/capabilities')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <ArrowLeft width={16} height={16} aria-hidden />
        All Capabilities
      </button>

      {capabilityResult.state.status === 'loading' ? <Loading label="Loading this Capability" /> : null}
      {capabilityResult.state.status === 'error' ? <ErrorNote error={capabilityResult.state.error} /> : null}
      {capabilityResult.state.status === 'ready' ? (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                <Layers width={22} height={22} aria-hidden />
              </span>
              <div className="min-w-0">
                <Text variant="h1">{capabilityResult.state.data.name}</Text>
                <div className="mt-1 flex items-center gap-2">
                  <Text variant="caption" tone="secondary">
                    {capabilityResult.state.data.category}
                  </Text>
                  <Guidance for="capability.category" size={14} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <RiskBadge risk={capabilityResult.state.data.risk_level} />
              <Guidance for="capability.risk" size={14} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="flex flex-col gap-6">
              <Card className="flex flex-col gap-5">
                <Section title="Outcome" guidanceKey="capability.outcome">
                  <Text variant="body" tone="secondary">
                    {capabilityResult.state.data.description}
                  </Text>
                </Section>

                {capabilityResult.state.data.intent ? (
                  <Section title="Intent" guidanceKey="capability.intent">
                    <Text variant="body-sm" tone="secondary">
                      {capabilityResult.state.data.intent}
                    </Text>
                  </Section>
                ) : null}

                {capabilityResult.state.data.supported_platforms &&
                capabilityResult.state.data.supported_platforms.length > 0 ? (
                  <Section title="Supported platforms" guidanceKey="capability.platforms">
                    <div className="flex flex-wrap gap-2">
                      {capabilityResult.state.data.supported_platforms.map((platform) => (
                        <span
                          key={platform}
                          className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-subtle px-3 py-1 text-xs font-medium text-ink"
                        >
                          <Server width={13} height={13} aria-hidden />
                          {platform}
                        </span>
                      ))}
                    </div>
                  </Section>
                ) : null}

                {capabilityResult.state.data.verification_strategy ? (
                  <Section title="How verification proves it" guidanceKey="capability.verification">
                    <div className="flex items-start gap-3 rounded-md border border-border bg-subtle p-4">
                      <ShieldCheck width={18} height={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                      <Text variant="body-sm" tone="secondary">
                        {capabilityResult.state.data.verification_strategy}
                      </Text>
                    </div>
                  </Section>
                ) : null}
              </Card>
            </div>

            <Card className="h-fit">
              <div className="mb-4 flex items-center gap-2">
                <Play width={18} height={18} className="text-brand" aria-hidden />
                <Text variant="h4">Start an Operation</Text>
                <Guidance for="capability.start" />
              </div>
              {nodesResult.state.status === 'loading' ? (
                <Loading label="Loading your Nodes" />
              ) : nodesResult.state.status === 'error' ? (
                <ErrorNote error={nodesResult.state.error} />
              ) : nodes.length === 0 ? (
                <EmptyState
                  icon={Server}
                  title="Connect a Node first"
                  description="A Capability runs on a Node. Connect one, then come back to start this Operation."
                />
              ) : (
                <StartOperation
                  capability={capabilityResult.state.data}
                  nodes={nodes}
                  initialNodeId={preselectedNode}
                />
              )}
            </Card>
          </div>
        </>
      ) : null}
    </OperatorShell>
  );
}
