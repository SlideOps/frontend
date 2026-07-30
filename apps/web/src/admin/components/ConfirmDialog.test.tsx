import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

/*
 * Every audited, destructive control on the admin surface goes through this
 * dialog: suspending an Operator, engaging Lockdown, signing everyone out. What
 * is worth asserting is not that it renders, but that it cannot be passed through
 * by accident, and that a keyboard reaches everything a mouse does.
 */

function setup(over: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Sign every Operator out"
      description="This ends every open session, including yours."
      confirmLabel="Sign everyone out"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...over}
    />,
  );
  return { onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
  it('names itself and its consequence, so the dialog alone says what will happen', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Sign every Operator out');
    expect(screen.getByText(/ends every open session, including yours/i)).toBeInTheDocument();
  });

  it('acts only when the confirm control is chosen', async () => {
    const { onConfirm, onCancel } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Sign everyone out' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels on Escape, so a dialog opened by mistake is dismissed the way anyone expects', async () => {
    const { onConfirm, onCancel } = setup();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('moves focus into the dialog, so a keyboard is not left behind the backdrop', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign everyone out' })).toHaveFocus();
    });
  });

  it('shows a working state while the action settles, so it cannot be fired twice', async () => {
    let release: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(
      <ConfirmDialog
        open
        title="Engage Lockdown"
        description="Holds every control at once."
        confirmLabel="Engage Lockdown"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Engage Lockdown' });
    await userEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());

    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // Let the action settle inside act, so the state update it causes belongs to
    // the test rather than arriving after it has finished.
    await act(async () => {
      release();
    });
  });

  it('renders nothing when closed, so it cannot be reached while hidden', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Suspend this Operator"
        description="They will not be able to sign in."
        confirmLabel="Suspend"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
