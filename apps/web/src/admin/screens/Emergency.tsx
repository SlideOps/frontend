import {
  ApiError,
  emergencyLockdown,
  emergencyReleaseAll,
  getEmergencyState,
  revokeAllSessions,
  setEmergencyControl,
  setFreeSeason,
  type EmergencyControl,
  type EmergencyState,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { AlertTriangle, Lock, LogOut, ShieldCheck, Unlock } from '@slideops/icons';
import { PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Refreshing } from '../../app/components/Refreshing';
import { ErrorNote, Loading } from '../components/Feedback';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * The emergency control plane.
 *
 * One switch was never enough. Holding Operation execution left every other way
 * the platform changes something running: a Service deploy skips the approval
 * gate by design and so skipped the brake too, schedules kept firing, and anyone
 * could still sign in mid-incident.
 *
 * Each control says what it stops AND what it leaves alone, because the moment
 * someone reaches for one of these is the worst possible moment to be guessing.
 */

type Pending =
  | { kind: 'control'; control: EmergencyControl }
  | { kind: 'free-season'; engaged: boolean }
  | { kind: 'lockdown' }
  | { kind: 'release-all' }
  | { kind: 'revoke-sessions' };

/** One switch, its explanation, and the action to flip it. */
function ControlCard({
  control,
  busy,
  onToggle,
}: {
  control: EmergencyControl;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className={control.engaged ? 'border-danger' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Text variant="h4">{control.title}</Text>
            {control.engaged ? (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-danger">
                <AlertTriangle width={12} height={12} aria-hidden />
                Held
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-success">
                Running
              </span>
            )}
          </div>
          <Text variant="body-sm" tone="secondary" className="mt-2 max-w-2xl">
            {control.description}
          </Text>
        </div>
        <Button variant={control.engaged ? 'primary' : 'danger'} disabled={busy} onClick={onToggle}>
          {control.engaged ? 'Release' : 'Hold'}
        </Button>
      </div>
    </Card>
  );
}

/** Emergency: one control per mutating path, plus lockdown and session revocation. */
export function Emergency() {
  const { state, reload, refreshing } = useAsyncData((signal) => getEmergencyState(signal), []);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const board: EmergencyState | null = state.status === 'ready' ? state.data : null;

  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setActionError(null);
    setNote(null);
    try {
      await work();
      setNote(success);
      setPending(null);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That action did not go through. Try again.',
      );
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!pending) {
      return;
    }
    switch (pending.kind) {
      case 'control': {
        const { control } = pending;
        return run(
          () => setEmergencyControl(control.name, !control.engaged),
          control.engaged ? `${control.title} is running again.` : `${control.title} is now held.`,
        );
      }
      case 'free-season':
        return run(
          () => setFreeSeason(!pending.engaged),
          pending.engaged
            ? 'Free season has ended. Every account is back on its own tier.'
            : 'Free season has started. Every Operator has full access with no payment required.',
        );
      case 'lockdown':
        return run(emergencyLockdown, 'Every control is engaged. The platform is locked down.');
      case 'release-all':
        return run(
          emergencyReleaseAll,
          'Every control is released. The platform is running normally.',
        );
      case 'revoke-sessions':
        return run(async () => {
          const revoked = await revokeAllSessions();
          // Our own session is gone too, so there is nothing to reload into.
          window.location.assign(`/login?revoked=${revoked}`);
        }, 'Every session was ended.');
    }
  };

  const dialog = (): { title: string; description: string; label: string; danger: boolean } => {
    switch (pending?.kind) {
      case 'control':
        return pending.control.engaged
          ? {
              title: `Release ${pending.control.title.toLowerCase()}?`,
              description: `This path returns to normal service for every tenant immediately. ${pending.control.description}`,
              label: 'Release',
              danger: false,
            }
          : {
              title: `Hold ${pending.control.title.toLowerCase()}?`,
              description: `This takes effect immediately, for every tenant. ${pending.control.description} This is written to the audit trail.`,
              label: 'Hold it',
              danger: true,
            };
      case 'free-season':
        return pending.engaged
          ? {
              title: 'End the free season?',
              description:
                'Every account returns to its own tier immediately: quotas and feature gates apply again. Anyone who exceeded their tier while it was open keeps what they built and simply cannot add more. This is written to the audit trail.',
              label: 'End free season',
              danger: false,
            }
          : {
              title: 'Start a free season for everyone?',
              description:
                'Lifts every tier quota and feature gate for every Operator, immediately, with no payment required, as if every account carried the richest tier. Admins are unaffected. This is written to the audit trail.',
              label: 'Start free season',
              danger: true,
            };
      case 'lockdown':
        return {
          title: 'Lock the platform down?',
          description:
            'Engages every control at once: Operation executions, Service deploys, scheduled Automations, new sign ins, and new registrations. It does NOT sign anyone out, and it does not stop work already executing, so you keep the control plane while you work out what happened. This is written to the audit trail.',
          label: 'Lock everything down',
          danger: true,
        };
      case 'release-all':
        return {
          title: 'Release every control?',
          description:
            'Returns the whole platform to normal service. Held Operations resume being drained, deploys are accepted again, and schedules fire. This is written to the audit trail.',
          label: 'Release everything',
          danger: false,
        };
      case 'revoke-sessions':
        return {
          title: 'Sign every Operator out?',
          description:
            'Ends every open session on the platform, so a captured token stops working now rather than at the end of its life. This signs YOU out too: deliberately, because a revocation that spares the person pressing it is not a revocation. You will be returned to the sign in page. If you have also held new sign ins, release that first or you will not be able to get back in.',
          label: 'Sign everyone out',
          danger: true,
        };
      default:
        return { title: '', description: '', label: '', danger: false };
    }
  };

  const d = dialog();

  return (
    <AdminShell active="emergency">
      <PageHeader
        title="Emergency controls"
        description="One control per path by which the platform changes something, so you can stop what is misbehaving without halting everything else. Every action here affects every tenant and is written to the audit trail."
        actions={<Refreshing show={refreshing} />}
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

      {state.status === 'loading' ? <Loading label="Reading the emergency controls" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {board ? (
        <div className="flex flex-col gap-6">
          {board.any_engaged ? (
            <Card className="border-danger">
              <div className="flex items-center gap-2">
                <AlertTriangle width={18} height={18} className="text-danger" aria-hidden />
                <Text variant="h4">The platform is partly held</Text>
              </div>
              <Text variant="body-sm" tone="secondary" className="mt-2">
                At least one control is engaged, so some work is being refused across every tenant.
                Release what you no longer need held.
              </Text>
            </Card>
          ) : null}

          <Card className={board.free_season.engaged ? 'border-warning' : undefined}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Unlock width={16} height={16} className="text-brand" aria-hidden />
                  <Text variant="h4">{board.free_season.title}</Text>
                  {board.free_season.engaged ? (
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-warning">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                      Off
                    </span>
                  )}
                </div>
                <Text variant="body-sm" tone="secondary" className="mt-2 max-w-2xl">
                  {board.free_season.description}
                </Text>
                <Text variant="caption" tone="secondary" className="mt-2 block">
                  You can also grant this to one Operator at a time from their profile, independent
                  of this platform-wide switch.
                </Text>
              </div>
              <Button
                variant={board.free_season.engaged ? 'primary' : 'danger'}
                disabled={busy}
                onClick={() => setPending({ kind: 'free-season', engaged: board.free_season.engaged })}
              >
                {board.free_season.engaged ? 'End free season' : 'Start free season'}
              </Button>
            </div>
          </Card>

          <div className="flex flex-col gap-3">
            {board.controls.map((control) => (
              <ControlCard
                key={control.name}
                control={control}
                busy={busy}
                onToggle={() => setPending({ kind: 'control', control })}
              />
            ))}
          </div>

          <Card>
            <Text variant="h4">Everything at once</Text>
            <Text variant="body-sm" tone="secondary" className="mt-2 max-w-2xl">
              For when the answer is to stop the platform and work out what happened afterwards.
              Lockdown engages every control above; it does not sign anyone out and does not stop
              work already executing.
            </Text>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => setPending({ kind: 'lockdown' })}
              >
                <Lock width={16} height={16} aria-hidden />
                Lockdown
              </Button>
              <Button
                variant="primary"
                disabled={busy || !board.any_engaged}
                onClick={() => setPending({ kind: 'release-all' })}
              >
                <ShieldCheck width={16} height={16} aria-hidden />
                Release everything
              </Button>
            </div>
          </Card>

          <Card className="border-warning">
            <Text variant="h4">System users</Text>
            <Text variant="body-sm" tone="secondary" className="mt-2 max-w-2xl">
              Ending every session is the control for a credential incident: the one thing no path
              switch can reach. It signs you out along with everyone else, which is the point. Pair
              it with holding new sign ins only if you are certain you can release that afterwards.
            </Text>
            <div className="mt-4">
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => setPending({ kind: 'revoke-sessions' })}
              >
                <LogOut width={16} height={16} aria-hidden />
                Sign every Operator out
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        title={d.title}
        description={d.description}
        confirmLabel={d.label}
        confirmVariant={d.danger ? 'danger' : 'primary'}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </AdminShell>
  );
}
