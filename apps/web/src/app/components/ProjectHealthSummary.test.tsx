import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { Node, Readiness, Service } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

const listServices = vi.fn();
const listProjectNodes = vi.fn();
const getReadiness = vi.fn();
const getCapabilityStates = vi.fn();
const navigateMock = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listServices: (...a: unknown[]) => listServices(...a),
  listProjectNodes: (...a: unknown[]) => listProjectNodes(...a),
  getReadiness: (...a: unknown[]) => getReadiness(...a),
  getCapabilityStates: (...a: unknown[]) => getCapabilityStates(...a),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigateMock,
}));

const { ProjectHealthSummary } = await import('./ProjectHealthSummary');

function svc(over: Partial<Service> = {}): Service {
  return {
    id: 'svc-1',
    name: 'api',
    project_id: 'proj-1',
    node_id: 'n-1',
    deployment_type: 'software',
    runtime: 'container',
    source: { type: 'image', image: 'nginx:latest' },
    cpu_limit: 0.5,
    memory_mb: 256,
    status: 'running',
    ...over,
  } as Service;
}

function readiness(over: Partial<Readiness> = {}): Readiness {
  return {
    discovered: true,
    summary: '',
    essentials_missing: 0,
    satisfied: [],
    missing: [],
    ...over,
  };
}

function show() {
  return renderInApp(
    <MemoryRouter>
      <ProjectHealthSummary projectId="proj-1" />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listServices.mockReset().mockResolvedValue([]);
  listProjectNodes.mockReset().mockResolvedValue([]);
  getReadiness.mockReset().mockResolvedValue(readiness());
  getCapabilityStates.mockReset().mockResolvedValue({});
  navigateMock.mockReset();
});

describe('ProjectHealthSummary', () => {
  it('reads all systems operational when nothing has failed and nothing essential is missing', async () => {
    listServices.mockResolvedValue([svc({ status: 'running' })]);

    show();

    expect(await screen.findByText('All systems operational')).toBeInTheDocument();
  });

  it('counts a failed Service and a missing essential as issues', async () => {
    listServices.mockResolvedValue([svc({ id: 'svc-a', status: 'failed' })]);
    listProjectNodes.mockResolvedValue([{ id: 'n-1', name: 'web-1' } as Node]);
    getReadiness.mockResolvedValue(readiness({ essentials_missing: 2 }));

    show();

    expect(await screen.findByText('3 issues to look at')).toBeInTheDocument();
  });

  it('scopes the software list to this Project only', async () => {
    listServices.mockResolvedValue([
      svc({ id: 'svc-a', name: 'in-project', project_id: 'proj-1' }),
      svc({ id: 'svc-b', name: 'other-project', project_id: 'proj-2' }),
    ]);

    show();

    expect(await screen.findByText('in-project')).toBeInTheDocument();
    expect(screen.queryByText('other-project')).not.toBeInTheDocument();
  });

  it('navigates to the deploy form with this Project preselected', async () => {
    show();
    await screen.findByText('All systems operational');

    await userEvent.click(screen.getByRole('button', { name: /^Deploy$/ }));

    expect(navigateMock).toHaveBeenCalledWith('/app/services/new?project=proj-1&type=software');
  });
});
