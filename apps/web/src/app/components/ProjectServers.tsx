import {
  ApiError,
  assignNodeToProject,
  listNodes,
  listProjectNodes,
  unassignNodeFromProject,
  type Node,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowRight, Plus, Server } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsyncData } from '../hooks/useAsyncData';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorNote, Loading } from './Feedback';

interface ServersData {
  assigned: Node[];
  assignable: Node[];
}

async function loadServers(projectId: string, signal: AbortSignal): Promise<ServersData> {
  const [assigned, all] = await Promise.all([
    listProjectNodes(projectId, signal),
    listNodes(signal),
  ]);
  // A server can join a Project only when it belongs to no Project yet, so the
  // pool is every server the Operator owns with an empty project_id.
  const assignable = all.filter((node) => !node.project_id);
  return { assigned, assignable };
}

const selectClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * The servers assigned to a Project. A server is connected and secured at the
 * server level first, then assigned here. Each assigned server links to its
 * dashboard and can be unassigned back to the server level; the assign control
 * offers only the servers not already in a Project.
 */
export function ProjectServers({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { state, reload } = useAsyncData((signal) => loadServers(projectId, signal), [projectId]);

  const [selected, setSelected] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [pendingUnassign, setPendingUnassign] = useState<Node | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const assign = async () => {
    if (!selected) {
      return;
    }
    setAssigning(true);
    setActionError(null);
    try {
      await assignNodeToProject(projectId, selected);
      setSelected('');
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That server could not be assigned. Try again.',
      );
    } finally {
      setAssigning(false);
    }
  };

  const runUnassign = async () => {
    if (!pendingUnassign) {
      return;
    }
    setActionError(null);
    try {
      await unassignNodeFromProject(projectId, pendingUnassign.id);
      setPendingUnassign(null);
      reload();
    } catch (error) {
      setPendingUnassign(null);
      setActionError(
        error instanceof ApiError ? error.message : 'That server could not be unassigned. Try again.',
      );
    }
  };

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Server width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Servers</Text>
        <Guidance for="project.servers" />
      </div>
      <Text variant="body-sm" tone="secondary" className="mb-4">
        A server is connected and secured at the server level first, then assigned to a Project. The
        Project runs its stack and Services on the servers assigned here.
      </Text>

      {state.status === 'loading' ? <Loading label="Loading the servers on this Project" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        <>
          {state.data.assigned.length > 0 ? (
            <ul className="mb-5 flex flex-col gap-2">
              {state.data.assigned.map((node) => (
                <li
                  key={node.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                    <Server width={16} height={16} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <Text variant="body-sm" className="font-medium">
                      {node.name}
                    </Text>
                    <Text variant="body-sm" tone="secondary" className="truncate">
                      {node.ssh_username}@{node.address}:{node.port}
                    </Text>
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/app/nodes/${node.id}`)}>
                    Open server
                    <ArrowRight width={15} height={15} aria-hidden />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPendingUnassign(node)}>
                    Unassign
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <Text variant="body-sm" tone="secondary" className="mb-5">
              No servers assigned yet. Assign one below so this Project has somewhere to run.
            </Text>
          )}

          <div className="border-t border-border pt-4">
            <div className="mb-2 flex items-center gap-2">
              <Text variant="body-sm" className="font-medium">
                Assign a server
              </Text>
              <Guidance for="project.assign" />
            </div>
            {state.data.assignable.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="assign-server" className="sr-only">
                  Choose a server to assign
                </label>
                <select
                  id="assign-server"
                  className={`${selectClass} max-w-xs`}
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  <option value="" disabled>
                    Choose a server
                  </option>
                  {state.data.assignable.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name} ({node.address})
                    </option>
                  ))}
                </select>
                <Button onClick={assign} disabled={!selected || assigning}>
                  <Plus width={15} height={15} aria-hidden />
                  {assigning ? 'Assigning' : 'Assign'}
                </Button>
              </div>
            ) : (
              <Text variant="body-sm" tone="secondary">
                Every server you own is already in a Project. Connect another server, or unassign one
                from its Project first.
              </Text>
            )}
          </div>

          {actionError ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {actionError}
            </p>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={pendingUnassign !== null}
        title="Unassign this server?"
        description={
          <>
            This returns{' '}
            <span className="font-medium text-ink">{pendingUnassign?.name}</span> to the server level.
            The server stays connected and secured; it just leaves this Project and can be assigned
            elsewhere. Services running on it are not touched here.
          </>
        }
        confirmLabel="Unassign server"
        confirmVariant="danger"
        onConfirm={runUnassign}
        onCancel={() => setPendingUnassign(null)}
      />
    </Card>
  );
}
