import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function requiredParam(): CapabilityParameter {
  return {
    key: 'name',
    label: 'Name',
    type: 'string',
    required: true,
    help: 'A name for this instance.',
  };
}

function optionalParam(): CapabilityParameter {
  return {
    key: 'max_memory',
    label: 'Max memory',
    type: 'string',
    required: false,
    help: 'Redis eviction threshold.',
  };
}

function notableParam(): CapabilityParameter {
  return {
    key: 'enable_pgvector',
    label: 'Enable pgvector',
    type: 'boolean',
    required: false,
    notable: true,
    help: 'Install the pgvector extension and enable it on this database.',
  };
}

describe('ParameterFields, Basic vs Advanced', () => {
  it('always shows required parameters and the version field, with optional parameters collapsed', async () => {
    renderInApp(
      <Harness parameters={[requiredParam(), versionParam(), optionalParam()]} nodeId="node-1" capabilityKey="install-redis" />,
    );

    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
    await screen.findByLabelText(/^Version/);
    expect(screen.queryByLabelText(/^Max memory/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show (1)' })).toBeInTheDocument();
  });

  it('reveals optional parameters once Advanced options is opened', async () => {
    renderInApp(<Harness parameters={[requiredParam(), optionalParam()]} />);

    await userEvent.click(screen.getByRole('button', { name: 'Show (1)' }));

    expect(screen.getByLabelText(/^Max memory/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
  });

  it('renders no Advanced options disclosure when every parameter is required', () => {
    renderInApp(<Harness parameters={[requiredParam()]} />);

    expect(screen.queryByRole('button', { name: /Show|Hide/ })).not.toBeInTheDocument();
  });

  it('shows a notable optional parameter like pgvector up front, never collapsed', () => {
    renderInApp(<Harness parameters={[requiredParam(), notableParam(), optionalParam()]} />);

    // Not hidden behind the toggle: visible immediately, with no click needed.
    expect(screen.getByLabelText(/^Enable pgvector/)).toBeInTheDocument();
    // An ordinary optional parameter alongside it still collapses as before,
    // so marking one parameter notable does not silently open every other one.
    expect(screen.queryByLabelText(/^Max memory/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show (1)' })).toBeInTheDocument();
  });
});
