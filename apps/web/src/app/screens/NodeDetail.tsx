import {
  ApiError,
  discoverNode,
  getNode,
  listCapabilities,
  type Assessment,
  type DiscoveryResult,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Server,
  ShieldCheck,
} from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CapabilityCard } from '../components/CapabilityCard';
import { CredentialRotation } from '../components/CredentialRotation';
import { ErrorNote, Loading } from '../components/Feedback';
import { FactsView } from '../components/FactsView';
import { NodeHealth } from '../components/NodeHealth';
import { OperatorShell } from '../components/OperatorShell';
import { SecureServer, ServerPosture } from '../components/SecureServer';
import { ServerUsers } from '../components/ServerUsers';
import { useAsyncData } from '../hooks/useAsyncData';

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-2">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{value}</dd>
    </div>
  );
}

function AssessmentView({ assessment }: { assessment: Assessment }) {
  return (
    <div className="flex flex-col gap-4">
      {assessment.summary ? (
        <Text variant="body" tone="secondary">
          {assessment.summary}
        </Text>
      ) : null}
      {assessment.findings.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {assessment.findings.map((finding, index) => (
            <li key={index} className="flex items-start gap-3">
              <ShieldCheck width={18} height={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <div>
                <Text variant="body-sm" className="font-medium">
                  {finding.title}
                </Text>
                <Text variant="body-sm" tone="secondary" className="mt-0.5">
                  {finding.detail}
                </Text>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {assessment.recommendations.length > 0 ? (
        <div className="rounded-md border border-border bg-subtle p-4">
          <Text variant="caption" tone="secondary">
            Recommended
          </Text>
          <ul className="mt-2 flex flex-col gap-2">
            {assessment.recommendations.map((recommendation, index) => (
              <li key={index}>
                <Text variant="body-sm">{recommendation.reason}</Text>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** The Node view: connection summary, Discovery, Assessment, and Capabilities. */
export function NodeDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const nodeResult = useAsyncData((signal) => getNode(id, signal), [id]);
  const capabilitiesResult = useAsyncData((signal) => listCapabilities(undefined, signal), []);

  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  const recommendedKeys = new Set<string>(
    discovery?.assessment.recommendations.map((recommendation) => recommendation.capability_key) ??
      [],
  );

  const runDiscovery = async () => {
    setDiscovering(true);
    setDiscoverError(null);
    try {
      setDiscovery(await discoverNode(id));
      nodeResult.reload();
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
            <div className="flex flex-col gap-6">
            <Card className="h-fit">
              <div className="mb-3 flex items-center gap-2">
                <Server width={18} height={18} className="text-brand" aria-hidden />
                <Text variant="h4">Connection</Text>
              </div>
              <dl className="divide-y divide-border">
                <SummaryRow label="Hostname" value={nodeResult.state.data.hostname} />
                <SummaryRow label="Address" value={nodeResult.state.data.address} />
                <SummaryRow label="Port" value={String(nodeResult.state.data.port)} />
                <SummaryRow label="Username" value={nodeResult.state.data.ssh_username} />
                <SummaryRow
                  label="Sign in"
                  value={nodeResult.state.data.auth_kind === 'private_key' ? 'Private key' : 'Password'}
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

            <ServerPosture node={nodeResult.state.data} facts={discovery?.facts} />
            </div>

            <div className="flex flex-col gap-6">
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

              <NodeHealth nodeId={id} />

              <Card>
                <div className="mb-4 flex items-center gap-2">
                  <Text variant="h4">Discovery</Text>
                  <Guidance for="node.discover" />
                </div>
                {discovering ? <Loading label="Reading the Node, read only" /> : null}
                {discoverError ? (
                  <p role="alert" className="text-sm text-danger">
                    {discoverError}
                  </p>
                ) : null}
                {!discovering && !discovery && !discoverError ? (
                  <Text variant="body-sm" tone="secondary">
                    Run Discovery to read this Node over SSH. It gathers Facts and an Assessment, and
                    never changes anything.
                  </Text>
                ) : null}
                {discovery ? (
                  <div className="flex flex-col gap-6">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Text variant="caption" tone="secondary">
                          Assessment
                        </Text>
                        <Guidance for="node.assessment" />
                      </div>
                      <AssessmentView assessment={discovery.assessment} />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Text variant="caption" tone="secondary">
                          Facts
                        </Text>
                        <Guidance for="node.facts" />
                      </div>
                      <FactsView facts={discovery.facts} />
                    </div>
                  </div>
                ) : null}
              </Card>

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
                  <div className="grid gap-4">
                    {capabilitiesResult.state.data.map((capability) => (
                      <CapabilityCard
                        key={capability.key}
                        capability={capability}
                        footer={
                          <div className="flex items-center gap-3">
                            <Button
                              size="sm"
                              onClick={() =>
                                navigate(`/app/capabilities/${capability.key}?node=${id}`)
                              }
                            >
                              Start an Operation
                              <ArrowRight width={15} height={15} aria-hidden />
                            </Button>
                            {recommendedKeys.has(capability.key) ? (
                              <span className="inline-flex items-center gap-1 text-xs text-success">
                                <CheckCircle2 width={14} height={14} aria-hidden />
                                Recommended here
                              </span>
                            ) : null}
                          </div>
                        }
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
              <ServerUsers nodeId={id} />
            </div>
          </section>
        </>
      ) : null}
    </OperatorShell>
  );
}
