import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

// xterm draws with canvas and measures real layout, neither of which jsdom
// has. What is under test here is the copy around the terminal, matching
// DockerContainerTerminal's own test.
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 100;
    rows = 30;
    options: Record<string, unknown> = {};
    loadAddon() {}
    open() {}
    write() {}
    focus() {}
    dispose() {}
    onData() {}
    onResize() {}
  },
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit() {}
  },
}));
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

const { CeleryWorkerTerminal } = await import('./CeleryWorkerTerminal');

/*
 * The same honesty DockerContainerTerminal insists on, for a worker's own
 * shell: this is the Node's own SSH connection with `cd` run through it, not
 * a sandbox, and not confined to the worker.
 */

function show() {
  return renderInApp(
    <CeleryWorkerTerminal serviceId="service-1" workingDirectory="/opt/docai/backend" />,
  );
}

function asRole(role: 'owner' | 'viewer') {
  useWorkspaceStore.setState({
    workspaces: [{ id: 'ws-1', name: 'W', role, active: true } as never],
  });
}

beforeEach(() => {
  asRole('owner');
});

describe('CeleryWorkerTerminal', () => {
  it('says the shell lands in the working directory over the server’s own connection', () => {
    show();

    expect(
      screen.getByText(/This is a shell on the server, in \/opt\/docai\/backend/),
    ).toBeInTheDocument();
  });

  it('never claims the shell is isolated, contained or safe', () => {
    show();

    const copy = document.body.textContent ?? '';
    expect(copy).not.toMatch(/isolat/i);
    expect(copy).not.toMatch(/\bsafely\b|\bsecurely\b|\bsafe\b/i);
    expect(copy).toMatch(/no container to enter/i);
    expect(copy).toMatch(/not confined to it/i);
  });

  it('does not open a session merely because the section was opened', () => {
    show();

    expect(screen.getByRole('button', { name: 'Open a shell' })).toBeInTheDocument();
  });

  it('tells a Viewer why there is no shell, rather than offering one that would be refused', () => {
    asRole('viewer');
    show();

    expect(screen.getByText(/Your role here is Viewer/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open a shell' })).toBeNull();
  });
});
