import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Service } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

const updateServiceConfiguration = vi.fn();
const redeployService = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  updateServiceConfiguration: (...a: unknown[]) => updateServiceConfiguration(...a),
  redeployService: (...a: unknown[]) => redeployService(...a),
}));

const { ServiceConfiguration } = await import('./ServiceConfiguration');

function service(overrides: Partial<Service> = {}): Service {
  return {
    id: 'svc-1',
    name: 'web',
    project_id: 'p-1',
    node_id: 'n-1',
    runtime: 'container',
    source: { type: 'image', image: 'nginx:1.25' },
    ports: [{ host: 8000, container: 3000 }],
    cpu_limit: 1,
    memory_mb: 512,
    status: 'running',
    env: {},
    created_at: '2026-07-30T10:00:00Z',
    ...overrides,
  } as Service;
}

function show(svc: Service = service()) {
  const onChanged = vi.fn();
  return {
    onChanged,
    ...renderInApp(<ServiceConfiguration service={svc} onChanged={onChanged} />),
  };
}

beforeEach(() => {
  updateServiceConfiguration.mockReset();
  redeployService.mockReset();
  updateServiceConfiguration.mockResolvedValue(service());
  redeployService.mockResolvedValue(service());
});

describe('ServiceConfiguration', () => {
  it('shows the ports the Service was deployed with, so a wrong one can be seen', () => {
    show();
    expect(screen.getByLabelText('Published ports')).toHaveValue('8000:3000');
  });

  it('writes a SlideOps-chosen host port as the container port alone', () => {
    show(service({ ports: [{ host: 0, container: 3000 }] }));
    expect(screen.getByLabelText('Published ports')).toHaveValue('3000');
  });

  // The whole point of this panel: the mistake in the Operator's own words was
  // deploying on 8000 when 3000 was meant, which used to mean deleting the
  // Service and starting again.
  it('corrects a mistyped port without recreating the Service', async () => {
    const user = userEvent.setup();
    show();

    const ports = screen.getByLabelText('Published ports');
    await user.clear(ports);
    await user.type(ports, '3000:3000');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateServiceConfiguration).toHaveBeenCalledWith(
        'svc-1',
        expect.objectContaining({ ports: [{ host: 3000, container: 3000 }] }),
      ),
    );
  });

  it('corrects the image a Service runs', async () => {
    const user = userEvent.setup();
    show();

    const image = screen.getByLabelText('Image');
    await user.clear(image);
    await user.type(image, 'nginx:1.27');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateServiceConfiguration).toHaveBeenCalledWith(
        'svc-1',
        expect.objectContaining({ source: { type: 'image', image: 'nginx:1.27' } }),
      ),
    );
  });

  it('moves a Service from an image to a repository, sending only the repository fields', async () => {
    const user = userEvent.setup();
    show();

    await user.selectOptions(screen.getByLabelText('Source'), 'repository');
    await user.type(screen.getByLabelText('Repository'), 'git@github.com:acme/app.git');
    await user.type(screen.getByLabelText('Branch'), 'main');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateServiceConfiguration).toHaveBeenCalledWith(
        'svc-1',
        expect.objectContaining({
          source: {
            type: 'repository',
            repository_url: 'git@github.com:acme/app.git',
            branch: 'main',
            build: '',
          },
        }),
      ),
    );
  });

  it('shows the repository fields for a repository Service, not an image field', () => {
    show(
      service({
        source: {
          type: 'repository',
          repository_url: 'https://github.com/acme/web',
          branch: 'dev',
        },
      }),
    );
    expect(screen.getByLabelText('Repository')).toHaveValue('https://github.com/acme/web');
    expect(screen.getByLabelText('Branch')).toHaveValue('dev');
    expect(screen.queryByLabelText('Image')).not.toBeInTheDocument();
  });

  it('refuses to save a port that is not a pair of whole numbers, and says which line', async () => {
    const user = userEvent.setup();
    show();

    const ports = screen.getByLabelText('Published ports');
    await user.clear(ports);
    await user.type(ports, 'three thousand');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('three thousand');
    expect(updateServiceConfiguration).not.toHaveBeenCalled();
  });

  it('will not let a Compose stack be moved off a repository', () => {
    show(
      service({
        runtime: 'compose',
        source: { type: 'repository', repository_url: 'https://github.com/acme/stack' },
      }),
    );
    expect(screen.getByLabelText('Source')).toBeDisabled();
  });

  // An adopted workload was never built by SlideOps, so there is nothing to
  // rebuild it from and offering the fields would be offering a lie.
  it('offers no source or port editing for an adopted Service', () => {
    show(service({ adopted: true, source: { type: 'adopted', image: 'redis:7' } }));
    expect(screen.queryByLabelText('Published ports')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Source')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Command')).toBeInTheDocument();
  });

  it('says the change is saved but not running, and redeploys to apply it', async () => {
    const user = userEvent.setup();
    show(service({ config_changed_at: '2026-09-07T10:00:00Z' }));

    expect(screen.getByText(/Saved, but not yet running/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Redeploy to apply/ }));
    await waitFor(() => expect(redeployService).toHaveBeenCalledWith('svc-1'));
  });
});
