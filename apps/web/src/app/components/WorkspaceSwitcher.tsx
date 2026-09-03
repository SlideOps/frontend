import {
  ApiError,
  createWorkspace,
  listIncomingNodeTransfers,
  listMyInvitations,
} from '@slideops/api-client';
import { Button, cn, Field } from '@slideops/design-system';
import { Building2, Check, ChevronsUpDown, Mail, Plus, Settings } from '@slideops/icons';
import { Popover } from '@slideops/tooltips';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { activeWorkspace, useWorkspaceStore } from '../../store/workspace';
import { useAsyncData } from '../hooks/useAsyncData';

const roleLabel: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

/** The name and role line for one workspace entry, in the switcher and the hub alike. */
function workspaceSubtitle(isPersonal: boolean, role: string): string {
  return isPersonal ? 'Personal' : (roleLabel[role] ?? role);
}

/**
 * Which workspace the Operator is acting in, and a way to move between every
 * one they can act in, create another, or open the fuller picker. Always
 * rendered, even with only one workspace: creating a second one must always
 * be one click away, the same as Vercel's own team switcher.
 */
export function WorkspaceSwitcher() {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const switchTo = useWorkspaceStore((state) => state.switchTo);
  const navigate = useNavigate();
  const [switching, setSwitching] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A pending invitation is easy to miss if the only place it shows is the
  // Workspaces hub; a count here, wherever the switcher already is, catches
  // it the moment the Operator opens it.
  const { state: invitationsState } = useAsyncData((signal) => listMyInvitations(signal), []);
  // A node transfer is addressed to this account's email, exactly like an
  // invitation, so it is folded into the same "waiting for you" count and
  // banner rather than a second, competing indicator in the header.
  const { state: nodeTransfersState } = useAsyncData(
    (signal) => listIncomingNodeTransfers(signal),
    [],
  );
  const pendingCount =
    (invitationsState.status === 'ready' ? invitationsState.data.length : 0) +
    (nodeTransfersState.status === 'ready' ? nodeTransfersState.data.length : 0);

  if (workspaces.length === 0) {
    return null;
  }

  const active = activeWorkspace(workspaces) ?? workspaces[0];

  const onSelect = async (workspaceId: string) => {
    if (workspaceId === active?.id) {
      return;
    }
    setSwitching(workspaceId);
    try {
      await switchTo(workspaceId);
    } finally {
      setSwitching('');
    }
  };

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setCreateError(null);
    try {
      const created = await createWorkspace(name.trim());
      setName('');
      setCreating(false);
      await switchTo(created.id);
    } catch (caught) {
      setCreateError(
        caught instanceof ApiError ? caught.message : 'That workspace could not be created.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Popover
      label="Switch workspace"
      placement="bottom"
      trigger={(props) => (
        <button
          type="button"
          className="relative inline-flex h-9 max-w-48 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm text-ink transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          {...props}
        >
          <Building2 width={16} height={16} className="shrink-0 text-ink-muted" aria-hidden />
          <span className="min-w-0 truncate">{active?.name}</span>
          <ChevronsUpDown
            width={14}
            height={14}
            className="ml-auto shrink-0 text-ink-muted"
            aria-hidden
          />
          {pendingCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-brand px-1 text-[10px] font-semibold text-brand-fg">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          ) : null}
        </button>
      )}
    >
      {creating ? (
        <form
          className="flex w-64 flex-col gap-3 p-1"
          onSubmit={(event) => void submitCreate(event)}
        >
          <Field
            label="Workspace name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Client X"
            error={createError ?? undefined}
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              className="flex-1"
              disabled={submitting || name.trim() === ''}
            >
              {submitting ? 'Creating' : 'Create'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex w-64 flex-col gap-1">
          {pendingCount > 0 ? (
            <button
              type="button"
              onClick={() => navigate('/app/workspaces')}
              className="mb-1 flex items-center gap-2 rounded-md border border-brand bg-brand-subtle px-2 py-2 text-left text-sm text-ink transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Mail width={15} height={15} className="shrink-0 text-brand" aria-hidden />
              {pendingCount === 1
                ? 'You have 1 thing waiting for you'
                : `You have ${pendingCount} things waiting for you`}
            </button>
          ) : null}
          <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Workspaces
          </p>
          <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                disabled={switching !== ''}
                onClick={() => void onSelect(workspace.id)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  workspace.active ? 'bg-subtle' : undefined,
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink">{workspace.name}</p>
                  <p className="text-xs text-ink-muted">
                    {switching === workspace.id
                      ? 'Switching...'
                      : workspaceSubtitle(workspace.is_personal, workspace.role)}
                  </p>
                </div>
                {workspace.active ? (
                  <Check width={16} height={16} className="shrink-0 text-brand" aria-hidden />
                ) : null}
              </button>
            ))}
          </div>
          <div className="mt-1 flex flex-col gap-0.5 border-t border-border pt-1">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-ink transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Plus width={15} height={15} className="text-ink-muted" aria-hidden />
              Create workspace
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/workspaces')}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-ink transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Settings width={15} height={15} className="text-ink-muted" aria-hidden />
              Manage workspaces
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
}
