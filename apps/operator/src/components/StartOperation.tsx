import {
  ApiError,
  createOperation,
  type Capability,
  type CapabilityParameter,
  type Node,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { Play } from '@slideops/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  buildParameterSchema,
  cleanParameterValues,
  defaultParameterValues,
} from '../parameter-schema';
import { ParameterFields } from './ParameterFields';

const selectClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * Start an Operation for a Capability on a Node. When the Capability declares
 * parameters, the form is generated from that metadata: one control per
 * parameter, typed and validated by the schema built from the same list, with
 * the help text attached as guidance. The collected values travel to
 * createOperation as parameters. When there are none, this is just a start
 * button. Nothing here executes anything; the Operation opens at its plan.
 */
export function StartOperation({
  capability,
  nodes,
  initialNodeId,
}: {
  capability: Capability;
  nodes: Node[];
  initialNodeId?: string;
}) {
  const navigate = useNavigate();
  const parameters = useMemo<CapabilityParameter[]>(() => capability.parameters ?? [], [capability]);
  const schema = useMemo(() => buildParameterSchema(parameters), [parameters]);

  const [nodeId, setNodeId] = useState<string>(
    initialNodeId && nodes.some((node) => node.id === initialNodeId)
      ? initialNodeId
      : (nodes[0]?.id ?? ''),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues: defaultParameterValues(parameters),
  });

  if (nodes.length === 0) {
    return (
      <Text variant="body-sm" tone="secondary">
        Connect a Node to run this Capability.
      </Text>
    );
  }

  const submit = handleSubmit(async (values) => {
    if (!nodeId) {
      setError('Choose a Node to run this Capability on.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const cleaned = cleanParameterValues(values);
      const operation = await createOperation({
        node_id: nodeId,
        capability_key: capability.key,
        parameters: Object.keys(cleaned).length > 0 ? cleaned : undefined,
      });
      navigate(`/operations/${operation.id}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The Operation could not be started.');
      setSubmitting(false);
    }
  });

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor={`node-${capability.key}`} className="text-sm font-medium text-ink">
          Run on Node
        </label>
        <select
          id={`node-${capability.key}`}
          className={selectClass}
          value={nodeId}
          onChange={(event) => setNodeId(event.target.value)}
        >
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.name}
            </option>
          ))}
        </select>
      </div>

      <ParameterFields
        idPrefix={`param-${capability.key}`}
        parameters={parameters}
        register={register}
        errors={errors}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={submitting}>
          <Play width={15} height={15} aria-hidden />
          {submitting ? 'Starting' : 'Start an Operation'}
        </Button>
        <Text variant="body-sm" tone="secondary">
          You will review the plan before anything runs.
        </Text>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
