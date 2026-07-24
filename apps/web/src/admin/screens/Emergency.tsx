import {
  getEmergencyStatus,
  getOverview,
  pauseExecutions,
  resumeExecutions,
  ApiError,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { AlertTriangle, Play, ShieldCheck, Users } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { useAsyncData } from '../hooks/useAsyncData';

/** Emergency: the platform-wide execution pause, deliberate and audited. */
export function Emergency() {
  const navigate = useNavigate();
  const status = useAsyncData((signal) => getEmergencyStatus(signal), []);
  const overview = useAsyncData((signal) => getOverview(signal), []);

  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const paused = status.state.status === 'ready' ? status.state.data.executions_paused : false;
  const suspendedCount =
    overview.state.status === 'ready' ? overview.state.data.operators_suspended : 0;

  const runAction = async () => {
    setActionError(null);
    try {
      if (paused) {
        await resumeExecutions();
      } else {
        await pauseExecutions();
      }
      setConfirming(false);
      status.reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That action did not go through. Try again.',
      );
      setConfirming(false);
    }
  };

  return (
    <AdminShell active="emergency">
      <PageHeader
        title="Emergency controls"
        description="Pause or resume every execution platform wide. Queued Operations wait and run when you resume, so nothing is lost. Each switch is confirmed and written to the audit trail."
        guidanceKey="overview.emergency"
      />

      {status.state.status === 'loading' ? <Loading label="Reading the current state" /> : null}
      {status.state.status === 'error' ? <ErrorNote error={status.state.error} /> : null}

      {status.state.status === 'ready' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Card
            raised
            className={`flex flex-col gap-4 ${paused ? 'border-danger' : 'border-border'}`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${
                  paused ? 'bg-subtle text-danger' : 'bg-subtle text-success'
                }`}
              >
                {paused ? (
                  <AlertTriangle width={22} height={22} aria-hidden />
                ) : (
                  <ShieldCheck width={22} height={22} aria-hidden />
                )}
              </span>
              <div>
                <Text variant="h3">
                  {paused ? 'Executions are paused' : 'Executions are running'}
                </Text>
                <Text variant="body-sm" tone="secondary" className="mt-1">
                  {paused
                    ? 'New executions are held platform wide. Creating and approving still works; approved Operations wait and will run when you resume.'
                    : 'The worker is starting executions normally across every tenant.'}
                </Text>
              </div>
              <div className="ml-auto">
                <Guidance for="emergency.pause" placement="left" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              {paused ? (
                <Button variant="primary" size="lg" onClick={() => setConfirming(true)}>
                  <Play width={18} height={18} aria-hidden />
                  Resume executions
                </Button>
              ) : (
                <Button variant="danger" size="lg" onClick={() => setConfirming(true)}>
                  <AlertTriangle width={18} height={18} aria-hidden />
                  Pause all executions
                </Button>
              )}
              <Guidance for="emergency.resume" />
            </div>

            {actionError ? (
              <p role="alert" className="text-sm text-danger">
                {actionError}
              </p>
            ) : null}
          </Card>

          <Card className="h-fit">
            <div className="mb-1 flex items-center gap-2">
              <Users width={18} height={18} className="text-brand" aria-hidden />
              <Text variant="h4">Suspended Operators</Text>
              <div className="ml-auto">
                <Guidance for="overview.suspended" />
              </div>
            </div>
            <p className={`mt-2 text-3xl font-semibold ${suspendedCount > 0 ? 'text-danger' : 'text-ink'}`}>
              {suspendedCount}
            </p>
            <Text variant="body-sm" tone="secondary" className="mt-2">
              A suspended Operator cannot approve or execute Operations, and the worker skips their
              queued Operations.
            </Text>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => navigate('/admin/operators')}
            >
              Manage Operators
            </Button>
          </Card>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title={paused ? 'Resume all executions?' : 'Pause all executions?'}
        description={
          paused
            ? 'Held Operations will begin running again across every tenant. This is written to the audit trail.'
            : 'Every execution is held platform wide until you resume. Nothing is lost: queued and approved Operations wait and run on resume. This is written to the audit trail.'
        }
        confirmLabel={paused ? 'Resume executions' : 'Pause all executions'}
        confirmVariant={paused ? 'primary' : 'danger'}
        onConfirm={runAction}
        onCancel={() => setConfirming(false)}
      />
    </AdminShell>
  );
}
