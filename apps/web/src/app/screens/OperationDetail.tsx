import {
  ApiError,
  approveOperation,
  cancelOperation,
  getNode,
  getOperation,
  openOperationStream,
  type Operation,
  type OperationEvent,
  type OperationStatus,
  type StreamStatus,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { AlertTriangle, ArrowLeft, CheckCircle2, Terminal, Wifi, XCircle } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LogoLoader } from '../../components/LogoLoader';
import { StatusBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { CredentialsCard } from '../components/CredentialsCard';
import { PlanReview } from '../components/PlanReview';
import { StepTimeline } from '../components/StepTimeline';
import { VerificationView } from '../components/VerificationView';
import { OperatorShell } from '../components/OperatorShell';
import { useOperationsStore } from '../store/operations';

const PRE_EXECUTION: OperationStatus[] = [
  'created',
  'discovering',
  'assessing',
  'planning',
  'awaiting_approval',
];
const RUNNING: OperationStatus[] = ['approved', 'executing', 'verifying'];
const REFETCH_ON: OperationEvent['type'][] = [
  'operation.status',
  'operation.verification',
  'operation.completed',
];

const EMPTY_EVENTS: OperationEvent[] = [];

// The live terminal embeds xterm.js, which is heavy, so it loads on demand. It
// arrives with the execution view and never weighs on the first load.
const OperationTerminal = lazy(() =>
  import('../components/OperationTerminal').then((m) => ({ default: m.OperationTerminal })),
);

/** A live indicator for the event stream connection. */
function StreamIndicator({ status }: { status: StreamStatus }) {
  const label = status === 'open' ? 'Live' : status === 'closed' ? 'Stream closed' : 'Reconnecting';
  const tone = status === 'open' ? 'text-success' : 'text-ink-muted';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${tone}`} role="status">
      <Wifi width={14} height={14} aria-hidden />
      {label}
    </span>
  );
}

/**
 * The Operation flow, one screen for the whole lifecycle. Before execution it
 * shows the Plan to review and approve. During execution it shows the step
 * timeline and the live terminal, both driven by the event stream. After, it
 * shows the Verification result, or the error and rollback on failure. It works
 * the same for a live Operation and for one replayed from History.
 */
export function OperationDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const events = useOperationsStore((state) => state.events[id] ?? EMPTY_EVENTS);
  const ingest = useOperationsStore((state) => state.ingest);
  const clear = useOperationsStore((state) => state.clear);

  const [operation, setOperation] = useState<Operation | null>(null);
  // The Node's address, resolved so the credentials card can form a real
  // connection. It never blocks the page: if it cannot be fetched, the card
  // simply shows no host.
  const [nodeHost, setNodeHost] = useState<string | undefined>(undefined);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('connecting');
  const [actionError, setActionError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await getOperation(id);
      setOperation(next);
      setLoadError(null);
      if (next.events && next.events.length > 0) {
        ingest(id, next.events);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setLoadError(error);
      }
    }
  }, [id, ingest]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  // Replay first, then subscribe: both paths feed the same store, merged by seq.
  useEffect(() => {
    const handle = openOperationStream({
      onStatusChange: setStreamStatus,
      onEvent: (event) => {
        if (event.operation_id !== id) {
          return;
        }
        ingest(id, [event]);
        if (REFETCH_ON.includes(event.type)) {
          void loadRef.current();
        }
      },
    });
    return () => handle.close();
  }, [id, ingest]);

  useEffect(() => () => clear(id), [id, clear]);

  // Resolve the Node address for the credentials card, lazily and without
  // blocking the Operation view. A failure leaves the host unset, which the card
  // handles by omitting the host row and the connection string.
  const nodeId = operation?.node_id;
  useEffect(() => {
    if (!nodeId) {
      return;
    }
    let active = true;
    getNode(nodeId)
      .then((node) => {
        if (active) {
          setNodeHost(node.address);
        }
      })
      .catch(() => {
        // The host is a convenience; if it cannot be resolved the card still works.
      });
    return () => {
      active = false;
    };
  }, [nodeId]);

  const approve = async () => {
    setApproving(true);
    setActionError(null);
    try {
      await approveOperation(id);
      await load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Approval did not go through.');
    } finally {
      setApproving(false);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    setActionError(null);
    try {
      await cancelOperation(id);
      await load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Cancel did not go through.');
    } finally {
      setCancelling(false);
    }
  };

  if (loadError && !operation) {
    return (
      <OperatorShell active="operations">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => navigate('/app/operations')}
        >
          <ArrowLeft width={16} height={16} aria-hidden />
          History
        </Button>
        <ErrorNote error={loadError} />
      </OperatorShell>
    );
  }

  if (!operation) {
    return (
      <OperatorShell active="operations">
        <Loading label="Loading this Operation" />
      </OperatorShell>
    );
  }

  const status = operation.status;
  const isPreExecution = PRE_EXECUTION.includes(status);
  const isRunning = RUNNING.includes(status);
  const hasExecution =
    isRunning || status === 'completed' || status === 'failed' || status === 'cancelled';

  return (
    <OperatorShell active="operations">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => navigate('/app/operations')}
      >
        <ArrowLeft width={16} height={16} aria-hidden />
        History
      </Button>

      <PageHeader
        title={operation.capability_key}
        description="One run of a Capability against a Node, from plan to verification."
        guidanceKey="dashboard.operations"
        actions={
          <div className="flex items-center gap-3">
            <StreamIndicator status={streamStatus} />
            <StatusBadge status={status} />
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/app/nodes/${operation.node_id}`)}
        >
          View the Node
        </Button>
      </div>

      {status === 'failed' && operation.error ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-md border border-border bg-subtle px-4 py-3"
        >
          <XCircle width={18} height={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />
          <div>
            <Text variant="body-sm" className="font-medium">
              The Operation failed and was rolled back
            </Text>
            <Text variant="body-sm" tone="secondary" className="mt-0.5">
              {operation.error}
            </Text>
          </div>
        </div>
      ) : null}

      {status === 'cancelled' ? (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-border bg-subtle px-4 py-3">
          <AlertTriangle
            width={18}
            height={18}
            className="mt-0.5 shrink-0 text-warning"
            aria-hidden
          />
          <Text variant="body-sm" tone="secondary">
            This Operation was cancelled. Nothing further will run.
          </Text>
        </div>
      ) : null}

      {status === 'completed' ? (
        <div className="mb-6 flex items-center gap-3 rounded-md border border-border bg-subtle px-4 py-3">
          <CheckCircle2 width={18} height={18} className="shrink-0 text-success" aria-hidden />
          <Text variant="body-sm" tone="secondary">
            The Operation completed and its result was verified.
          </Text>
        </div>
      ) : null}

      {/* Pre-execution: review the plan and approve. */}
      {isPreExecution ? (
        <div className="flex flex-col gap-6">
          {operation.plan ? (
            <>
              <div className="flex items-center gap-2">
                <Text variant="h3">Review the plan</Text>
                <Guidance for="operation.plan" />
              </div>
              <PlanReview plan={operation.plan} />
              <Card>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    onClick={approve}
                    disabled={approving || status !== 'awaiting_approval'}
                  >
                    {approving ? 'Approving' : 'Approve and run'}
                  </Button>
                  <Guidance for="operation.approve" />
                  <Button variant="ghost" size="lg" onClick={cancel} disabled={cancelling}>
                    {cancelling ? 'Cancelling' : 'Cancel'}
                  </Button>
                  {status !== 'awaiting_approval' ? (
                    <Text variant="body-sm" tone="secondary">
                      Preparing the plan. Approval opens when it is ready.
                    </Text>
                  ) : null}
                </div>
                {actionError ? (
                  <p role="alert" className="mt-3 text-sm text-danger">
                    {actionError}
                  </p>
                ) : null}
              </Card>
            </>
          ) : (
            <Loading label="Preparing the plan: discovering, assessing, and planning" />
          )}
        </div>
      ) : null}

      {/* Execution and after: timeline, live terminal, and verification. */}
      {hasExecution ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <Card className="h-fit">
            <div className="mb-4 flex items-center gap-2">
              <Text variant="h4">Timeline</Text>
              <Guidance for="operation.timeline" />
            </div>
            {operation.plan ? (
              <StepTimeline steps={operation.plan.steps} events={events} status={status} />
            ) : (
              <Text variant="body-sm" tone="secondary">
                No plan is attached to this Operation.
              </Text>
            )}
          </Card>

          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Terminal width={18} height={18} className="text-brand" aria-hidden />
                  <Text variant="h4">Live output</Text>
                  <Guidance for="operation.terminal" />
                </div>
                {isRunning ? (
                  <Button variant="danger" size="sm" onClick={cancel} disabled={cancelling}>
                    {cancelling ? 'Cancelling' : 'Cancel'}
                  </Button>
                ) : null}
              </div>
              <Suspense
                fallback={
                  <div className="flex h-80 w-full items-center justify-center rounded-md border border-border bg-app">
                    <LogoLoader size="sm" />
                  </div>
                }
              >
                <OperationTerminal key={id} events={events} />
              </Suspense>
              {actionError ? (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {actionError}
                </p>
              ) : null}
            </Card>

            {operation.verification ? (
              <VerificationView verification={operation.verification} />
            ) : null}

            {status === 'completed' ? (
              <CredentialsCard operation={operation} host={nodeHost} />
            ) : null}
          </div>
        </div>
      ) : null}
    </OperatorShell>
  );
}
