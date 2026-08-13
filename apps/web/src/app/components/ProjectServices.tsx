import { listServices, type Service } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ChevronRight, Container, Plus, serviceIcon } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useNavigate } from 'react-router-dom';
import { ServiceStatusBadge } from './Badges';
import { ErrorNote, Loading } from './Feedback';
import { ServiceMetricsInline } from './ServiceMetrics';
import { useAsyncData } from '../hooks/useAsyncData';

/** The Services deployed in this Project, with status and a link to each. */
export function ProjectServices({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { state } = useAsyncData(
    async (signal): Promise<Service[]> => {
      const services = await listServices(signal);
      return services.filter((service) => service.project_id === projectId);
    },
    [projectId],
  );

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Container width={20} height={20} className="text-brand" aria-hidden />
          <Text variant="h3">Services</Text>
          <Guidance for="project.services" />
        </div>
        <Button size="sm" onClick={() => navigate(`/app/services/new?project=${projectId}`)}>
          <Plus width={15} height={15} aria-hidden />
          Deploy a Service
        </Button>
      </div>
      <Text variant="body-sm" tone="secondary" className="mb-4 max-w-2xl">
        The Services running in this Project, each on one of its servers under hard resource limits.
      </Text>

      {state.status === 'loading' ? <Loading label="Loading this Project's Services" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center">
            <Text variant="body-sm" tone="secondary">
              No Services in this Project yet. Deploy one from an image or a connected repository.
            </Text>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {state.data.map((service) => {
              const Icon = serviceIcon(service.source.image);
              return (
              <button
                key={service.id}
                type="button"
                onClick={() => navigate(`/app/services/${service.id}`)}
                className="flex w-full items-center gap-4 rounded-md border border-border bg-surface px-4 py-3 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                  <Icon width={18} height={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <Text variant="body-sm" className="font-medium">
                    {service.name}
                  </Text>
                  <Text variant="body-sm" tone="secondary" className="truncate">
                    {service.runtime === 'systemd' ? 'systemd' : 'container'}
                  </Text>
                </span>
                <span className="hidden shrink-0 sm:block">
                  <ServiceMetricsInline id={service.id} running={service.status === 'running'} />
                </span>
                <ServiceStatusBadge status={service.status} />
                <ChevronRight
                  width={18}
                  height={18}
                  className="shrink-0 text-ink-muted"
                  aria-hidden
                />
              </button>
              );
            })}
          </div>
        )
      ) : null}
    </section>
  );
}
