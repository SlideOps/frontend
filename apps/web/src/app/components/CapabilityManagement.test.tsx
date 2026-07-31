import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listCapabilityActions: (key: string) => listCapabilityActions(key),
  runCapabilityAction: (...args: unknown[]) => runCapabilityAction(...args),
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

function show(props: { installed: boolean; nodeId?: string }) {
  return renderInApp(
    <CapabilityManagement
      capabilityKey="install-postgresql"
      nodeId={props.nodeId ?? 'n1'}
      installed={props.installed}
    />,
  );
}

describe('CapabilityManagement', () => {
  beforeEach(() => {
    listCapabilityActions.mockReset().mockResolvedValue(actions);
    runCapabilityAction.mockReset();
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
  // nothing, so the link is held until it can succeed.
  it('holds the download until its required input is given', async () => {
    const operator = userEvent.setup();
    show({ installed: true });

    const link = await screen.findByText('Download');
    expect(link.closest('a')).not.toHaveAttribute('href');

    await operator.type(screen.getByPlaceholderText('app'), 'prudent_journal');
    await waitFor(() =>
      expect(link.closest('a')).toHaveAttribute(
        'href',
        expect.stringContaining('database=prudent_journal'),
      ),
    );
  });

  it('reports a refusal from the server', async () => {
    const { ApiError } = await import('@slideops/api-client');
    runCapabilityAction.mockRejectedValue(new ApiError(404, 'unknown_action', 'no such database'));
    const operator = userEvent.setup();
    show({ installed: true });

    await operator.click(await screen.findByRole('button', { name: /Show/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no such database');
  });
});
