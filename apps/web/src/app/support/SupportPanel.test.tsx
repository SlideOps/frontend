import { ApiError, type SupportContext, type SupportResponse } from '@slideops/api-client';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';

const askMock = vi.fn();
const confirmActionMock = vi.fn();
const quickActionsMock = vi.fn();
const supportPresetsMock = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ask: (...args: Parameters<typeof askMock>) => askMock(...args),
  confirmAction: (...args: Parameters<typeof confirmActionMock>) => confirmActionMock(...args),
  quickActions: (...args: Parameters<typeof quickActionsMock>) => quickActionsMock(...args),
  supportPresets: (...args: Parameters<typeof supportPresetsMock>) => supportPresetsMock(...args),
}));

const { SupportPanel } = await import('./SupportPanel');

const context: SupportContext = { route: '/app/operations/op_1', resource_type: 'operation', resource_id: 'op_1' };

function baseResponse(over: Partial<SupportResponse> = {}): SupportResponse {
  return {
    text: 'The repository branch could not be found.',
    confidence: 'high',
    cards: [],
    actions: [],
    navigation: null,
    follow_up: null,
    ...over,
  };
}

function renderPanel(over: Partial<Parameters<typeof SupportPanel>[0]> = {}) {
  const onOpenChange = vi.fn();
  const utils = renderInApp(
    <MemoryRouter>
      <SupportPanel open context={context} onOpenChange={onOpenChange} {...over} />
    </MemoryRouter>,
  );
  return { onOpenChange, ...utils };
}

beforeEach(() => {
  askMock.mockReset();
  confirmActionMock.mockReset();
  quickActionsMock.mockReset();
  quickActionsMock.mockResolvedValue([]);
  supportPresetsMock.mockReset();
  supportPresetsMock.mockResolvedValue([]);
});

describe('SupportPanel', () => {
  it('renders nothing when closed', () => {
    renderInApp(
      <MemoryRouter>
        <SupportPanel open={false} context={context} onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the empty state and loads context-tailored quick actions', async () => {
    quickActionsMock.mockResolvedValue([
      { id: 'retry_op', label: 'Retry', destructive: false, confirm_required: false },
    ]);
    renderPanel();

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(quickActionsMock).toHaveBeenCalledWith('operation', 'op_1', expect.anything());
  });

  it('sends a question and renders the composed answer', async () => {
    askMock.mockResolvedValue(
      baseResponse({
        cards: [{ kind: 'operation', id: 'op_1', title: 'Deploy postgres', subtitle: 'failed' }],
      }),
    );
    renderPanel();

    await userEvent.type(screen.getByLabelText('Ask Support'), 'Why did this fail?');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText('The repository branch could not be found.')).toBeInTheDocument();
    expect(screen.getByText('Deploy postgres')).toBeInTheDocument();
    // Typed text carries no presetIntent -- it always goes through the
    // backend's own free text classification.
    expect(askMock).toHaveBeenCalledWith('Why did this fail?', [], context, expect.anything(), undefined);
  });

  it('auto-sends an initial message once when provided', async () => {
    askMock.mockResolvedValue(baseResponse());
    renderPanel({ initialMessage: 'Why did this fail?' });

    await waitFor(() => expect(askMock).toHaveBeenCalledTimes(1));
    expect(askMock).toHaveBeenCalledWith('Why did this fail?', [], context, expect.anything(), undefined);
  });

  it('runs a non-destructive action immediately without a confirmation step', async () => {
    askMock.mockResolvedValue(
      baseResponse({
        actions: [
          { id: 'view_logs', label: 'View logs', destructive: false, confirm_required: false, params: {} },
        ],
      }),
    );
    confirmActionMock.mockResolvedValue({ status: 'started', message: 'Opening logs.', resource_id: null });
    renderPanel();

    await userEvent.type(screen.getByLabelText('Ask Support'), 'why did this fail');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    await screen.findByRole('button', { name: 'View logs' });

    await userEvent.click(screen.getByRole('button', { name: 'View logs' }));

    expect(confirmActionMock).toHaveBeenCalledWith('view_logs', {}, context);
    expect(await screen.findByText('Opening logs.')).toBeInTheDocument();
  });

  it('requires confirmation before running a destructive action', async () => {
    askMock.mockResolvedValue(
      baseResponse({
        actions: [
          {
            id: 'cancel_operation',
            label: 'Cancel operation',
            destructive: true,
            confirm_required: true,
            params: { operation_id: 'op_1' },
          },
        ],
      }),
    );
    confirmActionMock.mockResolvedValue({ status: 'started', message: 'Operation cancelled.', resource_id: 'op_1' });
    renderPanel();

    await userEvent.type(screen.getByLabelText('Ask Support'), 'cancel this');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    await screen.findByRole('button', { name: 'Cancel operation' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel operation' }));

    expect(confirmActionMock).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog', { name: 'Cancel operation' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel operation' }));

    await waitFor(() =>
      expect(confirmActionMock).toHaveBeenCalledWith('cancel_operation', { operation_id: 'op_1' }, context),
    );
  });

  it('navigates and closes the panel when a navigation offer is chosen', async () => {
    askMock.mockResolvedValue(
      baseResponse({ navigation: { path: '/app/nodes/nd_1', label: 'Open the Node' } }),
    );
    const { onOpenChange } = renderPanel();

    await userEvent.type(screen.getByLabelText('Ask Support'), 'where is my node');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    await userEvent.click(await screen.findByRole('button', { name: 'Open the Node' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('continues the conversation when a follow-up option is chosen', async () => {
    askMock
      .mockResolvedValueOnce(
        baseResponse({
          text: 'Which Node should host this?',
          follow_up: {
            question: 'Which Node should host this?',
            options: [{ label: 'production-1', value: 'nd_1' }],
          },
        }),
      )
      .mockResolvedValueOnce(baseResponse({ text: 'Starting the deployment on production-1.' }));
    renderPanel();

    await userEvent.type(screen.getByLabelText('Ask Support'), 'I need a database');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'production-1' }));

    expect(await screen.findByText('Starting the deployment on production-1.')).toBeInTheDocument();
    // A follow-up option's own value is sent back as presetIntent, the same
    // certainty a preset button carries -- not re-classified from the label.
    expect(askMock).toHaveBeenLastCalledWith(
      'production-1',
      expect.arrayContaining([{ role: 'operator', text: 'I need a database' }]),
      context,
      expect.anything(),
      'nd_1',
    );
  });

  it('answers a preset question with certainty, bypassing free text classification', async () => {
    supportPresetsMock.mockResolvedValue([
      {
        label: 'Troubleshoot a problem',
        options: [{ id: 'explain_failure', label: 'Why did this fail?', message: 'Why did this fail?', intent: 'explain_failure' }],
      },
      {
        // Only the first category is open by default; picking an option from
        // a later one exercises expanding it first.
        label: 'Deploy something',
        options: [
          {
            id: 'deploy_software',
            label: 'Deploy my own application',
            message: 'How do I deploy my own application?',
            intent: 'deploy_software',
          },
        ],
      },
    ]);
    askMock.mockResolvedValue(
      baseResponse({
        text: 'Open New Service, pick the Node and Project...',
        navigation: { path: '/app/services/new', label: 'Open New Service' },
      }),
    );
    renderPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Deploy something' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Deploy my own application' }));

    expect(await screen.findByText(/Open New Service, pick the Node and Project/)).toBeInTheDocument();
    expect(askMock).toHaveBeenCalledWith(
      'How do I deploy my own application?',
      [],
      context,
      expect.anything(),
      'deploy_software',
    );
  });

  it('shows an inline error when asking fails', async () => {
    askMock.mockRejectedValue(new ApiError(500, 'internal_error', 'Something broke.'));
    renderPanel();

    await userEvent.type(screen.getByLabelText('Ask Support'), 'why did this fail');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText('Something broke.')).toBeInTheDocument();
  });
});
