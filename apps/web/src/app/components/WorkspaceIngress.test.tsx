import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceIngressView } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

const getWorkspaceIngress = vi.fn();
const chooseWorkspaceIngress = vi.fn();
const disableWorkspaceIngress = vi.fn();
const listNodes = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getWorkspaceIngress: (...a: unknown[]) => getWorkspaceIngress(...a),
  chooseWorkspaceIngress: (...a: unknown[]) => chooseWorkspaceIngress(...a),
  disableWorkspaceIngress: (...a: unknown[]) => disableWorkspaceIngress(...a),
  listNodes: (...a: unknown[]) => listNodes(...a),
}));

const { WorkspaceIngress } = await import('./WorkspaceIngress');

function ingress(over: Partial<WorkspaceIngressView> = {}): WorkspaceIngressView {
  return {
    node_id: '',
    public_address: '',
    enabled: false,
    drifted: false,
    ...over,
  };
}

beforeEach(() => {
  for (const fn of [getWorkspaceIngress, chooseWorkspaceIngress, disableWorkspaceIngress, listNodes]) {
    fn.mockReset();
  }
  getWorkspaceIngress.mockResolvedValue(ingress());
  listNodes.mockResolvedValue([{ id: 'n-1', name: 'edge-node' }]);
});

describe('WorkspaceIngress', () => {
  // An ingress is not a free improvement: it makes one server the path for all
  // public traffic, and the page has to say so rather than only selling it.
  it('says what choosing one entry point costs as well as what it gives', async () => {
    renderInApp(<WorkspaceIngress canAdminister />);

    expect(
      await screen.findByText(/All public traffic for this Workspace passes through it/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/never needs a DNS change/i)).toBeInTheDocument();
  });

  it('chooses an entry point', async () => {
    chooseWorkspaceIngress.mockResolvedValue(
      ingress({ enabled: true, node_id: 'n-1', public_address: '203.0.113.9' }),
    );
    renderInApp(<WorkspaceIngress canAdminister />);

    await userEvent.selectOptions(
      await screen.findByLabelText(/Server to answer for this Workspace/),
      'n-1',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Use one entry point' }));

    await waitFor(() => expect(chooseWorkspaceIngress).toHaveBeenCalledWith('n-1', undefined));
  });

  // The one thing that breaks every hostname in a Workspace at once, and it is
  // completely invisible without being told.
  it('warns when the entry point has moved and every domain still points at the old address', async () => {
    getWorkspaceIngress.mockResolvedValue(
      ingress({
        enabled: true,
        node_id: 'n-1',
        public_address: '203.0.113.9',
        drifted: true,
        current_address: '198.51.100.4',
      }),
    );
    renderInApp(<WorkspaceIngress canAdminister />);

    expect(await screen.findByText(/still points at 203.0.113.9/)).toBeInTheDocument();
    expect(screen.getByText(/changed to 198.51.100.4/)).toBeInTheDocument();
  });

  it('leaves the controls out for a role that cannot change any of this', async () => {
    renderInApp(<WorkspaceIngress canAdminister={false} />);

    expect(await screen.findByText(/requires the Owner or an Admin/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use one entry point' })).not.toBeInTheDocument();
  });

  it('lets an Owner stop using the entry point once it is enabled', async () => {
    getWorkspaceIngress.mockResolvedValue(
      ingress({ enabled: true, node_id: 'n-1', public_address: '203.0.113.9' }),
    );
    renderInApp(<WorkspaceIngress canAdminister />);

    await userEvent.click(await screen.findByRole('button', { name: 'Stop using it' }));
    await waitFor(() => expect(disableWorkspaceIngress).toHaveBeenCalled());
  });
});
