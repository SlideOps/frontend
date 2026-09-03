import {
  ApiError,
  listProjectNodes,
  listServices,
  setProjectRouting,
  type Node,
  type Service,
} from '@slideops/api-client';
import { Button, Field, Section, Text } from '@slideops/design-system';
import { Check, Network, Trash2 } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanWrite } from '../../store/workspace';
import { useAsyncData } from '../hooks/useAsyncData';
import { ErrorNote, Loading } from './Feedback';

interface RoutingData {
  nodes: Node[];
  services: Service[];
}

async function loadRouting(projectId: string, signal: AbortSignal): Promise<RoutingData> {
  const [nodes, allServices] = await Promise.all([
    listProjectNodes(projectId, signal),
    listServices(signal),
  ]);
  const services = allServices.filter((service) => service.project_id === projectId);
  return { nodes, services };
}

/** One host port a Service occupies on a named server, for the allocation view. */
interface PortAllocation {
  key: string;
  service: string;
  host: number;
  server: string;
}

/**
 * Flatten the Project's Services into one row per published host port, naming the
 * server each sits on so a collision across Projects sharing a Node is visible.
 */
function portAllocations(nodes: Node[], services: Service[]): PortAllocation[] {
  const serverName = new Map(nodes.map((node) => [node.id, node.name]));
  const rows: PortAllocation[] = [];
  for (const service of services) {
    for (const port of service.ports ?? []) {
      rows.push({
        key: `${service.id}:${port.host}`,
        service: service.name,
        host: port.host,
        server: serverName.get(service.node_id) ?? service.node_id,
      });
    }
  }
  return rows.sort((a, b) => a.host - b.host);
}

const INVALID_DOMAIN_HINT = 'That does not look like a domain. Use something like app.example.com.';

/**
 * The Project's routing: the domain requests reach it by, and the host ports its
 * Services occupy on each server. An Operator running several Projects on one
 * shared Node sets a domain so requests are reachable by name, sees which ports
 * this Project holds so it is clear which Project a request reaches, and can jump
 * to the reverse-proxy Capability to route the domain to a Service.
 */
export function ProjectRouting({ projectId, domain }: { projectId: string; domain: string }) {
  const navigate = useNavigate();
  const canWrite = useCanWrite();
  const { state } = useAsyncData((signal) => loadRouting(projectId, signal), [projectId]);

  const [savedDomain, setSavedDomain] = useState(domain);
  const [value, setValue] = useState(domain);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);

  const save = async (next: string) => {
    setSaving(true);
    setFieldError(null);
    setActionError(null);
    try {
      const updated = await setProjectRouting(projectId, next);
      setSavedDomain(updated.domain);
      setValue(updated.domain);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'invalid_domain') {
        setFieldError(INVALID_DOMAIN_HINT);
      } else if (error instanceof ApiError) {
        setActionError(error);
      } else {
        setActionError(new ApiError(0, 'unknown', 'The domain could not be saved. Try again.'));
      }
    } finally {
      setSaving(false);
    }
  };

  const ready = state.status === 'ready' ? state.data : null;
  const firstServer = ready?.nodes[0];
  const allocations = ready ? portAllocations(ready.nodes, ready.services) : [];

  return (
    <Section
      title="Routing"
      description="Give this Project a domain so requests reach it by name, and see which host ports its Services occupy on each server so it stays clear which Project a request reaches."
      adornment={<Guidance for="project.routing" />}
    >
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Text variant="body-sm" className="font-medium">
              Domain
            </Text>
          </div>
          {savedDomain ? (
            <Text variant="body-sm" tone="secondary" className="mb-3">
              This Project answers to <span className="font-medium text-ink">{savedDomain}</span>.
            </Text>
          ) : (
            <Text variant="body-sm" tone="secondary" className="mb-3">
              No domain set yet. Set one below so requests can reach this Project by name.
            </Text>
          )}

          {canWrite ? (
            <div className="flex flex-col gap-3 sm:max-w-md">
              <Field
                label="Domain"
                placeholder="app.example.com"
                value={value}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                hint="A lowercase hostname, with no scheme, port, or path."
                error={fieldError ?? undefined}
                disabled={saving}
                onChange={(event) => setValue(event.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => save(value.trim())} disabled={saving}>
                  <Check width={15} height={15} aria-hidden />
                  {saving ? 'Saving' : 'Save domain'}
                </Button>
                {savedDomain ? (
                  <Button variant="ghost" onClick={() => save('')} disabled={saving}>
                    <Trash2 width={15} height={15} aria-hidden />
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <Text variant="body-sm" tone="secondary">
              Setting or clearing the domain needs a role above Viewer in this workspace.
            </Text>
          )}

          {actionError ? (
            <div className="mt-3">
              <ErrorNote error={actionError} />
            </div>
          ) : null}

          <Text variant="body-sm" tone="secondary" className="mt-3 max-w-2xl">
            Point the domain's DNS at this Project's server: an A record to the server address, and
            an AAAA record too if you use IPv6. Once it resolves, set up a reverse proxy to serve
            the domain and route its requests to one of this Project's Services.
          </Text>
        </div>

        <div className="border-t border-border pt-5">
          <div className="mb-3 flex items-center gap-2">
            <Network width={16} height={16} className="text-brand" aria-hidden />
            <Text variant="body-sm" className="font-medium">
              Host ports in use
            </Text>
          </div>

          {state.status === 'loading' ? (
            <Loading label="Reading this Project's port allocation" />
          ) : null}
          {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
          {ready ? (
            allocations.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {allocations.map((allocation) => (
                  <li
                    key={allocation.key}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-subtle px-2.5 py-1.5 text-sm text-ink"
                  >
                    <span className="font-medium">{allocation.service}</span>
                    <span className="text-brand">:{allocation.host}</span>
                    <span className="text-ink-muted">on {allocation.server}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Text variant="body-sm" tone="secondary">
                No host ports are published by this Project's Services yet.
              </Text>
            )
          ) : null}
        </div>

        {firstServer ? (
          <div className="border-t border-border pt-5">
            <Text variant="body-sm" tone="secondary" className="mb-3 max-w-2xl">
              Route the domain to a Service with a reverse proxy. The Capability guides the rest,
              from the plan to the verification.
            </Text>
            <Button
              variant="secondary"
              onClick={() =>
                navigate(
                  `/app/capabilities/configure-reverse-proxy?node=${firstServer.id}&project=${projectId}`,
                )
              }
            >
              <Network width={15} height={15} aria-hidden />
              Set up reverse proxy
            </Button>
          </div>
        ) : null}
    </Section>
  );
}
