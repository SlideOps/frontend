import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import type { Service } from '@slideops/api-client';

/*
 * Automatic deployment, from the Service's own CI/CD tab.
 *
 * The two build modes read very differently: slideops mode is a toggle on top
 * of a deploy that already exists, and shows whether a push webhook is what
 * is actually running it or the platform fell back to polling; external mode
 * has nothing to toggle beyond choosing it, since an outside CI is what
 * triggers a deploy, authenticated with a token this tab issues and shown
 * exactly once.
 */

const updateServiceCICD = vi.fn();
const rotateDeployHookToken = vi.fn();
const listServiceDeployEvents = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  updateServiceCICD: (...a: unknown[]) => updateServiceCICD(...a),
  rotateDeployHookToken: (...a: unknown[]) => rotateDeployHookToken(...a),
  listServiceDeployEvents: (...a: unknown[]) => listServiceDeployEvents(...a),
}));

const { ServiceCICDPanel } = await import('./ServiceCICDPanel');

function service(overrides: Partial<Service> = {}): Service {
  return {
    id: 'svc-1',
    name: 'web',
    project_id: 'p-1',
    node_id: 'n-1',
    runtime: 'container',
    source: { type: 'repository', repository_url: 'https://github.com/acme/web', branch: 'main' },
    cpu_limit: 1,
    memory_mb: 512,
    status: 'running',
    created_at: '2026-07-30T10:00:00Z',
    cicd: {
      auto_deploy: false,
      build_mode: 'slideops',
      webhook_configured: false,
      deploy_hook_configured: false,
      registry_configured: false,
    },
    ...overrides,
  } as Service;
}

function show(svc: Service, onChanged = vi.fn()) {
  return { onChanged, ...renderInApp(<ServiceCICDPanel service={svc} onChanged={onChanged} />) };
}

describe('ServiceCICDPanel', () => {
  beforeEach(() => {
    updateServiceCICD.mockReset();
    rotateDeployHookToken.mockReset();
    listServiceDeployEvents.mockReset().mockResolvedValue([]);
  });

  it('saves the toggle and mode, and reports the change back', async () => {
    const onChanged = vi.fn();
    updateServiceCICD.mockResolvedValue(service({ cicd: { ...service().cicd, auto_deploy: true } }));
    show(service(), onChanged);

    const operator = userEvent.setup();
    await operator.click(screen.getByRole('checkbox'));
    await operator.click(screen.getByRole('button', { name: /Save changes/ }));

    await waitFor(() =>
      expect(updateServiceCICD).toHaveBeenCalledWith(
        'svc-1',
        expect.objectContaining({ auto_deploy: true, build_mode: 'slideops' }),
      ),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('disables the toggle in slideops mode when the Service has no repository source', async () => {
    show(service({ source: { type: 'image', image: 'nginx:latest' } }));
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText(/does not deploy from a repository/)).toBeInTheDocument();
  });

  it('explains that polling is backing auto-deploy when no webhook is registered', async () => {
    show(service({ cicd: { ...service().cicd, auto_deploy: true, webhook_configured: false } }));
    expect(screen.getByText(/could not register a webhook/i)).toBeInTheDocument();
  });

  it('says a push redeploys instantly once a webhook is registered', async () => {
    show(service({ cicd: { ...service().cicd, auto_deploy: true, webhook_configured: true } }));
    expect(screen.getByText(/redeploys within seconds/)).toBeInTheDocument();
  });

  it('switches to external mode and shows the registry form and deploy hook section', async () => {
    show(service());
    const operator = userEvent.setup();
    await operator.click(screen.getByRole('button', { name: 'An external CI provides the artifact' }));

    expect(screen.getByRole('heading', { name: 'Registry' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deploy hook' })).toBeInTheDocument();
    expect(screen.getByText('No token yet.')).toBeInTheDocument();
  });

  it('shows a rotated token exactly once, with ready to paste pipeline snippets', async () => {
    rotateDeployHookToken.mockResolvedValue({
      service: service({ cicd: { ...service().cicd, build_mode: 'external', deploy_hook_configured: true } }),
      token: 'a1b2c3d4e5f6',
    });
    show(service({ cicd: { ...service().cicd, build_mode: 'external' } }));

    const operator = userEvent.setup();
    await operator.click(screen.getByRole('button', { name: 'Issue a token' }));

    expect(await screen.findByText('a1b2c3d4e5f6')).toBeInTheDocument();
    // Both snippets end in a curl call; what actually distinguishes them is
    // whether a registry push or a local docker save comes first.
    expect(screen.getAllByText(/curl -X POST/).length).toBe(2);
    expect(screen.getByText(/docker push/)).toBeInTheDocument();
    expect(screen.getByText(/docker save/)).toBeInTheDocument();
  });

  it('lists what triggered a deploy attempt and what happened', async () => {
    listServiceDeployEvents.mockResolvedValue([
      {
        id: 'evt-1',
        trigger: 'push_webhook',
        commit_sha: '4f2a1c9e8b7d6a5',
        outcome: 'redeploy_started',
        created_at: '2026-07-31T09:00:00Z',
      },
      {
        id: 'evt-2',
        trigger: 'poll',
        outcome: 'skipped',
        detail: 'no new commit',
        created_at: '2026-07-31T08:00:00Z',
      },
    ]);
    show(service());

    expect(await screen.findByText('Push webhook')).toBeInTheDocument();
    expect(screen.getByText('Periodic check')).toBeInTheDocument();
    expect(screen.getByText(/4f2a1c9/)).toBeInTheDocument();
  });

  it('says plainly when nothing has happened yet', async () => {
    listServiceDeployEvents.mockResolvedValue([]);
    show(service());
    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();
  });
});
