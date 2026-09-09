import { ApiError, type DockerImage } from '@slideops/api-client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

/*
 * The images panel.
 *
 * What is pinned here is the part an Operator cannot see go wrong: that a
 * refusal naming the containers holding an image reaches the screen with those
 * names on it, that removal is never a single click, and that a Viewer is not
 * offered controls the backend would refuse anyway.
 */

const listDockerImages = vi.fn();
const removeDockerImage = vi.fn();
const pullDockerImage = vi.fn();
const tagDockerImage = vi.fn();
const inspectDockerImage = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listDockerImages: (...args: unknown[]) => listDockerImages(...args),
  removeDockerImage: (...args: unknown[]) => removeDockerImage(...args),
  pullDockerImage: (...args: unknown[]) => pullDockerImage(...args),
  tagDockerImage: (...args: unknown[]) => tagDockerImage(...args),
  inspectDockerImage: (...args: unknown[]) => inspectDockerImage(...args),
}));

const { DockerImagesPanel } = await import('./DockerImagesPanel');

function image(overrides: Partial<DockerImage> = {}): DockerImage {
  return {
    id: 'sha256:aaaa',
    repository: 'nginx',
    tag: 'latest',
    created_at: '2026-09-01T00:00:00Z',
    size_bytes: 120_000_000,
    dangling: false,
    in_use: false,
    containers: 0,
    ...overrides,
  };
}

/** An Operator who may write, which is every role but Viewer. */
function asOperator() {
  useWorkspaceStore.setState({
    workspaces: [{ id: 'w1', name: 'Mine', is_personal: true, role: 'owner', active: true }],
    loaded: true,
  });
}

function asViewer() {
  useWorkspaceStore.setState({
    workspaces: [{ id: 'w1', name: 'Shared', is_personal: false, role: 'viewer', active: true }],
    loaded: true,
  });
}

beforeEach(() => {
  listDockerImages.mockReset().mockResolvedValue([]);
  removeDockerImage.mockReset().mockResolvedValue(undefined);
  pullDockerImage.mockReset().mockResolvedValue(undefined);
  tagDockerImage.mockReset().mockResolvedValue(undefined);
  inspectDockerImage.mockReset().mockResolvedValue({});
  asOperator();
});

describe('reading the images on a Node', () => {
  it('lists each image with its size and whether anything is using it', async () => {
    listDockerImages.mockResolvedValue([
      image({ id: 'sha256:a', repository: 'nginx', tag: '1.27', in_use: true, containers: 2 }),
      image({ id: 'sha256:b', repository: '<none>', tag: '<none>', dangling: true }),
    ]);
    renderInApp(<DockerImagesPanel nodeId="nd_1" />);

    expect(await screen.findByText('nginx:1.27')).toBeInTheDocument();
    // A lost repository is an untagged image, never Docker's <none>:<none>.
    expect(screen.getByText('Untagged')).toBeInTheDocument();
    expect(screen.getByText('2 containers')).toBeInTheDocument();
    expect(screen.getByText('Dangling')).toBeInTheDocument();
  });

  it('says how much the unused images could release', async () => {
    listDockerImages.mockResolvedValue([
      image({ id: 'sha256:a', in_use: true, size_bytes: 9_000_000_000 }),
      image({ id: 'sha256:b', in_use: false, size_bytes: 5 * 1024 * 1024 * 1024 }),
    ]);
    renderInApp(<DockerImagesPanel nodeId="nd_1" />);

    // The in-use image is not counted, however large it is.
    expect(await screen.findByText('5.0 GB can be reclaimed')).toBeInTheDocument();
  });

  it('narrows to one lens without asking the Node again', async () => {
    listDockerImages.mockResolvedValue([
      image({ id: 'sha256:a', repository: 'nginx', in_use: true }),
      image({ id: 'sha256:b', repository: 'postgres', in_use: false }),
    ]);
    const operator = userEvent.setup();
    renderInApp(<DockerImagesPanel nodeId="nd_1" />);
    await screen.findByText('nginx:latest');

    await operator.selectOptions(screen.getByLabelText('Show'), 'unused');

    expect(screen.queryByText('nginx:latest')).not.toBeInTheDocument();
    expect(screen.getByText('postgres:latest')).toBeInTheDocument();
    expect(listDockerImages).toHaveBeenCalledTimes(1);
  });
});

describe('removing an image', () => {
  it('never removes on the click alone', async () => {
    listDockerImages.mockResolvedValue([image({ repository: 'nginx', tag: 'latest' })]);
    const operator = userEvent.setup();
    renderInApp(<DockerImagesPanel nodeId="nd_1" />);

    await operator.click(await screen.findByLabelText('Remove nginx:latest'));

    expect(removeDockerImage).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('Remove nginx:latest?');
  });

  it('names the containers when the Node refuses because the image is in use', async () => {
    listDockerImages.mockResolvedValue([
      image({ repository: 'nginx', tag: 'latest', in_use: true, containers: 2 }),
    ]);
    removeDockerImage.mockRejectedValue(
      new ApiError(409, 'in_use', 'nginx:latest is used by 2 containers.', {
        containers: ['web-1', 'api'],
      }),
    );
    const operator = userEvent.setup();
    renderInApp(<DockerImagesPanel nodeId="nd_1" />);

    await operator.click(await screen.findByLabelText('Remove nginx:latest'));
    await operator.click(screen.getByRole('button', { name: 'Remove this image' }));

    const refusal = await screen.findByRole('alert');
    // The names are the whole answer to "why did nothing happen", so they must
    // survive the dialog closing.
    expect(refusal).toHaveTextContent('web-1 and api');
    expect(refusal).toHaveTextContent('nginx:latest is still in use, so nothing was removed');
  });

  it('sends the force decision the Operator actually made', async () => {
    listDockerImages.mockResolvedValue([image({ id: 'sha256:zz', repository: 'redis', tag: '7' })]);
    const operator = userEvent.setup();
    renderInApp(<DockerImagesPanel nodeId="nd_1" />);

    await operator.click(await screen.findByLabelText('Remove redis:7'));
    await operator.click(screen.getByRole('checkbox'));
    await operator.click(screen.getByRole('button', { name: 'Remove this image' }));

    await waitFor(() => expect(removeDockerImage).toHaveBeenCalledWith('nd_1', 'sha256:zz', true));
  });
});

describe('pulling an image', () => {
  it('sends the reference as typed and re-reads the list afterwards', async () => {
    listDockerImages.mockResolvedValue([image()]);
    const operator = userEvent.setup();
    renderInApp(<DockerImagesPanel nodeId="nd_1" />);

    await operator.click(await screen.findByRole('button', { name: 'Pull an image' }));
    await operator.type(screen.getByLabelText('Image to pull'), 'redis:7-alpine');
    await operator.click(screen.getByRole('button', { name: 'Pull this image' }));

    await waitFor(() => expect(pullDockerImage).toHaveBeenCalledWith('nd_1', 'redis:7-alpine'));
    await waitFor(() => expect(listDockerImages).toHaveBeenCalledTimes(2));
  });

  it('says what went wrong rather than leaving the form looking idle', async () => {
    listDockerImages.mockResolvedValue([image()]);
    pullDockerImage.mockRejectedValue(new ApiError(404, 'not_found', 'No such image: nginx:nope.'));
    const operator = userEvent.setup();
    renderInApp(<DockerImagesPanel nodeId="nd_1" />);

    await operator.click(await screen.findByRole('button', { name: 'Pull an image' }));
    await operator.type(screen.getByLabelText('Image to pull'), 'nginx:nope');
    await operator.click(screen.getByRole('button', { name: 'Pull this image' }));

    expect(await screen.findByText('No such image: nginx:nope.')).toBeInTheDocument();
  });
});

describe('a Viewer', () => {
  it('is offered no control that writes', async () => {
    asViewer();
    listDockerImages.mockResolvedValue([image({ repository: 'nginx', tag: 'latest' })]);
    renderInApp(<DockerImagesPanel nodeId="nd_1" />);

    expect(await screen.findByLabelText('Inspect nginx:latest')).toBeInTheDocument();
    expect(screen.queryByLabelText('Remove nginx:latest')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tag nginx:latest')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pull an image' })).not.toBeInTheDocument();
  });
});
