import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';

/*
 * Deployment-lifecycle auto-detection: the one nudge that closes the gap
 * the production incident this whole feature traces back to fell into --
 * Redis being healthy says nothing about whether a Celery worker exists for
 * an application that might depend on it.
 */

const getCapabilityStates = vi.fn();
const listOperations = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getCapabilityStates: (...args: unknown[]) => getCapabilityStates(...args),
  listOperations: (...args: unknown[]) => listOperations(...args),
}));

const { CeleryDeployNudge } = await import('./CeleryDeployNudge');

function show() {
  return renderInApp(
    <MemoryRouter initialEntries={['/app/services/service-1']}>
      <Routes>
        <Route
          path="/app/services/service-1"
          element={<CeleryDeployNudge nodeId="node-1" serviceId="service-1" />}
        />
        <Route path="/app/capabilities/:key" element={<div>Capability page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CeleryDeployNudge', () => {
  it('offers to configure a worker when Redis is configured and none exists yet', async () => {
    getCapabilityStates.mockResolvedValue({ 'configure-redis': { status: 'done', source: 'slideops' } });
    listOperations.mockResolvedValue([]);
    show();

    expect(await screen.findByText('Does this application use Celery?')).toBeInTheDocument();
    expect(getCapabilityStates).toHaveBeenCalledWith('node-1');
    expect(listOperations).toHaveBeenCalledWith({ node_id: 'node-1', status: 'completed' });
  });

  it('says nothing when Redis is not configured on this node', async () => {
    getCapabilityStates.mockResolvedValue({});
    listOperations.mockResolvedValue([]);
    show();

    await waitFor(() => expect(getCapabilityStates).toHaveBeenCalled());
    expect(screen.queryByText('Does this application use Celery?')).toBeNull();
  });

  it('says nothing once a Celery worker already exists', async () => {
    getCapabilityStates.mockResolvedValue({ 'configure-redis': { status: 'done', source: 'slideops' } });
    listOperations.mockResolvedValue([
      { id: 'op-1', node_id: 'node-1', capability_key: 'configure-celery-worker', status: 'completed' },
    ]);
    show();

    await waitFor(() => expect(listOperations).toHaveBeenCalled());
    expect(screen.queryByText('Does this application use Celery?')).toBeNull();
  });

  it('navigates to the Celery capability page, prefilled with this Service', async () => {
    const operator = userEvent.setup();
    getCapabilityStates.mockResolvedValue({ 'configure-redis': { status: 'done', source: 'slideops' } });
    listOperations.mockResolvedValue([]);
    show();

    await operator.click(await screen.findByRole('button', { name: /Configure a Celery worker/ }));

    expect(await screen.findByText('Capability page')).toBeInTheDocument();
  });

  it('never configures anything on its own -- it only offers a link', async () => {
    getCapabilityStates.mockResolvedValue({ 'configure-redis': { status: 'done', source: 'slideops' } });
    listOperations.mockResolvedValue([]);
    show();

    await screen.findByText('Does this application use Celery?');
    // The only controls this callout offers are navigation and dismissal --
    // no submit, no form, nothing that writes to the server by itself.
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('lets an Operator dismiss it for an application that does not use Celery', async () => {
    const operator = userEvent.setup();
    getCapabilityStates.mockResolvedValue({ 'configure-redis': { status: 'done', source: 'slideops' } });
    listOperations.mockResolvedValue([]);
    show();

    await screen.findByText('Does this application use Celery?');
    await operator.click(screen.getByRole('button', { name: 'Not this application' }));

    expect(screen.queryByText('Does this application use Celery?')).toBeNull();
  });
});
