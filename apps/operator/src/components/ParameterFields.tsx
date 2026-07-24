import type { CapabilityParameter } from '@slideops/api-client';
import { CircleHelp } from '@slideops/icons';
import { Tooltip } from '@slideops/tooltips';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';

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

export interface ParameterFieldsProps {
  /** A stable prefix that keeps field ids unique when more than one form is on a page. */
  idPrefix: string;
  parameters: readonly CapabilityParameter[];
  register: UseFormRegister<Record<string, unknown>>;
  errors: FieldErrors<Record<string, unknown>>;
}

/** Render the controls for a Capability's parameters from its metadata. */
export function ParameterFields({ idPrefix, parameters, register, errors }: ParameterFieldsProps) {
  return (
    <>
      {parameters.map((param) => {
        const fieldId = `${idPrefix}-${param.key}`;
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
    </>
  );
}
