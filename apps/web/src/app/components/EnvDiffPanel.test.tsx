import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Service } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

const listServices = vi.fn();
const updateServiceConfiguration = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listServices: (...a: unknown[]) => listServices(...a),
  updateServiceConfiguration: (...a: unknown[]) => updateServiceConfiguration(...a),
}));

vi.mock('../../store/workspace', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useCanWrite: () => true,
}));

const { EnvDiffPanel } = await import('./EnvDiffPanel');

function svc(over: Partial<Service> = {}): Service {
  return {
    id: 'svc-here',
    name: 'here',
    project_id: 'proj-1',
    node_id: 'n-1',
    deployment_type: 'software',
    runtime: 'container',
    source: { type: 'image', image: 'nginx:latest' },
    cpu_limit: 0.5,
    memory_mb: 256,
    status: 'running',
    env: {},
    ...over,
  } as Service;
}

beforeEach(() => {
  listServices.mockReset();
  updateServiceConfiguration.mockReset().mockResolvedValue({});
});

describe('EnvDiffPanel', () => {
  it('renders nothing when no other software Service exists in the Project', async () => {
    listServices.mockResolvedValue([svc({ id: 'svc-here' })]);
    const { container } = renderInApp(<EnvDiffPanel service={svc()} projectId="proj-1" />);

    await waitFor(() => expect(listServices).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('offers only software Services in the same Project to compare against', async () => {
    listServices.mockResolvedValue([
      svc({ id: 'svc-here', name: 'here' }),
      svc({ id: 'svc-there', name: 'there', project_id: 'proj-1' }),
      svc({ id: 'svc-other-project', name: 'other-project', project_id: 'proj-2' }),
      svc({
        id: 'svc-capability',
        name: 'infra',
        project_id: 'proj-1',
        deployment_type: 'capability',
      }),
    ]);

    renderInApp(<EnvDiffPanel service={svc({ id: 'svc-here' })} projectId="proj-1" />);

    await screen.findByLabelText('Compare against');
    expect(screen.getByRole('option', { name: 'there' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'other-project' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'infra' })).not.toBeInTheDocument();
  });

  it('classifies keys present only on one side, matching values, and differing values', async () => {
    listServices.mockResolvedValue([
      svc({
        id: 'svc-there',
        name: 'there',
        env: { SHARED: 'same', ONLY_THERE: 'there-value', DIFFERS: 'there-side' },
      }),
    ]);

    renderInApp(
      <EnvDiffPanel
        service={svc({
          id: 'svc-here',
          env: { SHARED: 'same', ONLY_HERE: 'here-value', DIFFERS: 'here-side' },
        })}
        projectId="proj-1"
      />,
    );

    await userEvent.selectOptions(await screen.findByLabelText('Compare against'), 'svc-there');

    expect(await screen.findByText('Same on both')).toBeInTheDocument();
    expect(screen.getByText('Only on this Service')).toBeInTheDocument();
    expect(screen.getByText('there-value')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Copy here' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Use theirs' })).toBeInTheDocument();
  });

  it('never compares or offers to sync a value sealed on either side', async () => {
    listServices.mockResolvedValue([
      svc({ id: 'svc-there', name: 'there', env: { SECRET: '[stored securely]' } }),
    ]);

    renderInApp(
      <EnvDiffPanel
        service={svc({ id: 'svc-here', env: { SECRET: '[stored securely]' } })}
        projectId="proj-1"
      />,
    );

    await userEvent.selectOptions(await screen.findByLabelText('Compare against'), 'svc-there');

    expect(await screen.findByText('Secret, set on both, hidden')).toBeInTheDocument();
    expect(screen.queryByText('[stored securely]')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('syncs the selected keys, keeping what already exists and never touching a sealed value', async () => {
    listServices.mockResolvedValue([
      svc({
        id: 'svc-there',
        name: 'there',
        env: { NEW_VAR: 'from-there' },
      }),
    ]);

    renderInApp(
      <EnvDiffPanel
        service={svc({
          id: 'svc-here',
          env: { EXISTING: 'kept', SECRET: '[stored securely]' },
        })}
        projectId="proj-1"
      />,
    );

    await userEvent.selectOptions(await screen.findByLabelText('Compare against'), 'svc-there');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Copy here' }));
    await userEvent.click(screen.getByRole('button', { name: /Sync selected/ }));

    await waitFor(() =>
      expect(updateServiceConfiguration).toHaveBeenCalledWith(
        'svc-here',
        expect.objectContaining({
          env: expect.arrayContaining([
            { key: 'EXISTING', value: 'kept', secret: false, keep: false },
            { key: 'SECRET', value: '', secret: true, keep: true },
            { key: 'NEW_VAR', value: 'from-there', secret: false },
          ]),
        }),
      ),
    );
    expect(await screen.findByText(/Saved\. This still needs a redeploy/)).toBeInTheDocument();
  });
});
