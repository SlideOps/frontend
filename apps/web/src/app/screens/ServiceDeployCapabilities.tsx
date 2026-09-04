import { zodResolver } from '@hookform/resolvers/zod';
import {
  ApiError,
  deployCapabilities,
  listCapabilities,
  type Capability,
  type Node,
  type Project,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { capabilityIcon, Play } from '@slideops/icons';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  buildParameterSchema,
  cleanParameterValues,
  defaultParameterValues,
} from '../parameter-schema';
import { ParameterFields } from '../components/ParameterFields';
import { useAsyncData } from '../hooks/useAsyncData';

/**
 * The backing-service Capabilities a Capability Service can be built from:
 * every engine a Project's application would connect to at runtime --
 * databases, message brokers, cache, search, and object storage -- each with
 * a full install/configure/verify Provider behind it. Node-level setup
 * (language runtimes, web servers, orchestration, security hardening) stays
 * out of this list: those are platform choices for the Node itself, not
 * something a Project "depends on" the way it depends on its own database.
 */
export const SUPPORTED_CAPABILITY_KEYS = [
  'install-postgresql',
  'install-redis',
  'install-mysql',
  'install-mariadb',
  'install-mongodb',
  'install-rabbitmq',
  'install-nats',
  'install-memcached',
  'install-minio',
  'install-meilisearch',
] as const;

const selectClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';
const inputClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export interface CapabilityParamsHandle {
  /** Validates this Capability's own parameters and resolves with them, or
   * with null when invalid -- its own fields already show why. */
  submit: () => Promise<Record<string, unknown> | null>;
}

/**
 * One selected Capability's own parameter form, namespaced by having its own
 * useForm instance rather than sharing fields with the others: ParameterFields
 * registers by a parameter's raw key, so two selected Capabilities that both
 * declare, say, a version parameter would collide in one shared form.
 */
export const CapabilityParamsBlock = forwardRef<
  CapabilityParamsHandle,
  { capability: Capability; nodeId: string }
>(function CapabilityParamsBlock({ capability, nodeId }, ref) {
  const parameters = useMemo(() => capability.parameters ?? [], [capability]);
  const schema = useMemo(() => buildParameterSchema(parameters), [parameters]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues: defaultParameterValues(parameters),
  });

  useImperativeHandle(ref, () => ({
    submit: () =>
      new Promise((resolve) => {
        void handleSubmit(
          (values) => resolve(cleanParameterValues(values)),
          () => resolve(null),
        )();
      }),
  }));

  if (parameters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <Text variant="body-sm" className="font-medium">
        {capability.name}
      </Text>
      <ParameterFields
        idPrefix={`param-${capability.key}`}
        parameters={parameters}
        register={register}
        errors={errors}
        nodeId={nodeId}
        capabilityKey={capability.key}
      />
    </div>
  );
});

/**
 * The Capabilities deploy flow: choose a Node, choose the engines a Project
 * needs, configure each one's own parameters, deploy the set as one
 * Capability Service.
 *
 * Each Capability still runs as its own real Operation once submitted, so
 * this form's job ends at collecting what to run and where -- the plan,
 * approval-by-deploying, execution, and verification all happen exactly as
 * they do for a single Capability started on its own.
 */
export function ServiceDeployCapabilities({
  projects,
  nodes,
  initialProjectId,
}: {
  projects: Project[];
  nodes: Node[];
  initialProjectId?: string;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState(
    initialProjectId && projects.some((p) => p.id === initialProjectId)
      ? initialProjectId
      : (projects[0]?.id ?? ''),
  );
  const [nodeId, setNodeId] = useState(nodes[0]?.id ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { state: catalogState } = useCapabilityCatalog(projectId);

  const refs = useRef<Record<string, CapabilityParamsHandle | null>>({});

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  if (nodes.length === 0) {
    return (
      <Text variant="body-sm" tone="secondary">
        Connect a Node to deploy a Capability Service.
      </Text>
    );
  }
  if (projects.length === 0) {
    return (
      <Text variant="body-sm" tone="secondary">
        Create a Project to deploy a Capability Service.
      </Text>
    );
  }

  const selectedCapabilities =
    catalogState.status === 'ready'
      ? catalogState.data.filter((c) => selected.has(c.key))
      : [];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Name your Capability Service.');
      return;
    }
    if (!projectId) {
      setError('Choose a Project this service belongs to.');
      return;
    }
    if (!nodeId) {
      setError('Choose a Node to deploy on.');
      return;
    }
    if (selectedCapabilities.length === 0) {
      setError('Choose at least one capability to deploy.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const results = await Promise.all(
        selectedCapabilities.map(async (c) => {
          const handle = refs.current[c.key];
          const params = handle ? await handle.submit() : {};
          return { key: c.key, params };
        }),
      );
      if (results.some((r) => r.params === null)) {
        // A per-capability field is invalid; its own form already shows why.
        setSubmitting(false);
        return;
      }
      const service = await deployCapabilities({
        name,
        project_id: projectId,
        node_id: nodeId,
        capabilities: results.map((r) => ({
          capability_key: r.key,
          parameters: r.params && Object.keys(r.params).length > 0 ? r.params : undefined,
        })),
      });
      navigate(`/app/services/${service.id}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The capability service could not be deployed.');
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="capability-service-name" className="text-sm font-medium text-ink">
            Name
          </label>
          <input
            id="capability-service-name"
            className={inputClass}
            placeholder="infra"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="capability-service-project" className="text-sm font-medium text-ink">
              Project
            </label>
            <select
              id="capability-service-project"
              className={selectClass}
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="capability-service-node" className="text-sm font-medium text-ink">
              Node
            </label>
            <select
              id="capability-service-node"
              className={selectClass}
              value={nodeId}
              onChange={(event) => setNodeId(event.target.value)}
            >
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Text variant="body-sm" className="font-medium">
            Capabilities
          </Text>
          {catalogState.status === 'loading' ? (
            <Text variant="body-sm" tone="secondary">
              Loading the capability catalog…
            </Text>
          ) : null}
          {catalogState.status === 'error' ? (
            <Text variant="body-sm" tone="secondary">
              The capability catalog could not be read.
            </Text>
          ) : null}
          {catalogState.status === 'ready' ? (
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
              {catalogState.data.map((c) => (
                <li key={c.key}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-subtle">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      checked={selected.has(c.key)}
                      onChange={() => toggle(c.key)}
                    />
                    {(() => {
                      const Icon = capabilityIcon(c);
                      return <Icon width={15} height={15} className="shrink-0 text-ink-muted" aria-hidden />;
                    })()}
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {selectedCapabilities.map((c) => (
          <CapabilityParamsBlock
            key={c.key}
            capability={c}
            nodeId={nodeId}
            ref={(handle) => {
              refs.current[c.key] = handle;
            }}
          />
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={submitting}>
            <Play width={15} height={15} aria-hidden />
            {submitting ? 'Deploying' : 'Deploy'}
          </Button>
          <Text variant="body-sm" tone="secondary">
            Each capability runs as its own Operation, recorded in History.
          </Text>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

/** Loads the supported database Capabilities from the catalog. Passes the
 *  chosen Project through: a Capability a Project's installed Plugins unlock
 *  (on top of the always-available Core ones) is otherwise invisible here,
 *  the same context every other catalog read in this app already supplies. */
function useCapabilityCatalog(projectId: string) {
  return useAsyncData(
    async (signal) => {
      const all = await listCapabilities({ projectId: projectId || undefined }, signal);
      const byKey = new Map(all.map((c) => [c.key, c]));
      return SUPPORTED_CAPABILITY_KEYS.map((key) => byKey.get(key)).filter(
        (c): c is Capability => Boolean(c),
      );
    },
    [projectId],
  );
}
