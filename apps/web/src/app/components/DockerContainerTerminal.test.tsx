import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

// xterm draws with canvas and measures real layout, neither of which jsdom has.
// What is under test here is the copy around the terminal, not how a terminal
// renders: that is xterm's own business and not this repository's to re-test.
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

const { DockerContainerTerminal } = await import('./DockerContainerTerminal');

/*
 * The shell tab, and specifically what it claims.
 *
 * This is the one panel in the Docker workspace where wrong copy is dangerous
 * rather than merely untidy. SlideOps reaches a container over the Operator's
 * own SSH connection to the server and runs a shell there; nothing about that
 * is separate from the machine. A panel that suggested otherwise would have
 * somebody type a command they would not have typed had they known, so the
 * absence of any such claim is asserted here rather than left to review.
 */

function show(running = true) {
  return renderInApp(
    <DockerContainerTerminal
      nodeId="n1"
      nodeName="web-1"
      containerRef={'f'.repeat(64)}
      containerName="api"
      running={running}
    />,
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

describe('DockerContainerTerminal', () => {
  it("says the shell is inside the container and reached over the server's SSH connection", () => {
    show();

    expect(
      screen.getByText(/This is a shell inside the container, reached over web-1's own SSH/),
    ).toBeInTheDocument();
    expect(screen.getByText(/attaches a shell to api/)).toBeInTheDocument();
  });

  it('never claims the shell is isolated, contained or safe', () => {
    show();

    const copy = document.body.textContent ?? '';
    // No form of "isolated", and no "secure"/"safe" reassurance: neither is
    // true of a docker exec over the server's own SSH session, and a claim like
    // that is exactly what would change what somebody is willing to run.
    expect(copy).not.toMatch(/isolat/i);
    expect(copy).not.toMatch(/\bsafely\b|\bsecurely\b|\bsafe\b/i);
    // And it says the thing that is true.
    expect(copy).toMatch(/not a sandbox/i);
    expect(copy).toMatch(/same kernel as everything else on web-1/i);
  });

  it('does not open a session merely because the tab was opened', () => {
    show();

    // A shell is a session on somebody's server. It waits to be asked for.
    expect(screen.getByRole('button', { name: 'Open a shell' })).toBeInTheDocument();
  });

  it('tells a Viewer why there is no shell, rather than offering one that would be refused', () => {
    asRole('viewer');
    show();

    expect(screen.getByText(/Your role here is Viewer/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open a shell' })).toBeNull();
  });

  it('offers the server shell first when the container is not running', async () => {
    show(false);

    // A container in a restart loop is exactly the one that cannot be attached
    // to, and exactly the one somebody needs to investigate. Refusing and
    // stopping there sends them to a terminal outside SlideOps.
    expect(screen.getByText(/not inside any container/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open a shell' })).toBeEnabled();

    // Switching to the container scope still explains why that one cannot open.
    await userEvent.click(screen.getByRole('button', { name: /Inside / }));
    expect(screen.getByRole('button', { name: 'Open a shell' })).toBeDisabled();
    expect(screen.getByText(/no processes to attach a shell to/)).toBeInTheDocument();
  });

  it('lets a running container be investigated from the server too', async () => {
    show(true);

    await userEvent.click(screen.getByRole('button', { name: /On / }));

    expect(screen.getByText(/not inside any container/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open a shell' })).toBeEnabled();
  });
});
