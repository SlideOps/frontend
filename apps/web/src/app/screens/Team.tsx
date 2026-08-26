import {
  ApiError,
  inviteTeamMember,
  listTeam,
  removeTeamMember,
  updateTeamMemberRole,
  type Member,
  type WorkspaceRole,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { UserPlus, Users } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import {
  DataGrid,
  Drawer,
  PageHeader,
  SearchBar,
  Toolbar,
  type DataGridColumn,
  type DataGridRow,
} from '@slideops/ui';
import { type FormEvent, useState } from 'react';
import { activeRole, useWorkspaceStore } from '../../store/workspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

const selectClass =
  'h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

const roleLabel: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

const roleDescription: Record<WorkspaceRole, string> = {
  owner: 'Full access, and this is the workspace itself.',
  admin: 'Full operational access, and can manage the team.',
  member: 'Full operational access. Cannot manage the team.',
  viewer: 'Read-only everywhere in this workspace.',
};

/** The email and role form that sends an invitation. Lives in the Drawer. */
function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('member');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await inviteTeamMember(email.trim(), role);
      setEmail('');
      setRole('member');
      onInvited();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'That invitation could not be sent. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="invite-email" className="text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="invite-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@example.com"
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor="invite-role" className="text-sm font-medium text-ink">
            Role
          </label>
          <Guidance for="team.role" />
        </div>
        <select
          id="invite-role"
          className={selectClass}
          value={role}
          onChange={(event) => setRole(event.target.value as WorkspaceRole)}
        >
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>
        <Text variant="body-sm" tone="secondary">
          {roleDescription[role]}
        </Text>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={submitting || email.trim() === ''}>
        {submitting ? 'Sending invitation' : 'Send invitation'}
      </Button>
    </form>
  );
}

/** The role picker for one active member's row. Disabled while its change is in flight. */
function RoleControl({
  member,
  onChanged,
}: {
  member: Member;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (role: WorkspaceRole) => {
    setBusy(true);
    setError(null);
    try {
      await updateTeamMemberRole(member.id, role);
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That role could not be changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <select
        className={selectClass}
        value={member.role}
        disabled={busy}
        onChange={(event) => void change(event.target.value as WorkspaceRole)}
      >
        <option value="admin">Admin</option>
        <option value="member">Member</option>
        <option value="viewer">Viewer</option>
      </select>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The Team screen: who can act in this workspace, at what role, and inviting more. */
export function Team() {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const role = activeRole(workspaces);
  const canManage = role === 'owner' || role === 'admin';

  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const { state, reload, refreshing } = useAsyncData(() => listTeam(), []);

  const onChanged = () => {
    setInviteOpen(false);
    reload();
  };

  const remove = async () => {
    if (!removing) {
      return;
    }
    setRemoveError(null);
    try {
      await removeTeamMember(removing.id);
      setRemoving(null);
      reload();
    } catch (caught) {
      setRemoveError(
        caught instanceof ApiError ? caught.message : 'That could not be removed. Try again.',
      );
    }
  };

  if (state.status === 'loading') {
    return (
      <OperatorShell active="team">
        <PageHeader
          title="Team"
          description="Who can act in this workspace, and at what level."
          guidanceKey="team.roles"
        />
        <Loading label="Reading your team" />
      </OperatorShell>
    );
  }
  if (state.status === 'error') {
    return (
      <OperatorShell active="team">
        <PageHeader
          title="Team"
          description="Who can act in this workspace, and at what level."
          guidanceKey="team.roles"
        />
        <ErrorNote error={state.error} />
      </OperatorShell>
    );
  }

  const term = search.trim().toLowerCase();
  const filtered = term
    ? state.data.filter((member) => member.email.toLowerCase().includes(term))
    : state.data;

  const columns: DataGridColumn[] = [
    { key: 'email', header: 'Email', sortable: true },
    { key: 'role', header: 'Role', width: '10rem' },
    { key: 'status', header: 'Status', width: '8rem' },
    { key: 'since', header: 'Since', sortable: true },
    { key: 'action', header: '', align: 'end' },
  ];

  const rows: DataGridRow[] = filtered.map((member) => ({
    id: member.id,
    sortValues: {
      email: member.email,
      since: member.accepted_at ?? member.invited_at,
    },
    cells: {
      email: member.email,
      role: canManage && member.status === 'active' ? (
        <RoleControl member={member} onChanged={reload} />
      ) : (
        roleLabel[member.role] ?? member.role
      ),
      status: (
        <span
          className={
            member.status === 'active'
              ? 'inline-flex items-center rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-success'
              : 'inline-flex items-center rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-warning'
          }
        >
          {member.status === 'active' ? 'Active' : 'Pending'}
        </span>
      ),
      since: new Date(member.accepted_at ?? member.invited_at).toLocaleDateString(),
      action: canManage ? (
        <Button size="sm" variant="ghost" onClick={() => setRemoving(member)}>
          {member.status === 'active' ? 'Remove' : 'Withdraw'}
        </Button>
      ) : null,
    },
  }));

  return (
    <OperatorShell active="team">
      <PageHeader
        title="Team"
        description="Who can act in this workspace, and at what level. Invite a teammate by email and choose the role they come in at."
        guidanceKey="team.roles"
      />

      <div className="flex flex-col gap-3">
        <Toolbar
          actions={
            canManage ? (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus width={15} height={15} aria-hidden />
                Invite
              </Button>
            ) : undefined
          }
        >
          <SearchBar value={search} onChange={setSearch} label="Search team" placeholder="Search by email..." />
        </Toolbar>

        <DataGrid
          columns={columns}
          rows={rows}
          loading={refreshing}
          emptyMessage={
            state.data.length === 0
              ? "It's just you here so far. Invite a teammate to bring them in."
              : 'Nothing matches that search.'
          }
        />

        {!canManage ? (
          <Text variant="body-sm" tone="secondary" className="flex items-center gap-1.5">
            <Users width={14} height={14} aria-hidden />
            Only an Owner or an Admin can invite, change a role, or remove someone.
          </Text>
        ) : null}
      </div>

      <Drawer open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a teammate">
        <InviteForm onInvited={onChanged} />
      </Drawer>

      <ConfirmDialog
        open={removing !== null}
        title={removing?.status === 'active' ? 'Remove this member?' : 'Withdraw this invitation?'}
        description={
          removeError ??
          (removing?.status === 'active'
            ? `${removing?.email} will lose access to this workspace immediately.`
            : `The invitation sent to ${removing?.email} will no longer be acceptable.`)
        }
        confirmLabel={removing?.status === 'active' ? 'Remove' : 'Withdraw'}
        confirmVariant="danger"
        onConfirm={remove}
        onCancel={() => {
          setRemoving(null);
          setRemoveError(null);
        }}
      />
    </OperatorShell>
  );
}
