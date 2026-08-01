import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { CopyButton } from './CopyButton';

/*
 * Copying a value without selecting it by hand.
 *
 * The setup key was shown as selectable text, which asks somebody to drag across
 * thirty two characters without missing one at either end, on a phone as often
 * as not. They find out whether they got it right only when the code they type
 * back is rejected, which reads as the setup being broken.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

function withClipboard(writeText: () => Promise<void>) {
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
}

describe('CopyButton', () => {
  it('puts the value on the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);
    renderInApp(<CopyButton value="JBSWY3DPEHPK3PXP" label="the setup key" />);

    await userEvent.click(screen.getByRole('button', { name: /copy the setup key/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP'));
  });

  // A copy that gives no feedback leaves somebody pressing it again to be sure.
  it('says so afterwards', async () => {
    withClipboard(vi.fn().mockResolvedValue(undefined));
    renderInApp(<CopyButton value="abc" label="the setup key" />);

    await userEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  /*
   * The clipboard needs a secure context and a permission that can be refused,
   * so this genuinely fails sometimes. Saying so matters more than usual here:
   * the value is a secret still on screen, and a button that silently did
   * nothing would leave somebody believing they had copied it.
   */
  it('admits it when the clipboard is not available', async () => {
    withClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    renderInApp(<CopyButton value="abc" label="the setup key" />);

    await userEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(await screen.findByText(/select it instead/i)).toBeInTheDocument();
  });

  it('goes back to offering a copy, so it keeps meaning something', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    withClipboard(vi.fn().mockResolvedValue(undefined));
    renderInApp(<CopyButton value="abc" label="the setup key" />);

    await userEvent.click(screen.getByRole('button', { name: /copy/i }));
    await screen.findByText('Copied');

    vi.advanceTimersByTime(2500);
    await waitFor(() => expect(screen.queryByText('Copied')).not.toBeInTheDocument());
    vi.useRealTimers();
  });
});
