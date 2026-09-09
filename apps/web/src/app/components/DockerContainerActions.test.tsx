import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  MANAGED_BY_SERVICE_CODE,
  type DockerContainer,
  type DockerContainerState,
} from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

/*
 * The lifecycle controls for one container.
 *
 * These are the buttons that stop somebody's production workload, so what is
 * pinned here is not the layout: it is the four promises this row makes.
 *
 * A control is only offered when the daemon would accept it. Nothing
 * irreversible happens on one press. Deleting the container and deleting its
 * data are two separate answers, and answering the first never answers the
 * second. And an Operator whose role cannot act is told so instead of being
 * given a button that meets a 403.
 */

const runDockerContainerAction = vi.fn();
const removeDockerContainer = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runDockerContainerAction: (...args: unknown[]) => runDockerContainerAction(...args),
  removeDockerContainer: (...args: unknown[]) => removeDockerContainer(...args),
}));

const { DockerContainerActions } = await import('./DockerContainerActions');

function container(over: Partial<DockerContainer> = {}): DockerContainer {
  return {
    full_id: 'f'.repeat(64),
    id: 'f0f0f0f0f0f0',
    name: 'api',
    image: 'ghcr.io/acme/api:1.4.0',
    image_id: 'sha256:aaa',
    state: 'running',
    status_text: 'Up 3 hours',
    health: 'healthy',
    created_at: '2026-09-08T09:00:00Z',
    started_at: '2026-09-08T09:00:00Z',
    restart_count: 0,
    restart_policy: 'unless-stopped',
    ports: [],
    ownership: 'slideops',
    networks: ['bridge'],
    mount_count: 0,
    labels: {},
    ...over,
  };
}

const onChanged = vi.fn();
const onRemoved = vi.fn();

function show(state: DockerContainerState = 'running') {
  return renderInApp(
    <MemoryRouter>
      <DockerContainerActions
        nodeId="n1"
        container={container({ state })}
        onChanged={onChanged}
        onRemoved={onRemoved}
      />
    </MemoryRouter>,
  );
}

/** The Operator's role in the active workspace, which decides whether any of this renders. */
function asRole(role: 'owner' | 'viewer') {
  useWorkspaceStore.setState({
    workspaces: [{ id: 'ws-1', name: 'W', role, active: true } as never],
  });
}

beforeEach(() => {
  runDockerContainerAction.mockReset();
  removeDockerContainer.mockReset();
  onChanged.mockReset();
  onRemoved.mockReset();
  runDockerContainerAction.mockResolvedValue(container({ state: 'exited' }));
  removeDockerContainer.mockResolvedValue(undefined);
  asRole('owner');
});

describe('DockerContainerActions', () => {
  it('offers only what a running container can accept', () => {
    show('running');

    for (const label of ['Stop', 'Restart', 'Pause', 'Kill', 'Remove']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    // Docker refuses both of these on a running container, so offering them
    // would be offering a button whose only outcome is an error.
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
  });

  it('offers only what a stopped container can accept', () => {
    show('exited');

    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    for (const label of ['Stop', 'Pause', 'Kill', 'Resume']) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });

  it('offers Resume, and not Pause, on a paused container', () => {
    show('paused');

    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('leaves a dead container nothing but removal', () => {
    show('dead');

    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    for (const label of ['Start', 'Stop', 'Restart', 'Pause', 'Resume', 'Kill']) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
  });

  it('runs a reversible action on one press, without a dialog', async () => {
    const operator = userEvent.setup();
    show('running');

    await operator.click(screen.getByRole('button', { name: 'Restart' }));
    await waitFor(() =>
      expect(runDockerContainerAction).toHaveBeenCalledWith('n1', 'f'.repeat(64), 'restart'),
    );
  });

  it('asks before killing, and names the container', async () => {
    const operator = userEvent.setup();
    show('running');

    await operator.click(screen.getByRole('button', { name: 'Kill' }));
    expect(runDockerContainerAction).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Kill api?')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('no chance to finish what they were doing');

    await operator.click(within(dialog).getByRole('button', { name: 'Kill' }));
    await waitFor(() =>
      expect(runDockerContainerAction).toHaveBeenCalledWith('n1', 'f'.repeat(64), 'kill'),
    );
  });

  it('does not remove anything until the removal is confirmed', async () => {
    const operator = userEvent.setup();
    show('running');

    await operator.click(screen.getByRole('button', { name: 'Remove' }));
    expect(removeDockerContainer).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('api is deleted from this server');

    await operator.click(screen.getByRole('button', { name: 'Remove the container' }));
    await waitFor(() =>
      expect(removeDockerContainer).toHaveBeenCalledWith('n1', 'f'.repeat(64), {
        force: false,
        remove_volumes: false,
      }),
    );
    await waitFor(() => expect(onRemoved).toHaveBeenCalled());
  });

  it('keeps deleting the data a separate choice from removing the container', async () => {
    const operator = userEvent.setup();
    show('running');

    await operator.click(screen.getByRole('button', { name: 'Remove' }));
    const dialog = screen.getByRole('dialog');

    // Two independent checkboxes, both off. Neither is a default, because
    // "and destroy its data" is not a detail of "remove this container".
    const force = within(dialog).getByRole('checkbox', {
      name: /Remove it even if it is running/,
    });
    const volumes = within(dialog).getByRole('checkbox', {
      name: /Also delete its anonymous volumes/,
    });
    expect(force).not.toBeChecked();
    expect(volumes).not.toBeChecked();
    expect(dialog).toHaveTextContent('This destroys data');

    await operator.click(volumes);
    expect(force).not.toBeChecked();

    await operator.click(screen.getByRole('button', { name: 'Remove the container' }));
    await waitFor(() =>
      expect(removeDockerContainer).toHaveBeenCalledWith('n1', 'f'.repeat(64), {
        force: false,
        remove_volumes: true,
      }),
    );
  });

  it('offers a Viewer no controls at all, and says why', () => {
    asRole('viewer');
    show('running');

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/Your role here is Viewer/)).toBeInTheDocument();
  });

  it('sends the Operator to the Service when a Service owns the container', async () => {
    removeDockerContainer.mockRejectedValue(
      new ApiError(409, MANAGED_BY_SERVICE_CODE, 'A Service manages this container.', {
        service_id: 'svc-9',
      }),
    );
    const operator = userEvent.setup();
    show('running');

    await operator.click(screen.getByRole('button', { name: 'Remove' }));
    await operator.click(screen.getByRole('button', { name: 'Remove the container' }));

    expect(await screen.findByText('A SlideOps Service manages this container')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open the Service/ })).toHaveAttribute(
      'href',
      '/app/services/svc-9',
    );
    // A refusal with a supported alternative is not a fault, so it is not
    // dressed as one.
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
