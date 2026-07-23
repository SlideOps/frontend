import type { CapabilityParameter } from '@slideops/api-client';
import { describe, expect, it } from 'vitest';
import {
  buildParameterSchema,
  cleanParameterValues,
  defaultParameterValues,
} from './parameter-schema';

/** A compact way to declare a parameter for a test. */
function param(over: Partial<CapabilityParameter> & { key: string; type: CapabilityParameter['type'] }): CapabilityParameter {
  return {
    label: over.label ?? over.key,
    required: over.required ?? false,
    help: over.help ?? '',
    ...over,
  };
}

describe('buildParameterSchema', () => {
  it('enforces required string parameters', () => {
    const schema = buildParameterSchema([param({ key: 'username', type: 'string', required: true })]);

    expect(schema.safeParse({ username: '' }).success).toBe(false);
    expect(schema.safeParse({ username: 'deploy' }).success).toBe(true);
  });

  it('lets an optional string be left blank', () => {
    const schema = buildParameterSchema([param({ key: 'note', type: 'string', required: false })]);

    expect(schema.safeParse({ note: '' }).success).toBe(true);
  });

  it('accepts a domain that looks like a hostname and rejects one that does not', () => {
    const schema = buildParameterSchema([param({ key: 'domain', type: 'domain', required: true })]);

    expect(schema.safeParse({ domain: 'app.slideops.com' }).success).toBe(true);
    expect(schema.safeParse({ domain: 'not a domain' }).success).toBe(false);
    expect(schema.safeParse({ domain: 'https://app.slideops.com' }).success).toBe(false);
  });

  it('requires an absolute path', () => {
    const schema = buildParameterSchema([param({ key: 'path', type: 'path', required: true })]);

    expect(schema.safeParse({ path: '/srv/app' }).success).toBe(true);
    expect(schema.safeParse({ path: 'srv/app' }).success).toBe(false);
  });

  it('recognizes an SSH public key', () => {
    const schema = buildParameterSchema([param({ key: 'public_key', type: 'public_key', required: true })]);

    const key = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExampleKeyBodyHere operator@slideops';
    expect(schema.safeParse({ public_key: key }).success).toBe(true);
    expect(schema.safeParse({ public_key: 'just some text' }).success).toBe(false);
  });

  it('coerces a numeric string to a number and rejects non-numbers', () => {
    const schema = buildParameterSchema([param({ key: 'port', type: 'number', required: true })]);

    const ok = schema.safeParse({ port: '8080' });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.port).toBe(8080);
    expect(schema.safeParse({ port: 'abc' }).success).toBe(false);
    expect(schema.safeParse({ port: '' }).success).toBe(false);
  });

  it('keeps a boolean parameter as a boolean', () => {
    const schema = buildParameterSchema([param({ key: 'sudo', type: 'boolean' })]);

    const result = schema.safeParse({ sudo: true });
    expect(result.success).toBe(true);
    expect(result.success && result.data.sudo).toBe(true);
  });

  it('validates several parameters together', () => {
    const schema = buildParameterSchema([
      param({ key: 'username', type: 'string', required: true }),
      param({ key: 'sudo', type: 'boolean' }),
      param({ key: 'public_key', type: 'public_key', required: true }),
    ]);

    const bad = schema.safeParse({ username: '', sudo: false, public_key: 'nope' });
    expect(bad.success).toBe(false);
  });
});

describe('defaultParameterValues', () => {
  it('starts booleans at false and everything else blank', () => {
    const values = defaultParameterValues([
      param({ key: 'username', type: 'string' }),
      param({ key: 'sudo', type: 'boolean' }),
    ]);

    expect(values).toEqual({ username: '', sudo: false });
  });
});

describe('cleanParameterValues', () => {
  it('drops blank and undefined values but keeps a false boolean', () => {
    const cleaned = cleanParameterValues({ username: 'deploy', note: '', missing: undefined, sudo: false });

    expect(cleaned).toEqual({ username: 'deploy', sudo: false });
  });
});
