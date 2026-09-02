import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Capability, Node, Project } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

const listCapabilitiesMock = vi.fn();
const deployCapabilitiesMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listCapabilities: (...a: unknown[]) => listCapabilitiesMock(...a),
  deployCapabilities: (...a: unknown[]) => deployCapabilitiesMock(...a),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigateMock,
}));

const { ServiceDeployCapabilities } = await import('./ServiceDeployCapabilities');

function capability(overrides: Partial<Capability> = {}): Capability {
  return {
    key: 'install-postgresql',
    name: 'PostgreSQL',
    category: 'database',
    description: 'A PostgreSQL server.',
    intent: '',
    risk_level: 'medium',
    supported_platforms: [],
    requirements: [],
    verification_strategy: '',
    parameters: [],
    ...overrides,
  } as Capability;
}

const catalog: Capability[] = [
  capability({ key: 'install-postgresql', name: 'PostgreSQL' }),
  capability({ key: 'install-redis', name: 'Redis' }),
  capability({ key: 'install-mysql', name: 'MySQL' }),
  capability({ key: 'install-mariadb', name: 'MariaDB' }),
  capability({ key: 'install-mongodb', name: 'MongoDB' }),
];

const node: Node = { id: 'node-1', name: 'db-server' } as Node;
const project: Project = { id: 'proj-1', name: 'apollo' } as Project;

beforeEach(() => {
  listCapabilitiesMock.mockReset().mockResolvedValue(catalog);
  deployCapabilitiesMock.mockReset().mockResolvedValue({ id: 'svc-1' });
  navigateMock.mockReset();
});

function show() {
  return renderInApp(
    <MemoryRouter>
      <ServiceDeployCapabilities projects={[project]} nodes={[node]} />
    </MemoryRouter>,
  );
}

describe('ServiceDeployCapabilities', () => {
  it('offers every supported database capability as a checkbox', async () => {
    show();
    expect(await screen.findByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
    expect(screen.getByText('MySQL')).toBeInTheDocument();
    expect(screen.getByText('MariaDB')).toBeInTheDocument();
    expect(screen.getByText('MongoDB')).toBeInTheDocument();
  });

  it('refuses to deploy with nothing selected', async () => {
    show();
    await screen.findByText('PostgreSQL');
    await userEvent.type(screen.getByLabelText('Name'), 'infra');
    await userEvent.click(screen.getByRole('button', { name: /Deploy/ }));
    expect(await screen.findByText(/choose at least one capability/i)).toBeInTheDocument();
    expect(deployCapabilitiesMock).not.toHaveBeenCalled();
  });

  it('deploys the selected capabilities together and navigates to the new service', async () => {
    show();
    await screen.findByText('PostgreSQL');
    await userEvent.type(screen.getByLabelText('Name'), 'infra');
    await userEvent.click(screen.getByRole('checkbox', { name: /PostgreSQL/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Redis/ }));
    await userEvent.click(screen.getByRole('button', { name: /Deploy/ }));

    await waitFor(() => expect(deployCapabilitiesMock).toHaveBeenCalledTimes(1));
    const call = deployCapabilitiesMock.mock.calls[0]![0];
    expect(call.name).toBe('infra');
    expect(call.node_id).toBe('node-1');
    const keys = call.capabilities.map((c: { capability_key: string }) => c.capability_key);
    expect(keys).toEqual(expect.arrayContaining(['install-postgresql', 'install-redis']));
    expect(keys).toHaveLength(2);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/app/services/svc-1'));
  });
});
