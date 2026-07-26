import {
  ApiError,
  listOperators,
  me,
  setOperatorRole,
  type AdminOperator,
  type OperatorRole,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ShieldCheck, Users } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminShell } from '../components/AdminShell';
import { OperatorStatusBadge } from '../components/Badges';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { useAsyncData } from '../hooks/useAsyncData';

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Never';
}

/** The badge for an Operator's role, so admins are visible at a glance. */
function RoleBadge({ role }: { role: OperatorRole }) {
  const isAdmin = role === 'admin';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium ${
        isAdmin ? 'bg-subtle text-brand' : 'bg-subtle text-ink-muted'
      }`}
    >
      {isAdmin ? <ShieldCheck width={12} height={12} aria-hidden /> : null}
      {isAdmin ? 'Admin' : 'Operator'}
    </span>
  );
}

/**
 * Operators: the cross-tenant roster.
 *
 * Role is both shown and changed here. It was previously only on the detail page,
 * which meant an admin had to open every row to find out who else held the role —
 * exactly the question this screen should answer at a glance.
 */
export function Operators() {
  const navigate = useNavigate();
  const { state, reload } = useAsyncData((signal) => listOperators(signal), []);

  // The signed-in admin, so this screen can refuse to let them revoke their own
  // access and lock themselves out of the control plane.
  const [selfID, setSelfID] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    me()
      .then((operator) => {
        if (active) {
          setSelfID(operator.id);
        }
      })
      .catch(() => {
        // The guard is a courtesy; without it the confirm dialog still explains
        // what is about to happen.
      });
    return () => {
      active = false;
    };
  }, []);

  const [pending, setPending] = useState<AdminOperator | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const changeRole = async () => {
    if (!pending) {
      return;
    }
    const nextRole: OperatorRole = pending.role === 'admin' ? 'operator' : 'admin';
    setWorking(true);
    setActionError(null);
    setNote(null);
    try {
      await setOperatorRole(pending.id, nextRole);
      setNote(
        nextRole === 'admin'
          ? `${pending.email} is now an administrator.`
          : `${pending.email} is now an ordinary Operator.`,
      );
      setPending(null);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That role change did not go through. Try again.',
      );
      setPending(null);
    } finally {
      setWorking(false);
    }
  };

  const pendingIsAdmin = pending?.role === 'admin';
  const pendingIsSelf = pending !== null && pending.id === selfID;

  return (
    <AdminShell active="operators">
      <PageHeader
        title="Operators"
        description="Every Operator on the platform, with their role, their Node and Operation counts, and when they were last active. Change a role here, or open a row for tier, suspension, and their recent Operations."
        guidanceKey="operators.roster"
      />

      {note ? (
        <p role="status" className="mb-4 text-sm text-success">
          {note}
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {actionError}
        </p>
      ) : null}

      {state.status === 'loading' ? <Loading label="Loading Operators" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Operators yet"
            description="When Operators register, they appear here with their role, status, and activity across the platform."
          />
        ) : (
          <Table label="Operators">
            <THead>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH className="text-right">Nodes</TH>
              <TH className="text-right">Operations</TH>
              <TH>Last active</TH>
              <TH className="text-right">Role change</TH>
            </THead>
            <TBody>
              {state.data.map((operator) => (
                <TR
                  key={operator.id}
                  interactive
                  onClick={() => navigate(`/admin/operators/${operator.id}`)}
                >
                  <TD className="font-medium">{operator.email}</TD>
                  <TD>
                    <RoleBadge role={operator.role} />
                  </TD>
                  <TD>
                    <OperatorStatusBadge status={operator.status} />
                  </TD>
                  <TD className="text-right tabular-nums">{operator.node_count}</TD>
                  <TD className="text-right tabular-nums">{operator.operation_count}</TD>
                  <TD className="text-ink-muted">{when(operator.last_active)}</TD>
                  <TD className="text-right">
                    <Button
                      size="sm"
                      variant={operator.role === 'admin' ? 'ghost' : 'secondary'}
                      disabled={working || operator.id === selfID}
                      title={
                        operator.id === selfID
                          ? 'You cannot change your own role, so an admin can never lock themselves out.'
                          : undefined
                      }
                      // The row itself navigates, so this must not bubble.
                      onClick={(event) => {
                        event.stopPropagation();
                        setPending(operator);
                      }}
                    >
                      {operator.role === 'admin' ? 'Revoke admin' : 'Make admin'}
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        title={pendingIsAdmin ? 'Revoke admin access?' : 'Grant admin access?'}
        description={
          pending === null
            ? ''
            : pendingIsAdmin
              ? `${pending.email} will lose the admin control plane: cross-tenant oversight, the emergency controls, tier editing, and role changes. They keep their own Workspace and everything in it. This is written to the audit trail.`
              : `${pending.email} will gain the admin control plane: cross-tenant oversight of every Operator, the emergency controls, tier and price editing, and the ability to change roles including yours. They also stop being held to any tier quota. This is written to the audit trail.`
        }
        confirmLabel={pendingIsAdmin ? 'Revoke admin' : 'Make admin'}
        confirmVariant={pendingIsAdmin ? 'danger' : 'primary'}
        onConfirm={pendingIsSelf ? () => setPending(null) : changeRole}
        onCancel={() => setPending(null)}
      />

      <Text variant="caption" tone="secondary" className="mt-6 block max-w-3xl">
        An address named in this deployment&apos;s <code>ADMIN_EMAILS</code> is granted admin again on
        its next sign in. Revoking such an account here takes effect immediately but will not stick;
        remove the address from <code>ADMIN_EMAILS</code> and restart the API to revoke it for good.
      </Text>
    </AdminShell>
  );
}
