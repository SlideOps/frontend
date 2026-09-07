import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, expect, it, beforeEach } from 'vitest';
import type { AvailableVersions, CapabilityParameter, Node } from '@slideops/api-client';
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
const listNodes = vi.fn(async (..._a: unknown[]): Promise<Node[]> => []);

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAvailableVersions: (...a: unknown[]) => getAvailableVersions(...a),
  listNodes: (...a: unknown[]) => listNodes(...a),
}));

beforeEach(() => {
  getAvailableVersions
    .mockReset()
    .mockResolvedValue({ supported: true, versions: ['15', '16', '17'], latest: '17' });
  listNodes.mockReset().mockResolvedValue([]);
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

function choiceParam(overrides: Partial<CapabilityParameter> = {}): CapabilityParameter {
  return {
    key: 'auth_method',
    label: 'Authentication method',
    type: 'choice',
    required: false,
    help: 'Password or private key.',
    options: ['password', 'private_key'],
    ...overrides,
  };
}

/** A Node as the picker reads it: a name an Operator gave it, and an address. */
function node(over: Partial<Node>): Node {
  return {
    id: 'n-1',
    name: 'Server',
    hostname: '',
    address: '203.0.113.1',
    port: 22,
    ssh_username: 'root',
    auth_kind: 'password',
    ssh_key_id: null,
    project_id: null,
    ...over,
  } as Node;
}

function renderFields(parameters: CapabilityParameter[], opts: { nodeId?: string } = {}) {
  return renderInApp(<Harness parameters={parameters} nodeId={opts.nodeId} />);
}

describe('ParameterFields, a choice parameter', () => {
  it('offers every declared option, in order', async () => {
    renderInApp(<Harness parameters={[choiceParam({ required: true })]} />);

    const field = await screen.findByLabelText(/^Authentication method/);
    expect(field.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'password' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'private key' })).toBeInTheDocument();
  });

  it('offers no Not set option when the choice is required', async () => {
    renderInApp(<Harness parameters={[choiceParam({ required: true })]} />);
    await screen.findByLabelText(/^Authentication method/);
    expect(screen.queryByRole('option', { name: 'Not set' })).not.toBeInTheDocument();
  });

  it('offers a Not set option when the choice is optional', async () => {
    renderInApp(<Harness parameters={[requiredParam(), choiceParam()]} />);
    // Optional, so it starts collapsed behind Advanced options, same as any
    // other optional parameter would.
    await userEvent.click(screen.getByRole('button', { name: 'Show (1)' }));
    await screen.findByLabelText(/^Authentication method/);
    expect(screen.getByRole('option', { name: 'Not set' })).toBeInTheDocument();
  });
});

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
    expect(getAvailableVersions).toHaveBeenCalledWith(
      'node-1',
      'install-postgresql',
      expect.anything(),
    );
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
      <Harness
        parameters={[requiredParam(), versionParam(), optionalParam()]}
        nodeId="node-1"
        capabilityKey="install-redis"
      />,
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

describe('a node_address parameter', () => {
  const sourceParam = {
    key: 'source',
    label: 'Allow from (the OTHER server)',
    type: 'node_address' as const,
    required: true,
    help: 'The other server that needs to reach this database.',
    placeholder: '203.0.113.4',
  };

  it('offers the workspace servers by name, so no address has to be remembered', async () => {
    listNodes.mockResolvedValue([
      node({ id: 'app', name: 'App-server-1', address: '187.7.20.156' }),
      node({ id: 'db', name: 'sali-database-server', address: '187.7.20.159' }),
    ]);

    renderFields([sourceParam], { nodeId: 'db' });

    // The list arrives from the server, so the plain field shows first, the
    // same way a version parameter's does while its own read is in flight.
    expect(
      await screen.findByRole('option', { name: /App-server-1 \(187\.7\.20\.156\)/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Allow from/).tagName).toBe('SELECT');
    // Allowing a database in from itself is never the answer to "which other
    // server needs to reach this".
    expect(screen.queryByRole('option', { name: /sali-database-server/ })).not.toBeInTheDocument();
  });

  it('lets an address be typed for a server outside the workspace', async () => {
    listNodes.mockResolvedValue([node({ id: 'app', name: 'App-server-1', address: '187.7.20.156' })]);

    renderFields([sourceParam], { nodeId: 'db' });
    await screen.findByRole('option', { name: /App-server-1/ });

    await userEvent.click(screen.getByRole('button', { name: /enter an address instead/i }));

    const input = screen.getByLabelText(/^Allow from/);
    expect(input.tagName).toBe('INPUT');
    await userEvent.type(input, '203.0.113.4');
    expect(input).toHaveValue('203.0.113.4');
  });

  it('falls back to a plain field when there are no other servers to offer', async () => {
    listNodes.mockResolvedValue([node({ id: 'db', name: 'sali-database-server', address: '187.7.20.159' })]);

    renderFields([sourceParam], { nodeId: 'db' });

    await waitFor(() => expect(listNodes).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText(/^Allow from/).tagName).toBe('INPUT'));
  });
});
