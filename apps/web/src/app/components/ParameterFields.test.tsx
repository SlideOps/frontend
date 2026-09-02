import { screen } from '@testing-library/react';
import { vi, describe, expect, it, beforeEach } from 'vitest';
import type { AvailableVersions, CapabilityParameter } from '@slideops/api-client';
import { useForm } from 'react-hook-form';
import { renderInApp } from '../../test/render';

/*
 * A `type: 'version'` parameter must only ever offer versions this Node can
 * actually install, fetched live, never a hardcoded list, and must fall
 * back to a plain field rather than a broken empty select whenever that
 * live read is not meaningful yet (no Node chosen) or not available at all
 * for this Capability.
 */

const getAvailableVersions = vi.fn(async (..._a: unknown[]): Promise<AvailableVersions> => ({
  supported: true,
  versions: ['15', '16', '17'],
  latest: '17',
}));

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAvailableVersions: (...a: unknown[]) => getAvailableVersions(...a),
}));

beforeEach(() => {
  getAvailableVersions
    .mockReset()
    .mockResolvedValue({ supported: true, versions: ['15', '16', '17'], latest: '17' });
});

const { ParameterFields } = await import('./ParameterFields');

function Harness({
  parameters,
  nodeId,
  capabilityKey,
}: {
  parameters: CapabilityParameter[];
  nodeId?: string;
  capabilityKey?: string;
}) {
  const {
    register,
    formState: { errors },
  } = useForm<Record<string, unknown>>();
  return (
    <ParameterFields
      idPrefix="test"
      parameters={parameters}
      register={register}
      errors={errors}
      nodeId={nodeId}
      capabilityKey={capabilityKey}
    />
  );
}

function versionParam(): CapabilityParameter {
  return {
    key: 'version',
    label: 'Version',
    type: 'version',
    required: false,
    help: 'Which version to install.',
  };
}

describe('ParameterFields, a version parameter', () => {
  it('offers only the versions read live, with the latest marked', async () => {
    renderInApp(
      <Harness parameters={[versionParam()]} nodeId="node-1" capabilityKey="install-postgresql" />,
    );

    // Awaiting the option, not just the field, is deliberate: the field
    // also exists during the fetch as its plain-input fallback, and
    // resolving on that would prove nothing about the live data actually
    // arriving.
    await screen.findByRole('option', { name: '17 (latest available)' });
    expect(screen.getByLabelText(/^Version/).tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: '16' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '15' })).toBeInTheDocument();
    expect(getAvailableVersions).toHaveBeenCalledWith('node-1', 'install-postgresql', expect.anything());
  });

  it('falls back to a plain field when no Node has been chosen yet', async () => {
    renderInApp(<Harness parameters={[versionParam()]} capabilityKey="install-postgresql" />);

    const field = await screen.findByLabelText(/^Version/);
    expect(field.tagName).toBe('INPUT');
    expect(getAvailableVersions).not.toHaveBeenCalled();
  });

  it('falls back to a plain field when this Capability has no version discovery', async () => {
    getAvailableVersions.mockResolvedValueOnce({ supported: false, versions: [] });
    renderInApp(
      <Harness parameters={[versionParam()]} nodeId="node-1" capabilityKey="install-redis" />,
    );

    const field = await screen.findByLabelText(/^Version/);
    expect(field.tagName).toBe('INPUT');
  });

  it('still offers the distribution default even when this Node has nothing else to offer', async () => {
    getAvailableVersions.mockResolvedValueOnce({ supported: true, versions: [] });
    renderInApp(
      <Harness parameters={[versionParam()]} nodeId="node-1" capabilityKey="install-postgresql" />,
    );

    await screen.findByRole('option', { name: /no other version found on this Node/ });
    expect(screen.getByLabelText(/^Version/).tagName).toBe('SELECT');
  });
});
