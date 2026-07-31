import {
  ApiError,
  adoptWorkload,
  listNodeWorkloads,
  listProjects,
  type Workload,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { Boxes, Check } from '@slideops/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsyncData } from '../hooks/useAsyncData';
import { ErrorNote, Loading } from './Feedback';
import { ServiceStatusBadge } from './Badges';

/*
 * What is already running on this server, on the server's own page.
 *
 * It used to be a paragraph and a link to a separate screen. That is a reasonable
 * place for a first time import and a poor answer to the question an Operator is
 * actually asking while looking at a server, which is "what is on here, and is
 * SlideOps managing it". They should not have to navigate away to find out, and
 * they should not have to import things one at a time when the answer is usually
 * all of them.
 *
 * Adopting changes nothing on the server. The workload keeps running exactly as
 * it was; SlideOps starts holding a record of it. That is worth saying on the
 * screen, because "import" sounds like it moves something.
 */

/** A workload SlideOps already manages, or one waiting to be picked up. */
function WorkloadRow({
  workload,
  busy,
  onAdopt,
}: {
  workload: Workload;
  busy: boolean;
  onAdopt: (workload: Workload) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Text variant="body-sm" className="font-medium">
            {workload.name}
          </Text>
          <ServiceStatusBadge status={workload.status} />
        </div>
        <Text variant="caption" tone="secondary" className="block truncate font-mono">
          {workload.image ?? workload.description ?? workload.ref}
        </Text>
      </div>

      {workload.adopted ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <Check width={13} height={13} className="text-success" aria-hidden />
          Managed
        </span>
      ) : (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAdopt(workload)}>
          Manage this
        </Button>
      )}
    </div>
  );
}

export function RunningHere({ nodeId }: { nodeId: string }) {
  const navigate = useNavigate();
  const workloads = useAsyncData((signal) => listNodeWorkloads(nodeId, signal), [nodeId]);
  const projects = useAsyncData((signal) => listProjects(signal), []);
  const [projectID, setProjectID] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const chosenProject =
    projectID || (projects.state.status === 'ready' ? (projects.state.data[0]?.id ?? '') : '');
  // Read once, so the narrowing holds: referring to projects.state.data after a
  // separate boolean does not tell the compiler which variant it is.
  const projectList = projects.state.status === 'ready' ? projects.state.data : null;
  const noProjects = projectList !== null && projectList.length === 0;
  // Adopting files a workload into a Project, so there has to be one to file it
  // into. Until there is, the controls say so rather than looking ready.
  const canAdopt = projectList !== null && chosenProject !== '';

  const adopt = async (list: Workload[]) => {
    if (list.length === 0) {
      return;
    }
    // This used to return here with no message at all, so pressing Manage did
    // nothing whatsoever: no request, no error, no change on screen. A button
    // that silently declines is worse than one that fails, because there is
    // nothing to react to.
    if (!chosenProject) {
      setError(
        noProjects
          ? 'A workload has to be managed inside a Project, and there are none yet. Create a Project first.'
          : 'Still loading your Projects. Try again in a moment.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      for (const workload of list) {
        await adoptWorkload(nodeId, {
          project_id: chosenProject,
          ref: workload.ref,
          runtime: workload.runtime,
          name: workload.name,
        });
      }
      setNote(
        list.length === 1
          ? `${list[0]?.name} is now managed. It kept running throughout.`
          : `${list.length} workloads are now managed. They kept running throughout.`,
      );
      workloads.reload();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'That could not be brought under management.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="Already running here"
      adornment={<Boxes width={16} height={16} className="text-brand" aria-hidden />}
    >
      {workloads.state.status === 'loading' ? <Loading label="Reading the server" /> : null}
      {workloads.state.status === 'error' ? <ErrorNote error={workloads.state.error} /> : null}

      {workloads.state.status === 'ready' ? (
        workloads.state.data.length === 0 ? (
          <Text variant="body-sm" tone="secondary">
            Nothing is running on this server that SlideOps does not already know about. Anything
            you start outside SlideOps will appear here.
          </Text>
        ) : (
          <>
            <Text variant="body-sm" tone="secondary">
              Apps already running here, from before SlideOps or from another account. Managing one
              records what is there and changes nothing: it keeps running exactly as it is, and
              SlideOps never rebuilds it.
            </Text>

            {/* The Project is chosen once, above the list, because it applies to
                every row. It used to sit at the bottom beside "Manage all", so a
                row's own button gave no hint that a Project was involved at all. */}
            {noProjects ? (
              <p className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
                A workload is managed inside a Project, and you have none yet.{' '}
                <button
                  type="button"
                  onClick={() => navigate('/app/projects')}
                  className="font-medium text-brand underline underline-offset-2"
                >
                  Create a Project
                </button>{' '}
                first, then come back.
              </p>
            ) : projectList ? (
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-muted">Manage these under</span>
                <select
                  aria-label="Project to manage these under"
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink"
                  value={chosenProject}
                  onChange={(event) => setProjectID(event.target.value)}
                >
                  {projectList.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {note ? (
              <p role="status" className="text-sm text-success">
                {note}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}

            <div>
              {workloads.state.data.map((workload) => (
                <WorkloadRow
                  key={workload.ref}
                  workload={workload}
                  busy={busy || !canAdopt}
                  onAdopt={(one) => adopt([one])}
                />
              ))}
            </div>

            {(() => {
              const unmanaged = workloads.state.data.filter((workload) => !workload.adopted);
              if (unmanaged.length === 0) {
                return (
                  <Text variant="caption" tone="secondary">
                    Everything running here is managed.
                  </Text>
                );
              }
              return (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" disabled={busy || !canAdopt} onClick={() => adopt(unmanaged)}>
                    {busy ? 'Bringing them in' : `Manage all ${unmanaged.length}`}
                  </Button>
                </div>
              );
            })()}
          </>
        )
      ) : null}
    </Section>
  );
}
