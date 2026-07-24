import {
  ApiError,
  createAutomation,
  listCapabilities,
  listNodes,
  type Capability,
  type Node,
  type Schedule,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowLeft, Clock, Server } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState } from '@slideops/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { ParameterFields } from '../components/ParameterFields';
import { ScheduleBuilder } from '../components/ScheduleBuilder';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  buildParameterSchema,
  cleanParameterValues,
  defaultParameterValues,
} from '../parameter-schema';
import { defaultSchedule } from '../schedule';

const selectClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

interface NewData {
  nodes: Node[];
  capabilities: Capability[];
}

/**
 * The parameter form for the chosen Capability. It is keyed by the Capability in
 * the parent, so choosing a different Capability remounts it with a fresh schema
 * and fresh defaults. On a valid submit it hands the cleaned values up so the
 * parent can compose the whole Automation with the Node and the schedule.
 */
function ParameterSection({
  capability,
  submitting,
  onValid,
}: {
  capability: Capability;
  submitting: boolean;
  onValid: (parameters: Record<string, unknown>) => void;
}) {
  const parameters = useMemo(() => capability.parameters ?? [], [capability]);
  const schema = useMemo(() => buildParameterSchema(parameters), [parameters]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues: defaultParameterValues(parameters),
  });

  const submit = handleSubmit((values) => onValid(cleanParameterValues(values)));

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
      {parameters.length > 0 ? (
        <div className="flex flex-col gap-5">
          <Text variant="caption" tone="secondary">
            Inputs for {capability.name}
          </Text>
          <ParameterFields
            idPrefix={`automation-${capability.key}`}
            parameters={parameters}
            register={register}
            errors={errors}
          />
        </div>
      ) : (
        <Text variant="body-sm" tone="secondary">
          {capability.name} needs no inputs.
        </Text>
      )}

      <Button type="submit" disabled={submitting}>
        <Clock width={15} height={15} aria-hidden />
        {submitting ? 'Saving' : 'Create Automation'}
      </Button>
    </form>
  );
}

/** Create an Automation: choose a Node and a Capability, add inputs, set a schedule. */
export function AutomationNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state } = useAsyncData<NewData>(async (signal) => {
    const [nodes, capabilities] = await Promise.all([
      listNodes(signal),
      listCapabilities(undefined, signal),
    ]);
    return { nodes, capabilities };
  }, []);

  const [nodeId, setNodeId] = useState('');
  const [capabilityKey, setCapabilityKey] = useState('');
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule('daily'));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once the data arrives, default the Node and Capability so the form is usable
  // immediately. A Node may be preselected through the query string.
  const ready = state.status === 'ready' ? state.data : null;
  const preselectNode = searchParams.get('node');
  const effectiveNodeId =
    nodeId ||
    (preselectNode && ready?.nodes.some((node) => node.id === preselectNode)
      ? preselectNode
      : (ready?.nodes[0]?.id ?? ''));
  const effectiveCapabilityKey = capabilityKey || (ready?.capabilities[0]?.key ?? '');
  const capability = ready?.capabilities.find((item) => item.key === effectiveCapabilityKey);

  const create = async (parameters: Record<string, unknown>) => {
    if (!effectiveNodeId) {
      setError('Choose a Node for this Automation.');
      return;
    }
    if (!effectiveCapabilityKey) {
      setError('Choose a Capability to automate.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const automation = await createAutomation({
        node_id: effectiveNodeId,
        capability_key: effectiveCapabilityKey,
        parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
        schedule,
        enabled: true,
      });
      navigate(`/app/automations/${automation.id}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The Automation could not be created.');
      setSubmitting(false);
    }
  };

  return (
    <OperatorShell active="automations">
      <button
        type="button"
        onClick={() => navigate('/app/automations')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <ArrowLeft width={16} height={16} aria-hidden />
        All Automations
      </button>

      <div className="mb-6">
        <Text variant="h1">New Automation</Text>
        <Text variant="body" tone="secondary" className="mt-2 max-w-2xl">
          Choose a Node and a Capability, fill in any inputs, and set a schedule. Every scheduled run
          is auto-approved yet runs the full lifecycle and is recorded in History.
        </Text>
      </div>

      {state.status === 'loading' ? <Loading label="Getting ready" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {ready ? (
        ready.nodes.length === 0 ? (
          <EmptyState
            icon={Server}
            title="Connect a Node first"
            description="An Automation runs a Capability on a Node. Connect a Node, then come back to schedule it."
            action={<Button onClick={() => navigate('/app/nodes/new')}>Connect a Node</Button>}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <Card className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="automation-node" className="text-sm font-medium text-ink">
                  Run on Node
                </label>
                <select
                  id="automation-node"
                  className={selectClass}
                  value={effectiveNodeId}
                  onChange={(event) => setNodeId(event.target.value)}
                >
                  {ready.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="automation-capability" className="text-sm font-medium text-ink">
                  Capability to run
                </label>
                <select
                  id="automation-capability"
                  className={selectClass}
                  value={effectiveCapabilityKey}
                  onChange={(event) => setCapabilityKey(event.target.value)}
                >
                  {ready.capabilities.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {capability ? (
                  <Text variant="body-sm" tone="secondary">
                    {capability.description}
                  </Text>
                ) : null}
              </div>

              {capability ? (
                <ParameterSection
                  key={capability.key}
                  capability={capability}
                  submitting={submitting}
                  onValid={create}
                />
              ) : null}

              {error ? (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              ) : null}
            </Card>

            <Card className="h-fit">
              <div className="mb-4 flex items-center gap-2">
                <Clock width={18} height={18} className="text-brand" aria-hidden />
                <Text variant="h4">Schedule</Text>
                <Guidance for="automation.schedule" />
              </div>
              <ScheduleBuilder value={schedule} onChange={setSchedule} />
            </Card>
          </div>
        )
      ) : null}
    </OperatorShell>
  );
}
