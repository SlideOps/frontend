import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderInApp } from '../../test/render';

/*
 * The management surface only exists once there is something to manage.
 *
 * That is the whole design: a Capability's page is a description until its
 * outcome is actually in place, and then the same page becomes where the work
 * happens. Rendering controls for something not installed would offer an
 * Operator a button that cannot work, which is the failure this replaces.
 */

const listCapabilityActions = vi.fn();
const runCapabilityAction = vi.fn();
const uploadToNode = vi.fn();
const createOperation = vi.fn();
const downloadCapabilityAction = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listCapabilityActions: (key: string) => listCapabilityActions(key),
  runCapabilityAction: (...args: unknown[]) => runCapabilityAction(...args),
  uploadToNode: (...args: unknown[]) => uploadToNode(...args),
  createOperation: (...args: unknown[]) => createOperation(...args),
  downloadCapabilityAction: (...args: unknown[]) => downloadCapabilityAction(...args),
}));

const { CapabilityManagement } = await import('./CapabilityManagement');

const actions = [
  {
    key: 'list-databases',
    label: 'Databases',
    description: 'Every database on this server.',
    effect: 'read',
    produces: 'table',
    parameters: [],
  },
  {
    key: 'export-database',
    label: 'Export a database',
    description: 'A complete copy, streamed straight to you.',
    effect: 'read',
    produces: 'file',
    parameters: [
      { key: 'database', label: 'Database', type: 'string', required: true, placeholder: 'app' },
    ],
  },
];

function show(props: { installed: boolean; nodeId?: string; serviceId?: string }) {
  return renderInApp(
    <MemoryRouter>
      <CapabilityManagement
        capabilityKey="install-postgresql"
        nodeId={props.nodeId ?? 'n1'}
        serviceId={props.serviceId}
        installed={props.installed}
      />
    </MemoryRouter>,
  );
}

describe('CapabilityManagement', () => {
  beforeEach(() => {
    listCapabilityActions.mockReset().mockResolvedValue(actions);
    runCapabilityAction.mockReset();
    uploadToNode.mockReset();
    createOperation.mockReset().mockResolvedValue({ id: 'op-1' });
    downloadCapabilityAction.mockReset().mockResolvedValue(undefined);
  });

  // The adaptive rule, from both sides.
  it('shows nothing at all when the Capability is not installed here', async () => {
    const { container } = show({ installed: false });
    await waitFor(() => expect(listCapabilityActions).not.toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing when no server is in context', async () => {
    const { container } = show({ installed: true, nodeId: '' });
    expect(container).toBeEmptyDOMElement();
  });

  it('offers the Actions once it is installed', async () => {
    show({ installed: true });
    expect(await screen.findByText('Databases')).toBeInTheDocument();
    expect(await screen.findByText('Export a database')).toBeInTheDocument();
  });

  it('shows nothing when the Capability offers no Actions', async () => {
    listCapabilityActions.mockResolvedValue([]);
    const { container } = show({ installed: true });
    await waitFor(() => expect(listCapabilityActions).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('reads rows and shows them', async () => {
    runCapabilityAction.mockResolvedValue({
      columns: ['Database', 'Size'],
      rows: [['prudent_journal', '8407 kB']],
    });
    const operator = userEvent.setup();
    show({ installed: true });

    await operator.click(await screen.findByRole('button', { name: /Show/ }));

    expect(await screen.findByText('prudent_journal')).toBeInTheDocument();
    expect(screen.getByText('8407 kB')).toBeInTheDocument();
    expect(runCapabilityAction).toHaveBeenCalledWith('install-postgresql', 'list-databases', {
      node_id: 'n1',
      parameters: {},
    });
  });

  it('says what an empty result means rather than showing a blank', async () => {
    runCapabilityAction.mockResolvedValue({
      columns: ['Database'],
      rows: [],
      empty: 'This server has no databases yet.',
    });
    const operator = userEvent.setup();
    show({ installed: true });

    await operator.click(await screen.findByRole('button', { name: /Show/ }));
    expect(await screen.findByText('This server has no databases yet.')).toBeInTheDocument();
  });

  // A download with a required input missing would produce a file named after
  // nothing, so it is held until it can succeed.
  it('holds the download until its required input is given', async () => {
    const operator = userEvent.setup();
    show({ installed: true });

    const button = await screen.findByRole('button', { name: /Download/ });
    expect(button).toBeDisabled();

    await operator.type(screen.getByPlaceholderText('app'), 'prudent_journal');
    await waitFor(() => expect(button).toBeEnabled());
  });

  /*
   * This was a bare anchor pointed at the download URL. Without a download
   * attribute a click is a top level navigation, so an export the server refused
   * replaced the whole application with a page of raw JSON: no message, nothing
   * saved, and no way to read the reason without opening devtools. Which is
   * indistinguishable from the button doing nothing at all.
   */
  it('reports a refused export instead of navigating away from the app', async () => {
    const { ApiError } = await import('@slideops/api-client');
    downloadCapabilityAction.mockRejectedValue(
      new ApiError(403, 'out_of_scope', 'this service does not use a database called "other"'),
    );
    const operator = userEvent.setup();
    show({ installed: true, serviceId: 'svc-1' });

    await operator.type(await screen.findByPlaceholderText('app'), 'other');
    await operator.click(screen.getByRole('button', { name: /Download/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('does not use a database called');
  });

  it('says so when the export actually saved', async () => {
    downloadCapabilityAction.mockResolvedValue(undefined);
    const operator = userEvent.setup();
    show({ installed: true });

    await operator.type(await screen.findByPlaceholderText('app'), 'prudent_journal');
    await operator.click(screen.getByRole('button', { name: /Download/ }));

    expect(await screen.findByRole('status')).toHaveTextContent('Saved to your downloads');
  });

  // Scoping is what stops a Service page reaching another application's data on
  // a shared database server.
  it('passes the Service through so the server can scope the read', async () => {
    runCapabilityAction.mockResolvedValue({ columns: ['Database'], rows: [] });
    const operator = userEvent.setup();
    show({ installed: true, serviceId: 'svc-1' });

    await operator.click(await screen.findByRole('button', { name: /Show/ }));
    await waitFor(() =>
      expect(runCapabilityAction).toHaveBeenCalledWith('install-postgresql', 'list-databases', {
        node_id: 'n1',
        service_id: 'svc-1',
        parameters: {},
      }),
    );
  });

  it('scopes the download to the Service too', async () => {
    downloadCapabilityAction.mockResolvedValue(undefined);
    const operator = userEvent.setup();
    show({ installed: true, serviceId: 'svc-1' });

    await operator.type(await screen.findByPlaceholderText('app'), 'prudent_journal');
    await operator.click(screen.getByRole('button', { name: /Download/ }));

    await waitFor(() =>
      expect(downloadCapabilityAction).toHaveBeenCalledWith('install-postgresql', 'export-database', {
        node_id: 'n1',
        service_id: 'svc-1',
        parameters: { database: 'prudent_journal' },
      }),
    );
  });

  it('says it is scoped when it is', async () => {
    show({ installed: true, serviceId: 'svc-1' });
    expect(await screen.findByText(/only what it actually uses is shown/)).toBeInTheDocument();
  });

  it('reports a refusal from the server', async () => {
    const { ApiError } = await import('@slideops/api-client');
    runCapabilityAction.mockRejectedValue(new ApiError(404, 'unknown_action', 'no such database'));
    const operator = userEvent.setup();
    show({ installed: true });

    await operator.click(await screen.findByRole('button', { name: /Show/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no such database');
  });

  /*
   * Restoring is two steps on purpose: the upload changes nothing, and the
   * restore is an Operation with a plan to approve. What is pinned is that the
   * upload really does not restore, and that the size the server measured is put
   * in front of somebody before they agree to anything.
   */
  it('uploads without restoring anything', async () => {
    uploadToNode.mockResolvedValue({ id: 'up-1', path: '/x', bytes: 29296 });
    const operator = userEvent.setup();
    show({ installed: true });

    const input = await screen.findByLabelText('Dump file');
    await operator.upload(input, new File(['-- dump'], 'app.sql', { type: 'text/plain' }));
    await operator.click(screen.getByRole('button', { name: /Upload/ }));

    await waitFor(() => expect(uploadToNode).toHaveBeenCalled());
    // The upload must not have restored anything.
    expect(createOperation).not.toHaveBeenCalled();
    expect(await screen.findByText(/29,296 bytes arrived/)).toBeInTheDocument();
  });

  it('creates an Operation to approve rather than restoring on the spot', async () => {
    uploadToNode.mockResolvedValue({ id: 'up-1', path: '/x', bytes: 100 });
    const operator = userEvent.setup();
    show({ installed: true });

    await operator.upload(
      await screen.findByLabelText('Dump file'),
      new File(['-- dump'], 'app.sql', { type: 'text/plain' }),
    );
    await operator.click(screen.getByRole('button', { name: /Upload/ }));
    await screen.findByLabelText('Restore into');
    await operator.type(screen.getByLabelText('Restore into'), 'app');
    await operator.click(screen.getByRole('button', { name: 'Plan the restore' }));

    await waitFor(() =>
      expect(createOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          capability_key: 'restore-postgresql',
          parameters: { database: 'app', upload_id: 'up-1' },
        }),
      ),
    );
  });

  it('reports an upload that did not complete', async () => {
    const { ApiError } = await import('@slideops/api-client');
    uploadToNode.mockRejectedValue(new ApiError(413, 'too_large', 'that file is too large'));
    const operator = userEvent.setup();
    show({ installed: true });

    await operator.upload(
      await screen.findByLabelText('Dump file'),
      new File(['x'], 'app.sql', { type: 'text/plain' }),
    );
    await operator.click(screen.getByRole('button', { name: /Upload/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('too large');
  });
});
