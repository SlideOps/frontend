import type { CSSProperties } from 'react';

/*
 * ANSI SGR colour codes, preserved rather than shown as escape junk.
 *
 * A workload that colours its own output -- most structured loggers do -- sends
 * that colour as literal escape sequences in the text. Showing them verbatim
 * turns every colourised line into `\x1b[32mready\x1b[0m`, which is worse than no
 * colour at all: the codes are the least readable part of the line and they used
 * to be the most visible.
 *
 * Only SGR (`... m`) codes carry anything this viewer can render: a colour, bold,
 * dim, italic, underline. Every other escape sequence -- cursor moves, screen
 * clears, terminal titles -- has no text of its own and is dropped rather than
 * printed, which is what "strip cleanly" means for a line this viewer cannot
 * fully emulate.
 *
 * Colours resolve to the app's own design tokens rather than the 16 literal ANSI
 * colours, so a red error line reads as this app's red in both themes instead of
 * a colour picked for a black terminal that may fight the page around it.
 */

const FOREGROUND_TOKEN: Record<number, string> = {
  30: '--color-text-secondary',
  31: '--color-danger',
  32: '--color-success',
  33: '--color-warning',
  34: '--color-info',
  35: '--color-accent',
  36: '--color-info',
  37: '--color-text-primary',
  90: '--color-text-secondary',
  91: '--color-danger',
  92: '--color-success',
  93: '--color-warning',
  94: '--color-info',
  95: '--color-accent',
  96: '--color-info',
  97: '--color-text-primary',
};

export interface AnsiStyle {
  colorToken?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface AnsiSegment {
  text: string;
  style: AnsiStyle;
}

// Matches one CSI sequence: ESC [ params final-byte. Only the "m" (SGR) final
// byte carries anything renderable; every other final byte is a control
// sequence this viewer drops. The control characters are the point of this
// regex, not an oversight.
// eslint-disable-next-line no-control-regex
const CSI = /\x1b\[([0-9;]*)([A-Za-z])/g;
// OSC sequences (terminal titles, hyperlinks) are terminated by BEL or ST and
// carry nothing a log line should show.
// eslint-disable-next-line no-control-regex
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

function applySGR(style: AnsiStyle, params: string): AnsiStyle {
  const codes = params
    .split(';')
    .filter((c) => c !== '')
    .map(Number);
  if (codes.length === 0) {
    codes.push(0);
  }
  let next = style;
  for (const code of codes) {
    if (code === 0) {
      next = {};
    } else if (code === 1) {
      next = { ...next, bold: true };
    } else if (code === 2) {
      next = { ...next, dim: true };
    } else if (code === 3) {
      next = { ...next, italic: true };
    } else if (code === 4) {
      next = { ...next, underline: true };
    } else if (code === 22) {
      next = { ...next, bold: false, dim: false };
    } else if (code === 23) {
      next = { ...next, italic: false };
    } else if (code === 24) {
      next = { ...next, underline: false };
    } else if (code === 39) {
      next = { ...next, colorToken: undefined };
    } else if (FOREGROUND_TOKEN[code]) {
      next = { ...next, colorToken: FOREGROUND_TOKEN[code] };
    }
  }
  return next;
}

/** Parse one line of output into styled segments, colour preserved where the
 * line carries it and every other escape sequence removed. */
export function parseAnsiLine(raw: string): AnsiSegment[] {
  const withoutOSC = raw.replace(OSC, '');
  if (!withoutOSC.includes('\x1b')) {
    return [{ text: withoutOSC, style: {} }];
  }

  const segments: AnsiSegment[] = [];
  let style: AnsiStyle = {};
  let lastIndex = 0;
  CSI.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CSI.exec(withoutOSC))) {
    const text = withoutOSC.slice(lastIndex, match.index);
    if (text) {
      segments.push({ text, style });
    }
    lastIndex = CSI.lastIndex;
    const [, params, final] = match;
    if (final === 'm') {
      style = applySGR(style, params ?? '');
    }
    // Any other final byte is a control sequence with no text of its own.
  }
  const rest = withoutOSC.slice(lastIndex);
  if (rest) {
    segments.push({ text: rest, style });
  }
  return segments;
}

/** The inline style one segment renders with, colour resolved through the
 * design token so it belongs to whichever theme is active. */
export function ansiSegmentStyle(style: AnsiStyle): CSSProperties {
  return {
    color: style.colorToken ? `var(${style.colorToken})` : undefined,
    fontWeight: style.bold ? 600 : undefined,
    opacity: style.dim ? 0.65 : undefined,
    fontStyle: style.italic ? 'italic' : undefined,
    textDecoration: style.underline ? 'underline' : undefined,
  };
}
