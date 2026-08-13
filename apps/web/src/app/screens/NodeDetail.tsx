import {
  nodeShellUrl,
  ApiError,
  discoverNode,
  getCapabilityStates,
  getNode,
  listCapabilities,
  type CapabilityState,
  type DiscoveryResult,
} from '@slideops/api-client';
import { Button, Card, Text, Section } from '@slideops/design-system';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  History,
  RefreshCw,
  RotateCcw,
  Server,
} from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { RunningHere } from '../components/RunningHere';
import { ServerReadiness } from '../components/ServerReadiness';
import { ShellTerminal } from '../components/ShellTerminal';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  completedHint,
  completionLabel,
  detectedHint,
  detectedLabel,
  isDetected,
  RE_RUN_LABEL,
  RUN_ANYWAY_LABEL,
} from '../capability-completion';
import { CompletionBadge, DetectedBadge } from '../components/Badges';
import { CapabilityCard } from '../components/CapabilityCard';
import { CredentialRotation } from '../components/CredentialRotation';
import { DiscoveryScan } from '../components/DiscoveryScan';
import { ErrorNote, Loading } from '../components/Feedback';
import { NodeCapacity } from '../components/NodeCapacity';
import { NodeHealth } from '../components/NodeHealth';
import { OperatorShell } from '../components/OperatorShell';
import { RevealValue } from '../components/RevealValue';
import { SecureServer, ServerPosture } from '../components/SecureServer';
import { ServerUsers } from '../components/ServerUsers';
import { TagsEditor } from '../components/TagsEditor';
import { useAsyncData } from '../hooks/useAsyncData';

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[8rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{value}</dd>
    </div>
  );
}

function AddressRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[8rem_1fr] sm:items-center sm:gap-3">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="min-w-0">
        <RevealValue value={value} label={label.toLowerCase()} sensitive />
      </dd>
    </div>
  );
}

/** The Node view: connection summary, Discovery, Assessment, and Capabilities. */
export function NodeDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const nodeResult = useAsyncData((signal) => getNode(id, signal), [id]);
  const capabilitiesResult = useAsyncData((signal) => listCapabilities({}, signal), []);

  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  // What is already in place on this server: the Capabilities SlideOps carried
  // out here, and the outcomes that were already there when SlideOps looked. An
  // Operator returning to a server they set up themselves, or from another
  // account, sees it as it is rather than as a blank slate. It re-reads after a
  // Discovery, since a fresh reading is what the detected half is drawn from. It
  // never blocks the list: while it loads or if it fails, the map stays empty and
  // the cards render as untouched.
  const statesResult = useAsyncData<Record<string, CapabilityState>>(
    (signal) => getCapabilityStates(id, undefined, signal),
    [id],
  );
  const states = statesResult.state.status === 'ready' ? statesResult.state.data : {};

  const recommendedKeys = new Set<string>(
    discovery?.assessment.recommendations.map((recommendation) => recommendation.capability_key) ??
      [],
  );

  // The badge that matches a Capability's state here: a completion SlideOps
  // recorded, or an outcome found already in place on the server.
  const capabilityBadge = (key: string, state: CapabilityState | undefined) => {
    if (!state) {
      return undefined;
    }
    return isDetected(state) ? (
      <DetectedBadge label={detectedLabel(key)} />
    ) : (
      <CompletionBadge label={completionLabel(key)} />
    );
  };

  // A Capability SlideOps carried out here links back to its run and offers a
  // quieter Re-run. One found already in place says what was found and offers
  // only the quiet action, since there is no run of ours to look back at. An
  // untouched one keeps the plain start action, with the recommendation note when
  // the Assessment suggests it.
  const capabilityFooter = (key: string, state: CapabilityState | undefined) => {
    const startHref = `/app/capabilities/${key}?node=${id}`;
    if (state && isDetected(state)) {
      return (
        <div className="flex flex-col gap-2">
          <Text variant="caption" tone="secondary">
            {detectedHint(state)}
          </Text>
          <div>
            <Button size="sm" variant="ghost" onClick={() => navigate(startHref)}>
              <RotateCcw width={15} height={15} aria-hidden />
              {RUN_ANYWAY_LABEL}
            </Button>
          </div>
        </div>
      );
    }
    if (state) {
      return (
        <div className="flex flex-col gap-2">
          <Text variant="caption" tone="secondary">
            {completedHint(key, state.last_completed_at ?? '')}
          </Text>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => navigate(`/app/operations/${state.last_operation_id}`)}
            >
              <History width={15} height={15} aria-hidden />
              View in History
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate(startHref)}>
              <RotateCcw width={15} height={15} aria-hidden />
              {RE_RUN_LABEL}
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={() => navigate(startHref)}>
          Start an Operation
          <ArrowRight width={15} height={15} aria-hidden />
        </Button>
        {recommendedKeys.has(key) ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <CheckCircle2 width={14} height={14} aria-hidden />
            Recommended here
          </span>
        ) : null}
      </div>
    );
  };

  const runDiscovery = async () => {
    setDiscovering(true);
    setDiscoverError(null);
    try {
      setDiscovery(await discoverNode(id));
      nodeResult.reload();
      statesResult.reload();
    } catch (error) {
      setDiscoverError(error instanceof ApiError ? error.message : 'Discovery did not complete.');
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <OperatorShell active="nodes">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/app/nodes')}>
        <ArrowLeft width={16} height={16} aria-hidden />
        All servers
      </Button>

      {nodeResult.state.status === 'loading' ? <Loading label="Loading this Node" /> : null}
      {nodeResult.state.status === 'error' ? <ErrorNote error={nodeResult.state.error} /> : null}
      {nodeResult.state.status === 'ready' ? (
        <>
          <PageHeader
            title={nodeResult.state.data.name}
            description={`${nodeResult.state.data.ssh_username}@${nodeResult.state.data.address}:${nodeResult.state.data.port}`}
            actions={
              <Button onClick={runDiscovery} disabled={discovering}>
                <RefreshCw
                  width={16}
                  height={16}
                  className={discovering ? 'animate-spin' : undefined}
                  aria-hidden
                />
                {discovering ? 'Discovering' : discovery ? 'Discover again' : 'Discover'}
              </Button>
            }
          />

          <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
            <div className="flex min-w-0 flex-col gap-8">
              <Card className="h-fit">
                <div className="mb-3 flex items-center gap-2">
                  <Server width={18} height={18} className="text-brand" aria-hidden />
                  <Text variant="h4">Connection</Text>
                </div>
                <dl className="divide-y divide-border">
                  <SummaryRow label="Hostname" value={nodeResult.state.data.hostname} />
                  <AddressRow label="Address" value={nodeResult.state.data.address} />
                  <SummaryRow label="Port" value={String(nodeResult.state.data.port)} />
                  <SummaryRow label="Username" value={nodeResult.state.data.ssh_username} />
                  <SummaryRow
                    label="Sign in"
                    value={
                      nodeResult.state.data.auth_kind === 'private_key' ? 'Private key' : 'Password'
                    }
                  />
                  <SummaryRow
                    label="System"
                    value={
                      nodeResult.state.data.distro
                        ? `${nodeResult.state.data.distro}${nodeResult.state.data.distro_version ? ` ${nodeResult.state.data.distro_version}` : ''}`
                        : 'Unknown until Discovery'
                    }
                  />
                  <SummaryRow label="Status" value={nodeResult.state.data.status} />
                </dl>
              </Card>

              <NodeCapacity nodeId={id} />

              <ServerPosture node={nodeResult.state.data} facts={discovery?.facts} />
            </div>

            <div className="flex min-w-0 flex-col gap-8">
              <SecureServer
                nodeId={id}
                onDiscover={runDiscovery}
                discovering={discovering}
                onRotate={() =>
                  document
                    .getElementById('server-settings')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              />

              <ServerReadiness nodeId={id} />

              <NodeHealth nodeId={id} />

              <Section title="Terminal">
                <ShellTerminal
                  standalonePath={`/app/nodes/${id}/shell`}
                  urlFor={(cols, rows) => nodeShellUrl(id, cols, rows)}
                  scopeLabel="This whole server"
                  scopeDetail="A shell on the server itself, as the SSH account SlideOps connects with: the same access you would have opening a terminal yourself. For a shell confined to one application, open it from that Service instead. Opening one is recorded in the audit trail."
                  unavailableReason={
                    nodeResult.state.data.status === 'unreachable'
                      ? 'This server is unreachable, so there is nothing to open a shell onto.'
                      : undefined
                  }
                />
              </Section>

              <Section title="Discovery" adornment={<Guidance for="node.discover" />}>
                {discovering ? <Loading label="Reading the Node, read only" /> : null}
                {discoverError ? (
                  <p role="alert" className="text-sm text-danger">
                    {discoverError}
                  </p>
                ) : null}
                {!discovering && !discovery && !discoverError ? (
                  <Text variant="body-sm" tone="secondary">
                    Run Discovery to read this Node over SSH. It gathers Facts and an Assessment,
                    and never changes anything.
                  </Text>
                ) : null}
                {discovery ? <DiscoveryScan result={discovery} /> : null}
              </Section>

              <RunningHere nodeId={id} />

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Text variant="h3">Available Capabilities</Text>
                  <Guidance for="node.capabilities" />
                </div>
                {capabilitiesResult.state.status === 'loading' ? (
                  <Loading label="Loading Capabilities" />
                ) : null}
                {capabilitiesResult.state.status === 'error' ? (
                  <ErrorNote error={capabilitiesResult.state.error} />
                ) : null}
                {capabilitiesResult.state.status === 'ready' ? (
                  <div className="rounded-md border border-border bg-surface px-3">
                    {capabilitiesResult.state.data.map((capability) => (
                      <CapabilityCard
                        key={capability.key}
                        capability={capability}
                        inPlace={Boolean(states[capability.key])}
                        badge={capabilityBadge(capability.key, states[capability.key])}
                        footer={capabilityFooter(capability.key, states[capability.key])}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <section id="server-settings" className="mt-10 scroll-mt-6">
            <div className="mb-4 flex items-center gap-2">
              <Text variant="h3">Server settings</Text>
              <Guidance for="server.settings" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <CredentialRotation
                node={nodeResult.state.data}
                onRotated={() => nodeResult.reload()}
              />
              <ServerUsers nodeId={id} node={nodeResult.state.data} />
              <TagsEditor node={nodeResult.state.data} onSaved={() => nodeResult.reload()} />
            </div>
          </section>
        </>
      ) : null}
    </OperatorShell>
  );
}
