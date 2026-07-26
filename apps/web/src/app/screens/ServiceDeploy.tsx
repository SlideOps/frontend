import { zodResolver } from '@hookform/resolvers/zod';
import {
  ApiError,
  deployService,
  getGitHubStatus,
  listGitHubRepos,
  listNodes,
  listProjects,
  type GitHubRepo,
  type GitHubStatus,
  type Node,
  type Project,
} from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { Container, GitBranch } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { buildServiceSchema, toDeployInput, type ServiceFormValues } from '../service-schema';
import { useAsyncData } from '../hooks/useAsyncData';

interface DeployData {
  projects: Project[];
  nodes: Node[];
  github: GitHubStatus;
  repos: GitHubRepo[];
}

async function loadDeployData(signal: AbortSignal): Promise<DeployData> {
  const [projects, nodes, github] = await Promise.all([
    listProjects(signal),
    listNodes(signal),
    // GitHub is optional here, so a failure or an unconfigured platform must not
    // block the deploy form; fall back to an unconnected status.
    getGitHubStatus(signal).catch(() => ({ configured: false, connected: false }) as GitHubStatus),
  ]);
  const repos = github.connected ? await listGitHubRepos(signal).catch(() => []) : [];
  return { projects, nodes, github, repos };
}

const inputClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** The deploy form, rendered once the Projects and Nodes are loaded. */
function DeployForm({ data, initialProjectId }: { data: DeployData; initialProjectId?: string }) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  // Preselect the Project only when it is one the Operator owns, so a stray
  // param never selects nothing.
  const preselectedProject =
    initialProjectId && data.projects.some((project) => project.id === initialProjectId)
      ? initialProjectId
      : '';

  const resolver = zodResolver(buildServiceSchema());

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormValues>({
    resolver,
    defaultValues: {
      project_id: preselectedProject,
      node_id: '',
      name: '',
      runtime: 'container',
      source_type: 'image',
      image: '',
      repository_url: '',
      branch: 'main',
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

  // Filling in a repository from the connected GitHub account sets the clone URL
  // and defaults the branch to that repository's default branch.
  const onPickRepo = (fullName: string) => {
    const repo = data.repos.find((entry) => entry.full_name === fullName);
    if (!repo) {
      return;
    }
    setValue('repository_url', repo.clone_url, { shouldValidate: true });
    setValue('branch', repo.default_branch, { shouldValidate: true });
  };
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const service = await deployService(toDeployInput(values));
      navigate(`/app/services/${service.id}`, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'The Service could not be deployed. Try again.',
      );
    }
  });

  return (
    <Card className="max-w-2xl">
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
        <span>
          The CPU, memory, and process limits below run on your own server and are yours to set.
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
            <select
              id="project_id"
              className={inputClass}
              defaultValue={preselectedProject}
              {...register('project_id')}
            >
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
            {data.github.connected && data.repos.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="github_repo" className="text-sm font-medium text-ink">
                    From GitHub (optional)
                  </label>
                  <Guidance for="service.githubRepo" />
                </div>
                <select
                  id="github_repo"
                  className={inputClass}
                  defaultValue=""
                  onChange={(event) => onPickRepo(event.target.value)}
                >
                  <option value="">Choose a repository to fill the URL and branch</option>
                  {data.repos.map((repo) => (
                    <option key={repo.full_name} value={repo.full_name}>
                      {repo.full_name}
                      {repo.private ? ' (private)' : ''}
                    </option>
                  ))}
                </select>
                <Text variant="body-sm" tone="secondary" className="flex items-center gap-1.5">
                  <GitBranch width={14} height={14} aria-hidden />
                  Connected as {data.github.login ?? 'your GitHub account'}. Picking a repository fills
                  the URL and branch below.
                </Text>
              </div>
            ) : null}
            <Field
              label="Repository URL"
              placeholder="https://github.com/you/app.git"
              error={errors.repository_url?.message}
              labelAdornment={<Guidance for="service.repository" />}
              {...register('repository_url')}
            />
            <Field
              label="Branch"
              placeholder="main"
              error={errors.branch?.message}
              labelAdornment={<Guidance for="service.branch" />}
              {...register('branch')}
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
            placeholder={'DATABASE_URL=postgres://user@host:5432/db\nsecret:SECRET_ENCRYPTION_KEY=…'}
            className={`resize-y py-2 font-mono ${inputClass.replace('h-10', '')} ${errors.env ? 'border-danger' : ''}`}
            {...register('env')}
          />
          <Text variant="body-sm" tone="secondary">
            One variable per line, written <code>KEY=value</code>. Prefix a line with{' '}
            <code>secret:</code> to seal that value — it is encrypted, never shown again, and revealed
            only to the deploy itself. Anything unprefixed is stored as you typed it and stays
            readable, so seal what is sensitive and leave the rest plain.
          </Text>
          {errors.env ? <p className="text-sm text-danger">{errors.env.message}</p> : null}
        </div>

        {formError ? (
          <div role="alert" className="rounded-md border border-border bg-subtle px-4 py-3">
            <Text variant="body-sm" className="font-medium text-danger">
              That did not go through
            </Text>
            <Text variant="body-sm" tone="secondary" className="mt-0.5">
              {formError}
            </Text>
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
  const [searchParams] = useSearchParams();
  // Deploying from inside a Project preselects it here via ?project=.
  const initialProjectId = searchParams.get('project') ?? undefined;
  const { state } = useAsyncData((signal) => loadDeployData(signal), []);

  return (
    <OperatorShell active="services">
      <PageHeader
        title="Deploy a Service"
        description="Run one solution on a Node under the CPU, memory, and process limits you choose on your own server. SlideOps deploys it and verifies it is running."
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
          <DeployForm data={state.data} initialProjectId={initialProjectId} />
        )
      ) : null}
    </OperatorShell>
  );
}
