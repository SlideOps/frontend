import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { InstallApp } from './InstallApp';

/*
 * Offering to install the app.
 *
 * It was installable for some time and almost nobody found out, because the
 * browser's own prompt lives behind a menu on desktop. An installable app nobody
 * is told about is the same as one that is not.
 *
 * The browser decides whether installing is possible, and the event it fires is
 * the only way to open the real prompt. So the rules worth pinning are that the
 * control appears only when there is a usable event, and never in a window that
 * is already the installed app.
 */

function fireAvailable() {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted' as const });
  window.dispatchEvent(event);
  return event;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function standalone(is: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: is && query.includes('standalone'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('InstallApp', () => {
  it('shows nothing until the browser says installing is possible', () => {
    standalone(false);
    renderInApp(<InstallApp />);
    expect(screen.queryByRole('button', { name: /install/i })).not.toBeInTheDocument();
  });

  it('offers to install once the browser says it can', async () => {
    standalone(false);
    renderInApp(<InstallApp />);
    fireAvailable();
    expect(await screen.findByRole('button', { name: /install/i })).toBeInTheDocument();
  });

  // Offering to install something you are already looking at is nonsense.
  it('never offers inside the installed app', () => {
    standalone(true);
    renderInApp(<InstallApp />);
    fireAvailable();
    expect(screen.queryByRole('button', { name: /install/i })).not.toBeInTheDocument();
  });

  it('opens the real prompt when asked', async () => {
    standalone(false);
    renderInApp(<InstallApp />);
    const event = fireAvailable();

    await userEvent.click(await screen.findByRole('button', { name: /install/i }));
    await waitFor(() => expect(event.prompt).toHaveBeenCalled());
  });

  // The event is single use: prompting twice with the same one throws.
  it('takes the offer away once it has been used', async () => {
    standalone(false);
    renderInApp(<InstallApp />);
    fireAvailable();

    await userEvent.click(await screen.findByRole('button', { name: /install/i }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /install/i })).not.toBeInTheDocument(),
    );
  });

  it('disappears when the app reports itself installed', async () => {
    standalone(false);
    renderInApp(<InstallApp />);
    fireAvailable();
    await screen.findByRole('button', { name: /install/i });

    window.dispatchEvent(new Event('appinstalled'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /install/i })).not.toBeInTheDocument(),
    );
  });
});
