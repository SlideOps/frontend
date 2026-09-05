import {
  acceptInvitation,
  acceptNodeTransfer,
  ApiError,
  createWorkspace,
  declineInvitation,
  declineNodeTransfer,
  deleteWorkspace,
  listIncomingNodeTransfers,
  listMyInvitations,
  renameWorkspace,
  type IncomingNodeTransfer,
  type PendingInvitation,
  type Workspace,
} from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { ArrowRightLeft, Building2, Check, Pencil, Plus, Trash2, X } from '@slideops/icons';
import { PageHeader, Drawer } from '@slideops/ui';
import { type FormEvent, useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../store/workspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { PendingInvitationCard, roleLabel } from '../components/PendingInvitationCard';
import { useAsyncData } from '../hooks/useAsyncData';

/** The name and role form shared by create and rename, in the Drawer. */
function WorkspaceNameForm({
  initialName = '',
  submitLabel,
  onSubmit,
}: {
  initialName?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(name.trim());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That could not be saved. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <Field
        label="Workspace name"
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Client X"
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={submitting || name.trim() === ''}>
        {submitting ? 'Saving' : submitLabel}
      </Button>
    </form>
  );
}

/** One workspace's card: its name, kind, role, and the actions its role allows. */
function WorkspaceCard({
  workspace,
  onSwitch,
  onRename,
  onDelete,
  switching,
}: {
  workspace: Workspace;
  onSwitch: () => void;
  onRename: () => void;
  onDelete: () => void;
  switching: boolean;
}) {
  const canManage = workspace.role === 'owner';

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-subtle text-ink-muted">
            <Building2 width={16} height={16} aria-hidden />
          </span>
          <div className="min-w-0">
            <Text variant="body" className="truncate font-medium">
              {workspace.name}
            </Text>
            <Text variant="caption" tone="secondary">
              {workspace.is_personal ? 'Personal' : (roleLabel[workspace.role] ?? workspace.role)}
            </Text>
          </div>
        </div>
        {workspace.active ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-success">
            <Check width={12} height={12} aria-hidden />
            Active
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!workspace.active ? (
          <Button size="sm" disabled={switching} onClick={onSwitch}>
            {switching ? 'Switching' : 'Switch to this'}
          </Button>
        ) : null}
        {canManage ? (
          <Button size="sm" variant="ghost" onClick={onRename}>
            <Pencil width={14} height={14} aria-hidden />
            Rename
          </Button>
        ) : null}
        {canManage && !workspace.is_personal ? (
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 width={14} height={14} aria-hidden />
            Delete
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * One node transfer still waiting for this account's email to decide: which
 * node, offered by which workspace, and a one-click accept (into the
 * Personal workspace) or decline. Accepting into a different workspace this
 * account owns needs the fuller review at the transfer's own link, which
 * this card does not shortcut.
 */
function IncomingNodeTransferCard({
  transfer,
  busy,
  onAccept,
  onDecline,
}: {
  transfer: IncomingNodeTransfer;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3 border-brand bg-brand-subtle">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface text-brand">
          <ArrowRightLeft width={16} height={16} aria-hidden />
        </span>
        <div className="min-w-0">
          <Text variant="body" className="truncate font-medium">
            {transfer.node_name}
          </Text>
          <Text variant="caption" tone="secondary">
            Offered by {transfer.from_workspace_name}
          </Text>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} onClick={onAccept}>
          <Check width={14} height={14} aria-hidden />
          Accept
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onDecline}>
          <X width={14} height={14} aria-hidden />
          Decline
        </Button>
      </div>
    </Card>
  );
}

/**
 * Every workspace the Operator can act in: their Personal one, and as many
 * more as they have created or been invited into. Creating one here never
 * requires a Node or a Project first; it starts empty, and can be switched
 * into right away or later from the switcher in the header.
 */
export function WorkspaceHub() {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const loaded = useWorkspaceStore((state) => state.loaded);
  const switchTo = useWorkspaceStore((state) => state.switchTo);
  const refresh = useWorkspaceStore((state) => state.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const { state: invitationsState, reload: reloadInvitations } = useAsyncData(
    (signal) => listMyInvitations(signal),
    [],
  );
  const invitations = invitationsState.status === 'ready' ? invitationsState.data : [];
  const [invitationBusy, setInvitationBusy] = useState('');
  const [invitationError, setInvitationError] = useState<string | null>(null);

  const doAccept = async (invitation: PendingInvitation) => {
    setInvitationBusy(invitation.token);
    setInvitationError(null);
    try {
      await acceptInvitation(invitation.token);
      await Promise.all([reloadInvitations(), refresh()]);
    } catch (caught) {
      setInvitationError(
        caught instanceof ApiError ? caught.message : 'That invitation could not be accepted.',
      );
    } finally {
      setInvitationBusy('');
    }
  };

  const doDecline = async (invitation: PendingInvitation) => {
    setInvitationBusy(invitation.token);
    setInvitationError(null);
    try {
      await declineInvitation(invitation.token);
      await reloadInvitations();
    } catch (caught) {
      setInvitationError(
        caught instanceof ApiError ? caught.message : 'That invitation could not be declined.',
      );
    } finally {
      setInvitationBusy('');
    }
  };

  const { state: nodeTransfersState, reload: reloadNodeTransfers } = useAsyncData(
    (signal) => listIncomingNodeTransfers(signal),
    [],
  );
  const nodeTransfers = nodeTransfersState.status === 'ready' ? nodeTransfersState.data : [];
  const [nodeTransferBusy, setNodeTransferBusy] = useState('');
  const [nodeTransferError, setNodeTransferError] = useState<string | null>(null);

  const doAcceptNodeTransfer = async (transfer: IncomingNodeTransfer) => {
    setNodeTransferBusy(transfer.token);
    setNodeTransferError(null);
    try {
      await acceptNodeTransfer(transfer.token);
      await Promise.all([reloadNodeTransfers(), refresh()]);
    } catch (caught) {
      setNodeTransferError(
        caught instanceof ApiError ? caught.message : 'That transfer could not be accepted.',
      );
    } finally {
      setNodeTransferBusy('');
    }
  };

  const doDeclineNodeTransfer = async (transfer: IncomingNodeTransfer) => {
    setNodeTransferBusy(transfer.token);
    setNodeTransferError(null);
    try {
      await declineNodeTransfer(transfer.token);
      await reloadNodeTransfers();
    } catch (caught) {
      setNodeTransferError(
        caught instanceof ApiError ? caught.message : 'That transfer could not be declined.',
      );
    } finally {
      setNodeTransferBusy('');
    }
  };

  const [switching, setSwitching] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<Workspace | null>(null);
  const [deleting, setDeleting] = useState<Workspace | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const owned = workspaces.filter((w) => w.role === 'owner');
  const shared = workspaces.filter((w) => w.role !== 'owner');

  const doSwitch = async (workspace: Workspace) => {
    setSwitching(workspace.id);
    try {
      await switchTo(workspace.id);
    } finally {
      setSwitching('');
    }
  };

  const doCreate = async (name: string) => {
    await createWorkspace(name);
    setCreateOpen(false);
    await refresh();
  };

  const doRename = async (name: string) => {
    if (!renaming) {
      return;
    }
    await renameWorkspace(renaming.id, name);
    setRenaming(null);
    await refresh();
  };

  const doDelete = async () => {
    if (!deleting) {
      return;
    }
    setDeleteError(null);
    try {
      await deleteWorkspace(deleting.id);
      setDeleting(null);
      await refresh();
    } catch (caught) {
      setDeleteError(
        caught instanceof ApiError ? caught.message : 'That workspace could not be deleted.',
      );
    }
  };

  return (
    <OperatorShell active="workspaces">
      <PageHeader
        title="Workspaces"
        description="Every workspace you can act in: your Personal one, and any others you created or were invited into."
        guidanceKey="workspaces.hub"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus width={16} height={16} aria-hidden />
            Create workspace
          </Button>
        }
      />

      {invitationError ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {invitationError}
        </p>
      ) : null}
      {invitationsState.status === 'error' ? <ErrorNote error={invitationsState.error} /> : null}
      {invitations.length > 0 ? (
        <div className="mb-6">
          <Text variant="h4" className="mb-3">
            Waiting for you
          </Text>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {invitations.map((invitation) => (
              <PendingInvitationCard
                key={invitation.token}
                invitation={invitation}
                busy={invitationBusy === invitation.token}
                onAccept={() => void doAccept(invitation)}
                onDecline={() => void doDecline(invitation)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {nodeTransferError ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {nodeTransferError}
        </p>
      ) : null}
      {nodeTransfersState.status === 'error' ? <ErrorNote error={nodeTransfersState.error} /> : null}
      {nodeTransfers.length > 0 ? (
        <div className="mb-6">
          <Text variant="h4" className="mb-3">
            Nodes offered to you
          </Text>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nodeTransfers.map((transfer) => (
              <IncomingNodeTransferCard
                key={transfer.token}
                transfer={transfer}
                busy={nodeTransferBusy === transfer.token}
                onAccept={() => void doAcceptNodeTransfer(transfer)}
                onDecline={() => void doDeclineNodeTransfer(transfer)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {!loaded ? <Loading label="Reading your workspaces" /> : null}
      {loaded ? (
        <div className="flex flex-col gap-6">
          <div>
            {shared.length > 0 ? (
              <Text variant="h4" className="mb-3">
                Your workspaces
              </Text>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {owned.map((workspace) => (
                <WorkspaceCard
                  key={workspace.id}
                  workspace={workspace}
                  switching={switching === workspace.id}
                  onSwitch={() => void doSwitch(workspace)}
                  onRename={() => setRenaming(workspace)}
                  onDelete={() => {
                    setDeleteError(null);
                    setDeleting(workspace);
                  }}
                />
              ))}
            </div>
          </div>

          {shared.length > 0 ? (
            <div>
              <Text variant="h4" className="mb-3">
                Shared with you
              </Text>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shared.map((workspace) => (
                  <WorkspaceCard
                    key={workspace.id}
                    workspace={workspace}
                    switching={switching === workspace.id}
                    onSwitch={() => void doSwitch(workspace)}
                    onRename={() => setRenaming(workspace)}
                    onDelete={() => {
                      setDeleteError(null);
                      setDeleting(workspace);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} title="Create a workspace">
        <WorkspaceNameForm submitLabel="Create" onSubmit={doCreate} />
      </Drawer>

      <Drawer open={renaming !== null} onClose={() => setRenaming(null)} title="Rename workspace">
        <WorkspaceNameForm
          initialName={renaming?.name ?? ''}
          submitLabel="Save"
          onSubmit={doRename}
        />
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this workspace?"
        description={
          deleteError ??
          `${deleting?.name} will be permanently deleted. This only works while it owns no Node or Project.`
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={doDelete}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
      />
    </OperatorShell>
  );
}
