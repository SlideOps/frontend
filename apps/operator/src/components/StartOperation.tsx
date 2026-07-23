import {
  ApiError,
  createOperation,
  type Capability,
  type CapabilityParameter,
  type Node,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { CircleHelp, Play } from '@slideops/icons';
import { Tooltip } from '@slideops/tooltips';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  buildParameterSchema,
  cleanParameterValues,
  defaultParameterValues,
} from '../parameter-schema';

const controlClass =
  'w-full rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';
const inputClass = `h-10 ${controlClass} border-border`;
const textareaClass = `min-h-[7rem] py-2 ${controlClass} border-border font-mono`;
const helpClass =
  'inline-flex h-5 w-5 items-center justify-center rounded-pill text-ink-muted transition-colors duration-fast ease-standard hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';
const selectClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** A plain-language help bubble for a generated field, sourced from metadata. */
function FieldHelp({ text, label }: { text: string; label: string }) {
  if (!text) {
    return null;
  }
  return (
    <Tooltip content={text}>
      <button type="button" className={helpClass} aria-label={`About ${label}`}>
        <CircleHelp width={14} height={14} aria-hidden />
      </button>
    </Tooltip>
  );
}

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

      {parameters.map((param) => {
        const fieldId = `param-${capability.key}-${param.key}`;
        const message = errors[param.key]?.message;
        const errorText = typeof message === 'string' ? message : undefined;
        return (
          <div key={param.key} className="flex flex-col gap-2">
            {param.type === 'boolean' ? (
              <label htmlFor={fieldId} className="flex items-center gap-3">
                <input
                  id={fieldId}
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  {...register(param.key)}
                />
                <span className="text-sm font-medium text-ink">{param.label}</span>
                <FieldHelp text={param.help} label={param.label} />
              </label>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <label htmlFor={fieldId} className="text-sm font-medium text-ink">
                    {param.label}
                    {param.required ? null : (
                      <span className="ml-1 text-xs font-normal text-ink-muted">optional</span>
                    )}
                  </label>
                  <FieldHelp text={param.help} label={param.label} />
                </div>
                {param.type === 'text' || param.type === 'public_key' ? (
                  <textarea
                    id={fieldId}
                    className={textareaClass}
                    placeholder={param.placeholder}
                    aria-invalid={errorText ? true : undefined}
                    {...register(param.key)}
                  />
                ) : (
                  <input
                    id={fieldId}
                    type="text"
                    inputMode={param.type === 'number' ? 'numeric' : undefined}
                    className={inputClass}
                    placeholder={param.placeholder}
                    aria-invalid={errorText ? true : undefined}
                    {...register(param.key)}
                  />
                )}
              </>
            )}
            {errorText ? (
              <p className="text-sm text-danger" role="alert">
                {errorText}
              </p>
            ) : null}
          </div>
        );
      })}

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
