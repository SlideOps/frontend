import {
  ApiError,
  createOperation,
  type Capability,
  type CapabilityParameter,
  type Node,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ArrowRight, Package, Play } from '@slideops/icons';
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
  initialProjectId,
}: {
  capability: Capability;
  nodes: Node[];
  initialNodeId?: string;
  /**
   * The Project this Operation runs in, read from the ?project= param. A Plugin
   * Capability requires it; a Core Capability is started without one, so this is
   * undefined and no project_id is sent.
   */
  initialProjectId?: string;
}) {
  const navigate = useNavigate();
  const parameters = useMemo<CapabilityParameter[]>(
    () => capability.parameters ?? [],
    [capability],
  );
  const schema = useMemo(() => buildParameterSchema(parameters), [parameters]);

  const [nodeId, setNodeId] = useState<string>(
    initialNodeId && nodes.some((node) => node.id === initialNodeId)
      ? initialNodeId
      : (nodes[0]?.id ?? ''),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When a Capability is not installed the backend refuses with this code, so we
  // guide the Operator to the Plugin that unlocks it instead of a raw error.
  const [notInstalled, setNotInstalled] = useState(false);

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
    setNotInstalled(false);
    try {
      const cleaned = cleanParameterValues(values);
      const operation = await createOperation({
        node_id: nodeId,
        capability_key: capability.key,
        // Carry the Project only when one was passed. A Plugin Capability runs
        // with it; a Core Capability is started without one and sends no
        // project_id, which the backend requires.
        project_id: initialProjectId,
        parameters: Object.keys(cleaned).length > 0 ? cleaned : undefined,
      });
      navigate(`/app/operations/${operation.id}`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'capability_not_installed') {
        setNotInstalled(true);
      } else {
        // project_required and any other backend error carry a clear message.
        setError(cause instanceof ApiError ? cause.message : 'The Operation could not be started.');
      }
      setSubmitting(false);
    }
  });

  // The Plugin that unlocks this Capability, when the metadata names it. The
  // Marketplace list is a good fallback when it does not.
  const pluginId =
    capability.plugin_id && capability.plugin_id.toLowerCase() !== 'core'
      ? capability.plugin_id
      : undefined;
  const marketplaceHref = pluginId ? `/app/marketplace/${pluginId}` : '/app/marketplace';

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
        nodeId={nodeId}
        capabilityKey={capability.key}
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

      {notInstalled ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-md border border-border bg-subtle p-4"
        >
          <div className="flex items-start gap-3">
            <Package width={18} height={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
            <div>
              <Text variant="body-sm" className="font-medium">
                This Capability is not installed yet
              </Text>
              <Text variant="body-sm" tone="secondary" className="mt-0.5">
                It comes from a Plugin you have not installed. Install its Plugin from the
                Marketplace, then start this Operation again.
              </Text>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={() => navigate(marketplaceHref)}
          >
            <Package width={15} height={15} aria-hidden />
            Open the Marketplace
            <ArrowRight width={15} height={15} aria-hidden />
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
