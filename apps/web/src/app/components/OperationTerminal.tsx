import type { OperationEvent } from '@slideops/api-client';
import { useTheme } from '@slideops/design-system';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef } from 'react';
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
    fit.fit();
    terminalRef.current = terminal;
    fitRef.current = fit;
    writtenRef.current = 0;

    const onResize = () => {
      try {
        fit.fit();
      } catch {
        // Fitting can throw while the element is detached; ignore it.
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      writtenRef.current = 0;
    };
  }, [resolved]);

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
    fitRef.current?.fit();
  }, [events]);

  return (
    <div
      ref={containerRef}
      role="log"
      aria-label="Live Operation output"
      className="h-80 w-full overflow-hidden rounded-md border border-border bg-app p-2"
    />
  );
}
