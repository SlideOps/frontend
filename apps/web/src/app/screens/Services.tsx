import {
  listNodes,
  listProjects,
  listServices,
  type Node,
  type Project,
  type Service,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ChevronRight, Container, Plus, ScanSearch } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useNavigate } from 'react-router-dom';
import { AdoptedBadge, ServiceStatusBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { SampleAppDeploy } from '../components/SampleAppDeploy';
import { ServiceMetricsInline } from '../components/ServiceMetrics';
import { useAsyncData } from '../hooks/useAsyncData';

interface ServicesData {
  services: Service[];
  projects: Map<string, Project>;
  nodes: Map<string, Node>;
}

async function loadServices(signal: AbortSignal): Promise<ServicesData> {
  const [services, projects, nodes] = await Promise.all([
    listServices(signal),
    listProjects(signal).catch(() => [] as Project[]),
    listNodes(signal).catch(() => [] as Node[]),
  ]);
  return {
    services,
    projects: new Map(projects.map((project) => [project.id, project])),
    nodes: new Map(nodes.map((node) => [node.id, node])),
  };
}

function ServiceRow({
  service,
  projectName,
  nodeName,
  onOpen,
}: {
  service: Service;
  projectName: string;
  nodeName: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-md border border-border bg-surface px-4 py-3 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
        <Container width={18} height={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <Text variant="body-sm" className="font-medium">
          {service.name}
        </Text>
        <Text variant="body-sm" tone="secondary" className="truncate">
          {projectName} · {nodeName} · {service.runtime === 'systemd' ? 'systemd' : 'container'}
        </Text>
        {/* Where it answers, on the list itself. An Operator running several
            applications on one server should not have to open each one to find
            out which address belongs to which. */}
        {service.public_urls && service.public_urls[0] ? (
          <Text variant="caption" tone="secondary" className="mt-0.5 block truncate font-mono">
            {service.public_urls[0].replace(/^https?:\/\//, '')}
          </Text>
        ) : null}
      </span>
      <span className="hidden shrink-0 sm:block">
        <ServiceMetricsInline id={service.id} running={service.status === 'running'} />
      </span>
      {service.adopted ? <AdoptedBadge /> : null}
      <ServiceStatusBadge status={service.status} />
      <ChevronRight width={18} height={18} className="shrink-0 text-ink-muted" aria-hidden />
    </button>
  );
}

/** The Services list: every deployed Service, with status and live usage. */
export function Services() {
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => loadServices(signal), []);

  return (
    <OperatorShell active="services">
      <PageHeader
        title="Services"
        description="Everything you have deployed, and the address each one answers on. Several can share one server: SlideOps gives each its own port and its own web address, so they cannot take each other's."
        guidanceKey="services.overview"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/app/services/import')}>
              <ScanSearch width={16} height={16} aria-hidden />
              Import what is running
            </Button>
            <Button onClick={() => navigate('/app/services/new')}>
              <Plus width={16} height={16} aria-hidden />
              Deploy a Service
            </Button>
          </>
        }
      />

      {state.status === 'loading' ? <Loading label="Loading your Services" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        <div className="flex flex-col gap-8">
          <SampleAppDeploy />
          {state.data.services.length === 0 ? (
            <EmptyState
              icon={Container}
              title="No Services here yet"
              description="A Service is one solution running on a Node under hard resource limits. Deploy one from an image or a repository, or import an app you were already running on a server before you found SlideOps."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button onClick={() => navigate('/app/services/new')}>Deploy your first Service</Button>
                  <Button variant="secondary" onClick={() => navigate('/app/services/import')}>
                    Import what is already running
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {state.data.services.map((service) => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  projectName={state.data.projects.get(service.project_id)?.name ?? 'Unknown Project'}
                  nodeName={state.data.nodes.get(service.node_id)?.name ?? 'Unknown Node'}
                  onOpen={() => navigate(`/app/services/${service.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </OperatorShell>
  );
}
