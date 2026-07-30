import {
  getCapabilityStates,
  listCapabilities,
  listNodes,
  listProjectNodes,
  type Capability,
  type CapabilityState,
  type Node,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ArrowRight, History, Layers, RotateCcw, Server } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState } from '@slideops/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  completedHint,
  completionLabel,
  detectedHint,
  detectedLabel,
  isDetected,
  RE_RUN_LABEL,
  RUN_ANYWAY_LABEL,
} from '../capability-completion';
import { useAsyncData } from '../hooks/useAsyncData';
import { CompletionBadge, DetectedBadge } from './Badges';
import { CapabilityCard } from './CapabilityCard';
import { ErrorNote, Loading } from './Feedback';

interface CapabilitiesData {
  capabilities: Capability[];
  nodes: Node[];
  assignedIDs: Set<string>;
}

async function loadCapabilities(projectId: string, signal: AbortSignal): Promise<CapabilitiesData> {
  const [capabilities, assigned, all] = await Promise.all([
    listCapabilities({ projectId }, signal),
    listProjectNodes(projectId, signal),
    listNodes(signal).catch(() => [] as Node[]),
  ]);
  // Every server the Operator owns can run these, with the Project's own servers
  // offered first. Restricting this to assigned servers meant a Project with
  // Plugins installed but no server assigned showed nothing at all, hiding the
  // install completely -- while Services have always deployed to any server, so
  // the two surfaces disagreed with each other.
  const assignedIDs = new Set(assigned.map((node) => node.id));
  const nodes = [...assigned, ...all.filter((node) => !assignedIDs.has(node.id))];
  return { capabilities, nodes, assignedIDs };
}

/** Whether a Capability comes from a Plugin, so it must run with Project context. */
function isPluginCapability(capability: Capability): boolean {
  return Boolean(capability.plugin_id && capability.plugin_id.toLowerCase() !== 'core');
}

const selectClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * The Capabilities available in this Project: the Core security Capabilities plus
 * the Capabilities this Project's installed Plugins add. A Plugin Capability must
 * run with Project context, so its start link carries both a chosen assigned
 * server and this Project; a Core Capability carries only the server. When no
 * server is assigned yet, this prompts to assign one first.
 */
export function ProjectCapabilities({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => loadCapabilities(projectId, signal), [projectId]);
  const [serverId, setServerId] = useState('');

  const ready = state.status === 'ready' ? state.data : null;
  const nodes = ready?.nodes ?? [];
  const chosen = serverId || nodes[0]?.id || '';

  // Which Capabilities are already in place on the chosen server: the ones
  // SlideOps carried out, from History, and the ones that were already there when
  // SlideOps looked, from the server's own Discovery. Either way the card says so,
  // so an Operator who set the server up before finding SlideOps is met where they
  // are. It never blocks the list: while it loads or if it fails, the map stays
  // empty and the cards simply render as untouched.
  const statesResult = useAsyncData<Record<string, CapabilityState>>(
    (signal) => (chosen ? getCapabilityStates(chosen, projectId, signal) : Promise.resolve({})),
    [chosen, projectId],
  );
  const states = statesResult.state.status === 'ready' ? statesResult.state.data : {};

  const startHref = (capability: Capability): string => {
    const base = `/app/capabilities/${capability.key}?node=${chosen}`;
    return isPluginCapability(capability) ? `${base}&project=${projectId}` : base;
  };

  // A Capability SlideOps carried out leads back to its record in History and
  // offers a quieter Re-run, so it never reads like a fresh first-time action.
  // One found already in place says what was found and offers only the quiet
  // action, since there is no run of ours to look back at. An untouched one keeps
  // the plain start action.
  const capabilityFooter = (capability: Capability, state: CapabilityState | undefined) => {
    if (!state) {
      return (
        <Button size="sm" onClick={() => navigate(startHref(capability))}>
          Start an Operation
          <ArrowRight width={15} height={15} aria-hidden />
        </Button>
      );
    }
    if (isDetected(state)) {
      return (
        <div className="flex flex-col gap-2">
          <Text variant="caption" tone="secondary">
            {detectedHint(state)}
          </Text>
          <div>
            <Button size="sm" variant="ghost" onClick={() => navigate(startHref(capability))}>
              <RotateCcw width={15} height={15} aria-hidden />
              {RUN_ANYWAY_LABEL}
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <Text variant="caption" tone="secondary">
          {completedHint(capability.key, state.last_completed_at ?? '')}
        </Text>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => navigate(`/app/operations/${state.last_operation_id}`)}>
            <History width={15} height={15} aria-hidden />
            View in History
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate(startHref(capability))}>
            <RotateCcw width={15} height={15} aria-hidden />
            {RE_RUN_LABEL}
          </Button>
        </div>
      </div>
    );
  };

  // The badge that matches the state: a completion SlideOps recorded, or an
  // observation of the server as it already was.
  const capabilityBadge = (capability: Capability, state: CapabilityState | undefined) => {
    if (!state) {
      return undefined;
    }
    return isDetected(state) ? (
      <DetectedBadge label={detectedLabel(capability.key)} />
    ) : (
      <CompletionBadge label={completionLabel(capability.key)} />
    );
  };

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Layers width={20} height={20} className="text-brand" aria-hidden />
        <Text variant="h3">Capabilities available here</Text>
        <Guidance for="project.capabilities" />
      </div>
      <Text variant="body-sm" tone="secondary" className="mb-4 max-w-2xl">
        The Core security Capabilities plus the ones this Project's installed Plugins unlock. Start
        an Operation on one of this Project's servers; a Plugin Capability runs with this Project's
        context.
      </Text>

      {state.status === 'loading' ? (
        <Loading label="Loading the Capabilities for this Project" />
      ) : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {ready ? (
        nodes.length === 0 ? (
          <EmptyState
            icon={Server}
            title="Assign a server first"
            description="A Capability runs on a server. Assign a server to this Project above, then come back to start an Operation here."
          />
        ) : (
          <>
            <div className="mb-4 flex max-w-md flex-wrap items-center gap-3">
              <label htmlFor="capability-server" className="text-sm font-medium text-ink">
                Run on server
              </label>
              <select
                id="capability-server"
                className={`${selectClass} max-w-xs`}
                value={chosen}
                onChange={(event) => setServerId(event.target.value)}
              >
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                    {ready && !ready.assignedIDs.has(node.id)
                      ? ', not assigned to this Project'
                      : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {ready.capabilities.map((capability) => {
                const state = states[capability.key];
                return (
                  <CapabilityCard
                    key={capability.key}
                    capability={capability}
                    badge={capabilityBadge(capability, state)}
                    footer={capabilityFooter(capability, state)}
                  />
                );
              })}
            </div>
          </>
        )
      ) : null}
    </section>
  );
}
