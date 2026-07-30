import {
  getOperator,
  suspendOperator,
  unsuspendOperator,
  setOperatorRole,
  adminSetTier,
  ApiError,
  type TierName,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowLeft, ShieldCheck, Users } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { useState } from 'react';
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
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-2">
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
  const [actionError, setActionError] = useState<string | null>(null);

  const operator = state.status === 'ready' ? state.data : null;
  const isSuspended = operator?.status === 'suspended';
  const isAdmin = operator?.role === 'admin';
  const currentTier = operator?.tier ?? null;

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
                <Button variant="secondary" onClick={() => setRoleConfirming(true)}>
                  {isAdmin ? 'Revoke admin' : 'Make admin'}
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
    </AdminShell>
  );
}
