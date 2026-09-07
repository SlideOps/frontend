import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Service } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

/*
 * A Service's environment can be edited two ways, and both have to keep working.
 *
 * The full editor sends the whole set, which is what makes it useful for a
 * rewrite and dangerous for a one line correction: anything missing from that
 * text is deleted. The per-variable editor names one key in the path and sends
 * one variable, so these tests are mostly about what is NOT sent, and about a
 * sealed secret never appearing on screen just because somebody pressed Edit.
 *
 * A rename is the same edit seen from the other side: the path still names the
 * variable as it stands now, and the body carries the name to move it to. The
 * risky cases are a sealed variable, whose plaintext cannot be resent and must
 * therefore be kept, and a stale editor, whose save would reinstate every other
 * variable as it was rather than only losing the field in hand.
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

/** The Service a save answers with: the whole environment as it now stands. */
function withEnv(env: Record<string, string>): Service {
  return svc({ env, config_changed_at: '2026-02-02T10:00:00Z' });
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

/** The value box of the row currently open for editing. */
function valueBox(key: string): HTMLElement {
  return within(rowFor(key)).getByLabelText('Variable value');
}

/** The name box of the row currently open for editing. */
function nameBox(key: string): HTMLElement {
  return within(rowFor(key)).getByLabelText('Variable name');
}

async function edit(user: ReturnType<typeof userEvent.setup>, key: string) {
  await user.click(screen.getByRole('button', { name: `Edit ${key}` }));
}

async function saveRow(user: ReturnType<typeof userEvent.setup>, key: string) {
  await user.click(screen.getByRole('button', { name: `Save changes to ${key}` }));
}

/** Retype a box from empty, pasting so awkward text is taken literally. */
async function retype(user: ReturnType<typeof userEvent.setup>, box: HTMLElement, text: string) {
  await user.clear(box);
  // userEvent reads {{ and [[ as key descriptors, so the literal text is pasted.
  await user.paste(text);
}

/** The body of the one call made to the per-variable endpoint. */
function sentBody(): Record<string, unknown> {
  return updateServiceEnvVar.mock.calls[0]?.[2] as Record<string, unknown>;
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

    await edit(user, 'LOG_LEVEL');
    await retype(user, valueBox('LOG_LEVEL'), 'debug');
    await saveRow(user, 'LOG_LEVEL');

    await waitFor(() => expect(updateServiceEnvVar).toHaveBeenCalledTimes(1));
    expect(updateServiceEnvVar).toHaveBeenCalledWith('svc-1', 'LOG_LEVEL', {
      value: 'debug',
      secret: false,
    });
    expect(updateServiceConfiguration).not.toHaveBeenCalled();
  });

  it('opens an editor on one row and leaves every other row as it was', async () => {
    const user = userEvent.setup();
    show();

    await edit(user, 'LOG_LEVEL');

    expect(valueBox('LOG_LEVEL')).toBeInTheDocument();
    expect(nameBox('LOG_LEVEL')).toHaveValue('LOG_LEVEL');
    expect(
      within(rowFor('DATABASE_URL')).queryByLabelText('Variable value'),
    ).not.toBeInTheDocument();
    expect(
      within(rowFor('DATABASE_URL')).getByRole('button', { name: 'Edit DATABASE_URL' }),
    ).toBeInTheDocument();
  });

  it('changes nothing when an edit is cancelled', async () => {
    const user = userEvent.setup();
    const { onChanged } = show();

    await edit(user, 'LOG_LEVEL');
    await retype(user, valueBox('LOG_LEVEL'), 'debug');
    await retype(user, nameBox('LOG_LEVEL'), 'LEVEL');
    await user.click(screen.getByRole('button', { name: 'Cancel editing LOG_LEVEL' }));

    expect(updateServiceEnvVar).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit LOG_LEVEL' })).toBeInTheDocument();

    // Reopening shows the stored name and value again, not the abandoned draft.
    await edit(user, 'LOG_LEVEL');
    expect(valueBox('LOG_LEVEL')).toHaveValue('info');
    expect(nameBox('LOG_LEVEL')).toHaveValue('LOG_LEVEL');
  });

  it('never puts a sealed value on screen when its row is opened for editing', async () => {
    const user = userEvent.setup();
    show();

    await edit(user, 'SECRET_KEY');

    const box = valueBox('SECRET_KEY');
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

    await edit(user, 'SECRET_KEY');
    await saveRow(user, 'SECRET_KEY');

    expect(updateServiceEnvVar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit SECRET_KEY' })).toBeInTheDocument();
  });

  it('replaces a sealed value with the one typed over it, sealing it again', async () => {
    const user = userEvent.setup();
    show();

    await edit(user, 'SECRET_KEY');
    await user.type(valueBox('SECRET_KEY'), 'new-key');
    await saveRow(user, 'SECRET_KEY');

    await waitFor(() =>
      expect(updateServiceEnvVar).toHaveBeenCalledWith('svc-1', 'SECRET_KEY', {
        value: 'new-key',
        secret: true,
      }),
    );
  });

  it('sends a value containing equals signs and dollars exactly as it was typed', async () => {
    const user = userEvent.setup();
    show();

    const awkward = 'postgres://user:p$$w=rd@db:5432/app?sslmode=require "quoted" a b';
    await edit(user, 'DATABASE_URL');
    await retype(user, valueBox('DATABASE_URL'), awkward);
    await saveRow(user, 'DATABASE_URL');

    await waitFor(() =>
      expect(updateServiceEnvVar).toHaveBeenCalledWith('svc-1', 'DATABASE_URL', {
        value: awkward,
        secret: false,
      }),
    );
  });

  it('passes awkward values through byte for byte without trimming or encoding them', async () => {
    const user = userEvent.setup();
    show();

    const awkward = [
      'L5cw$4(7C8E*',
      'p@ss w0rd with spaces',
      'postgres://user:p%40ss@host:5432/db?sslmode=require',
      'C:\\path\\to\\thing',
      '{"retries": 3, "url": "https://x/y?a=b&c=d"}',
      '  leading and trailing spaces  ',
    ];

    for (const value of awkward) {
      updateServiceEnvVar.mockClear();
      await edit(user, 'LOG_LEVEL');
      await retype(user, valueBox('LOG_LEVEL'), value);
      await saveRow(user, 'LOG_LEVEL');

      await waitFor(() => expect(updateServiceEnvVar).toHaveBeenCalledTimes(1));
      expect(sentBody().value).toBe(value);
    }
  });

  it('keeps a plain variable that is saved empty instead of deleting it', async () => {
    const user = userEvent.setup();
    show();

    await edit(user, 'LOG_LEVEL');
    await user.clear(valueBox('LOG_LEVEL'));
    await saveRow(user, 'LOG_LEVEL');

    await waitFor(() => expect(updateServiceEnvVar).toHaveBeenCalledTimes(1));
    expect(updateServiceEnvVar).toHaveBeenCalledWith('svc-1', 'LOG_LEVEL', {
      value: '',
      secret: false,
    });
    expect(sentBody()).not.toHaveProperty('keep_value');
  });

  it('renames a variable by sending the new name against the old name in the path', async () => {
    const user = userEvent.setup();
    show();

    await edit(user, 'DATABASE_URL');
    await retype(user, nameBox('DATABASE_URL'), 'DB_URL');
    await saveRow(user, 'DATABASE_URL');

    await waitFor(() => expect(updateServiceEnvVar).toHaveBeenCalledTimes(1));
    expect(updateServiceEnvVar).toHaveBeenCalledWith('svc-1', 'DATABASE_URL', {
      name: 'DB_URL',
      value: 'postgres://app@db/app',
      secret: false,
    });
  });

  it('changes the name and the value in one request when both were edited', async () => {
    const user = userEvent.setup();
    show();

    await edit(user, 'LOG_LEVEL');
    await retype(user, nameBox('LOG_LEVEL'), 'LOG_VERBOSITY');
    await retype(user, valueBox('LOG_LEVEL'), 'debug');
    await saveRow(user, 'LOG_LEVEL');

    await waitFor(() => expect(updateServiceEnvVar).toHaveBeenCalledTimes(1));
    expect(updateServiceEnvVar).toHaveBeenCalledWith('svc-1', 'LOG_LEVEL', {
      name: 'LOG_VERBOSITY',
      value: 'debug',
      secret: false,
    });
  });

  it('renames a sealed variable by keeping the stored value instead of resending it', async () => {
    const user = userEvent.setup();
    show();

    await edit(user, 'SECRET_KEY');
    await retype(user, nameBox('SECRET_KEY'), 'SESSION_KEY');
    await saveRow(user, 'SECRET_KEY');

    await waitFor(() => expect(updateServiceEnvVar).toHaveBeenCalledTimes(1));
    const body = sentBody();
    expect(body.name).toBe('SESSION_KEY');
    expect(body.keep_value).toBe(true);
    // Neither the plaintext, which this app has never held, nor the marker that
    // stands in for it, may ride along on a rename.
    expect(body.value).toBe('');
    expect(JSON.stringify(body)).not.toContain(SEALED_MARKER);
  });

  it('replaces a sealed value and renames it in one request when both were edited', async () => {
    const user = userEvent.setup();
    show();

    await edit(user, 'SECRET_KEY');
    await retype(user, nameBox('SECRET_KEY'), 'SESSION_KEY');
    await user.type(valueBox('SECRET_KEY'), 'brand-new');
    await saveRow(user, 'SECRET_KEY');

    await waitFor(() => expect(updateServiceEnvVar).toHaveBeenCalledTimes(1));
    expect(updateServiceEnvVar).toHaveBeenCalledWith('svc-1', 'SECRET_KEY', {
      name: 'SESSION_KEY',
      value: 'brand-new',
      secret: true,
    });
  });

  it('echoes back the configuration timestamp that was read when the editor opened', async () => {
    const user = userEvent.setup();
    show(svc({ config_changed_at: '2026-01-31T09:00:00Z' }));

    await edit(user, 'LOG_LEVEL');
    await retype(user, valueBox('LOG_LEVEL'), 'debug');
    await saveRow(user, 'LOG_LEVEL');

    await waitFor(() => expect(updateServiceEnvVar).toHaveBeenCalledTimes(1));
    expect(sentBody().if_unchanged_since).toBe('2026-01-31T09:00:00Z');
  });

  it('warns in plain language what a rename will cost before it is saved', async () => {
    const user = userEvent.setup();
    show();

    await edit(user, 'DATABASE_URL');
    expect(screen.queryByText(/You are renaming/)).not.toBeInTheDocument();

    await retype(user, nameBox('DATABASE_URL'), 'DB_URL');

    expect(
      screen.getByText(
        /You are renaming DATABASE_URL to DB_URL\. Anything that still expects DATABASE_URL will no longer receive it\./,
      ),
    ).toBeInTheDocument();
    // A warning, not a wall: the rename is still available.
    expect(screen.getByRole('button', { name: 'Save changes to DATABASE_URL' })).toBeEnabled();
  });

  it('shows the renamed variable under its new name and drops the row it was renamed from', async () => {
    const user = userEvent.setup();
    updateServiceEnvVar.mockResolvedValue(
      withEnv({
        DB_URL: 'postgres://app@db/app',
        LOG_LEVEL: 'info',
        SECRET_KEY: SEALED_MARKER,
      }),
    );
    show();

    await edit(user, 'DATABASE_URL');
    await retype(user, nameBox('DATABASE_URL'), 'DB_URL');
    await saveRow(user, 'DATABASE_URL');

    expect(await screen.findByTitle('DB_URL')).toBeInTheDocument();
    expect(screen.queryByTitle('DATABASE_URL')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit DB_URL' })).toBeInTheDocument();
  });

  it('says a variable was renamed rather than merely updated', async () => {
    const user = userEvent.setup();
    updateServiceEnvVar.mockResolvedValue(
      withEnv({ DB_URL: 'postgres://app@db/app', LOG_LEVEL: 'info', SECRET_KEY: SEALED_MARKER }),
    );
    show();

    await edit(user, 'DATABASE_URL');
    await retype(user, nameBox('DATABASE_URL'), 'DB_URL');
    await saveRow(user, 'DATABASE_URL');

    expect(await screen.findByRole('status')).toHaveTextContent('Renamed DATABASE_URL to DB_URL.');
    // The change is recorded, not applied, and that has not changed.
    expect(screen.getByText(/Saved, but not yet running/)).toBeInTheDocument();
    expect(redeployService).not.toHaveBeenCalled();
  });

  it('says a variable was updated when only its value changed', async () => {
    const user = userEvent.setup();
    show();

    await edit(user, 'LOG_LEVEL');
    await retype(user, valueBox('LOG_LEVEL'), 'debug');
    await saveRow(user, 'LOG_LEVEL');

    expect(await screen.findByRole('status')).toHaveTextContent('Updated LOG_LEVEL.');
  });

  it('refuses an empty name without sending a request', async () => {
    const user = userEvent.setup();
    show();

    await edit(user, 'LOG_LEVEL');
    await user.clear(nameBox('LOG_LEVEL'));
    await saveRow(user, 'LOG_LEVEL');

    expect(await screen.findByRole('alert')).toHaveTextContent('Give the variable a name.');
    expect(updateServiceEnvVar).not.toHaveBeenCalled();
    expect(nameBox('LOG_LEVEL')).toBeInTheDocument();
  });

  it('refuses a name containing a space without sending a request', async () => {
    const user = userEvent.setup();
    show();

    await edit(user, 'LOG_LEVEL');
    await retype(user, nameBox('LOG_LEVEL'), 'LOG LEVEL');
    await saveRow(user, 'LOG_LEVEL');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A variable name cannot contain spaces or line breaks.',
    );
    expect(updateServiceEnvVar).not.toHaveBeenCalled();
  });

  it('refuses a name containing an equals sign without sending a request', async () => {
    const user = userEvent.setup();
    show();

    await edit(user, 'LOG_LEVEL');
    await retype(user, nameBox('LOG_LEVEL'), 'LOG=LEVEL');
    await saveRow(user, 'LOG_LEVEL');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A variable name cannot contain an equals sign.',
    );
    expect(updateServiceEnvVar).not.toHaveBeenCalled();
  });

  it('accepts a name the conventional rule would reject but the backend allows', async () => {
    const user = userEvent.setup();
    show();

    // A name the Operator's own application reads is theirs to choose. Refusing
    // this locally would break a working deployment to enforce a convention this
    // app does not own.
    await edit(user, 'LOG_LEVEL');
    await retype(user, nameBox('LOG_LEVEL'), '2fa.token-ttl');
    await saveRow(user, 'LOG_LEVEL');

    await waitFor(() => expect(updateServiceEnvVar).toHaveBeenCalledTimes(1));
    expect(sentBody().name).toBe('2fa.token-ttl');
  });

  it('shows the backend message beside the name when the server refuses the name', async () => {
    const user = userEvent.setup();
    updateServiceEnvVar.mockRejectedValue(
      new ApiError(400, 'invalid_env_key', 'A variable name cannot be empty.'),
    );
    show();

    await edit(user, 'LOG_LEVEL');
    await retype(user, nameBox('LOG_LEVEL'), 'LOG_LEVEL_2');
    await saveRow(user, 'LOG_LEVEL');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('A variable name cannot be empty.');
    expect(nameBox('LOG_LEVEL')).toHaveAttribute('aria-invalid', 'true');
    expect(nameBox('LOG_LEVEL')).toHaveAttribute('aria-describedby', alert.id);
  });

  it('shows the backend message beside the name when the new name is already taken', async () => {
    const user = userEvent.setup();
    updateServiceEnvVar.mockRejectedValue(
      new ApiError(409, 'env_key_exists', 'LOG_LEVEL is already set on this Service.'),
    );
    show();

    await edit(user, 'DATABASE_URL');
    await retype(user, nameBox('DATABASE_URL'), 'LOG_LEVEL');
    await saveRow(user, 'DATABASE_URL');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'LOG_LEVEL is already set on this Service.',
    );
    // The editor stays open with the rejected name in it, ready to be corrected.
    expect(nameBox('DATABASE_URL')).toHaveValue('LOG_LEVEL');
    expect(screen.queryByText(/Saved, but not yet running/)).not.toBeInTheDocument();
  });

  it('calls the editor stale and says what to do next when the configuration moved underneath it', async () => {
    const user = userEvent.setup();
    updateServiceEnvVar.mockRejectedValue(
      new ApiError(409, 'config_changed', 'The configuration changed after this editor opened.'),
    );
    show(svc({ config_changed_at: '2026-01-31T09:00:00Z' }));

    await edit(user, 'LOG_LEVEL');
    await retype(user, valueBox('LOG_LEVEL'), 'debug');
    await saveRow(user, 'LOG_LEVEL');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The configuration changed after this editor opened.',
    );
    expect(
      screen.getByText(/Reload the page to read the current one, then make this change again./),
    ).toBeInTheDocument();
    expect(valueBox('LOG_LEVEL')).toHaveValue('debug');
  });

  it('calls the editor stale when the variable being renamed is no longer on the Service', async () => {
    const user = userEvent.setup();
    updateServiceEnvVar.mockRejectedValue(
      new ApiError(404, 'env_key_not_found', 'LOG_LEVEL is not set on this Service.'),
    );
    show();

    await edit(user, 'LOG_LEVEL');
    await retype(user, nameBox('LOG_LEVEL'), 'LOG_VERBOSITY');
    await saveRow(user, 'LOG_LEVEL');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'LOG_LEVEL is not set on this Service.',
    );
    expect(
      screen.getByText(/This editor is showing an environment that has since changed./),
    ).toBeInTheDocument();
  });

  it('says a saved variable is not yet running and offers the redeploy that applies it', async () => {
    const user = userEvent.setup();
    const { onChanged } = show();

    await edit(user, 'LOG_LEVEL');
    await retype(user, valueBox('LOG_LEVEL'), 'debug');
    await saveRow(user, 'LOG_LEVEL');

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
    updateServiceEnvVar.mockResolvedValue(
      withEnv({
        DATABASE_URL: 'postgres://app@db/app',
        LOG_LEVEL: 'debug',
        SECRET_KEY: SEALED_MARKER,
      }),
    );
    show();

    await edit(user, 'LOG_LEVEL');
    await retype(user, valueBox('LOG_LEVEL'), 'debug');
    await saveRow(user, 'LOG_LEVEL');
    await waitFor(() => expect(updateServiceEnvVar).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Edit all' }));
    expect(screen.getByLabelText('Environment variables')).toHaveValue(
      'DATABASE_URL=postgres://app@db/app\nLOG_LEVEL=debug\nsecret:SECRET_KEY=',
    );
  });

  it('lists a renamed variable once under its new name when the full editor is opened next', async () => {
    const user = userEvent.setup();
    updateServiceEnvVar.mockResolvedValue(
      withEnv({ DB_URL: 'postgres://app@db/app', LOG_LEVEL: 'info', SECRET_KEY: SEALED_MARKER }),
    );
    show();

    await edit(user, 'DATABASE_URL');
    await retype(user, nameBox('DATABASE_URL'), 'DB_URL');
    await saveRow(user, 'DATABASE_URL');
    await screen.findByTitle('DB_URL');

    await user.click(screen.getByRole('button', { name: 'Edit all' }));
    const area = screen.getByLabelText<HTMLTextAreaElement>('Environment variables');
    expect(area).toHaveValue('DB_URL=postgres://app@db/app\nLOG_LEVEL=info\nsecret:SECRET_KEY=');
    // Once under the new name, and not a second time under the old one: a full
    // save of this text must not reinstate the variable it was renamed from.
    expect(area.value).not.toContain('DATABASE_URL');
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

    await edit(user, 'LOG_LEVEL');
    await retype(user, valueBox('LOG_LEVEL'), 'debug');
    await saveRow(user, 'LOG_LEVEL');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'LOG_LEVEL could not be saved. Try again.',
    );
    expect(valueBox('LOG_LEVEL')).toHaveValue('debug');
    expect(screen.queryByText(/Saved, but not yet running/)).not.toBeInTheDocument();
  });
});
