import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { TerminalSurface } from './TerminalSurface';

/*
 * The shared surface under every terminal and every log view.
 *
 * What is worth pinning here is the promise the rest of them rely on: expanding
 * is a change of clothes, not a change of body. Nothing is unmounted, so a live
 * session and everything already written into it come through the toggle
 * untouched. The rest is the accessible name on the control that does it, and
 * the light behaving itself for somebody who asked for less motion.
 */

/** A surface the test can drive, standing in for a real caller's own state. */
function Harness({ onResize }: { onResize?: () => void } = {}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TerminalSurface
      label="the terminal"
      expanded={expanded}
      onExpandedChange={setExpanded}
      onResize={onResize}
      contentClassName="test-content"
    >
      <span data-testid="payload">still here</span>
    </TerminalSurface>
  );
}

/** Replace matchMedia so the surface sees the motion preference under test. */
function stubMotionPreference(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TerminalSurface', () => {
  it('names the expand control after the surface it will fill the window with', () => {
    renderInApp(<Harness />);

    const expand = screen.getByRole('button', { name: 'Fill the window with the terminal' });
    expect(expand).toHaveAttribute('aria-pressed', 'false');
  });

  it('renames the expand control once it is the way back out', async () => {
    renderInApp(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: /fill the window/i }));

    const shrink = screen.getByRole('button', { name: 'Leave full screen for the terminal' });
    expect(shrink).toHaveAttribute('aria-pressed', 'true');
  });

  /*
   * The whole reason this component exists in one piece rather than four.
   *
   * A surface that remounted on expanding would take an xterm terminal's own
   * element out of the DOM with it, and the session, the scrollback and whatever
   * was half typed at the prompt would go too. So the identical DOM node has to
   * come out the other side of the toggle, both ways.
   */
  it('keeps the very same content element alive across expanding and collapsing', async () => {
    const { container } = renderInApp(<Harness />);
    const before = container.querySelector('.test-content');
    const payload = screen.getByTestId('payload');

    await userEvent.click(screen.getByRole('button', { name: /fill the window/i }));
    expect(container.querySelector('.test-content')).toBe(before);
    expect(screen.getByTestId('payload')).toBe(payload);

    await userEvent.click(screen.getByRole('button', { name: /leave full screen/i }));
    expect(container.querySelector('.test-content')).toBe(before);
    expect(screen.getByTestId('payload')).toBe(payload);
  });

  // An emulator measures its container once and keeps that geometry, so a
  // surface that grew without saying so leaves an eighty column terminal in the
  // middle of a wide window: an expand that looks like it did nothing.
  it('asks the emulator to remeasure itself after it is expanded', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onResize = vi.fn();
    renderInApp(<Harness onResize={onResize} />);
    await vi.advanceTimersByTimeAsync(100);
    onResize.mockClear();

    await userEvent.click(screen.getByRole('button', { name: /fill the window/i }));
    await vi.advanceTimersByTimeAsync(100);

    expect(onResize).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('lets a long log go back to its place with Escape rather than trapping it full screen', async () => {
    renderInApp(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /fill the window/i }));

    await userEvent.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: /fill the window/i })).toBeInTheDocument();
  });

  it('drifts the light under the surface by default', () => {
    stubMotionPreference(false);
    const { container } = renderInApp(<Harness />);

    const glow = container.querySelector('.so-glow-pool');
    expect(glow).not.toBeNull();
    expect(glow).not.toHaveClass('so-glow-pool-static');
  });

  // Subdued and still, never removed: the surface should still read as lifted
  // off the page for somebody who simply does not want anything moving.
  it('holds the light still and subdued when the viewer asks for less motion', () => {
    stubMotionPreference(true);
    const { container } = renderInApp(<Harness />);

    expect(container.querySelector('.so-glow-pool')).toHaveClass('so-glow-pool-static');
  });

  // The light is decoration behind opaque content. Announcing it would put a
  // meaningless element between a screen reader and the output it came for.
  it('hides the light from assistive technology', () => {
    const { container } = renderInApp(<Harness />);

    expect(container.querySelector('.so-glow-pool')).toHaveAttribute('aria-hidden');
  });
});
