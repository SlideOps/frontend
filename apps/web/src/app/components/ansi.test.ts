import { describe, expect, it } from 'vitest';
import { parseAnsiLine } from './ansi';

/*
 * ANSI parsing for the live log viewer.
 *
 * The property worth pinning: real colour survives as a styled segment, and
 * everything else -- cursor moves, terminal titles -- disappears rather than
 * leaving escape-code junk on the page.
 */

describe('parseAnsiLine', () => {
  it('returns plain text untouched when there is nothing to parse', () => {
    expect(parseAnsiLine('listening on :8000')).toEqual([
      { text: 'listening on :8000', style: {} },
    ]);
  });

  it('carries a foreground colour as a styled segment', () => {
    const segments = parseAnsiLine('\x1b[31merror\x1b[0m: boom');
    expect(segments).toEqual([
      { text: 'error', style: { colorToken: '--color-danger' } },
      { text: ': boom', style: {} },
    ]);
  });

  it('combines bold with a colour until reset', () => {
    const segments = parseAnsiLine('\x1b[1;32mready\x1b[0m');
    expect(segments).toEqual([{ text: 'ready', style: { bold: true, colorToken: '--color-success' } }]);
  });

  it('drops a cursor-movement sequence, keeping the surrounding text', () => {
    const segments = parseAnsiLine('loading\x1b[2Kdone');
    expect(segments.map((s) => s.text).join('')).toBe('loadingdone');
  });

  it('drops an OSC title sequence entirely', () => {
    const segments = parseAnsiLine('\x1b]0;my title\x07hello');
    expect(segments).toEqual([{ text: 'hello', style: {} }]);
  });
});
