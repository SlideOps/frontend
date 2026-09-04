import {
  ApiError,
  getCommunicationSettings,
  setCommunicationSettings,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { Mail } from '@slideops/icons';
import { PageHeader } from '@slideops/ui';
import { useEffect, useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { ErrorNote, Loading } from '../components/Feedback';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * Billing Communications: the Pending Payment reminder's own settings.
 * Nothing here is hardcoded in the sweep itself -- an Admin controls
 * whether it runs at all, and how long a payment must sit pending before
 * it fires, and a change here takes effect for every payment that becomes
 * eligible from that point on. Minutes is what the backend stores; a unit
 * picker is just a convenience over that one number, converted on save.
 */

type Unit = 'minutes' | 'hours' | 'days';

const UNIT_MINUTES: Record<Unit, number> = { minutes: 1, hours: 60, days: 60 * 24 };

/** Pick the largest unit that divides evenly into the stored minutes, so
 *  "1440 minutes" reads back as "1 day" rather than a large minute count. */
function bestUnitFor(totalMinutes: number): { value: number; unit: Unit } {
  if (totalMinutes > 0 && totalMinutes % UNIT_MINUTES.days === 0) {
    return { value: totalMinutes / UNIT_MINUTES.days, unit: 'days' };
  }
  if (totalMinutes > 0 && totalMinutes % UNIT_MINUTES.hours === 0) {
    return { value: totalMinutes / UNIT_MINUTES.hours, unit: 'hours' };
  }
  return { value: totalMinutes, unit: 'minutes' };
}

const selectClass =
  'h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';
const inputClass =
  'h-10 w-24 rounded-md border border-border bg-surface px-3 text-sm text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export function BillingCommunications() {
  const { state, reload } = useAsyncData((signal) => getCommunicationSettings(signal), []);

  const [enabled, setEnabled] = useState(true);
  const [delayValue, setDelayValue] = useState(10);
  const [delayUnit, setDelayUnit] = useState<Unit>('minutes');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== 'ready') {
      return;
    }
    setEnabled(state.data.pending_reminder_enabled);
    const best = bestUnitFor(state.data.pending_reminder_delay_minutes);
    setDelayValue(best.value);
    setDelayUnit(best.unit);
  }, [state.status, state.status === 'ready' ? state.data.pending_reminder_delay_minutes : null]);

  const runSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      await setCommunicationSettings({
        enabled,
        delayMinutes: Math.max(1, Math.round(delayValue * UNIT_MINUTES[delayUnit])),
      });
      setSaveMessage('Saved. This applies to every payment that becomes eligible from now on.');
      reload();
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell active="billing-communications">
      <PageHeader
        title="Billing Communications"
        description="Control the automatic Pending Payment reminder: whether it runs, and how long a payment must sit pending before it fires."
      />

      {state.status === 'loading' ? <Loading label="Loading settings" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {state.status === 'ready' ? (
        <Card className="max-w-lg">
          <div className="flex items-start gap-3">
            <Mail width={18} height={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
            <div>
              <Text variant="h4">Pending Payment Reminder</Text>
              <Text variant="body-sm" tone="secondary" className="mt-1">
                When a payment sits pending past the delay below, SlideOps automatically emails the
                Operator a reminder, unless it has already resolved by then -- checked fresh,
                immediately before sending.
              </Text>
            </div>
          </div>

          <label className="mt-5 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Automatic reminders are on
          </label>

          <fieldset className="mt-4" disabled={!enabled}>
            <legend className="text-sm font-medium text-ink">Send reminder after</legend>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                className={inputClass}
                value={delayValue}
                onChange={(event) => setDelayValue(Number(event.target.value) || 1)}
              />
              <select
                className={selectClass}
                value={delayUnit}
                onChange={(event) => setDelayUnit(event.target.value as Unit)}
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
            <Text variant="caption" tone="secondary" className="mt-2 block">
              Default is 10 minutes. Changing this affects only payments that become eligible for a
              reminder from now on -- nothing already sent is retried, and nothing already pending is
              flooded with a reminder just because this changed.
            </Text>
          </fieldset>

          {saveMessage ? (
            <p role="status" className="mt-4 text-sm text-success">
              {saveMessage}
            </p>
          ) : null}
          {saveError ? (
            <p role="alert" className="mt-4 text-sm text-danger">
              {saveError}
            </p>
          ) : null}

          <div className="mt-6">
            <Button onClick={runSave} disabled={saving}>
              {saving ? 'Saving' : 'Save'}
            </Button>
          </div>
        </Card>
      ) : null}
    </AdminShell>
  );
}
