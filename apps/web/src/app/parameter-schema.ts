import type { CapabilityParameter } from '@slideops/api-client';
import { z } from 'zod';

/*
 * The generated parameter form is built from Capability metadata. A Capability
 * carries a list of parameters, each with a type, and from that list this module
 * builds a Zod schema with per-type validation and a set of default values. The
 * frontend renders one control per parameter and validates it with the schema,
 * so a new parameter or a new Capability never needs a hand-written form.
 */

/** A hostname the way a domain looks: labels of letters, digits, and hyphens. */
const HOSTNAME =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

/** An SSH public key: a known key type, a base64 body, and an optional comment. */
const SSH_PUBLIC_KEY =
  /^(ssh-rsa|ssh-ed25519|ssh-dss|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+[A-Za-z0-9+/]+={0,3}(\s+\S.*)?$/;

/** The form value type for one parameter before validation transforms it. */
export type ParameterValue = string | number | boolean | undefined;

/** The shape react-hook-form holds while the Operator fills the form in. */
export type ParameterFormValues = Record<string, ParameterValue>;

function requiredMessage(param: CapabilityParameter): string {
  return `${param.label} is required.`;
}

/** Build the Zod field for one parameter, keyed to its type. Exported for tests. */
export function parameterFieldSchema(param: CapabilityParameter): z.ZodTypeAny {
  switch (param.type) {
    case 'boolean':
      return z.boolean().default(false);

    case 'number': {
      const text = z.string().trim();
      const base = param.required ? text.min(1, requiredMessage(param)) : text;
      return base
        .refine((value) => value === '' || /^-?\d+(\.\d+)?$/.test(value), {
          message: `Enter a number for ${param.label}.`,
        })
        .transform((value) => (value === '' ? undefined : Number(value)));
    }

    case 'domain': {
      const text = z.string().trim();
      const base = param.required ? text.min(1, requiredMessage(param)) : text;
      return base.refine((value) => value === '' || HOSTNAME.test(value), {
        message: `Enter a domain that looks like a hostname, for example app.${'example'}.com.`,
      });
    }

    case 'path': {
      const text = z.string().trim();
      const base = param.required ? text.min(1, requiredMessage(param)) : text;
      return base.refine((value) => value === '' || value.startsWith('/'), {
        message: `Enter an absolute path for ${param.label}, starting with a slash.`,
      });
    }

    case 'public_key': {
      const text = z.string().trim();
      const base = param.required ? text.min(1, requiredMessage(param)) : text;
      return base.refine((value) => value === '' || SSH_PUBLIC_KEY.test(value), {
        message: `Enter a valid SSH public key for ${param.label}, for example one starting with ssh-ed25519.`,
      });
    }

    case 'string':
    case 'text':
    default: {
      const text = z.string().trim();
      return param.required ? text.min(1, requiredMessage(param)) : text;
    }
  }
}

/**
 * Build the whole parameter schema from a Capability's parameter list. The
 * result validates the generated form and, on success, yields the cleaned
 * values (numbers coerced, blanks dropped) ready to send as the Operation
 * parameters.
 */
export function buildParameterSchema(
  parameters: readonly CapabilityParameter[],
): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const param of parameters) {
    shape[param.key] = parameterFieldSchema(param);
  }
  return z.object(shape) as unknown as z.ZodType<Record<string, unknown>>;
}

/** The empty starting values for the generated form, one per parameter. */
export function defaultParameterValues(
  parameters: readonly CapabilityParameter[],
): ParameterFormValues {
  const values: ParameterFormValues = {};
  for (const param of parameters) {
    values[param.key] = param.type === 'boolean' ? false : '';
  }
  return values;
}

/**
 * Drop the keys whose value is empty or undefined so optional parameters left
 * blank are never sent. Booleans are always sent, so a false is preserved.
 */
export function cleanParameterValues(values: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === '') {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}
