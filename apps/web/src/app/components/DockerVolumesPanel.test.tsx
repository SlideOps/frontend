import { ApiError, type DockerVolume } from '@slideops/api-client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

/*
 * The volumes panel, where the one irreversible act in the Docker control
 * centre lives.
 *
 * Everything asserted here is about the removal being deliberate: the dialog
 * names the volume and what has it mounted, the confirm does nothing until the
 * Operator has typed the name, and a size nobody read never renders as an empty
 * volume, which is the one reading that would make deleting a database look
 * safe.
 */

const listDockerVolumes = vi.fn();
const removeDockerVolume = vi.fn();
const createDockerVolume = vi.fn();
const inspectDockerVolume = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listDockerVolumes: (...args: unknown[]) => listDockerVolumes(...args),
  removeDockerVolume: (...args: unknown[]) => removeDockerVolume(...args),
  createDockerVolume: (...args: unknown[]) => createDockerVolume(...args),
  inspectDockerVolume: (...args: unknown[]) => inspectDockerVolume(...args),
}));

const { DockerVolumesPanel } = await import('./DockerVolumesPanel');

function volume(overrides: Partial<DockerVolume> = {}): DockerVolume {
  return {
    name: 'app-data',
    driver: 'local',
    mountpoint: '/var/lib/docker/volumes/app-data/_data',
    created_at: '2026-09-01T00:00:00Z',
    in_use: false,
    containers: [],
    labels: {},
    ...overrides,
  };
}

beforeEach(() => {
  listDockerVolumes.mockReset().mockResolvedValue([]);
  removeDockerVolume.mockReset().mockResolvedValue(undefined);
  createDockerVolume.mockReset().mockResolvedValue(volume());
  inspectDockerVolume.mockReset().mockResolvedValue({});
  useWorkspaceStore.setState({
    workspaces: [{ id: 'w1', name: 'Mine', is_personal: true, role: 'owner', active: true }],
    loaded: true,
  });
});

describe('reading the volumes on a Node', () => {
  it('shows a size the daemon never reported as Unknown, never as empty', async () => {
    listDockerVolumes.mockResolvedValue([volume({ name: 'app-data', size_bytes: undefined })]);
    renderInApp(<DockerVolumesPanel nodeId="nd_1" />);

    expect(await screen.findByText('app-data')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText('0 B')).not.toBeInTheDocument();
  });

  it('shows a size of -1 as Unknown too', async () => {
    listDockerVolumes.mockResolvedValue([volume({ size_bytes: -1 })]);
    renderInApp(<DockerVolumesPanel nodeId="nd_1" />);

    expect(await screen.findByText('Unknown')).toBeInTheDocument();
  });

  it('names the containers that have a volume mounted', async () => {
    listDockerVolumes.mockResolvedValue([
      volume({ name: 'pgdata', in_use: true, containers: ['postgres', 'backup'] }),
    ]);
    renderInApp(<DockerVolumesPanel nodeId="nd_1" />);

    expect(await screen.findByText('postgres and backup')).toBeInTheDocument();
  });
});

describe('removing a volume', () => {
  it('is never a one click removal', async () => {
    listDockerVolumes.mockResolvedValue([volume({ name: 'pgdata' })]);
    const operator = userEvent.setup();
    renderInApp(<DockerVolumesPanel nodeId="nd_1" />);

    await operator.click(await screen.findByLabelText('Remove pgdata'));

    expect(removeDockerVolume).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Remove the volume pgdata?');
    expect(dialog).toHaveTextContent('This deletes the data in pgdata');
  });

  it('refuses to act until the Operator has typed the volume name', async () => {
    listDockerVolumes.mockResolvedValue([volume({ name: 'pgdata' })]);
    const operator = userEvent.setup();
    renderInApp(<DockerVolumesPanel nodeId="nd_1" />);

    await operator.click(await screen.findByLabelText('Remove pgdata'));
    await operator.click(screen.getByRole('button', { name: 'Remove this volume and its data' }));

    expect(removeDockerVolume).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('That is not the name of this volume');
  });

  it('will not accept a near miss of the name', async () => {
    listDockerVolumes.mockResolvedValue([volume({ name: 'pgdata' })]);
    const operator = userEvent.setup();
    renderInApp(<DockerVolumesPanel nodeId="nd_1" />);

    await operator.click(await screen.findByLabelText('Remove pgdata'));
    await operator.type(screen.getByLabelText('Type the volume name to confirm'), 'pgdat');
    await operator.click(screen.getByRole('button', { name: 'Remove this volume and its data' }));

    expect(removeDockerVolume).not.toHaveBeenCalled();
  });

  it('removes once the name matches, and never forces it', async () => {
    listDockerVolumes.mockResolvedValue([volume({ name: 'pgdata' })]);
    const operator = userEvent.setup();
    renderInApp(<DockerVolumesPanel nodeId="nd_1" />);

    await operator.click(await screen.findByLabelText('Remove pgdata'));
    await operator.type(screen.getByLabelText('Type the volume name to confirm'), 'pgdata');
    await operator.click(screen.getByRole('button', { name: 'Remove this volume and its data' }));

    // Never forced from this screen: a volume a container has open is a volume
    // something is writing to, and the answer to that is to stop the container.
    await waitFor(() => expect(removeDockerVolume).toHaveBeenCalledWith('nd_1', 'pgdata', false));
  });

  it('names what is mounting the volume when the Node refuses', async () => {
    listDockerVolumes.mockResolvedValue([
      volume({ name: 'pgdata', in_use: true, containers: ['postgres'] }),
    ]);
    removeDockerVolume.mockRejectedValue(
      new ApiError(409, 'in_use', 'pgdata is mounted by postgres.', { containers: ['postgres'] }),
    );
    const operator = userEvent.setup();
    renderInApp(<DockerVolumesPanel nodeId="nd_1" />);

    await operator.click(await screen.findByLabelText('Remove pgdata'));
    await operator.type(screen.getByLabelText('Type the volume name to confirm'), 'pgdata');
    await operator.click(screen.getByRole('button', { name: 'Remove this volume and its data' }));

    const refusal = await screen.findByRole('alert');
    expect(refusal).toHaveTextContent('pgdata is still mounted, so nothing was removed');
    expect(refusal).toHaveTextContent('Mounted by postgres');
  });

  it('says plainly that an unknown size means an unknown amount of data', async () => {
    listDockerVolumes.mockResolvedValue([volume({ name: 'pgdata', size_bytes: undefined })]);
    const operator = userEvent.setup();
    renderInApp(<DockerVolumesPanel nodeId="nd_1" />);

    await operator.click(await screen.findByLabelText('Remove pgdata'));

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Docker was not asked how large this volume is',
    );
  });
});

describe('creating a volume', () => {
  it('sends an empty driver as no driver at all', async () => {
    listDockerVolumes.mockResolvedValue([volume()]);
    const operator = userEvent.setup();
    renderInApp(<DockerVolumesPanel nodeId="nd_1" />);

    await operator.click(await screen.findByRole('button', { name: 'Create a volume' }));
    await operator.type(screen.getByLabelText('Volume name'), 'cache');
    await operator.click(screen.getByRole('button', { name: 'Create this volume' }));

    await waitFor(() =>
      expect(createDockerVolume).toHaveBeenCalledWith('nd_1', { name: 'cache', driver: undefined }),
    );
  });
});

describe('a Viewer', () => {
  it('is offered no removal at all', async () => {
    useWorkspaceStore.setState({
      workspaces: [{ id: 'w1', name: 'Shared', is_personal: false, role: 'viewer', active: true }],
      loaded: true,
    });
    listDockerVolumes.mockResolvedValue([volume({ name: 'pgdata' })]);
    renderInApp(<DockerVolumesPanel nodeId="nd_1" />);

    expect(await screen.findByLabelText('Inspect pgdata')).toBeInTheDocument();
    expect(screen.queryByLabelText('Remove pgdata')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create a volume' })).not.toBeInTheDocument();
  });
});
