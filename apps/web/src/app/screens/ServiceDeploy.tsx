import { zodResolver } from '@hookform/resolvers/zod';
import {
  ApiError,
  deployService,
  getTier,
  listNodes,
  listProjects,
  type Node,
  type Project,
  type TierInfo,
} from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { Container } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { useMemo, useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import {
  buildServiceSchema,
  toDeployInput,
  type QuotaHeadroom,
  type ServiceFormValues,
} from '../service-schema';
import { useAsyncData } from '../hooks/useAsyncData';

interface DeployData {
  projects: Project[];
  nodes: Node[];
  tier: TierInfo;
}

async function loadDeployData(signal: AbortSignal): Promise<DeployData> {
  const [projects, nodes, tier] = await Promise.all([
    listProjects(signal),
    listNodes(signal),
    getTier(signal),
  ]);
  return { projects, nodes, tier };
}

const inputClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

function headroomFor(tier: TierInfo): QuotaHeadroom {
  return {
    vcpu: Math.max(0, tier.limits.vcpu - tier.usage.vcpu_allocated),
    memory_mb: Math.max(0, tier.limits.memory_mb - tier.usage.memory_allocated_mb),
  };
}

/** The deploy form, rendered once the Projects, Nodes, and tier are loaded. */
function DeployForm({ data }: { data: DeployData }) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [quotaHit, setQuotaHit] = useState(false);

  const headroom = headroomFor(data.tier);
  const headroomRef = useRef(headroom);
  headroomRef.current = headroom;

  // Resolve against the latest headroom every validation, so the CPU and memory
  // ceilings always reflect the remaining quota read from the tier.
  const resolver = useMemo<Resolver<ServiceFormValues>>(
    () => (values, context, options) =>
      zodResolver(buildServiceSchema(headroomRef.current))(values, context, options),
    [],
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormValues>({
    resolver,
    defaultValues: {
      project_id: '',
      node_id: '',
      name: '',
      runtime: 'container',
      source_type: 'image',
      image: '',
      repository_url: '',
      build: '',
      command: '',
      cpu_limit: 0.5,
      memory_mb: 256,
      pids_limit: '',
      env: '',
      ports: '',
    },
  });

  const sourceType = watch('source_type');
  const runtime = watch('runtime');
  const servicesLeft = Math.max(0, data.tier.limits.services - data.tier.usage.services);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setQuotaHit(false);
    try {
      const service = await deployService(toDeployInput(values));
      navigate(`/app/services/${service.id}`, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'quota_exceeded') {
        setQuotaHit(true);
        setFormError(error.message);
        return;
      }
      setFormError(
        error instanceof ApiError ? error.message : 'The Service could not be deployed. Try again.',
      );
    }
  });

  return (
    <Card className="max-w-2xl">
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
        <span>
          Remaining this tier: {servicesLeft} Service{servicesLeft === 1 ? '' : 's'}, {headroom.vcpu}{' '}
          vCPU, {headroom.memory_mb} MB.
        </span>
        <Guidance for="services.quota" />
      </div>

      <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        <Field
          label="Name"
          placeholder="web"
          error={errors.name?.message}
          labelAdornment={<Guidance for="service.name" />}
          {...register('name')}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="project_id" className="text-sm font-medium text-ink">
                Project
              </label>
              <Guidance for="service.project" />
            </div>
            <select id="project_id" className={inputClass} defaultValue="" {...register('project_id')}>
              <option value="" disabled>
                Choose a Project
              </option>
              {data.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {errors.project_id ? (
              <p className="text-sm text-danger">{errors.project_id.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="node_id" className="text-sm font-medium text-ink">
                Node
              </label>
              <Guidance for="service.node" />
            </div>
            <select id="node_id" className={inputClass} defaultValue="" {...register('node_id')}>
              <option value="" disabled>
                Choose a Node
              </option>
              {data.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
            {errors.node_id ? <p className="text-sm text-danger">{errors.node_id.message}</p> : null}
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <legend className="text-sm font-medium text-ink">Runtime</legend>
            <Guidance for="service.runtime" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-subtle">
              <input type="radio" value="container" className="mt-0.5 accent-brand" {...register('runtime')} />
              <span>
                <span className="font-medium text-ink">Container</span>
                <span className="mt-0.5 block text-ink-muted">
                  Recommended. Runs the workload in Docker with the limits applied.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-subtle">
              <input type="radio" value="systemd" className="mt-0.5 accent-brand" {...register('runtime')} />
              <span>
                <span className="font-medium text-ink">systemd</span>
                <span className="mt-0.5 block text-ink-muted">
                  Runs a command as a unit with the limits set through the cgroup.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <legend className="text-sm font-medium text-ink">Source</legend>
            <Guidance for="service.source" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-subtle">
              <input type="radio" value="image" className="mt-0.5 accent-brand" {...register('source_type')} />
              <span>
                <span className="font-medium text-ink">Image</span>
                <span className="mt-0.5 block text-ink-muted">Run a prebuilt image.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-subtle">
              <input type="radio" value="repository" className="mt-0.5 accent-brand" {...register('source_type')} />
              <span>
                <span className="font-medium text-ink">Repository</span>
                <span className="mt-0.5 block text-ink-muted">Clone a repository and build it first.</span>
              </span>
            </label>
          </div>
        </fieldset>

        {sourceType === 'image' ? (
          <Field
            label="Image"
            placeholder="nginx:latest"
            error={errors.image?.message}
            labelAdornment={<Guidance for="service.image" />}
            {...register('image')}
          />
        ) : (
          <div className="grid gap-5">
            <Field
              label="Repository URL"
              placeholder="https://example.com/app.git"
              error={errors.repository_url?.message}
              labelAdornment={<Guidance for="service.repository" />}
              {...register('repository_url')}
            />
            <Field
              label="Build command (optional)"
              placeholder="docker build -t app ."
              error={errors.build?.message}
              {...register('build')}
            />
          </div>
        )}

        <Field
          label={runtime === 'systemd' ? 'Command' : 'Command (optional)'}
          placeholder={runtime === 'systemd' ? '/usr/bin/app --serve' : 'Override the entrypoint'}
          error={errors.command?.message}
          labelAdornment={<Guidance for="service.command" />}
          {...register('command')}
        />

        <div className="grid gap-5 sm:grid-cols-3">
          <Field
            label="vCPU limit"
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="0.5"
            error={errors.cpu_limit?.message}
            labelAdornment={<Guidance for="service.cpu" />}
            {...register('cpu_limit')}
          />
          <Field
            label="Memory (MB)"
            type="number"
            inputMode="numeric"
            placeholder="256"
            error={errors.memory_mb?.message}
            labelAdornment={<Guidance for="service.memory" />}
            {...register('memory_mb')}
          />
          <Field
            label="Process limit"
            type="number"
            inputMode="numeric"
            placeholder="Optional"
            error={errors.pids_limit?.message}
            labelAdornment={<Guidance for="service.pids" />}
            {...register('pids_limit')}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="ports" className="text-sm font-medium text-ink">
              Ports (optional)
            </label>
            <Guidance for="service.ports" />
          </div>
          <textarea
            id="ports"
            rows={2}
            spellCheck={false}
            placeholder="8080:80"
            className={`resize-y py-2 font-mono ${inputClass.replace('h-10', '')} ${errors.ports ? 'border-danger' : ''}`}
            {...register('ports')}
          />
          <Text variant="body-sm" tone="secondary">
            One mapping per line, written host:container.
          </Text>
          {errors.ports ? <p className="text-sm text-danger">{errors.ports.message}</p> : null}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="env" className="text-sm font-medium text-ink">
              Environment (optional)
            </label>
            <Guidance for="service.env" />
          </div>
          <textarea
            id="env"
            rows={3}
            spellCheck={false}
            placeholder="NODE_ENV=production"
            className={`resize-y py-2 font-mono ${inputClass.replace('h-10', '')} ${errors.env ? 'border-danger' : ''}`}
            {...register('env')}
          />
          <Text variant="body-sm" tone="secondary">
            One variable per line, written KEY=value. Secret values are stored encrypted and redacted.
          </Text>
          {errors.env ? <p className="text-sm text-danger">{errors.env.message}</p> : null}
        </div>

        {formError ? (
          <div role="alert" className="rounded-md border border-border bg-subtle px-4 py-3">
            <Text variant="body-sm" className="font-medium text-danger">
              {quotaHit ? 'Over your tier quota' : 'That did not go through'}
            </Text>
            <Text variant="body-sm" tone="secondary" className="mt-0.5">
              {formError}
            </Text>
            {quotaHit ? (
              <Text variant="body-sm" tone="secondary" className="mt-1">
                Remove a Service to free room, or ask an admin to raise your tier.
              </Text>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? 'Deploying' : 'Deploy Service'}
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={() => navigate('/app/services')}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Deploy a Service: choose a Project and Node, a source, a runtime, and limits within quota. */
export function ServiceDeploy() {
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => loadDeployData(signal), []);

  return (
    <OperatorShell active="services">
      <PageHeader
        title="Deploy a Service"
        description="Run one solution on a Node under hard CPU, memory, and process limits your tier allows. SlideOps deploys it and verifies it is running."
        guidanceKey="services.deploy"
      />

      {state.status === 'loading' ? <Loading label="Preparing the deploy form" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data.projects.length === 0 || state.data.nodes.length === 0 ? (
          <Card className="max-w-2xl">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                <Container width={18} height={18} aria-hidden />
              </span>
              <div>
                <Text variant="h4">A Project and a Node come first</Text>
                <Text variant="body-sm" tone="secondary" className="mt-1">
                  A Service runs on a Node inside a Project. Connect a Node
                  {state.data.projects.length === 0 ? ' and create a Project' : ''} before deploying.
                </Text>
                <div className="mt-4 flex flex-wrap gap-2">
                  {state.data.nodes.length === 0 ? (
                    <Button onClick={() => navigate('/app/nodes/new')}>Connect a Node</Button>
                  ) : null}
                  <Button variant="ghost" onClick={() => navigate('/app/services')}>
                    Back to Services
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <DeployForm data={state.data} />
        )
      ) : null}
    </OperatorShell>
  );
}
