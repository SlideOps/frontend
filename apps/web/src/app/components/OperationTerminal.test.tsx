import type { OperationEvent } from '@slideops/api-client';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { OperationTerminal } from './OperationTerminal';

/*
 * An Operation's live output.
 *
 * xterm draws with canvas and measures real layout, neither of which jsdom has,
 * so it is stubbed: what is under test is what the surface around it does to the
 * emulator, not how the emulator paints, which is xterm's own business.
 */

const written: string[] = [];
const disposed = vi.fn();
const fitted = vi.fn();

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 100;
    rows = 30;
    options: Record<string, unknown> = {};
    loadAddon() {}
    open() {}
    write() {}
    writeln(line: string) {
      written.push(line);
    }
    focus() {}
    dispose() {
      disposed();
    }
    onData() {}
    onResize() {}
  },
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit() {
      fitted();
    }
  },
}));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

let seq = 0;

function logEvent(message: string): OperationEvent {
  return {
    operation_id: 'op-1',
    seq: (seq += 1),
    at: '2026-01-01T00:00:00Z',
    type: 'operation.log',
    level: 'info',
    message,
    data: {},
  };
}

beforeEach(() => {
  written.length = 0;
  disposed.mockClear();
  fitted.mockClear();
});

describe('OperationTerminal', () => {
  it('offers to fill the window with the live output, by that name', () => {
    renderInApp(<OperationTerminal events={[logEvent('starting')]} />);

    expect(
      screen.getByRole('button', { name: 'Fill the window with the live Operation output' }),
    ).toBeInTheDocument();
  });

  /*
   * The output of a finished Operation is the record of what happened on
   * somebody's server. Rebuilding the emulator to make its box bigger would
   * throw that away and replay it from whatever the component still held, which
   * for a long-running Operation is not all of it.
   */
  it('does not rebuild the terminal, or repeat a line, when the output is expanded', async () => {
    renderInApp(<OperationTerminal events={[logEvent('installing'), logEvent('done')]} />);
    expect(written).toEqual(['installing', 'done']);

    await userEvent.click(screen.getByRole('button', { name: /fill the window/i }));

    expect(disposed).not.toHaveBeenCalled();
    expect(written).toEqual(['installing', 'done']);
  });

  // An emulator keeps the geometry it measured once, so a box that grew without
  // saying so stays eighty columns wide in the middle of a full window.
  it('remeasures the emulator after the box has changed size', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderInApp(<OperationTerminal events={[logEvent('starting')]} />);
    await vi.advanceTimersByTimeAsync(100);
    fitted.mockClear();

    await userEvent.click(screen.getByRole('button', { name: /fill the window/i }));
    await vi.advanceTimersByTimeAsync(100);

    expect(fitted).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('names the output region for a screen reader reading along with it', () => {
    renderInApp(<OperationTerminal events={[]} />);

    expect(screen.getByRole('log', { name: 'Live Operation output' })).toBeInTheDocument();
  });
});
