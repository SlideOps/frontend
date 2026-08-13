import {
  adoptWorkload,
  ApiError,
  createProject,
  listNodeWorkloads,
  listNodes,
  listProjects,
  type Node,
  type Project,
  type Workload,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowRight, Container, Plus, RefreshCw, ScanSearch, Server, serviceIcon } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ServiceStatusBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * Import what is already running.
 *
 * A server rarely arrives empty. An Operator who ran apps on it before they
 * found SlideOps, or who set it up from a different account, should not have to
 * deploy those apps again to see them here. This screen reads a server, lists the
 * workloads already on it, and brings the chosen ones under management in a
 * Project. Nothing on the server is started, stopped, or rebuilt: the workload
 * keeps running exactly as it was and simply appears in the Workspace from now
 * on.
 *
 * Databases, web servers, and the like are deliberately absent: those are
 * Capabilities, and they already show as in place on the server's own page.
 */

/** The backend's own wording where there is one, and a plain fallback otherwise. */
function message(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

const selectClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

interface ImportData {
  nodes: Node[];
  projects: Project[];
}

async function loadImportData(signal: AbortSignal): Promise<ImportData> {
  const [nodes, projects] = await Promise.all([listNodes(signal), listProjects(signal)]);
  return { nodes, projects };
}

/** The limits a workload runs under, or a plain note that none were set. */
function limitsLabel(workload: Workload): string {
  if (workload.cpu_limit <= 0 && workload.memory_mb <= 0) {
    return 'No resource limits set';
  }
  const cpu = workload.cpu_limit > 0 ? `${workload.cpu_limit} vCPU` : 'no CPU limit';
  const memory = workload.memory_mb > 0 ? `${workload.memory_mb} MB` : 'no memory limit';
  return `${cpu} · ${memory}`;
}

/** What the workload is, in one line: its image or its unit description. */
function whatItIs(workload: Workload): string {
  if (workload.runtime === 'container') {
    return workload.image || 'Container';
  }
  return workload.description || 'Service unit';
}

/** One workload offered for import, with what it is and where it listens. */
function WorkloadRow({
  workload,
  busy,
  onAdopt,
  onOpen,
}: {
  workload: Workload;
  busy: boolean;
  onAdopt: () => void;
  onOpen: () => void;
}) {
  const ports = workload.ports.map((port) => port.host).join(', ');
  const Icon = workload.runtime === 'container' ? serviceIcon(workload.image) : Server;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-surface px-4 py-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
        <Icon width={18} height={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <Text variant="body-sm" className="font-medium">
          {workload.name}
        </Text>
        <Text variant="body-sm" tone="secondary" className="truncate">
          {whatItIs(workload)} · {workload.runtime === 'systemd' ? 'systemd' : 'container'}
          {ports ? ` · port ${ports}` : ''} · {limitsLabel(workload)}
        </Text>
      </span>
      <ServiceStatusBadge status={workload.status} />
      {workload.adopted ? (
        <Button size="sm" variant="ghost" onClick={onOpen}>
          Already managed
          <ArrowRight width={15} height={15} aria-hidden />
        </Button>
      ) : (
        <Button size="sm" onClick={onAdopt} disabled={busy}>
          {busy ? 'Importing…' : 'Import'}
        </Button>
      )}
    </div>
  );
}

/** The screen: pick a server, pick a Project, and import what is already there. */
export function ServiceImport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state } = useAsyncData((signal) => loadImportData(signal), []);
  const ready = state.status === 'ready' ? state.data : null;

  const [nodeId, setNodeId] = useState(searchParams.get('node') ?? '');
  const [projectId, setProjectId] = useState('');
  const [workloads, setWorkloads] = useState<Workload[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busyRef, setBusyRef] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Fall back to the first server and Project the Operator has, so the screen is
  // usable the moment it loads rather than after two selections.
  const chosenNode = nodeId || ready?.nodes[0]?.id || '';
  const chosenProject = projectId || ready?.projects[0]?.id || '';

  const scan = useCallback(async (id: string) => {
    if (!id) {
      return;
    }
    setScanning(true);
    setError(null);
    try {
      setWorkloads(await listNodeWorkloads(id));
    } catch (caught) {
      setWorkloads(null);
      setError(
        message(caught, 'This server could not be read. Check it is reachable and try again.'),
      );
    } finally {
      setScanning(false);
    }
  }, []);

  // Read the chosen server as soon as there is one, so the Operator sees what is
  // already running without having to ask for it.
  useEffect(() => {
    void scan(chosenNode);
  }, [chosenNode, scan]);

  const adopt = async (workload: Workload) => {
    if (!chosenProject) {
      setError('Create a Project first, so the imported Service has somewhere to live.');
      return;
    }
    setBusyRef(workload.ref);
    setError(null);
    setNote(null);
    try {
      const adopted = await adoptWorkload(chosenNode, {
        project_id: chosenProject,
        ref: workload.ref,
        runtime: workload.runtime,
      });
      setNote(`${adopted.name} is now managed by SlideOps. It kept running throughout.`);
      await scan(chosenNode);
    } catch (caught) {
      setError(message(caught, 'That workload could not be brought under management. Try again.'));
    } finally {
      setBusyRef('');
    }
  };

  const createFirstProject = async () => {
    setError(null);
    try {
      const project = await createProject({ name: 'My server' });
      setProjectId(project.id);
      setNote('Created a Project called "My server" to hold what you import.');
    } catch (caught) {
      setError(message(caught, 'The Project could not be created. Try again.'));
    }
  };

  const importable = workloads?.filter((workload) => !workload.adopted) ?? [];
  const managed = workloads?.filter((workload) => workload.adopted) ?? [];

  return (
    <OperatorShell active="services">
      <PageHeader
        title="Import what is already running"
        description="Apps you were already running on a server, before SlideOps or from another account. Import one and SlideOps manages it from now on. Nothing is restarted or rebuilt: it keeps running exactly as it is."
        actions={
          <Button
            variant="secondary"
            onClick={() => void scan(chosenNode)}
            disabled={!chosenNode || scanning}
          >
            <RefreshCw width={16} height={16} aria-hidden />
            {scanning ? 'Reading the server…' : 'Read again'}
          </Button>
        }
      />

      {state.status === 'loading' ? <Loading label="Loading your servers and Projects" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {ready ? (
        ready.nodes.length === 0 ? (
          <EmptyState
            icon={Server}
            title="Connect a server first"
            description="SlideOps reads a server over SSH to find what is already running on it. Connect the server you have been using, then come back here."
            action={<Button onClick={() => navigate('/app/nodes/new')}>Connect a server</Button>}
          />
        ) : (
          <div className="flex flex-col gap-6">
            <Card className="flex flex-wrap items-end gap-4">
              <div className="w-full min-w-0 sm:w-auto sm:min-w-[14rem] sm:flex-1">
                <label htmlFor="import-node" className="mb-1 block text-sm font-medium text-ink">
                  Read this server
                </label>
                <select
                  id="import-node"
                  className={selectClass}
                  value={chosenNode}
                  onChange={(event) => setNodeId(event.target.value)}
                >
                  {ready.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name} ({node.address})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full min-w-0 sm:w-auto sm:min-w-[14rem] sm:flex-1">
                <label htmlFor="import-project" className="mb-1 block text-sm font-medium text-ink">
                  Add what you import to
                </label>
                {ready.projects.length === 0 ? (
                  <Button variant="secondary" onClick={() => void createFirstProject()}>
                    <Plus width={16} height={16} aria-hidden />
                    Create a Project
                  </Button>
                ) : (
                  <select
                    id="import-project"
                    className={selectClass}
                    value={chosenProject}
                    onChange={(event) => setProjectId(event.target.value)}
                  >
                    {ready.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </Card>

            {note ? (
              <Card className="border-success">
                <Text variant="body-sm" tone="secondary">
                  {note}
                </Text>
              </Card>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}

            {scanning && !workloads ? (
              <Loading label="Reading what is running on this server" />
            ) : null}

            {workloads && importable.length === 0 && managed.length === 0 ? (
              <EmptyState
                icon={ScanSearch}
                title="Nothing to import from this server"
                description="SlideOps found no application containers or service units of your own here. Databases and web servers are not listed: those show up as Capabilities already in place on the server's page."
                action={
                  <Button onClick={() => navigate('/app/services/new')}>
                    Deploy a Service instead
                  </Button>
                }
              />
            ) : null}

            {importable.length > 0 ? (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <ScanSearch width={20} height={20} className="text-brand" aria-hidden />
                  <Text variant="h3">Found on this server</Text>
                </div>
                <Text variant="body-sm" tone="secondary" className="mb-4 max-w-2xl">
                  These are already running. Importing one records it as a Service so you can watch,
                  start, stop, and read it here. It does not touch the workload.
                </Text>
                <div className="flex flex-col gap-2">
                  {importable.map((workload) => (
                    <WorkloadRow
                      key={`${workload.runtime}:${workload.ref}`}
                      workload={workload}
                      busy={busyRef === workload.ref}
                      onAdopt={() => void adopt(workload)}
                      onOpen={() => undefined}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {managed.length > 0 ? (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Container width={20} height={20} className="text-brand" aria-hidden />
                  <Text variant="h3">Already managed here</Text>
                </div>
                <div className="flex flex-col gap-2">
                  {managed.map((workload) => (
                    <WorkloadRow
                      key={`${workload.runtime}:${workload.ref}`}
                      workload={workload}
                      busy={false}
                      onAdopt={() => undefined}
                      onOpen={() =>
                        workload.service_id
                          ? navigate(`/app/services/${workload.service_id}`)
                          : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )
      ) : null}
    </OperatorShell>
  );
}
