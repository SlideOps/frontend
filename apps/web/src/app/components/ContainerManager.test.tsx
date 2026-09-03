import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderInApp } from '../../test/render';
import type { Workload } from '@slideops/api-client';

/*
 * The container runtime's own page should show what is actually running,
 * with the same one-click Adopt the cross-server Import screen already
 * offers, narrowed to containers, so an Operator looking at "Enable
 * containers" is not sent somewhere else to find out.
 */

const listNodeWorkloads = vi.fn();
const adoptWorkload = vi.fn();
const getServiceMetrics = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listNodeWorkloads: (...args: unknown[]) => listNodeWorkloads(...args),
  adoptWorkload: (...args: unknown[]) => adoptWorkload(...args),
  getServiceMetrics: (...args: unknown[]) => getServiceMetrics(...args),
}));

const { ContainerManager } = await import('./ContainerManager');

function workload(overrides: Partial<Workload> = {}): Workload {
  return {
    ref: 'container:app',
    name: 'app',
    runtime: 'container',
    image: 'nginx:latest',
    ports: [{ host: 8080, container: 80 }],
    status: 'running',
    cpu_limit: 0,
    memory_mb: 0,
    adopted: false,
    ...overrides,
  };
}

function show(projectId?: string) {
  return renderInApp(
    <MemoryRouter>
      <ContainerManager nodeId="n1" projectId={projectId} />
    </MemoryRouter>,
  );
}

describe('ContainerManager', () => {
  beforeEach(() => {
    listNodeWorkloads.mockReset();
    adoptWorkload.mockReset();
    getServiceMetrics.mockReset();
  });

  it('shows live CPU and memory usage for an adopted container', async () => {
    listNodeWorkloads.mockResolvedValue([workload({ adopted: true, service_id: 'svc-1' })]);
    getServiceMetrics.mockResolvedValue({ cpu_percent: 12.4, memory_used_mb: 340, memory_limit_mb: 1024 });
    show('proj-1');

    expect(await screen.findByText('12%')).toBeInTheDocument();
    expect(screen.getByText('340 / 1024 MB')).toBeInTheDocument();
    expect(getServiceMetrics).toHaveBeenCalledWith('svc-1', expect.anything());
  });

  it('shows a dash for CPU and memory on a container that is not adopted', async () => {
    listNodeWorkloads.mockResolvedValue([workload({ adopted: false, service_id: undefined })]);
    show('proj-1');

    await screen.findByText('app');
    expect(getServiceMetrics).not.toHaveBeenCalled();
  });

  it('lists only containers, not systemd units', async () => {
    listNodeWorkloads.mockResolvedValue([
      workload({ ref: 'container:app', name: 'app' }),
      workload({ ref: 'unit:nginx', name: 'nginx-unit', runtime: 'systemd', image: undefined }),
    ]);
    show('proj-1');

    expect(await screen.findByText('app')).toBeInTheDocument();
    expect(screen.queryByText('nginx-unit')).toBeNull();
  });

  it('searches by name or image', async () => {
    listNodeWorkloads.mockResolvedValue([
      workload({ ref: 'container:app', name: 'app', image: 'nginx:latest' }),
      workload({ ref: 'container:db', name: 'db', image: 'postgres:16' }),
    ]);
    const operator = userEvent.setup();
    show('proj-1');

    await screen.findByText('app');
    await operator.type(screen.getByRole('searchbox'), 'postgres');
    expect(screen.queryByText('app')).toBeNull();
    expect(screen.getByText('db')).toBeInTheDocument();
  });

  it('adopts an unmanaged container into the given Project', async () => {
    listNodeWorkloads.mockResolvedValue([workload()]);
    adoptWorkload.mockResolvedValue({ id: 'svc-1' });
    const operator = userEvent.setup();
    show('proj-1');

    await operator.click(await screen.findByRole('button', { name: 'Adopt' }));
    await waitFor(() =>
      expect(adoptWorkload).toHaveBeenCalledWith('n1', {
        project_id: 'proj-1',
        ref: 'container:app',
        runtime: 'container',
      }),
    );
  });

  it('refuses to adopt without a Project, saying why', async () => {
    listNodeWorkloads.mockResolvedValue([workload()]);
    const operator = userEvent.setup();
    show(undefined);

    await operator.click(await screen.findByRole('button', { name: 'Adopt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Pick a Project');
    expect(adoptWorkload).not.toHaveBeenCalled();
  });

  it('offers Manage instead of Adopt for a container already under management', async () => {
    listNodeWorkloads.mockResolvedValue([workload({ adopted: true, service_id: 'svc-1' })]);
    show('proj-1');

    expect(await screen.findByRole('button', { name: /Manage/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adopt' })).toBeNull();
  });

  it('says plainly when nothing is running yet', async () => {
    listNodeWorkloads.mockResolvedValue([]);
    show('proj-1');
    expect(await screen.findByText('No containers are running on this Node yet.')).toBeInTheDocument();
  });
});
