import {
  getOperator,
  suspendOperator,
  unsuspendOperator,
  setOperatorRole,
  adminSetTier,
  adminSetFreeSeason,
  listEntitlementGrants,
  grantEntitlement,
  revokeEntitlement,
  listSupportNotes,
  addSupportNote,
  deleteSupportNote,
  ApiError,
  type TierName,
  type EntitlementGrant,
  type SupportNote,
} from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { ArrowLeft, FileText, Gift, ShieldCheck, Trash2, Unlock, Users, X } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminShell } from '../components/AdminShell';
import { OperatorStatusBadge, StatusBadge } from '../components/Badges';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { useAsyncData } from '../hooks/useAsyncData';

const TIERS: TierName[] = ['free', 'starter', 'pro', 'enterprise'];

const tierLabel: Record<TierName, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const selectClass =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{value}</dd>
    </div>
  );
}

/** One Operator: their summary, a suspend or unsuspend action, and recent Operations. */
export function OperatorDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { state, reload } = useAsyncData((signal) => getOperator(id, signal), [id]);

  const [confirming, setConfirming] = useState(false);
  const [roleConfirming, setRoleConfirming] = useState(false);
  const [pendingTier, setPendingTier] = useState<TierName | null>(null);
  const [freeSeasonConfirming, setFreeSeasonConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [grants, setGrants] = useState<EntitlementGrant[]>([]);
  const [grantsError, setGrantsError] = useState<ApiError | null>(null);
  const [granting, setGranting] = useState(false);
  const [grantReason, setGrantReason] = useState('');
  const [grantNodes, setGrantNodes] = useState('0');
  const [grantProjects, setGrantProjects] = useState('0');
  const [grantSeats, setGrantSeats] = useState('0');
  const [grantExpiresAt, setGrantExpiresAt] = useState('');
  const [revoking, setRevoking] = useState<EntitlementGrant | null>(null);

  const loadGrants = () => {
    if (!id) {
      return;
    }
    listEntitlementGrants(id)
      .then((g) => {
        setGrants(g);
        setGrantsError(null);
      })
      .catch((error) => setGrantsError(error instanceof ApiError ? error : null));
  };

  useEffect(loadGrants, [id]);

  const [notes, setNotes] = useState<SupportNote[]>([]);
  const [notesError, setNotesError] = useState<ApiError | null>(null);
  const [newNoteBody, setNewNoteBody] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [noteActionError, setNoteActionError] = useState<string | null>(null);
  const [deletingNote, setDeletingNote] = useState<SupportNote | null>(null);

  const loadNotes = () => {
    if (!id) {
      return;
    }
    listSupportNotes(id)
      .then((n) => {
        setNotes(n);
        setNotesError(null);
      })
      .catch((error) => setNotesError(error instanceof ApiError ? error : null));
  };

  useEffect(loadNotes, [id]);

  const runAddNote = async () => {
    if (!id || newNoteBody.trim() === '') {
      return;
    }
    setAddingNote(true);
    setNoteActionError(null);
    try {
      await addSupportNote(id, newNoteBody.trim());
      setNewNoteBody('');
      loadNotes();
    } catch (error) {
      setNoteActionError(
        error instanceof ApiError ? error.message : 'That note did not save. Try again.',
      );
    } finally {
      setAddingNote(false);
    }
  };

  const runDeleteNote = async () => {
    if (!id || !deletingNote) {
      return;
    }
    setNoteActionError(null);
    try {
      await deleteSupportNote(id, deletingNote.id);
      setDeletingNote(null);
      loadNotes();
    } catch (error) {
      setNoteActionError(
        error instanceof ApiError ? error.message : 'That note did not delete. Try again.',
      );
      setDeletingNote(null);
    }
  };

  const operator = state.status === 'ready' ? state.data : null;
  const isSuspended = operator?.status === 'suspended';
  const isAdmin = operator?.role === 'admin';
  const currentTier = operator?.tier ?? null;
  const hasFreeSeason = operator?.free_season ?? false;

  const runTierAction = async () => {
    if (!operator || !pendingTier) {
      return;
    }
    setActionError(null);
    try {
      await adminSetTier(operator.id, pendingTier);
      setPendingTier(null);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That action did not go through. Try again.',
      );
      setPendingTier(null);
    }
  };

  const runFreeSeasonAction = async () => {
    if (!operator) {
      return;
    }
    setActionError(null);
    try {
      await adminSetFreeSeason(operator.id, !hasFreeSeason);
      setFreeSeasonConfirming(false);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That action did not go through. Try again.',
      );
      setFreeSeasonConfirming(false);
    }
  };

  const runRoleAction = async () => {
    if (!operator) {
      return;
    }
    setActionError(null);
    try {
      await setOperatorRole(operator.id, isAdmin ? 'operator' : 'admin');
      setRoleConfirming(false);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That action did not go through. Try again.',
      );
      setRoleConfirming(false);
    }
  };

  const runAction = async () => {
    if (!operator) {
      return;
    }
    setActionError(null);
    try {
      if (isSuspended) {
        await unsuspendOperator(operator.id);
      } else {
        await suspendOperator(operator.id);
      }
      setConfirming(false);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That action did not go through. Try again.',
      );
      setConfirming(false);
    }
  };

  const resetGrantForm = () => {
    setGrantReason('');
    setGrantNodes('0');
    setGrantProjects('0');
    setGrantSeats('0');
    setGrantExpiresAt('');
  };

  const runGrant = async () => {
    if (!operator) {
      return;
    }
    setActionError(null);
    try {
      await grantEntitlement(operator.id, {
        reason: grantReason,
        bonusNodes: Number(grantNodes) || 0,
        bonusProjects: Number(grantProjects) || 0,
        bonusSeats: Number(grantSeats) || 0,
        expiresAt: grantExpiresAt ? new Date(grantExpiresAt) : undefined,
      });
      setGranting(false);
      resetGrantForm();
      loadGrants();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That grant did not go through. Try again.',
      );
      setGranting(false);
    }
  };

  const runRevoke = async () => {
    if (!operator || !revoking) {
      return;
    }
    setActionError(null);
    try {
      await revokeEntitlement(operator.id, revoking.id);
      setRevoking(null);
      loadGrants();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That revoke did not go through. Try again.',
      );
      setRevoking(null);
    }
  };

  return (
    <AdminShell active="operators">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => navigate('/admin/operators')}
      >
        <ArrowLeft width={16} height={16} aria-hidden />
        All Operators
      </Button>

      {state.status === 'loading' ? <Loading label="Loading this Operator" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {operator ? (
        <>
          <PageHeader
            title={operator.email}
            description="One Operator, read across tenants for oversight. Suspending stops them approving or executing Operations."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5">
                  <span className="sr-only">Tier</span>
                  <select
                    className={selectClass}
                    aria-label="Set this Operator's tier"
                    value={currentTier ?? ''}
                    onChange={(event) => {
                      const next = event.target.value as TierName;
                      if (next && next !== currentTier) {
                        setPendingTier(next);
                      }
                    }}
                  >
                    {currentTier ? null : (
                      <option value="" disabled>
                        Set tier
                      </option>
                    )}
                    {TIERS.map((tier) => (
                      <option key={tier} value={tier}>
                        {tierLabel[tier]}
                      </option>
                    ))}
                  </select>
                </label>
                <Guidance for="operators.tier" />
                <Button
                  variant={hasFreeSeason ? 'primary' : 'secondary'}
                  onClick={() => setFreeSeasonConfirming(true)}
                >
                  <Unlock width={16} height={16} aria-hidden />
                  {hasFreeSeason ? 'End free season' : 'Grant free season'}
                </Button>
                <Button variant="secondary" onClick={() => setRoleConfirming(true)}>
                  {isAdmin ? 'Revoke admin' : 'Make admin'}
                </Button>
                <Button variant="secondary" onClick={() => setGranting(true)}>
                  <Gift width={16} height={16} aria-hidden />
                  Grant entitlement
                </Button>
                <Button
                  variant={isSuspended ? 'primary' : 'danger'}
                  onClick={() => setConfirming(true)}
                >
                  <ShieldCheck width={16} height={16} aria-hidden />
                  {isSuspended ? 'Unsuspend' : 'Suspend'}
                </Button>
              </div>
            }
          />

          {actionError ? (
            <p role="alert" className="mb-4 text-sm text-danger">
              {actionError}
            </p>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
            <Card className="h-fit">
              <div className="mb-3 flex items-center gap-2">
                <Users width={18} height={18} className="text-brand" aria-hidden />
                <Text variant="h4">Operator</Text>
                <div className="ml-auto">
                  <OperatorStatusBadge status={operator.status} />
                </div>
              </div>
              <dl className="divide-y divide-border">
                <SummaryRow
                  label="Status"
                  value={operator.status === 'suspended' ? 'Suspended' : 'Active'}
                />
                <SummaryRow label="Role" value={isAdmin ? 'Administrator' : 'Operator'} />
                <SummaryRow label="Tier" value={currentTier ? tierLabel[currentTier] : 'Not set'} />
                <SummaryRow label="Free season" value={hasFreeSeason ? 'Granted' : 'Not granted'} />
                <SummaryRow label="Nodes" value={String(operator.node_count)} />
                <SummaryRow label="Operations" value={String(operator.operation_count)} />
                <SummaryRow
                  label="Last active"
                  value={
                    operator.last_active ? new Date(operator.last_active).toLocaleString() : 'Never'
                  }
                />
                <SummaryRow
                  label="Joined"
                  value={new Date(operator.created_at).toLocaleDateString()}
                />
              </dl>
            </Card>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <Text variant="h4">Recent Operations</Text>
                <Guidance for="operations.record" />
              </div>
              {operator.recent_operations && operator.recent_operations.length > 0 ? (
                <Table label="Recent Operations">
                  <THead>
                    <TH>Capability</TH>
                    <TH>Status</TH>
                    <TH>Started</TH>
                  </THead>
                  <TBody>
                    {operator.recent_operations.map((operation) => (
                      <TR
                        key={operation.id}
                        interactive
                        onClick={() => navigate(`/admin/operations/${operation.id}`)}
                      >
                        <TD className="font-medium">
                          {operation.capability_name ?? operation.capability_key}
                        </TD>
                        <TD>
                          <StatusBadge status={operation.status} />
                        </TD>
                        <TD className="text-ink-muted">
                          {new Date(operation.created_at).toLocaleString()}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <Card>
                  <Text variant="body-sm" tone="secondary">
                    No Operations from this Operator yet.
                  </Text>
                </Card>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <Text variant="h4">Entitlement grants</Text>
              <Text variant="caption" tone="secondary">
                Extra Nodes, Projects, or Seats on top of this Operator's tier, summed into their
                effective quota. Every grant here needs a reason and is written to the audit trail.
              </Text>
            </div>
            {grantsError ? <ErrorNote error={grantsError} /> : null}
            {grants.length === 0 ? (
              <Card>
                <Text variant="body-sm" tone="secondary">
                  No entitlement grants for this Operator.
                </Text>
              </Card>
            ) : (
              <Table label="Entitlement grants">
                <THead>
                  <TH>Reason</TH>
                  <TH className="text-right">Nodes</TH>
                  <TH className="text-right">Projects</TH>
                  <TH className="text-right">Seats</TH>
                  <TH>Granted</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Action</TH>
                </THead>
                <TBody>
                  {grants.map((grant) => (
                    <TR key={grant.id}>
                      <TD className="max-w-xs">{grant.reason}</TD>
                      <TD className="text-right tabular-nums">
                        {grant.bonus_nodes ? `+${grant.bonus_nodes}` : ''}
                      </TD>
                      <TD className="text-right tabular-nums">
                        {grant.bonus_projects ? `+${grant.bonus_projects}` : ''}
                      </TD>
                      <TD className="text-right tabular-nums">
                        {grant.bonus_seats ? `+${grant.bonus_seats}` : ''}
                      </TD>
                      <TD className="text-ink-muted">
                        {new Date(grant.granted_at).toLocaleDateString()}
                      </TD>
                      <TD>
                        {grant.active ? (
                          <span className="text-success">
                            Active{grant.expires_at ? ` until ${new Date(grant.expires_at).toLocaleDateString()}` : ''}
                          </span>
                        ) : (
                          <span className="text-ink-muted">
                            {grant.revoked_at ? 'Revoked' : 'Expired'}
                          </span>
                        )}
                      </TD>
                      <TD className="text-right">
                        {grant.active ? (
                          <Button variant="ghost" size="sm" onClick={() => setRevoking(grant)}>
                            <X width={14} height={14} aria-hidden />
                            Revoke
                          </Button>
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <Text variant="h4">Support notes</Text>
              <Text variant="caption" tone="secondary">
                Free-text context for support, visible only to Admins and never shown to the
                Operator.
              </Text>
            </div>
            <Card>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <textarea
                  value={newNoteBody}
                  onChange={(event) => setNewNoteBody(event.target.value)}
                  placeholder="Called about a billing dispute on Sept 1, resolved..."
                  rows={2}
                  className="min-h-[2.5rem] w-full flex-1 resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
                <Button
                  variant="secondary"
                  onClick={runAddNote}
                  disabled={addingNote || newNoteBody.trim() === ''}
                >
                  <FileText width={15} height={15} aria-hidden />
                  {addingNote ? 'Adding' : 'Add note'}
                </Button>
              </div>
            </Card>
            {noteActionError ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                {noteActionError}
              </p>
            ) : null}
            {notesError ? <ErrorNote error={notesError} /> : null}
            {notes.length === 0 ? (
              <Card className="mt-3">
                <Text variant="body-sm" tone="secondary">
                  No support notes for this Operator yet.
                </Text>
              </Card>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {notes.map((note) => (
                  <Card key={note.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Text variant="body-sm" className="whitespace-pre-wrap">
                          {note.body}
                        </Text>
                        <Text variant="caption" tone="secondary" className="mt-1 block">
                          {new Date(note.created_at).toLocaleString()}
                        </Text>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingNote(note)}
                        aria-label="Delete this note"
                      >
                        <Trash2 width={14} height={14} aria-hidden />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title={isSuspended ? 'Unsuspend this Operator?' : 'Suspend this Operator?'}
        description={
          isSuspended
            ? 'They will be able to approve and execute Operations again. This is written to the audit trail.'
            : 'While suspended they cannot approve or execute Operations, and the worker skips their queued Operations. This is written to the audit trail.'
        }
        confirmLabel={isSuspended ? 'Unsuspend' : 'Suspend'}
        confirmVariant={isSuspended ? 'primary' : 'danger'}
        onConfirm={runAction}
        onCancel={() => setConfirming(false)}
      />

      <ConfirmDialog
        open={pendingTier !== null}
        title="Change this Operator's tier?"
        description={
          pendingTier
            ? `This moves the Operator to the ${tierLabel[pendingTier]} tier, changing the Nodes, Projects, Services, vCPU, and memory they may run. This is written to the audit trail.`
            : ''
        }
        confirmLabel="Change tier"
        confirmVariant="primary"
        onConfirm={runTierAction}
        onCancel={() => setPendingTier(null)}
      />

      <ConfirmDialog
        open={freeSeasonConfirming}
        title={hasFreeSeason ? "End this Operator's free season?" : 'Grant a free season?'}
        description={
          hasFreeSeason
            ? "They return to their own tier's quotas and feature gates immediately. Anything they built over the limit stays in place but they cannot add more. This is written to the audit trail."
            : 'Lifts every tier quota and feature gate for this Operator alone, immediately, with no payment required, independent of the platform-wide free season on the Emergency screen. It lasts until you end it. This is written to the audit trail.'
        }
        confirmLabel={hasFreeSeason ? 'End free season' : 'Grant free season'}
        confirmVariant={hasFreeSeason ? 'primary' : 'danger'}
        onConfirm={runFreeSeasonAction}
        onCancel={() => setFreeSeasonConfirming(false)}
      />

      <ConfirmDialog
        open={roleConfirming}
        title={isAdmin ? 'Revoke admin access?' : 'Grant admin access?'}
        description={
          isAdmin
            ? 'This Operator will lose access to the admin control plane. This is written to the audit trail.'
            : 'This Operator will gain full admin access, including oversight and the emergency controls. This is written to the audit trail.'
        }
        confirmLabel={isAdmin ? 'Revoke admin' : 'Make admin'}
        confirmVariant={isAdmin ? 'danger' : 'primary'}
        onConfirm={runRoleAction}
        onCancel={() => setRoleConfirming(false)}
      />

      <ConfirmDialog
        open={granting}
        title="Grant an entitlement?"
        description={
          <div className="flex flex-col gap-3">
            <p>
              Adds the bonus below on top of this Operator's tier, the same way an active promo
              code's value-add does. Existing infrastructure is unaffected either way. This is
              written to the audit trail.
            </p>
            <Field
              label="Reason"
              hint="Why this is being granted. Required."
              value={grantReason}
              onChange={(event) => setGrantReason(event.target.value)}
              placeholder="Support compensation for the outage on Sep 2"
            />
            <div className="grid grid-cols-3 gap-3">
              <Field
                label="Extra Nodes"
                type="number"
                min={0}
                value={grantNodes}
                onChange={(event) => setGrantNodes(event.target.value)}
              />
              <Field
                label="Extra Projects"
                type="number"
                min={0}
                value={grantProjects}
                onChange={(event) => setGrantProjects(event.target.value)}
              />
              <Field
                label="Extra Seats"
                type="number"
                min={0}
                value={grantSeats}
                onChange={(event) => setGrantSeats(event.target.value)}
              />
            </div>
            <Field
              label="Expires on"
              hint="Optional. Leave blank to last until an Admin revokes it by hand."
              type="date"
              value={grantExpiresAt}
              onChange={(event) => setGrantExpiresAt(event.target.value)}
            />
          </div>
        }
        confirmLabel="Grant entitlement"
        confirmVariant="primary"
        onConfirm={runGrant}
        onCancel={() => {
          setGranting(false);
          resetGrantForm();
        }}
      />

      <ConfirmDialog
        open={revoking !== null}
        title="Revoke this entitlement grant?"
        description={
          <>
            Ends <strong className="text-ink">{revoking?.reason}</strong> now, before its own
            expiry. This Operator's effective quota drops by the bonus it granted immediately.
            This is written to the audit trail.
          </>
        }
        confirmLabel="Revoke grant"
        confirmVariant="danger"
        onConfirm={runRevoke}
        onCancel={() => setRevoking(null)}
      />

      <ConfirmDialog
        open={deletingNote !== null}
        title="Delete this support note?"
        description="Removes it for good. A note carries no consequence of its own, so this is safe, but it cannot be undone."
        confirmLabel="Delete note"
        confirmVariant="danger"
        onConfirm={runDeleteNote}
        onCancel={() => setDeletingNote(null)}
      />
    </AdminShell>
  );
}
