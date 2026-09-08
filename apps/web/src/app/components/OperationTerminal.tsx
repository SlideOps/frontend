import type { OperationEvent } from '@slideops/api-client';
import { useTheme } from '@slideops/design-system';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TerminalSurface } from './TerminalSurface';
import { terminalTheme } from './terminal-theme';

/*
 * The live terminal. It embeds xterm.js and writes each Operation event as a
 * line, so the raw output of execution streams in front of the Operator exactly
 * as it happens on the Node. It is fed the merged event log, and it writes only
 * the lines it has not written yet, so a re-render never repeats output. Its
 * colors are resolved from the design tokens, so it belongs to both themes.
 */

const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[90m';
const BOLD = '\x1b[1m';

function formatLine(event: OperationEvent): string {
  switch (event.type) {
    case 'operation.step':
      return `${CYAN}> ${event.message}${RESET}`;
    case 'operation.status':
      return `${DIM}${event.message}${RESET}`;
    case 'operation.verification':
      return `${event.level === 'error' ? RED : GREEN}${event.message}${RESET}`;
    case 'operation.completed':
      return `${BOLD}${event.message}${RESET}`;
    case 'operation.log':
    default:
      if (event.level === 'error') {
        return `${RED}${event.message}${RESET}`;
      }
      if (event.level === 'warn') {
        return `${YELLOW}${event.message}${RESET}`;
      }
      return event.message;
  }
}

export interface OperationTerminalProps {
  events: readonly OperationEvent[];
}

export function OperationTerminal({ events }: OperationTerminalProps) {
  const { resolved } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const writtenRef = useRef(0);
  const [expanded, setExpanded] = useState(false);

  /*
   * Remeasuring is safe to call from anywhere and never touches the buffer.
   *
   * It matters that this is all expanding does here: the terminal is created
   * once, keyed on the theme alone, so filling the window neither disposes it
   * nor replays a single line. Everything already written stays written.
   */
  const refit = useCallback(() => {
    try {
      fitRef.current?.fit();
    } catch {
      // Fitting measures the element, so it throws while it is detached.
    }
  }, []);

  // Create the terminal, and recreate it when the theme changes so its colors
  // follow light and dark. The event effect below repaints all lines after.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: false,
      disableStdin: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      scrollback: 5000,
      theme: terminalTheme(),
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);
    terminalRef.current = terminal;
    fitRef.current = fit;
    writtenRef.current = 0;
    refit();

    return () => {
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      writtenRef.current = 0;
    };
  }, [resolved, refit]);

  // Write only the lines not yet written, so re-renders never repeat output.
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }
    for (let i = writtenRef.current; i < events.length; i += 1) {
      const event = events[i];
      if (event) {
        terminal.writeln(formatLine(event));
      }
    }
    writtenRef.current = events.length;
    refit();
  }, [events, refit]);

  return (
    <TerminalSurface
      label="the live Operation output"
      expanded={expanded}
      onExpandedChange={setExpanded}
      // The window resize listener this used to register itself now lives in the
      // surface, alongside the expand and drag-taller cases it never covered.
      // Draggable for the same reason the log view is: a terminal is only as
      // useful as the number of lines it shows, and that is the Operator's call.
      resizable
      onResize={refit}
      contentRef={containerRef}
      contentRole="log"
      contentLabel="Live Operation output"
      height="20rem"
    />
  );
}
