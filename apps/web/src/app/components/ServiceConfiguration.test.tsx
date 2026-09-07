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
    expect(updateServiceConfiguration).toHaveBeenCalledWith('svc-1', {
      command: '',
      env: [{ key: 'LOG_LEVEL', value: 'debug', secret: false, keep: false }],
    });
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
