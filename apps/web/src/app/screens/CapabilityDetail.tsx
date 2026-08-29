import {
  getCapability,
  getCapabilityStates,
  getNode,
  getOperation,
  listNodes,
  type Capability,
  type CapabilityState,
  type Node,
  type Operation,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import {
  ArrowLeft,
  ArrowRight,
  capabilityIcon,
  Database,
  History,
  KeyRound,
  ListChecks,
  Play,
  ScanSearch,
  Server,
  ShieldCheck,
} from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { DetailLayout, EmptyState } from '@slideops/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  completedHint,
  completionLabel,
  detectedHint,
  detectedLabel,
  isDetected,
} from '../capability-completion';
import { useCanWrite } from '../../store/workspace';
import { databaseManageStep } from '../database-credentials';
import { CompletionBadge, DetectedBadge, PluginSourceBadge, RiskBadge } from '../components/Badges';
import { CredentialsCard } from '../components/CredentialsCard';
import { ErrorNote, Loading } from '../components/Feedback';
import { CapabilityManagement } from '../components/CapabilityManagement';
import {
  DatabaseExplorer,
  DATABASE_EXPLORER_ACTION_KEYS,
  isExplorableDatabase,
} from '../components/DatabaseExplorer';
import { ContainerManager } from '../components/ContainerManager';
import { WebSitesManager, isWebSitesCapability } from '../components/WebSitesManager';
import { MessagingManager, isMessagingCapability } from '../components/MessagingManager';
import { StorageExplorer, isStorageCapability } from '../components/StorageExplorer';
import { SearchIndexManager, isSearchIndexCapability } from '../components/SearchIndexManager';
import { RuntimeManager, isRuntimeCapability } from '../components/RuntimeManager';
import { NetworkingManager, isNetworkingCapability } from '../components/NetworkingManager';
import { SecurityPosturePanel } from '../components/SecurityPosturePanel';
import { NodeHealth } from '../components/NodeHealth';
import { OperatorShell } from '../components/OperatorShell';
import { StartOperation } from '../components/StartOperation';
import { useAsyncData } from '../hooks/useAsyncData';

/** The four security Capabilities SecurityPosturePanel shows together. */
const SECURITY_CHECKLIST_KEYS = ['install-fail2ban', 'enable-auto-updates', 'enforce-key-only-ssh', 'server-audit'];

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
    <div className="py-5 first:pt-0 last:pb-0">
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
 * This Capability's outcome found already in place on the Node the Operator
 * arrived with, rather than carried out by SlideOps. There is no Operation behind
 * it, so there is nothing to link to and no credential to reveal: it states what
 * was found on the server and when, and leaves the decision to run it anyway with
 * the Operator. It never claims SlideOps did the work.
 */
function CapabilityAlreadyPresent({
  capabilityName,
  capabilityKey,
  state,
}: {
  capabilityName: string;
  capabilityKey: string;
  state: CapabilityState;
}) {
  return (
    <Card className="flex flex-col gap-4 border-info">
      <div className="flex flex-wrap items-center gap-3">
        <DetectedBadge label={detectedLabel(capabilityKey)} />
        <div className="flex items-center gap-2">
          <ScanSearch width={16} height={16} className="text-info" aria-hidden />
          <Text variant="body-sm" tone="secondary">
            {detectedHint(state)}
          </Text>
        </div>
      </div>
      <Text variant="body-sm" tone="secondary">
        {capabilityName} is already in place on this server, so there is nothing to do here.
        SlideOps did not carry this out, so there is no run to look back at and no credential it
        created. You can still run it from the panel on the right if you want SlideOps to apply its
        own settings.
      </Text>
    </Card>
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
  nodes,
}: {
  capabilityName: string;
  capabilityKey: string;
  done: CapabilityState;
  nodes: Node[];
}) {
  const navigate = useNavigate();
  const operationResult = useAsyncData<Operation>(
    (signal) => getOperation(done.last_operation_id ?? '', signal),
    [done.last_operation_id],
  );
  const operation = operationResult.state.status === 'ready' ? operationResult.state.data : null;

  // The Node address, so the credentials card can form a real connection. It
  // comes from the already-loaded Nodes when present, and is fetched only as a
  // fallback. It never blocks the card: an unresolved host just omits the host.
  const nodeId = operation?.node_id;
  const knownHost = nodeId ? nodes.find((node) => node.id === nodeId)?.address : undefined;
  const [fetchedHost, setFetchedHost] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!nodeId || knownHost) {
      return;
    }
    let active = true;
    getNode(nodeId)
      .then((node) => {
        if (active) {
          setFetchedHost(node.address);
        }
      })
      .catch(() => {
        // The host is a convenience; the card still works without it.
      });
    return () => {
      active = false;
    };
  }, [nodeId, knownHost]);
  const host = knownHost ?? fetchedHost;

  return (
    <Card className="flex flex-col gap-4 border-success">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CompletionBadge label={completionLabel(capabilityKey)} />
          <Text variant="body-sm" tone="secondary">
            {completedHint(capabilityKey, done.last_completed_at ?? '')}
          </Text>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate(`/app/operations/${done.last_operation_id}`)}
        >
          <History width={15} height={15} aria-hidden />
          View in History
        </Button>
      </div>
      <Text variant="body-sm" tone="secondary">
        {capabilityName} is already done on this server. Its details and any credentials it created
        are below; you can run it again from the panel on the right if you need to.
      </Text>
      {operation ? <CredentialsCard operation={operation} host={host} /> : null}
    </Card>
  );
}

/**
 * The next step after a database server is installed. Installing a database
 * starts the server but creates no application database, account, or password, so
 * an Operator has no credential and no obvious way forward. This calm callout
 * points at the manage Capability that creates that database, account, and
 * password. It shows only when this install is done on the server in context and
 * its manage step is not yet done there; once the manage step is done, the
 * credentials appear on their own and this steps aside. It renders nothing when
 * the Capability is not a database install, so a non-database page is untouched.
 */
function CreateDatabaseCredentials({
  capabilityKey,
  states,
  nodeId,
  projectId,
}: {
  capabilityKey: string;
  states: Record<string, CapabilityState>;
  nodeId: string;
  projectId?: string;
}) {
  const navigate = useNavigate();
  const step = databaseManageStep(capabilityKey);
  if (!step) {
    return null;
  }
  const installDone = Boolean(states[capabilityKey]);
  const manageDone = Boolean(states[step.manageKey]);
  if (!installDone || manageDone) {
    return null;
  }

  const manageHref = `/app/capabilities/${step.manageKey}?node=${nodeId}${
    projectId ? `&project=${projectId}` : ''
  }`;

  return (
    <Card className="flex flex-col gap-4 border-brand">
      <div className="flex items-center gap-2">
        <Database width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">One more step for a credential</Text>
      </div>
      <Text variant="body-sm" tone="secondary">
        {step.name} is installed and running. Create a database and account to get connection
        credentials, including a password, that you can use in your app.
      </Text>
      <div>
        <Button size="sm" onClick={() => navigate(manageHref)}>
          <KeyRound width={15} height={15} aria-hidden />
          Create database and account
        </Button>
      </div>
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
  const canWrite = useCanWrite();
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
  // The done-state of every Capability on the server in context, so a done
  // install can tell whether its matching manage step has been done too. While it
  // loads or if it fails, this stays empty and any nudge it would drive is hidden.
  const states = statesResult.state.status === 'ready' ? statesResult.state.data : {};
  const done = states[key];

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

      {capabilityResult.state.status === 'loading' ? (
        <Loading label="Loading this Capability" />
      ) : null}
      {capabilityResult.state.status === 'error' ? (
        <ErrorNote error={capabilityResult.state.error} />
      ) : null}
      {capabilityResult.state.status === 'ready' ? (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                {(() => {
                  const Icon = capabilityIcon(capabilityResult.state.data);
                  return <Icon width={22} height={22} aria-hidden />;
                })()}
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
                <Text variant="body-sm" tone="secondary" className="mt-1 max-w-2xl">
                  {capabilityResult.state.data.description}
                </Text>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {done ? (
                isDetected(done) ? (
                  <DetectedBadge label={detectedLabel(key)} />
                ) : (
                  <CompletionBadge label={completionLabel(key)} />
                )
              ) : null}
              <RiskBadge risk={capabilityResult.state.data.risk_level} />
              <Guidance for="capability.risk" size={14} />
            </div>
          </div>

          <DetailLayout
            main={
              <>
                {done && isDetected(done) ? (
                  <CapabilityAlreadyPresent
                    capabilityName={capabilityResult.state.data.name}
                    capabilityKey={key}
                    state={done}
                  />
                ) : null}
                {done && !isDetected(done) ? (
                  <CapabilityHere
                    capabilityName={capabilityResult.state.data.name}
                    capabilityKey={key}
                    done={done}
                    nodes={nodes}
                  />
                ) : null}
                {preselectedNode ? (
                  <CreateDatabaseCredentials
                    capabilityKey={key}
                    states={states}
                    nodeId={preselectedNode ?? ''}
                    projectId={preselectedProject}
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
                        <div
                          key={requirement.kind}
                          className="rounded-md border border-border bg-subtle p-4"
                        >
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

                {/* No frame around the document. These are parts of one page, and
                  a border around them said they were separate things. */}
                <div
                  id="capability-overview"
                  className="scroll-mt-24 flex flex-col divide-y divide-border"
                >
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

                  {/* Only once it is installed here, and only for a database
                    engine DatabaseExplorer knows how to draw. Before that
                    there is nothing to browse yet. */}
                  {done && preselectedNode && isExplorableDatabase(key) ? (
                    <Section title="Browse">
                      <Text variant="body-sm" tone="secondary" className="mb-3 block">
                        What is actually inside, a page at a time, searchable. Nothing here changes
                        anything.
                      </Text>
                      <DatabaseExplorer capabilityKey={key} nodeId={preselectedNode} />
                    </Section>
                  ) : null}

                  {/* The container runtime's own page is where "what is
                    actually running here" should be visible, not only on a
                    separate cross-server import screen. */}
                  {done && preselectedNode && key === 'enable-containers' ? (
                    <Section title="Containers">
                      <ContainerManager nodeId={preselectedNode} projectId={preselectedProject} />
                    </Section>
                  ) : null}

                  {done && preselectedNode && isWebSitesCapability(key) ? (
                    <Section title="Sites">
                      <WebSitesManager capabilityKey={key} nodeId={preselectedNode} />
                    </Section>
                  ) : null}

                  {done && preselectedNode && isMessagingCapability(key) ? (
                    <Section title={key === 'install-nats' ? 'Streams' : 'Queues'}>
                      <MessagingManager capabilityKey={key} nodeId={preselectedNode} />
                    </Section>
                  ) : null}

                  {done && preselectedNode && isStorageCapability(key) ? (
                    <Section title="Buckets">
                      <StorageExplorer capabilityKey={key} nodeId={preselectedNode} />
                    </Section>
                  ) : null}

                  {done && preselectedNode && isSearchIndexCapability(key) ? (
                    <Section title="Indexes">
                      <SearchIndexManager capabilityKey={key} nodeId={preselectedNode} />
                    </Section>
                  ) : null}

                  {done && preselectedNode && isRuntimeCapability(key) ? (
                    <Section title="Running now">
                      <RuntimeManager capabilityKey={key} nodeId={preselectedNode} />
                    </Section>
                  ) : null}

                  {done && preselectedNode && isNetworkingCapability(key) ? (
                    <Section title="Peers">
                      <NetworkingManager capabilityKey={key} nodeId={preselectedNode} />
                    </Section>
                  ) : null}

                  {/* Shown on any of the four security Capability pages, so
                    an Operator looking at one sees the whole posture rather
                    than only this one item. */}
                  {preselectedNode && SECURITY_CHECKLIST_KEYS.includes(key) ? (
                    <Section title="Security posture" guidanceKey="capability.security-posture">
                      <SecurityPosturePanel
                        states={states}
                        nodeId={preselectedNode}
                        projectId={preselectedProject}
                      />
                    </Section>
                  ) : null}

                  {/* The existing Node health panel, wired here instead of
                    living only as its own separate dashboard area. */}
                  {preselectedNode && key === 'enable-monitoring' ? (
                    <Section title="Health">
                      <NodeHealth nodeId={preselectedNode} />
                    </Section>
                  ) : null}

                  {/* Only once it is installed here. Before that there is nothing
                    to manage, and the page stays the description it always was. */}
                  <div id="capability-management" className="scroll-mt-24">
                    <CapabilityManagement
                      capabilityKey={key}
                      nodeId={preselectedNode ?? ''}
                      projectId={preselectedProject}
                      installed={Boolean(done)}
                      hideActionKeys={
                        isExplorableDatabase(key) ? DATABASE_EXPLORER_ACTION_KEYS : undefined
                      }
                    />
                  </div>

                  {capabilityResult.state.data.verification_strategy ? (
                    <div id="capability-verification" className="scroll-mt-24">
                      <Section
                        title="How verification proves it"
                        guidanceKey="capability.verification"
                      >
                        <div className="flex items-start gap-3 rounded-md border border-border bg-subtle p-4">
                          <ShieldCheck
                            width={18}
                            height={18}
                            className="mt-0.5 shrink-0 text-brand"
                            aria-hidden
                          />
                          <Text variant="body-sm" tone="secondary">
                            {capabilityResult.state.data.verification_strategy}
                          </Text>
                        </div>
                      </Section>
                    </div>
                  ) : null}
                </div>
              </>
            }
            rail={
              <Card className="h-fit">
                <div className="mb-4 flex items-center gap-2">
                  <Play width={18} height={18} className="text-brand" aria-hidden />
                  <Text variant="h4">{done ? 'Run again' : 'Start an Operation'}</Text>
                  <Guidance for="capability.start" />
                </div>
                {!canWrite ? (
                  <Text variant="body-sm" tone="secondary">
                    Starting an Operation needs a role above Viewer in this workspace.
                  </Text>
                ) : nodesResult.state.status === 'loading' ? (
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
            }
          />
        </>
      ) : null}
    </OperatorShell>
  );
}
