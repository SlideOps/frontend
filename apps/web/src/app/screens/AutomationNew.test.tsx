import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Capability, Node, Workspace } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

const node: Node = { id: 'n1', name: 'web-1', address: '10.0.0.1', status: 'reachable' } as Node;
const capability = { key: 'enable-monitoring', name: 'Enable monitoring', risk_level: 'low' } as Capability;

const ownerWorkspace: Workspace = {
  owner_operator_id: 'op_1',
  owner_email: 'me@example.com',
  role: 'owner',
  active: true,
};

const viewerWorkspace: Workspace = {
  owner_operator_id: 'op_9',
  owner_email: 'boss@example.com',
  role: 'viewer',
  active: true,
};

let workspaces: Workspace[] = [ownerWorkspace];

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listNodes: async () => [node],
  listCapabilities: async () => [capability],
  listWorkspaces: async () => workspaces,
}));

const { AutomationNew } = await import('./AutomationNew');

function renderScreen() {
  return renderInApp(
    <MemoryRouter>
      <AutomationNew />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useWorkspaceStore.setState({ workspaces: [], loaded: false });
  workspaces = [ownerWorkspace];
});

describe('AutomationNew', () => {
  it('shows the create form for an Owner', async () => {
    renderScreen();
    expect(await screen.findByText('New Automation')).toBeInTheDocument();
  });

  it('refuses a Viewer with a plain explanation rather than a form that would 403', async () => {
    workspaces = [viewerWorkspace];
    renderScreen();
    expect(await screen.findByText('This needs a role above Viewer')).toBeInTheDocument();
    expect(screen.queryByText('New Automation')).not.toBeInTheDocument();
  });
});
