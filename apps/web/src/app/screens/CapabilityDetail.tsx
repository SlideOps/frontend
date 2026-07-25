import {
  getCapability,
  getCapabilityStates,
  getOperation,
  listNodes,
  type Capability,
  type CapabilityState,
  type Node,
  type Operation,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowLeft, ArrowRight, History, Layers, ListChecks, Play, Server, ShieldCheck } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState } from '@slideops/ui';
import type { ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { completedHint, completionLabel } from '../capability-completion';
import { CompletionBadge, PluginSourceBadge, RiskBadge } from '../components/Badges';
import { CredentialsCard } from '../components/CredentialsCard';
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
 * The state of this Capability on the Node the Operator arrived with: that it is
 * already done, when it last completed, a link back to that run in History, and
 * any credentials it produced, revealed and copied from the owning Operation. It
 * loads that Operation so a database password or similar is shown right here
 * rather than only in History. It renders nothing until the Operation is loaded.
 */
function CapabilityHere({
  capabilityName,
  capabilityKey,
  done,
}: {
  capabilityName: string;
  capabilityKey: string;
  done: CapabilityState;
}) {
  const navigate = useNavigate();
  const operationResult = useAsyncData<Operation>(
    (signal) => getOperation(done.last_operation_id, signal),
    [done.last_operation_id],
  );
  const operation = operationResult.state.status === 'ready' ? operationResult.state.data : null;

  return (
    <Card className="flex flex-col gap-4 border-success">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CompletionBadge label={completionLabel(capabilityKey)} />
          <Text variant="body-sm" tone="secondary">
            {completedHint(capabilityKey, done.last_completed_at)}
          </Text>
        </div>
        <Button size="sm" variant="secondary" onClick={() => navigate(`/app/operations/${done.last_operation_id}`)}>
          <History width={15} height={15} aria-hidden />
          View in History
        </Button>
      </div>
      <Text variant="body-sm" tone="secondary">
        {capabilityName} is already done on this server. Its details and any credentials it created are
        below; you can run it again from the panel on the right if you need to.
      </Text>
      {operation ? <CredentialsCard operation={operation} /> : null}
    </Card>
  );
}

/**
 * The Capability detail: the outcome it delivers, the intent behind it, its
 * risk, the platforms it supports, and how verification proves it worked. When
 * the Operator arrives with a server in context, it also shows whether the
 * Capability is already done there and the credentials it produced. From here an
 * Operator starts an Operation on a chosen Node, filling in any inputs the
 * Capability declares through the generated form.
 */
export function CapabilityDetail() {
  const { key = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedNode = searchParams.get('node') ?? undefined;
  // A Plugin Capability started from a Project carries ?project=; a Core
  // Capability carries none, so this stays undefined and no project_id is sent.
  const preselectedProject = searchParams.get('project') ?? undefined;

  const capabilityResult = useAsyncData<Capability>((signal) => getCapability(key, signal), [key]);
  const nodesResult = useAsyncData<Node[]>((signal) => listNodes(signal), []);
  const nodes = nodesResult.state.status === 'ready' ? nodesResult.state.data : [];

  // When the Operator arrived with a server in context, learn whether this
  // Capability is already done there. Without a server there is no per-server
  // state to show, so this resolves empty and the page reads as a fresh start.
  const statesResult = useAsyncData<Record<string, CapabilityState>>(
    (signal) =>
      preselectedNode
        ? getCapabilityStates(preselectedNode, preselectedProject, signal)
        : Promise.resolve({}),
    [preselectedNode, preselectedProject],
  );
  const done = statesResult.state.status === 'ready' ? statesResult.state.data[key] : undefined;

  return (
    <OperatorShell active="capabilities">
      <button
        type="button"
        onClick={() => navigate('/app/capabilities')}
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
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Text variant="caption" tone="secondary">
                    {capabilityResult.state.data.category}
                  </Text>
                  <Guidance for="capability.category" size={14} />
                  <PluginSourceBadge capability={capabilityResult.state.data} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {done ? <CompletionBadge label={completionLabel(key)} /> : null}
              <RiskBadge risk={capabilityResult.state.data.risk_level} />
              <Guidance for="capability.risk" size={14} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="flex min-w-0 flex-col gap-6">
              {done ? (
                <CapabilityHere
                  capabilityName={capabilityResult.state.data.name}
                  capabilityKey={key}
                  done={done}
                />
              ) : null}
              {capabilityResult.state.data.requirements &&
              capabilityResult.state.data.requirements.length > 0 ? (
                <Card className="flex flex-col gap-4 border-warning">
                  <div className="flex items-center gap-2">
                    <ListChecks width={18} height={18} className="text-warning" aria-hidden />
                    <Text variant="h4">Before you start</Text>
                  </div>
                  <Text variant="body-sm" tone="secondary">
                    Set these up first so this Capability works the way you expect.
                  </Text>
                  <div className="flex flex-col gap-3">
                    {capabilityResult.state.data.requirements.map((requirement) => (
                      <div key={requirement.kind} className="rounded-md border border-border bg-subtle p-4">
                        <Text variant="body-sm" className="font-medium text-ink">
                          {requirement.title}
                        </Text>
                        <Text variant="body-sm" tone="secondary" className="mt-1">
                          {requirement.description}
                        </Text>
                        <Text variant="body-sm" tone="secondary" className="mt-2">
                          <span className="font-medium text-ink">How: </span>
                          {requirement.how_to}
                        </Text>
                        {requirement.setup_capability_key || requirement.setup_path ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                requirement.setup_capability_key
                                  ? `/app/capabilities/${requirement.setup_capability_key}`
                                  : (requirement.setup_path ?? '/app'),
                              )
                            }
                            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                          >
                            Set this up
                            <ArrowRight width={15} height={15} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}

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
                <Text variant="h4">{done ? 'Run again' : 'Start an Operation'}</Text>
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
                  initialProjectId={preselectedProject}
                />
              )}
            </Card>
          </div>
        </>
      ) : null}
    </OperatorShell>
  );
}
