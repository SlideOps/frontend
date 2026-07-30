import {
  ApiError,
  deployService,
  getSampleApp,
  listNodes,
  listProjects,
  type Node,
  type Project,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { CheckCircle2, Rocket } from '@slideops/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsyncData } from '../hooks/useAsyncData';
import { ErrorNote, Loading } from './Feedback';

/*
 * A one click way to prove a fresh setup works. It deploys a tiny Hello World
 * from a public repository, so no GitHub connection is needed, onto a Project and
 * a server the Operator already has. When it comes up and answers, that single
 * green Service proves four things at once: the server connection, the container
 * runtime, the deploy pipeline, and public access. On success the Operator lands
 * on the Service detail to watch it deploy, run, and reach the public URL live.
 */

// A gentle default allocation for a workload this small, and a host port that is
// unlikely to collide with the local dev preview on 8090. Kept editable so a
// clash is a quick change rather than a dead end.
const SAMPLE_SERVICE_NAME = 'sample-app';
const SAMPLE_CPU_LIMIT = 0.5;
const SAMPLE_MEMORY_MB = 128;
const SAMPLE_PIDS_LIMIT = 128;
const DEFAULT_HOST_PORT = 8081;
const MIN_PORT = 1;
const MAX_PORT = 65535;

const inputClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

interface LaunchData {
  projects: Project[];
  nodes: Node[];
}

async function loadLaunchData(signal: AbortSignal): Promise<LaunchData> {
  const [projects, nodes] = await Promise.all([listProjects(signal), listNodes(signal)]);
  return { projects, nodes };
}

/** The four outcomes a green sample proves, shown so the point stays clear. */
function ProofPoints() {
  const points = [
    'Your server connection',
    'The container runtime',
    'The deploy pipeline',
    'Public access',
  ];
  return (
    <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {points.map((point) => (
        <li key={point} className="flex items-center gap-2 text-sm text-ink-muted">
          <CheckCircle2 width={15} height={15} className="shrink-0 text-success" aria-hidden />
          {point}
        </li>
      ))}
    </ul>
  );
}

/** The launch controls, rendered once a Project with an assigned server exists. */
function LaunchForm({ data }: { data: LaunchData }) {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [hostPort, setHostPort] = useState(String(DEFAULT_HOST_PORT));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // A Service runs on a server assigned to its Project, so the server choices are
  // exactly the ones assigned to the picked Project.
  const assignedNodes = projectId ? data.nodes.filter((node) => node.project_id === projectId) : [];

  const portNumber = Number(hostPort);
  const portValid =
    hostPort.trim() !== '' &&
    Number.isInteger(portNumber) &&
    portNumber >= MIN_PORT &&
    portNumber <= MAX_PORT;
  const canDeploy = projectId !== '' && nodeId !== '' && portValid && !busy;

  const onProjectChange = (value: string) => {
    setProjectId(value);
    // The old server may not belong to the new Project, so clear the choice.
    setNodeId('');
  };

  const onDeploy = async () => {
    if (!canDeploy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sample = await getSampleApp();
      const service = await deployService({
        project_id: projectId,
        node_id: nodeId,
        name: SAMPLE_SERVICE_NAME,
        runtime: 'container',
        source: {
          type: 'repository',
          repository_url: sample.repository_url,
          branch: sample.branch,
        },
        cpu_limit: SAMPLE_CPU_LIMIT,
        memory_mb: SAMPLE_MEMORY_MB,
        pids_limit: SAMPLE_PIDS_LIMIT,
        ports: [{ host: portNumber, container: sample.container_port }],
      });
      // Land on the Service detail so the Operator watches deploying turn to
      // running, sees the public URL, and the live Preview: the proof it is up.
      navigate(`/app/services/${service.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, 'unknown_error', 'The sample app could not be deployed. Try again.'),
      );
      setBusy(false);
    }
  };

  const noAssignedNodes = projectId !== '' && assignedNodes.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="sample-project" className="text-sm font-medium text-ink">
            Project
          </label>
          <select
            id="sample-project"
            className={inputClass}
            value={projectId}
            onChange={(event) => onProjectChange(event.target.value)}
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
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="sample-node" className="text-sm font-medium text-ink">
            Server
          </label>
          <select
            id="sample-node"
            className={inputClass}
            value={nodeId}
            disabled={projectId === '' || assignedNodes.length === 0}
            onChange={(event) => setNodeId(event.target.value)}
          >
            <option value="" disabled>
              {projectId === '' ? 'Choose a Project first' : 'Choose a server'}
            </option>
            {assignedNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:max-w-[16rem]">
        <label htmlFor="sample-port" className="text-sm font-medium text-ink">
          Host port
        </label>
        <input
          id="sample-port"
          type="number"
          inputMode="numeric"
          min={MIN_PORT}
          max={MAX_PORT}
          className={inputClass}
          value={hostPort}
          onChange={(event) => setHostPort(event.target.value)}
          aria-describedby="sample-port-help"
        />
        <Text id="sample-port-help" variant="body-sm" tone="secondary">
          The port on your server the sample answers on. Change it if {DEFAULT_HOST_PORT} is taken.
        </Text>
        {hostPort.trim() !== '' && !portValid ? (
          <p className="text-sm text-danger">
            Enter a port between {MIN_PORT} and {MAX_PORT}.
          </p>
        ) : null}
      </div>

      {noAssignedNodes ? (
        <div className="rounded-md border border-dashed border-border bg-surface px-4 py-3">
          <Text variant="body-sm" tone="secondary">
            This Project has no server assigned yet. Assign one to it, then deploy the sample.
          </Text>
        </div>
      ) : null}

      {error ? <ErrorNote error={error} /> : null}

      <div>
        <Button size="lg" onClick={onDeploy} disabled={!canDeploy} aria-busy={busy}>
          <Rocket width={18} height={18} aria-hidden />
          {busy ? 'Deploying the sample' : 'Deploy sample app'}
        </Button>
      </div>
    </div>
  );
}

/** Guidance shown when no Project, or no assigned server, exists to deploy onto. */
function LaunchGuidance({ data }: { data: LaunchData }) {
  const navigate = useNavigate();
  const hasProject = data.projects.length > 0;
  return (
    <div className="rounded-md border border-dashed border-border bg-surface px-5 py-6">
      <Text variant="body-sm" tone="secondary">
        {hasProject
          ? 'Assign a connected server to one of your Projects, then come back to deploy the sample.'
          : 'Create a Project and assign a connected server to it, then come back to deploy the sample.'}
      </Text>
      <div className="mt-4 flex flex-wrap gap-2">
        {hasProject ? (
          <Button size="sm" onClick={() => navigate('/app/projects')}>
            Open Projects
          </Button>
        ) : (
          <Button size="sm" onClick={() => navigate('/app/projects')}>
            Create a Project
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => navigate('/app/nodes')}>
          View servers
        </Button>
      </div>
    </div>
  );
}

/**
 * The Deploy sample app panel. It loads the Operator's Projects and servers, then
 * either offers the one click launch or guides the Operator to the missing piece.
 */
export function SampleAppDeploy() {
  const { state } = useAsyncData((signal) => loadLaunchData(signal), []);

  // A server must be assigned to a Project for a deploy to have somewhere to land.
  const hasAssignableTarget =
    state.status === 'ready' &&
    state.data.projects.length > 0 &&
    state.data.nodes.some((node) => node.project_id !== null);

  return (
    <Card className="max-w-2xl">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
          <Rocket width={18} height={18} aria-hidden />
        </span>
        <div className="min-w-0">
          <Text variant="h4">Validate your setup with a sample app</Text>
          <Text variant="body-sm" tone="secondary" className="mt-1">
            Deploy a tiny Hello World to confirm your whole setup works. When it runs and answers,
            you have your proof.
          </Text>
        </div>
      </div>

      <div className="mt-4">
        <ProofPoints />
      </div>

      <div className="mt-5">
        {state.status === 'loading' ? <Loading label="Checking your Projects and servers" /> : null}
        {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
        {state.status === 'ready' ? (
          hasAssignableTarget ? (
            <LaunchForm data={state.data} />
          ) : (
            <LaunchGuidance data={state.data} />
          )
        ) : null}
      </div>
    </Card>
  );
}
