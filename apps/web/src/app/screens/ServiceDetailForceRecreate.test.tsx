import { ApiError } from '@slideops/api-client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from '../../store/workspace';
import { renderInApp } from '../../test/render';

/*
 * Recreating containers on the next deploy, on the Service detail page.
 *
 * The failure it exists for: an Operator corrected an environment variable,
 * redeployed, watched the deploy report success, and got the identical error
 * back. Compose reused the containers it already had, so the old values went on
 * being the running values. These assert the control that ends that, and that
 * it never shows a setting the server did not accept.
 *
 * Its own file rather than an eleventh render bolted onto the page's other
 * suite: that one is already close to the per test time limit on a loaded
 * machine, and lengthening it made an unrelated test start timing out.
 */

const getService = vi.fn();
const getProject = vi.fn();
const getNode = vi.fn();
const getServiceActivity = vi.fn();
const getServiceMetrics = vi.fn();
const listCapabilityActions = vi.fn();
const checkServiceUpdate = vi.fn();
const listMarketplacePlugins = vi.fn();
const listInstalledPlugins = vi.fn();
const getCapabilityStates = vi.fn();
const setServiceForceRecreate = vi.fn();

const viewerWorkspace = {
  id: 'ws-9',
  name: 'Client X',
  is_personal: false,
  role: 'viewer',
  active: true,
};

/*
 * The shell reads which workspaces this Operator can act in the moment it
 * mounts, and that read is what every Viewer gate on the page answers from. It
 * also overwrites whatever a test wrote into the store beforehand, so the role
 * a test wants has to come from here. Empty means acting in one's own
 * workspace, which is an Owner.
 */
const listWorkspaces = vi.fn(async (): Promise<Array<typeof viewerWorkspace>> => []);

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getService: (...a: unknown[]) => getService(...a),
  getProject: (...a: unknown[]) => getProject(...a),
  getNode: (...a: unknown[]) => getNode(...a),
  getServiceActivity: (...a: unknown[]) => getServiceActivity(...a),
  getServiceMetrics: (...a: unknown[]) => getServiceMetrics(...a),
  listCapabilityActions: (...a: unknown[]) => listCapabilityActions(...a),
  checkServiceUpdate: (...a: unknown[]) => checkServiceUpdate(...a),
  listMarketplacePlugins: (...a: unknown[]) => listMarketplacePlugins(...a),
  listInstalledPlugins: (...a: unknown[]) => listInstalledPlugins(...a),
  getCapabilityStates: (...a: unknown[]) => getCapabilityStates(...a),
  setServiceForceRecreate: (...a: unknown[]) => setServiceForceRecreate(...a),
  listWorkspaces: () => listWorkspaces(),
}));

const { ServiceDetail } = await import('./ServiceDetail');

/** A compose stack: the runtime the recreate choice actually decides something for. */
const composeService = {
  id: 'svc-1',
  project_id: 'p-1',
  node_id: 'n-1',
  name: 'prudent-journal-backend',
  runtime: 'compose',
  status: 'running',
  source: { type: 'repository', repository_url: 'https://github.com/x/y', branch: 'main' },
  cpu_limit: 1,
  memory_mb: 512,
  pids_limit: 256,
  ports: [{ host: 8100, container: 8000 }],
  adopted: false,
  force_recreate: false,
  created_at: '2026-07-30T10:00:00Z',
};

const RECREATE = /Recreate containers on the next deploy/;

function show() {
  return renderInApp(
    <MemoryRouter initialEntries={['/app/services/svc-1']}>
      <Routes>
        <Route path="/app/services/:id" element={<ServiceDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Render the page and hand back the recreate checkbox once it is on screen. */
function recreateBox() {
  show();
  return screen.findByRole('checkbox', { name: RECREATE });
}

describe('ServiceDetail: recreating containers on the next deploy', () => {
  beforeEach(() => {
    getService.mockReset().mockResolvedValue(composeService);
    getProject.mockReset().mockResolvedValue({ id: 'p-1', name: 'Kenpoly' });
    getNode.mockReset().mockResolvedValue({ id: 'n-1', name: 'contabo vps' });
    getServiceActivity.mockReset().mockResolvedValue([]);
    getServiceMetrics
      .mockReset()
      .mockResolvedValue({ cpu_percent: 1, memory_used_mb: 10, memory_limit_mb: 512 });
    listCapabilityActions.mockReset().mockResolvedValue([]);
    checkServiceUpdate.mockReset().mockResolvedValue({ update_available: false, reason: '' });
    listMarketplacePlugins.mockReset().mockResolvedValue([]);
    listInstalledPlugins.mockReset().mockResolvedValue([]);
    getCapabilityStates.mockReset().mockResolvedValue({});
    setServiceForceRecreate.mockReset();
    listWorkspaces.mockResolvedValue([]);
    useWorkspaceStore.setState({ workspaces: [], loaded: false });
  });

  it('shows the setting off, and says what it does and costs, when the Service has it off', async () => {
    expect(await recreateBox()).not.toBeChecked();
    expect(screen.getByText(/Nothing happens now/)).toBeInTheDocument();
    expect(screen.getByText(/moment of downtime/)).toBeInTheDocument();
  });

  it('turns it on by asking the server for enabled true and shows what came back', async () => {
    setServiceForceRecreate.mockResolvedValue({ ...composeService, force_recreate: true });

    await userEvent.click(await recreateBox());

    await waitFor(() => expect(setServiceForceRecreate).toHaveBeenCalledWith('svc-1', true));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: RECREATE })).toBeChecked());
  });

  it('shows the setting on when the Service has it on, and turns it off for enabled false', async () => {
    getService.mockResolvedValue({ ...composeService, force_recreate: true });
    setServiceForceRecreate.mockResolvedValue({ ...composeService, force_recreate: false });

    const box = await recreateBox();
    expect(box).toBeChecked();

    await userEvent.click(box);

    await waitFor(() => expect(setServiceForceRecreate).toHaveBeenCalledWith('svc-1', false));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: RECREATE })).not.toBeChecked());
  });

  // The server's own words, not a sentence this screen made up, and the box left
  // where the server last confirmed it rather than where the click put it.
  it('surfaces the server message and leaves the setting alone when the change is refused', async () => {
    setServiceForceRecreate.mockRejectedValue(
      new ApiError(409, 'service_removed', 'This Service was already removed.'),
    );

    await userEvent.click(await recreateBox());

    expect(await screen.findByRole('alert')).toHaveTextContent('This Service was already removed.');
    expect(screen.getByRole('checkbox', { name: RECREATE })).not.toBeChecked();
  });

  it('does not offer it to a Viewer, who may not write in this workspace', async () => {
    listWorkspaces.mockResolvedValue([viewerWorkspace]);
    show();

    await screen.findByText('Actions');
    await waitFor(() =>
      expect(
        screen.getByText(/Starting, stopping, redeploying, or removing this Service needs a role/),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole('checkbox', { name: RECREATE })).not.toBeInTheDocument();
  });

  // A single container is torn down and built again on every deploy already, so
  // a toggle there would decide nothing. The Operator is still told that, where
  // the control would have been, rather than finding an unexplained gap.
  it('offers no toggle on a single container Service and says why in its place', async () => {
    getService.mockResolvedValue({ ...composeService, runtime: 'container' });
    show();

    expect(
      await screen.findByText(/removed and recreated on every deploy already/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: RECREATE })).not.toBeInTheDocument();
  });

  // A systemd unit is not a container at all, so neither the toggle nor the
  // sentence about containers would describe anything real.
  it('says nothing about containers on a systemd Service, which runs none', async () => {
    getService.mockResolvedValue({ ...composeService, runtime: 'systemd' });
    show();

    await screen.findByRole('button', { name: 'Restart' });
    expect(screen.queryByRole('checkbox', { name: RECREATE })).not.toBeInTheDocument();
    expect(screen.queryByText(/recreated on every deploy already/)).not.toBeInTheDocument();
  });

  // An adopted workload was never built here and is never redeployed, which is
  // why Redeploy is withheld from it too: there is no next deploy to decide about.
  it('offers nothing about recreating on an adopted workload, which is never redeployed', async () => {
    getService.mockResolvedValue({ ...composeService, adopted: true });
    show();

    await screen.findByRole('button', { name: 'Stop managing this Service' });
    expect(screen.queryByRole('checkbox', { name: RECREATE })).not.toBeInTheDocument();
  });
});
