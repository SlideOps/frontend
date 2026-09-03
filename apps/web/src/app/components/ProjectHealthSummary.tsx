import {
  getCapabilityStates,
  getReadiness,
  listProjectNodes,
  listServices,
  type Node,
  type Readiness,
  type Service,
} from '@slideops/api-client';
import { Button, Section, Text, cn } from '@slideops/design-system';
import { AlertTriangle, CheckCircle2, Globe, Layers, Rocket, Sparkles } from '@slideops/icons';
import { useNavigate } from 'react-router-dom';
import { useAsyncData } from '../hooks/useAsyncData';
import { ServiceStatusBadge } from './Badges';
import { ErrorNote, Loading } from './Feedback';

interface NodeHealth {
  node: Node;
  /** Null when Readiness could not be read; treated as "nothing to report" rather than an issue. */
  readiness: Readiness | null;
  capabilitiesInPlace: number;
}

interface HealthData {
  services: Service[];
  nodeHealth: NodeHealth[];
}

/**
 * Every signal here already exists as its own live read elsewhere in the
 * product (a Service's own status, a Node's own Readiness, a Node's own
 * Capability states); this only fans out over the Project's own Nodes and
 * Services to gather them in one place, so there is nothing new to keep
 * consistent with those other pages.
 */
async function loadHealth(projectId: string, signal: AbortSignal): Promise<HealthData> {
  const [allServices, nodes] = await Promise.all([
    listServices(signal),
    listProjectNodes(projectId, signal),
  ]);
  const services = allServices.filter((service) => service.project_id === projectId);
  const nodeHealth = await Promise.all(
    nodes.map(async (node): Promise<NodeHealth> => {
      const [readiness, states] = await Promise.all([
        getReadiness(node.id, signal).catch(() => null),
        getCapabilityStates(node.id, projectId, signal).catch(() => ({})),
      ]);
      const capabilitiesInPlace = Object.values(states).filter(
        (entry) => entry.status === 'done' || entry.status === 'detected',
      ).length;
      return { node, readiness, capabilitiesInPlace };
    }),
  );
  return { services, nodeHealth };
}

/**
 * An at a glance read of the whole Project: is anything down, is any server
 * missing something it should have, and how much is actually running here.
 * Not a new dashboard subsystem, just a fan out over reads that already
 * exist and are already cheap, so an Operator does not have to open every
 * Service and every Node in turn to answer "is everything OK".
 */
export function ProjectHealthSummary({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => loadHealth(projectId, signal), [projectId]);

  return (
    <Section title="Health" description="What's running, what's missing, and where to go next.">
      {state.status === 'loading' ? <Loading label="Reading this Project's health" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        <HealthBody data={state.data} projectId={projectId} navigate={navigate} />
      ) : null}
    </Section>
  );
}

function HealthBody({
  data,
  projectId,
  navigate,
}: {
  data: HealthData;
  projectId: string;
  navigate: (to: string) => void;
}) {
  const { services, nodeHealth } = data;
  const failedServices = services.filter((service) => service.status === 'failed');
  const essentialsMissing = nodeHealth.reduce(
    (sum, entry) => sum + (entry.readiness?.essentials_missing ?? 0),
    0,
  );
  const issueCount = failedServices.length + essentialsMissing;
  const softwareServices = services.filter((service) => service.deployment_type === 'software');
  const capabilityServices = services.filter((service) => service.deployment_type === 'capability');
  const totalCapabilitiesInPlace = nodeHealth.reduce(
    (sum, entry) => sum + entry.capabilitiesInPlace,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-2',
          issueCount > 0 ? 'border-warning/40 bg-subtle' : 'border-success/40 bg-subtle',
        )}
      >
        {issueCount > 0 ? (
          <AlertTriangle width={16} height={16} className="shrink-0 text-warning" aria-hidden />
        ) : (
          <CheckCircle2 width={16} height={16} className="shrink-0 text-success" aria-hidden />
        )}
        <Text variant="body-sm" className={issueCount > 0 ? 'text-warning' : 'text-success'}>
          {issueCount === 0
            ? 'All systems operational'
            : `${issueCount} ${issueCount === 1 ? 'issue' : 'issues'} to look at`}
        </Text>
      </div>

      {services.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Text variant="caption" tone="secondary">
            Software ({softwareServices.length})
          </Text>
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {softwareServices.map((service) => (
              <li
                key={service.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <Text variant="body-sm" className="truncate text-ink">
                  {service.name}
                </Text>
                <ServiceStatusBadge status={service.status} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-subtle px-3 py-2">
        <Text variant="body-sm" tone="secondary">
          {capabilityServices.length} Capability {capabilityServices.length === 1 ? 'Service' : 'Services'},{' '}
          {totalCapabilitiesInPlace} Capabilities in place across {nodeHealth.length}{' '}
          {nodeHealth.length === 1 ? 'server' : 'servers'}
          {essentialsMissing > 0
            ? `, ${essentialsMissing} essential ${essentialsMissing === 1 ? 'measure' : 'measures'} missing`
            : ''}
          .
        </Text>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/app/services/new?project=${encodeURIComponent(projectId)}&type=software`)}
        >
          <Rocket width={14} height={14} aria-hidden />
          Deploy
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            navigate(`/app/services/new?project=${encodeURIComponent(projectId)}&type=capabilities`)
          }
        >
          <Sparkles width={14} height={14} aria-hidden />
          Add a Capability
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate(`?tab=services`)}>
          <Layers width={14} height={14} aria-hidden />
          Services
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate(`?tab=domains`)}>
          <Globe width={14} height={14} aria-hidden />
          Domains
        </Button>
      </div>
    </div>
  );
}
