import {
  ApiError,
  createOperation,
  discoverCelery,
  preflightCelery,
  sendCeleryTestTask,
  type Capability,
  type CeleryCandidate,
  type CeleryCheck,
  type CeleryDiscovery,
  type Operation,
} from '@slideops/api-client';
import { Button, Card, Text, cn } from '@slideops/design-system';
import {
  ArrowRight,
  Check,
  Cpu,
  Folder,
  Play,
  RefreshCw,
  Rocket,
  RotateCcw,
  ScanSearch,
  Search,
  Square,
  Trash2,
  X,
} from '@slideops/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  buildParameterSchema,
  cleanParameterValues,
  defaultParameterValues,
} from '../parameter-schema';
import { ActionTable } from './ActionTable';
import { ErrorNote, Loading } from './Feedback';
import { ParameterFields } from './ParameterFields';

/*
 * Turning an application's own Celery configuration into a real, supervised
 * worker, from a Service's own Capability page.
 *
 * This is deliberately not a second approval flow. Discovering a candidate
 * application and proving it works are the genuinely new pieces of UI --
 * neither can live inside an Operation's Plan, since Plan never reaches the
 * Node -- but the actual write, once a candidate is chosen and proven, is an
 * ordinary Operation started through createOperation exactly like
 * StartOperation's own submit, so it gets the same review-the-plan step,
 * the same History record, and the same approval gate every other
 * Capability already has. Lifecycle actions (start, stop, restart, remove)
 * are not re-implemented here at all: they are links to their own Capability
 * pages, which already render StartOperation, so there is exactly one place
 * in this codebase that starts an Operation.
 */

const inputClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** Whether CeleryManager knows how to draw this Capability's page. */
export function isCeleryCapability(capabilityKey: string): boolean {
  return capabilityKey === 'configure-celery-worker';
}

/** The most recently completed configure-celery-worker Operation on this
 * Node, or null when none has ever completed -- exactly Decision 4 of the
 * Celery plan: no separate table records current configuration, the latest
 * successful Operation's own parameters are the record. Exported so the
 * page hosting this Section can also read the worker's own working
 * directory for CeleryWorkerLogs, without a second query for the same fact. */
export function latestConfiguredWorker(operations: Operation[]): Operation | null {
  let newest: Operation | null = null;
  for (const operation of operations) {
    if (operation.capability_key !== 'configure-celery-worker' || operation.status !== 'completed') {
      continue;
    }
    const at = operation.completed_at ?? operation.created_at ?? '';
    const newestAt = newest ? (newest.completed_at ?? newest.created_at ?? '') : '';
    if (!newest || at.localeCompare(newestAt) > 0) {
      newest = operation;
    }
  }
  return newest;
}

/** One parameter value off an Operation, as a plain string, or empty when
 * absent -- exported for the same reason latestConfiguredWorker is. */
export function stringParam(operation: Operation, key: string): string {
  const value = operation.parameters?.[key];
  return typeof value === 'string' ? value : '';
}

/** The worker command this configuration would run, built the same way the
 * backend's own celeryWorkerCommand does, purely so an Operator can see what
 * they are about to approve before they approve it. This is a preview, not
 * what actually runs -- the backend builds and quotes the real command
 * itself, independently, when the Operation executes. */
function commandPreview(values: Record<string, unknown>): string {
  const pythonExecutable = String(values.python_executable ?? '').trim();
  const celeryApp = String(values.celery_app ?? '').trim();
  if (!pythonExecutable || !celeryApp) {
    return '';
  }
  const celeryBin = `${pythonExecutable.replace(/\/[^/]*$/, '')}/celery`;
  const parts = [celeryBin, '-A', celeryApp, 'worker'];
  const workerName = String(values.worker_name ?? '').trim();
  if (workerName) {
    parts.push(`--hostname=${workerName}`);
  }
  const queues = String(values.queues ?? '').trim();
  if (queues) {
    parts.push(`--queues=${queues}`);
  }
  const concurrency = String(values.concurrency ?? '').trim();
  if (concurrency) {
    parts.push(`--concurrency=${concurrency}`);
  }
  const pool = String(values.pool ?? '').trim();
  if (pool) {
    parts.push(`--pool=${pool}`);
  }
  parts.push(`--loglevel=${String(values.log_level ?? '').trim() || 'INFO'}`);
  const extraArgs = String(values.extra_args ?? '').trim();
  if (extraArgs) {
    parts.push(extraArgs);
  }
  return parts.join(' ');
}

/** One pass/fail preflight check, with its real evidence. */
function CheckRow({ check }: { check: CeleryCheck }) {
  return (
    <div className="flex items-start gap-3 rounded-md p-3">
      <span
        className={cn(
          'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill',
          check.passed ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
        )}
      >
        {check.passed ? <Check width={14} height={14} aria-hidden /> : <X width={14} height={14} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <Text variant="body-sm" className="font-medium text-ink">
          {check.name}
        </Text>
        {check.detail ? (
          <Text variant="caption" tone="secondary" className="mt-0.5 block break-words">
            {check.detail}
          </Text>
        ) : null}
      </span>
    </div>
  );
}

/** Scanning an application directory for a candidate Celery application, a
 * candidate Python interpreter, and which dependency manifests are present.
 * Nothing here is trusted on its own -- picking a candidate only fills the
 * form below; preflighting it is what actually proves it works. */
function DiscoveryPanel({
  serviceId,
  onPick,
}: {
  serviceId: string;
  onPick: (fields: { workingDirectory: string; celeryApp?: string; pythonExecutable?: string }) => void;
}) {
  const [path, setPath] = useState('');
  const [discovery, setDiscovery] = useState<CeleryDiscovery | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const scan = () => {
    const trimmed = path.trim();
    if (!trimmed) {
      return;
    }
    setLoading(true);
    setError(null);
    discoverCelery(serviceId, trimmed)
      .then((result) => {
        setDiscovery(result);
        onPick({ workingDirectory: trimmed });
      })
      .catch((caught: unknown) => {
        setError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown_error', 'That scan failed.'));
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-subtle p-4">
      <div className="flex items-center gap-2">
        <ScanSearch width={16} height={16} className="text-brand" aria-hidden />
        <Text variant="body-sm" className="font-medium text-ink">
          Find the Celery application
        </Text>
      </div>
      <Text variant="caption" tone="secondary">
        The application's own root directory -- not SlideOps' own directory. This only reads files;
        nothing is written until you approve configuring it below.
      </Text>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder="/opt/docai/backend"
          className={cn(inputClass, 'flex-1')}
          aria-label="Application directory to scan"
        />
        <Button type="button" size="sm" onClick={scan} disabled={loading || !path.trim()}>
          <Search width={14} height={14} aria-hidden />
          {loading ? 'Scanning' : 'Scan'}
        </Button>
      </div>
      {error ? <ErrorNote error={error} /> : null}
      {discovery ? (
        <div className="flex flex-col gap-3">
          {discovery.candidates.length === 0 ? (
            <Text variant="body-sm" tone="secondary">
              No <code>Celery(...)</code> assignment was found under that path. You can still fill in
              the Celery application below by hand if you know it.
            </Text>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Text variant="caption" tone="secondary">
                Candidate Celery applications found:
              </Text>
              {discovery.candidates.map((candidate) => (
                <CandidateButton
                  key={candidate.target}
                  candidate={candidate}
                  onPick={() => onPick({ workingDirectory: path.trim(), celeryApp: candidate.target })}
                />
              ))}
            </div>
          )}
          {discovery.python_candidates.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Text variant="caption" tone="secondary">
                Candidate Python interpreters found (its own virtual environment, never the Node's
                system Python):
              </Text>
              {discovery.python_candidates.map((python) => (
                <button
                  key={python}
                  type="button"
                  onClick={() => onPick({ workingDirectory: path.trim(), pythonExecutable: python })}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs text-ink transition-colors duration-fast ease-standard hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <Cpu width={13} height={13} className="shrink-0 text-ink-muted" aria-hidden />
                  {python}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CandidateButton({
  candidate,
  onPick,
}: {
  candidate: CeleryCandidate;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-fast ease-standard hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <Folder width={13} height={13} className="shrink-0 text-ink-muted" aria-hidden />
      <span className="min-w-0">
        <Text variant="body-sm" className="font-mono text-ink">
          {candidate.target}
        </Text>
        <Text variant="caption" tone="secondary" className="block">
          {candidate.file}
        </Text>
      </span>
    </button>
  );
}

/**
 * The worker configuration form: Discovery and Preflight above a generic
 * ParameterFields form built from configure-celery-worker's own metadata, a
 * command preview below it, and a submit that starts an ordinary Operation.
 */
function ConfigureForm({
  capability,
  nodeId,
  serviceId,
  projectId,
  initialValues,
  onConfigured,
}: {
  capability: Capability;
  nodeId: string;
  serviceId?: string;
  projectId?: string;
  initialValues?: Record<string, string>;
  onConfigured: () => void;
}) {
  const navigate = useNavigate();
  const parameters = useMemo(() => capability.parameters ?? [], [capability]);
  const schema = useMemo(() => buildParameterSchema(parameters), [parameters]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [preflightChecks, setPreflightChecks] = useState<CeleryCheck[] | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightError, setPreflightError] = useState<ApiError | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues: { ...defaultParameterValues(parameters), ...initialValues },
  });

  const values = watch();
  const preview = commandPreview(values);

  const runPreflight = () => {
    if (!serviceId) {
      return;
    }
    setPreflightLoading(true);
    setPreflightError(null);
    preflightCelery(serviceId, {
      working_directory: String(values.working_directory ?? ''),
      python_executable: String(values.python_executable ?? ''),
      celery_app: String(values.celery_app ?? ''),
      broker_url: String(values.broker_url ?? ''),
      result_backend: String(values.result_backend ?? '') || undefined,
    })
      .then(setPreflightChecks)
      .catch((caught: unknown) => {
        setPreflightError(
          caught instanceof ApiError ? caught : new ApiError(0, 'unknown_error', 'That check failed.'),
        );
      })
      .finally(() => setPreflightLoading(false));
  };

  const submit = handleSubmit(async (formValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const cleaned = cleanParameterValues(formValues);
      const operation = await createOperation({
        node_id: nodeId,
        capability_key: capability.key,
        project_id: projectId,
        parameters: Object.keys(cleaned).length > 0 ? cleaned : undefined,
      });
      onConfigured();
      navigate(`/app/operations/${operation.id}`);
    } catch (cause) {
      setSubmitError(cause instanceof ApiError ? cause.message : 'The Operation could not be started.');
      setSubmitting(false);
    }
  });

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
      {serviceId ? (
        <DiscoveryPanel
          serviceId={serviceId}
          onPick={({ workingDirectory, celeryApp, pythonExecutable }) => {
            setValue('working_directory', workingDirectory, { shouldValidate: true });
            if (celeryApp) {
              setValue('celery_app', celeryApp, { shouldValidate: true });
            }
            if (pythonExecutable) {
              setValue('python_executable', pythonExecutable, { shouldValidate: true });
            }
            setPreflightChecks(null);
          }}
        />
      ) : (
        <Text variant="body-sm" tone="secondary">
          Open this from the Service's own page to scan its own application directory for a
          candidate Celery application. You can still fill in every field below by hand.
        </Text>
      )}

      <ParameterFields
        idPrefix={`param-${capability.key}`}
        parameters={parameters}
        register={register}
        errors={errors}
        nodeId={nodeId}
        capabilityKey={capability.key}
      />

      {preview ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-subtle p-3">
          <Text variant="caption" tone="secondary">
            Preview -- the command this worker's unit will run once approved. SlideOps builds and
            quotes the real command itself when the Operation executes; this is only a preview of
            what you are about to approve.
          </Text>
          <code className="block overflow-x-auto whitespace-pre text-xs text-ink">{preview}</code>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-md border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Text variant="body-sm" className="font-medium text-ink">
            Prove this configuration works, before approving anything
          </Text>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={runPreflight}
            disabled={preflightLoading || !serviceId}
          >
            <RefreshCw width={14} height={14} aria-hidden />
            {preflightLoading ? 'Checking' : 'Check this configuration'}
          </Button>
        </div>
        {!serviceId ? (
          <Text variant="caption" tone="secondary">
            Open this from the Service's own page to run a live check.
          </Text>
        ) : null}
        {preflightError ? <ErrorNote error={preflightError} /> : null}
        {preflightChecks ? (
          <div className="flex flex-col divide-y divide-border">
            {preflightChecks.map((check) => (
              <CheckRow key={check.name} check={check} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={submitting}>
          <Play width={15} height={15} aria-hidden />
          {submitting ? 'Starting' : 'Configure and start this worker'}
        </Button>
        <Text variant="body-sm" tone="secondary">
          You will review the plan before anything runs.
        </Text>
      </div>
      {submitError ? (
        <p role="alert" className="text-sm text-danger">
          {submitError}
        </p>
      ) : null}
    </form>
  );
}

/** A link to one of the lifecycle Capability's own pages, prefilled with
 * enough to identify this worker -- reusing that page's own StartOperation
 * rather than starting a second Operation flow here. */
function LifecycleLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof Play;
  label: string;
}) {
  const navigate = useNavigate();
  return (
    <Button type="button" variant="secondary" size="sm" onClick={() => navigate(to)}>
      <Icon width={14} height={14} aria-hidden />
      {label}
    </Button>
  );
}

/** The already-configured worker: what it is, quick lifecycle actions, and
 * its own task visibility, all derived from the latest completed
 * configure-celery-worker Operation rather than a separate stored record. */
function ConfiguredWorker({
  operation,
  nodeId,
  serviceId,
  onReconfigure,
}: {
  operation: Operation;
  nodeId: string;
  serviceId?: string;
  onReconfigure: () => void;
}) {
  const workingDirectory = stringParam(operation, 'working_directory');
  const pythonExecutable = stringParam(operation, 'python_executable');
  const celeryApp = stringParam(operation, 'celery_app');
  const brokerURL = stringParam(operation, 'broker_url');
  const resultBackend = stringParam(operation, 'result_backend');
  const queues = stringParam(operation, 'queues') || 'celery';
  const query = `?node=${encodeURIComponent(nodeId)}&working_directory=${encodeURIComponent(workingDirectory)}`;
  const taskParameters = { working_directory: workingDirectory, python_executable: pythonExecutable, celery_app: celeryApp };

  const [roundTrip, setRoundTrip] = useState<CeleryCheck | null>(null);
  const [roundTripLoading, setRoundTripLoading] = useState(false);
  const [roundTripError, setRoundTripError] = useState<ApiError | null>(null);

  const runRoundTrip = () => {
    if (!serviceId) {
      return;
    }
    setRoundTripLoading(true);
    setRoundTripError(null);
    sendCeleryTestTask(serviceId, {
      working_directory: workingDirectory,
      python_executable: pythonExecutable,
      celery_app: celeryApp,
      result_backend: resultBackend,
      queues,
    })
      .then(setRoundTrip)
      .catch((caught: unknown) => {
        setRoundTripError(
          caught instanceof ApiError ? caught : new ApiError(0, 'unknown_error', 'That test task failed.'),
        );
      })
      .finally(() => setRoundTripLoading(false));
  };

  const [taskView, setTaskView] = useState<
    'active' | 'reserved' | 'registered' | 'queue-depth' | 'task-routing'
  >('active');
  const taskActions: {
    key: 'active' | 'reserved' | 'registered' | 'queue-depth' | 'task-routing';
    label: string;
    actionKey: string;
  }[] = [
    { key: 'active', label: 'Active', actionKey: 'list-active-tasks' },
    { key: 'reserved', label: 'Reserved', actionKey: 'list-reserved-tasks' },
    { key: 'registered', label: 'Registered', actionKey: 'list-registered-tasks' },
    { key: 'queue-depth', label: 'Queue depth', actionKey: 'queue-depth' },
    { key: 'task-routing', label: 'Task routing', actionKey: 'task-routing' },
  ];
  const currentAction = taskActions.find((a) => a.key === taskView) ?? taskActions[0]!;
  const [threshold, setThreshold] = useState('100');
  const queueDepthParameters = { ...taskParameters, queues, threshold };

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text variant="h4">This worker is configured</Text>
          <Button type="button" variant="ghost" size="sm" onClick={onReconfigure}>
            <RotateCcw width={14} height={14} aria-hidden />
            Change configuration
          </Button>
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-muted">Working directory</dt>
            <dd className="mt-0.5 break-words font-mono text-sm text-ink">{workingDirectory}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Celery application</dt>
            <dd className="mt-0.5 break-words font-mono text-sm text-ink">{celeryApp}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Broker</dt>
            <dd className="mt-0.5 break-words font-mono text-sm text-ink">{brokerURL}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Python interpreter</dt>
            <dd className="mt-0.5 break-words font-mono text-sm text-ink">{pythonExecutable}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <LifecycleLink
            to={`/app/capabilities/inspect-celery-worker${query}&python_executable=${encodeURIComponent(pythonExecutable)}`}
            icon={ScanSearch}
            label="Inspect"
          />
          <LifecycleLink to={`/app/capabilities/start-celery-worker${query}`} icon={Play} label="Start" />
          <LifecycleLink to={`/app/capabilities/stop-celery-worker${query}`} icon={Square} label="Stop" />
          <LifecycleLink
            to={`/app/capabilities/restart-celery-worker${query}`}
            icon={RefreshCw}
            label="Restart"
          />
          <LifecycleLink
            to={`/app/capabilities/remove-celery-worker${query}`}
            icon={Trash2}
            label="Remove"
          />
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Text variant="body-sm" tone="secondary">
              A control ping only proves the worker answers; this sends a real task through the
              broker to prove the whole chain works.
            </Text>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={runRoundTrip}
              disabled={roundTripLoading || !serviceId}
            >
              <Rocket width={14} height={14} aria-hidden />
              {roundTripLoading ? 'Sending' : 'Send a test task'}
            </Button>
          </div>
          {roundTripError ? <ErrorNote error={roundTripError} /> : null}
          {roundTrip ? <CheckRow check={roundTrip} /> : null}
        </div>
      </Card>

      {serviceId ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {taskActions.map((action) => (
              <Button
                key={action.key}
                type="button"
                size="sm"
                variant={taskView === action.key ? 'secondary' : 'ghost'}
                onClick={() => setTaskView(action.key)}
              >
                {action.label}
              </Button>
            ))}
          </div>
          {taskView === 'queue-depth' ? (
            <label className="flex items-center gap-2 self-start">
              <Text variant="caption" tone="secondary">
                Pending-task threshold
              </Text>
              <input
                type="text"
                inputMode="numeric"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                className={cn(inputClass, 'h-8 w-20')}
                aria-label="Pending-task threshold"
              />
            </label>
          ) : null}
          <ActionTable
            capabilityKey="inspect-celery-worker"
            actionKey={currentAction.actionKey}
            nodeId={nodeId}
            serviceId={serviceId}
            parameters={taskView === 'queue-depth' ? queueDepthParameters : taskParameters}
            icon={Cpu}
            loadingLabel={
              taskView === 'queue-depth'
                ? 'Reading queue depth'
                : taskView === 'task-routing'
                  ? "Reading this application's task routing"
                  : `Reading ${currentAction.label.toLowerCase()} tasks`
            }
            emptyTitle={
              taskView === 'queue-depth'
                ? 'Nothing to check'
                : taskView === 'task-routing'
                  ? 'No routing configured'
                  : `No ${currentAction.label.toLowerCase()} tasks`
            }
            emptyDescription="Nothing here right now. A worker that never shows anything active is worth a look at Inspect."
            searchPlaceholder="Search tasks..."
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The Celery section on configure-celery-worker's own Capability page:
 * discover and prove an application's Celery setup, configure and start a
 * supervised worker for it, and once one exists, see it, control it, and
 * see what it is actually doing -- all without leaving this page.
 */
export function CeleryManager({
  capability,
  nodeId,
  serviceId,
  projectId,
  operations,
  operationsLoading,
  operationsError,
  onReload,
}: {
  capability: Capability;
  nodeId: string;
  serviceId?: string;
  projectId?: string;
  operations: Operation[];
  operationsLoading: boolean;
  operationsError: ApiError | null;
  onReload: () => void;
}) {
  const [forceConfigure, setForceConfigure] = useState(false);
  const configured = latestConfiguredWorker(operations);

  if (operationsLoading) {
    return <Loading label="Reading this Node's Celery configuration" />;
  }
  if (operationsError) {
    return <ErrorNote error={operationsError} />;
  }

  if (configured && !forceConfigure) {
    return (
      <ConfiguredWorker
        operation={configured}
        nodeId={nodeId}
        serviceId={serviceId}
        onReconfigure={() => setForceConfigure(true)}
      />
    );
  }

  const initialValues = configured
    ? {
        working_directory: stringParam(configured, 'working_directory'),
        python_executable: stringParam(configured, 'python_executable'),
        celery_app: stringParam(configured, 'celery_app'),
        broker_url: stringParam(configured, 'broker_url'),
        result_backend: stringParam(configured, 'result_backend'),
        worker_name: stringParam(configured, 'worker_name'),
        queues: stringParam(configured, 'queues'),
        concurrency: stringParam(configured, 'concurrency'),
        log_level: stringParam(configured, 'log_level'),
        pool: stringParam(configured, 'pool'),
        run_as_user: stringParam(configured, 'run_as_user'),
        extra_args: stringParam(configured, 'extra_args'),
      }
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      {configured ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-subtle px-3 py-2">
          <Text variant="body-sm" tone="secondary">
            Changing the configuration below rewrites and restarts the same worker; it does not
            create a second one.
          </Text>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setForceConfigure(false);
              onReload();
            }}
          >
            <ArrowRight width={14} height={14} aria-hidden />
            Back to the configured worker
          </Button>
        </div>
      ) : null}
      <ConfigureForm
        capability={capability}
        nodeId={nodeId}
        serviceId={serviceId}
        projectId={projectId}
        initialValues={initialValues}
        onConfigured={() => setForceConfigure(false)}
      />
    </div>
  );
}
