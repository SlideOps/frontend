import {
  deleteAutomation,
  listAutomations,
  listCapabilities,
  listNodes,
  runAutomation,
  updateAutomation,
  type Automation,
  type Capability,
  type Node,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { Clock, Play, Plus, Trash2 } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';
import { scheduleToText } from '../schedule';

interface AutomationsData {
  automations: Automation[];
  nodes: Node[];
  capabilities: Capability[];
}

/** Read the friendly next-run text, or a calm placeholder when none is set. */
function nextRunText(automation: Automation): string {
  if (!automation.enabled) {
    return 'Paused';
  }
  if (!automation.next_run_at) {
    return 'Not scheduled yet';
  }
  return `Next run ${new Date(automation.next_run_at).toLocaleString()}`;
}

function AutomationRow({
  automation,
  nodeName,
  capabilityName,
  onChanged,
}: {
  automation: Automation;
  nodeName: string;
  capabilityName: string;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<null | 'toggle' | 'run' | 'delete'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy('toggle');
    setError(null);
    try {
      await updateAutomation(automation.id, { enabled: !automation.enabled });
      onChanged();
    } catch {
      setError('That change did not save. Try again.');
      setBusy(null);
    }
  };

  const runNow = async () => {
    setBusy('run');
    setError(null);
    try {
      const operationId = await runAutomation(automation.id);
      navigate(`/app/operations/${operationId}`);
    } catch {
      setError('This run could not start. Try again.');
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('delete');
    setError(null);
    try {
      await deleteAutomation(automation.id);
      onChanged();
    } catch {
      setError('This Automation could not be removed. Try again.');
      setBusy(null);
    }
  };

  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-4 px-4 py-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
          <Clock width={18} height={18} aria-hidden />
        </span>
        <button
          type="button"
          onClick={() => navigate(`/app/automations/${automation.id}`)}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Text variant="body-sm" className="font-medium">
            {capabilityName}
          </Text>
          <Text variant="body-sm" tone="secondary" className="truncate">
            {nodeName} · {scheduleToText(automation.schedule)}
          </Text>
        </button>

        <span className="hidden shrink-0 text-xs text-ink-muted lg:block">
          {nextRunText(automation)}
        </span>

        <label className="inline-flex shrink-0 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            checked={automation.enabled}
            disabled={busy !== null}
            onChange={toggle}
          />
          <span className="text-xs font-medium text-ink">
            {automation.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </label>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={runNow} disabled={busy !== null}>
            <Play width={15} height={15} aria-hidden />
            {busy === 'run' ? 'Starting' : 'Run now'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete((value) => !value)}
            disabled={busy !== null}
            aria-label={`Delete the Automation for ${capabilityName}`}
          >
            <Trash2 width={15} height={15} aria-hidden />
          </Button>
        </div>
      </div>

      {confirmDelete ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-subtle px-4 py-3">
          <Text variant="body-sm" tone="secondary">
            Remove this Automation? Its past Operations stay in History.
          </Text>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(false)}
              disabled={busy === 'delete'}
            >
              Keep it
            </Button>
            <Button variant="danger" size="sm" onClick={remove} disabled={busy === 'delete'}>
              {busy === 'delete' ? 'Removing' : 'Remove'}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="border-t border-border px-4 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Automations: every saved recurring intent, with run now, edit, and delete. */
export function Automations() {
  const navigate = useNavigate();
  const { state, reload } = useAsyncData<AutomationsData>(async (signal) => {
    const [automations, nodes, capabilities] = await Promise.all([
      listAutomations(signal),
      listNodes(signal),
      listCapabilities({}, signal),
    ]);
    return { automations, nodes, capabilities };
  }, []);

  return (
    <OperatorShell active="automations">
      <PageHeader
        title="Automations"
        description="A saved intent to run a Capability on a Node on a schedule. Setting one up is your standing approval for those runs, so each scheduled Operation still runs the full lifecycle and lands in History."
        actions={
          <Button onClick={() => navigate('/app/automations/new')}>
            <Plus width={16} height={16} aria-hidden />
            New Automation
          </Button>
        }
      />

      {state.status === 'loading' ? <Loading label="Loading your Automations" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data.automations.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No Automations yet"
            description="Automate a Capability you run often. Choose a Node and a Capability, set a schedule, and SlideOps will run it for you and record every result."
            action={<Button onClick={() => navigate('/app/automations/new')}>Create your first Automation</Button>}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="mb-2 flex items-center gap-2">
              <Text variant="caption" tone="secondary">
                Scheduled runs are auto-approved
              </Text>
              <Guidance for="automation.approval" size={14} />
            </div>
            {state.data.automations.map((automation) => {
              const node = state.data.nodes.find((item) => item.id === automation.node_id);
              const capability = state.data.capabilities.find(
                (item) => item.key === automation.capability_key,
              );
              return (
                <AutomationRow
                  key={automation.id}
                  automation={automation}
                  nodeName={node?.name ?? 'Unknown Node'}
                  capabilityName={capability?.name ?? automation.capability_key}
                  onChanged={reload}
                />
              );
            })}
          </div>
        )
      ) : null}
    </OperatorShell>
  );
}
