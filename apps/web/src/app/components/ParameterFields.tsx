import { getAvailableVersions, listNodes, type CapabilityParameter } from '@slideops/api-client';
import { CircleHelp } from '@slideops/icons';
import { Tooltip } from '@slideops/tooltips';
import { useState } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * The generated parameter form fields, one control per Capability parameter,
 * typed and validated by the schema built from the same metadata. Both starting
 * an Operation and creating an Automation render these, so a Capability's inputs
 * look and behave the same wherever they are filled in.
 */

const controlClass =
  'w-full rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';
const inputClass = `h-10 ${controlClass} border-border`;
const textareaClass = `min-h-[7rem] py-2 ${controlClass} border-border font-mono`;
const helpClass =
  'inline-flex h-5 w-5 items-center justify-center rounded-pill text-ink-muted transition-colors duration-fast ease-standard hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

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
 * A `type: 'version'` parameter's control: a select populated live from
 * GET .../capabilities/{key}/versions, never a hardcoded list, so an
 * Operator can only ever choose a version this Node can actually install.
 * Falls back to a plain text field, same as an unrecognized type would,
 * when the Node has not been chosen yet or this Capability turns out not to
 * have version discovery after all — the frontend's own catalog and the
 * backend's registry could in principle drift, and a broken empty select is
 * worse than the ordinary fallback every other unknown type already gets.
 */
function VersionField({
  fieldId,
  nodeId,
  capabilityKey,
  className,
  register,
  registerKey,
}: {
  fieldId: string;
  nodeId: string | undefined;
  capabilityKey: string;
  className: string;
  register: UseFormRegister<Record<string, unknown>>;
  registerKey: string;
}) {
  const result = useAsyncData(
    (signal) =>
      nodeId
        ? getAvailableVersions(nodeId, capabilityKey, signal)
        : Promise.resolve({ supported: false, versions: [] }),
    [nodeId, capabilityKey],
  );

  if (result.state.status !== 'ready' || !result.state.data.supported) {
    return (
      <input
        id={fieldId}
        type="text"
        className={className}
        placeholder="Leave blank for the distribution's default"
        {...register(registerKey)}
      />
    );
  }

  const { versions, latest } = result.state.data;

  return (
    <select id={fieldId} className={className} {...register(registerKey)}>
      <option value="">
        {versions.length > 0
          ? `Distribution default${latest ? ` (currently ${latest})` : ''}`
          : "Distribution default (no other version found on this Node's own sources)"}
      </option>
      {versions.map((v) => (
        <option key={v} value={v}>
          {v === latest ? `${v} (latest available)` : v}
        </option>
      ))}
    </select>
  );
}

export interface ParameterFieldsProps {
  /** A stable prefix that keeps field ids unique when more than one form is on a page. */
  idPrefix: string;
  parameters: readonly CapabilityParameter[];
  register: UseFormRegister<Record<string, unknown>>;
  errors: FieldErrors<Record<string, unknown>>;
  /**
   * The Node a `type: 'version'` parameter's live discovery reads from.
   * Undefined until an Operator has chosen one, in which case the version
   * field falls back to its plain text shape rather than fetching nothing.
   */
  nodeId?: string;
  /** The Capability this form belongs to, for the same live discovery call. */
  capabilityKey?: string;
}

/**
 * A `type: 'node_address'` parameter's control: the Workspace's own servers in
 * a list, plus a way to type an address for one that is not in it.
 *
 * Wiring an application on one server to a database on another meant knowing
 * which of your servers 187.7.20.156 was, and typing it correctly, in a field
 * whose only feedback for getting it wrong was a connection that timed out
 * later. Every one of those addresses is already known here, so this offers
 * them by the names their Operator gave them.
 *
 * The free-text escape is not a fallback for when the list fails to load, it is
 * a real case: a server outside this Workspace, or a network rather than one
 * machine, is something SlideOps has never seen and cannot offer. Choosing it
 * gives back exactly the field that was here before.
 *
 * The Node this Capability is running on is left out of the list. Allowing a
 * database in from itself is never the answer to "which other server needs to
 * reach this", and offering it invites the mistake.
 */
function NodeAddressField({
  fieldId,
  nodeId,
  placeholder,
  className,
  register,
  registerKey,
}: {
  fieldId: string;
  nodeId: string | undefined;
  placeholder: string | undefined;
  className: string;
  register: UseFormRegister<Record<string, unknown>>;
  registerKey: string;
}) {
  const result = useAsyncData((signal) => listNodes(signal), []);
  const nodes =
    result.state.status === 'ready'
      ? result.state.data.filter((n) => n.id !== nodeId && n.address)
      : [];

  // The list is always the starting point: this renders into a fresh form, and
  // picking a server is the case this exists for. Switching is local state.
  const [manual, setManual] = useState(false);
  const field = register(registerKey);

  if (nodes.length === 0) {
    return (
      <input
        id={fieldId}
        type="text"
        className={className}
        placeholder={placeholder}
        {...register(registerKey)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {manual ? (
        <input
          id={fieldId}
          type="text"
          className={className}
          placeholder={placeholder}
          {...field}
        />
      ) : (
        <select
          id={fieldId}
          className={className}
          {...field}
          onChange={(event) => {
            // The escape hatch is a choice in the same list, so reaching it is
            // one interaction rather than a control the Operator has to notice
            // first. It is never submitted as a value.
            if (event.target.value === MANUAL_ADDRESS) {
              setManual(true);
              return;
            }
            void field.onChange(event);
          }}
        >
          <option value="">Choose a server</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.address}>
              {n.name} ({n.address})
            </option>
          ))}
          <option value={MANUAL_ADDRESS}>Another server or network...</option>
        </select>
      )}
      <button
        type="button"
        className="self-start text-xs text-ink-muted underline hover:text-accent"
        onClick={() => setManual((was) => !was)}
      >
        {manual ? 'Pick one of my servers instead' : 'Enter an address instead'}
      </button>
    </div>
  );
}

/**
 * The select value that means "not one of my servers". It can never collide
 * with a real address, which is the only property it needs.
 */
const MANUAL_ADDRESS = '__manual__';

/** One parameter's control, shared by both the always-visible and Advanced groups below. */
function ParameterField({
  param,
  fieldId,
  errorText,
  nodeId,
  capabilityKey,
  register,
}: {
  param: CapabilityParameter;
  fieldId: string;
  errorText: string | undefined;
  nodeId: string | undefined;
  capabilityKey: string | undefined;
  register: UseFormRegister<Record<string, unknown>>;
}) {
  return (
    <div className="flex flex-col gap-2">
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
          ) : param.type === 'choice' && param.options && param.options.length > 0 ? (
            <select
              id={fieldId}
              className={inputClass}
              aria-invalid={errorText ? true : undefined}
              {...register(param.key)}
            >
              {param.required ? null : <option value="">Not set</option>}
              {param.options.map((option) => (
                <option key={option} value={option}>
                  {option.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          ) : param.type === 'node_address' ? (
            <NodeAddressField
              fieldId={fieldId}
              nodeId={nodeId}
              placeholder={param.placeholder}
              className={inputClass}
              register={register}
              registerKey={param.key}
            />
          ) : param.type === 'version' && capabilityKey ? (
            <VersionField
              fieldId={fieldId}
              nodeId={nodeId}
              capabilityKey={capabilityKey}
              className={inputClass}
              register={register}
              registerKey={param.key}
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
}

/**
 * Render the controls for a Capability's parameters from its metadata.
 *
 * Required parameters, the version field (choosing a version is the point of
 * Basic vs Advanced elsewhere in the product, so it never hides), and any
 * parameter the Capability itself marks `notable` (pgvector on Create
 * PostgreSQL database and user, the first of these -- a widely asked-for
 * option that hiding by default made effectively invisible) always show.
 * Every other optional parameter -- Redis's max memory or eviction policy,
 * and the like -- sits behind an "Advanced options" disclosure, collapsed by
 * default, so a first-time Operator sees only what they must decide. Nothing
 * here changes what an unopened Advanced field submits as: every default
 * stays exactly what it is today.
 */
export function ParameterFields({
  idPrefix,
  parameters,
  register,
  errors,
  nodeId,
  capabilityKey,
}: ParameterFieldsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const primary = parameters.filter(
    (param) => param.required || param.type === 'version' || param.notable,
  );
  const advanced = parameters.filter(
    (param) => !param.required && param.type !== 'version' && !param.notable,
  );

  const renderField = (param: CapabilityParameter) => {
    const fieldId = `${idPrefix}-${param.key}`;
    const message = errors[param.key]?.message;
    const errorText = typeof message === 'string' ? message : undefined;
    return (
      <ParameterField
        key={param.key}
        param={param}
        fieldId={fieldId}
        errorText={errorText}
        nodeId={nodeId}
        capabilityKey={capabilityKey}
        register={register}
      />
    );
  };

  return (
    <>
      {primary.map(renderField)}
      {advanced.length > 0 ? (
        <div className="flex flex-col gap-4 rounded-md border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">Advanced options</span>
            <button
              type="button"
              className="text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              onClick={() => setShowAdvanced((value) => !value)}
            >
              {showAdvanced ? 'Hide' : `Show (${advanced.length})`}
            </button>
          </div>
          {showAdvanced ? advanced.map(renderField) : null}
        </div>
      ) : null}
    </>
  );
}
