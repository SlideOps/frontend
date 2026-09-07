import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Service } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

/*
 * A Service's environment can be edited two ways, and both have to keep working.
 *
 * The full editor sends the whole set, which is what makes it useful for a
 * rewrite and dangerous for a one line correction: anything missing from that
 * text is deleted. The per-variable editor names one key and sends one value, so
 * these tests are mostly about what is NOT sent, and about a sealed secret never
 * appearing on screen just because somebody pressed Edit.
 */

let writable = true;

const updateServiceEnvVar = vi.fn();
const updateServiceConfiguration = vi.fn();
const redeployService = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  updateServiceEnvVar: (...a: unknown[]) => updateServiceEnvVar(...a),
  updateServiceConfiguration: (...a: unknown[]) => updateServiceConfiguration(...a),
  redeployService: (...a: unknown[]) => redeployService(...a),
}));

vi.mock('../../store/workspace', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useCanWrite: () => writable,
}));

const { ServiceConfiguration } = await import('./ServiceConfiguration');

const SEALED_MARKER = '[stored securely]';

function svc(over: Partial<Service> = {}): Service {
  return {
    id: 'svc-1',
    name: 'api',
    project_id: 'proj-1',
    node_id: 'n-1',
    deployment_type: 'software',
    runtime: 'container',
    source: { type: 'image', image: 'nginx:latest', command: '' },
    cpu_limit: 0.5,
    memory_mb: 256,
    status: 'running',
    env: {
      DATABASE_URL: 'postgres://app@db/app',
      LOG_LEVEL: 'info',
      SECRET_KEY: SEALED_MARKER,
    },
    ...over,
  } as Service;
}

function show(service: Service = svc()) {
  const onChanged = vi.fn();
  const result = renderInApp(<ServiceConfiguration service={service} onChanged={onChanged} />);
  return { ...result, onChanged };
}

/** The row a variable is rendered in, so an assertion cannot match a neighbour. */
function rowFor(key: string): HTMLElement {
  return screen.getByTitle(key).closest('div') as HTMLElement;
}

beforeEach(() => {
  writable = true;
  updateServiceEnvVar.mockReset().mockResolvedValue(svc());
  updateServiceConfiguration.mockReset().mockResolvedValue(svc());
  redeployService.mockReset().mockResolvedValue(svc());
});

describe('ServiceConfiguration', () => {
  it('sends only the variable that was edited, never the rest of the environment', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: 'Edit LOG_LEVEL' }));
    const box = screen.getByLabelText('Value for LOG_LEVEL');
    await user.clear(box);
    await user.type(box, 'debug');
    await user.click(screen.getByRole('button', { name: 'Save LOG_LEVEL' }));

    await waitFor(() => expect(updateServiceEnvVar).toHaveBeenCalledTimes(1));
    expect(updateServiceEnvVar).toHaveBeenCalledWith('svc-1', 'LOG_LEVEL', 'debug', false);
    expect(updateServiceConfiguration).not.toHaveBeenCalled();
  });

  it('opens an editor on one row and leaves every other row as it was', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: 'Edit LOG_LEVEL' }));

    expect(screen.getByLabelText('Value for LOG_LEVEL')).toBeInTheDocument();
    expect(screen.queryByLabelText('Value for DATABASE_URL')).not.toBeInTheDocument();
    expect(
      within(rowFor('DATABASE_URL')).getByRole('button', { name: 'Edit DATABASE_URL' }),
    ).toBeInTheDocument();
  });

  it('changes nothing when an edit is cancelled', async () => {
    const user = userEvent.setup();
    const { onChanged } = show();

    await user.click(screen.getByRole('button', { name: 'Edit LOG_LEVEL' }));
    await user.clear(screen.getByLabelText('Value for LOG_LEVEL'));
    await user.type(screen.getByLabelText('Value for LOG_LEVEL'), 'debug');
    await user.click(screen.getByRole('button', { name: 'Cancel editing LOG_LEVEL' }));

    expect(updateServiceEnvVar).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit LOG_LEVEL' })).toBeInTheDocument();

    // Reopening shows the stored value again, not the abandoned draft.
    await user.click(screen.getByRole('button', { name: 'Edit LOG_LEVEL' }));
    expect(screen.getByLabelText('Value for LOG_LEVEL')).toHaveValue('info');
  });

  it('never puts a sealed value on screen when its row is opened for editing', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: 'Edit SECRET_KEY' }));

    const box = screen.getByLabelText('Value for SECRET_KEY');
    expect(box).toHaveValue('');
    expect(box).toHaveAttribute(
      'placeholder',
      'Leave empty to keep the current value; type a new one to replace it',
    );
    expect(screen.queryByDisplayValue(SEALED_MARKER)).not.toBeInTheDocument();
  });

  it('keeps a sealed value untouched when its editor is saved empty', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: 'Edit SECRET_KEY' }));
    await user.click(screen.getByRole('button', { name: 'Save SECRET_KEY' }));

    expect(updateServiceEnvVar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit SECRET_KEY' })).toBeInTheDocument();
  });

  it('replaces a sealed value with the one typed over it, sealing it again', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: 'Edit SECRET_KEY' }));
    await user.type(screen.getByLabelText('Value for SECRET_KEY'), 'new-key');
    await user.click(screen.getByRole('button', { name: 'Save SECRET_KEY' }));

    await waitFor(() =>
      expect(updateServiceEnvVar).toHaveBeenCalledWith('svc-1', 'SECRET_KEY', 'new-key', true),
    );
  });

  it('sends a value containing equals signs and dollars exactly as it was typed', async () => {
    const user = userEvent.setup();
    show();

    const awkward = 'postgres://user:p$$w=rd@db:5432/app?sslmode=require "quoted" a b';
    await user.click(screen.getByRole('button', { name: 'Edit DATABASE_URL' }));
    const box = screen.getByLabelText('Value for DATABASE_URL');
    await user.clear(box);
    // userEvent reads {{ and [[ as key descriptors, so the literal text is pasted.
    await user.paste(awkward);
    await user.click(screen.getByRole('button', { name: 'Save DATABASE_URL' }));

    await waitFor(() =>
      expect(updateServiceEnvVar).toHaveBeenCalledWith('svc-1', 'DATABASE_URL', awkward, false),
    );
  });

  it('says a saved variable is not yet running and offers the redeploy that applies it', async () => {
    const user = userEvent.setup();
    const { onChanged } = show();

    await user.click(screen.getByRole('button', { name: 'Edit LOG_LEVEL' }));
    await user.clear(screen.getByLabelText('Value for LOG_LEVEL'));
    await user.type(screen.getByLabelText('Value for LOG_LEVEL'), 'debug');
    await user.click(screen.getByRole('button', { name: 'Save LOG_LEVEL' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(screen.getByText(/Saved, but not yet running/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Redeploy to apply/ }));
    await waitFor(() => expect(redeployService).toHaveBeenCalledWith('svc-1'));
  });

  it('still opens the full editor and saves the whole environment through it', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: 'Edit all' }));

    const area = screen.getByLabelText('Environment variables');
    expect(area).toHaveValue(
      'DATABASE_URL=postgres://app@db/app\nLOG_LEVEL=info\nsecret:SECRET_KEY=',
    );

    await user.clear(area);
    await user.type(area, 'LOG_LEVEL=debug');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateServiceConfiguration).toHaveBeenCalledTimes(1));
    // objectContaining, not an exact match: the same save also carries the
    // source and the ports, which this component edits too and which have their
    // own tests below. What matters here is that the whole environment went
    // through the configuration endpoint and not through the per-variable one.
    expect(updateServiceConfiguration).toHaveBeenCalledWith(
      'svc-1',
      expect.objectContaining({
        command: '',
        env: [{ key: 'LOG_LEVEL', value: 'debug', secret: false, keep: false }],
      }),
    );
    expect(updateServiceEnvVar).not.toHaveBeenCalled();
  });

  it('carries a per-variable save into the full editor so it cannot be undone by a later full save', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: 'Edit LOG_LEVEL' }));
    await user.clear(screen.getByLabelText('Value for LOG_LEVEL'));
    await user.type(screen.getByLabelText('Value for LOG_LEVEL'), 'debug');
    await user.click(screen.getByRole('button', { name: 'Save LOG_LEVEL' }));
    await waitFor(() => expect(updateServiceEnvVar).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Edit all' }));
    expect(screen.getByLabelText('Environment variables')).toHaveValue(
      'DATABASE_URL=postgres://app@db/app\nLOG_LEVEL=debug\nsecret:SECRET_KEY=',
    );
  });

  it('offers a Viewer no way to edit a variable at all', () => {
    writable = false;
    show();

    expect(screen.queryByRole('button', { name: 'Edit LOG_LEVEL' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit SECRET_KEY' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit all' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    // Reading a value is not a write, so the reveal stays.
    expect(screen.getByRole('button', { name: 'Reveal LOG_LEVEL' })).toBeInTheDocument();
  });

  it('reports a failed per-variable save without closing the editor', async () => {
    const user = userEvent.setup();
    updateServiceEnvVar.mockRejectedValue(new Error('network down'));
    show();

    await user.click(screen.getByRole('button', { name: 'Edit LOG_LEVEL' }));
    await user.clear(screen.getByLabelText('Value for LOG_LEVEL'));
    await user.type(screen.getByLabelText('Value for LOG_LEVEL'), 'debug');
    await user.click(screen.getByRole('button', { name: 'Save LOG_LEVEL' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'LOG_LEVEL could not be saved. Try again.',
    );
    expect(screen.getByLabelText('Value for LOG_LEVEL')).toHaveValue('debug');
    expect(screen.queryByText(/Saved, but not yet running/)).not.toBeInTheDocument();
  });
});

/*
 * The same component also edits where a Service comes from and which ports it
 * publishes. Those tests live here rather than in a second file because they
 * exercise the same component and the same mocks, and splitting them would mean
 * two files that have to be kept in step.
 */

function portsService(overrides: Partial<Service> = {}): Service {
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

function showPorts(svc: Service = portsService()) {
  const onChanged = vi.fn();
  return {
    onChanged,
    ...renderInApp(<ServiceConfiguration service={svc} onChanged={onChanged} />),
  };
}

describe('ServiceConfiguration: source and ports', () => {
  it('shows the ports the Service was deployed with, so a wrong one can be seen', () => {
    showPorts();
    expect(screen.getByLabelText('Published ports')).toHaveValue('8000:3000');
  });

  it('writes a SlideOps-chosen host port as the container port alone', () => {
    showPorts(portsService({ ports: [{ host: 0, container: 3000 }] }));
    expect(screen.getByLabelText('Published ports')).toHaveValue('3000');
  });

  // The whole point of this panel: the mistake in the Operator's own words was
  // deploying on 8000 when 3000 was meant, which used to mean deleting the
  // Service and starting again.
  it('corrects a mistyped port without recreating the Service', async () => {
    const user = userEvent.setup();
    showPorts();

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
    showPorts();

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
    showPorts();

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
    showPorts(
      portsService({
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
    showPorts();

    const ports = screen.getByLabelText('Published ports');
    await user.clear(ports);
    await user.type(ports, 'three thousand');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('three thousand');
    expect(updateServiceConfiguration).not.toHaveBeenCalled();
  });

  it('will not let a Compose stack be moved off a repository', () => {
    showPorts(
      portsService({
        runtime: 'compose',
        source: { type: 'repository', repository_url: 'https://github.com/acme/stack' },
      }),
    );
    expect(screen.getByLabelText('Source')).toBeDisabled();
  });

  // An adopted workload was never built by SlideOps, so there is nothing to
  // rebuild it from and offering the fields would be offering a lie.
  it('offers no source or port editing for an adopted Service', () => {
    showPorts(portsService({ adopted: true, source: { type: 'adopted', image: 'redis:7' } }));
    expect(screen.queryByLabelText('Published ports')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Source')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Command')).toBeInTheDocument();
  });

  it('says the change is saved but not running, and redeploys to apply it', async () => {
    const user = userEvent.setup();
    showPorts(portsService({ config_changed_at: '2026-09-07T10:00:00Z' }));

    expect(screen.getByText(/Saved, but not yet running/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Redeploy to apply/ }));
    await waitFor(() => expect(redeployService).toHaveBeenCalledWith('svc-1'));
  });
});
