import {
  ApiError,
  deleteAutomation,
  getAutomation,
  getCapability,
  getNode,
  runAutomation,
  updateAutomation,
  type Automation,
  type Capability,
  type Node,
  type Schedule,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { Activity, ArrowLeft, Clock, Play, Server, Trash2 } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RiskBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { ScheduleBuilder } from '../components/ScheduleBuilder';
import { useAsyncData } from '../hooks/useAsyncData';
import { scheduleToText } from '../schedule';

interface DetailData {
  automation: Automation;
  node: Node | null;
  capability: Capability | null;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <Text variant="body-sm" tone="secondary">
        {label}
      </Text>
      <div className="text-right">{children}</div>
    </div>
  );
}

/** The Automation detail: its Capability and Node, an editable schedule, run now, delete, and its runs. */
export function AutomationDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { state, reload } = useAsyncData<DetailData>(async (signal) => {
    const automation = await getAutomation(id, signal);
    const [node, capability] = await Promise.all([
      getNode(automation.node_id, signal).catch(() => null),
      getCapability(automation.capability_key, signal).catch(() => null),
    ]);
    return { automation, node, capability };
  }, [id]);

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Seed the editable fields from the loaded Automation, once it arrives.
  const loaded = state.status === 'ready' ? state.data.automation : null;
  useEffect(() => {
    if (loaded) {
      setSchedule(loaded.schedule);
      setEnabled(loaded.enabled);
    }
  }, [loaded]);

  const save = async () => {
    if (!schedule) {
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateAutomation(id, { schedule, enabled });
      setSaved(true);
      reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'That change did not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    setError(null);
    try {
      const operationId = await runAutomation(id);
      navigate(`/operations/${operationId}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'This run could not start. Try again.');
      setRunning(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteAutomation(id);
      navigate('/automations');
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'This Automation could not be removed. Try again.',
      );
      setDeleting(false);
    }
  };

  return (
    <OperatorShell active="automations">
      <button
        type="button"
        onClick={() => navigate('/automations')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <ArrowLeft width={16} height={16} aria-hidden />
        All Automations
      </button>

      {state.status === 'loading' ? <Loading label="Loading this Automation" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                <Clock width={22} height={22} aria-hidden />
              </span>
              <div className="min-w-0">
                <Text variant="h1">
                  {state.data.capability?.name ?? state.data.automation.capability_key}
                </Text>
                <Text variant="body-sm" tone="secondary" className="mt-1">
                  {scheduleToText(state.data.automation.schedule)}
                </Text>
              </div>
            </div>
            {state.data.capability ? <RiskBadge risk={state.data.capability.risk_level} /> : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="flex flex-col gap-6">
              <Card className="flex flex-col gap-4">
                <Text variant="h4">Details</Text>
                <div className="flex flex-col divide-y divide-border">
                  <InfoRow label="Node">
                    <button
                      type="button"
                      onClick={() =>
                        state.data.node ? navigate(`/nodes/${state.data.node.id}`) : undefined
                      }
                      disabled={!state.data.node}
                      className="inline-flex items-center gap-1.5 text-sm text-ink hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:text-ink-muted"
                    >
                      <Server width={14} height={14} aria-hidden />
                      {state.data.node?.name ?? 'Unknown Node'}
                    </button>
                  </InfoRow>
                  <InfoRow label="Next run">
                    <Text variant="body-sm" as="span">
                      {enabled
                        ? state.data.automation.next_run_at
                          ? new Date(state.data.automation.next_run_at).toLocaleString()
                          : 'Not scheduled yet'
                        : 'Paused'}
                    </Text>
                  </InfoRow>
                  <InfoRow label="Last run">
                    <Text variant="body-sm" as="span">
                      {state.data.automation.last_run_at
                        ? new Date(state.data.automation.last_run_at).toLocaleString()
                        : 'Not run yet'}
                    </Text>
                  </InfoRow>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {state.data.automation.last_operation_id ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        navigate(`/operations/${state.data.automation.last_operation_id}`)
                      }
                    >
                      <Activity width={15} height={15} aria-hidden />
                      Open the last run
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => navigate('/operations')}>
                    See Operations in History
                  </Button>
                </div>
              </Card>

              <Card className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Text variant="h4">Schedule</Text>
                  <Guidance for="automation.schedule" size={14} />
                </div>
                {schedule ? <ScheduleBuilder value={schedule} onChange={setSchedule} /> : null}

                <label className="inline-flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    checked={enabled}
                    onChange={(event) => setEnabled(event.target.checked)}
                  />
                  <span className="text-sm font-medium text-ink">
                    {enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <Guidance for="automation.enabled" size={14} />
                </label>

                <div className="flex items-center gap-2">
                  <Button onClick={save} disabled={saving}>
                    {saving ? 'Saving' : 'Save changes'}
                  </Button>
                  {saved ? (
                    <Text variant="body-sm" tone="secondary" role="status">
                      Saved.
                    </Text>
                  ) : null}
                </div>
              </Card>
            </div>

            <Card className="h-fit">
              <Text variant="h4">Actions</Text>
              <div className="mt-4 flex flex-col gap-3">
                <Button onClick={runNow} disabled={running}>
                  <Play width={15} height={15} aria-hidden />
                  {running ? 'Starting a run' : 'Run now'}
                </Button>
                <Text variant="body-sm" tone="secondary">
                  A run now is still auto-approved and runs the full lifecycle.
                </Text>

                <div className="mt-2 border-t border-border pt-4">
                  {confirmDelete ? (
                    <div className="flex flex-col gap-3">
                      <Text variant="body-sm" tone="secondary">
                        Remove this Automation? Its past Operations stay in History.
                      </Text>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(false)}
                          disabled={deleting}
                        >
                          Keep it
                        </Button>
                        <Button variant="danger" size="sm" onClick={remove} disabled={deleting}>
                          {deleting ? 'Removing' : 'Remove'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                      <Trash2 width={15} height={15} aria-hidden />
                      Delete this Automation
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {error ? (
            <p role="alert" className="mt-4 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </>
      ) : null}
    </OperatorShell>
  );
}
