import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ServiceConnection } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

const getServiceConnections = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getServiceConnections: (...a: unknown[]) => getServiceConnections(...a),
}));

const { ServiceConnectionsPanel } = await import('./ServiceConnectionsPanel');

function connection(over: Partial<ServiceConnection> = {}): ServiceConnection {
  return {
    id: 'conn-1',
    service_id: 'svc-1',
    source_node_id: 'n-1',
    source_capability_key: 'install-redis',
    source_operation_id: 'op-1',
    env_prefix: 'REDIS',
    created_at: '2026-08-01T00:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  getServiceConnections.mockReset();
});

describe('ServiceConnectionsPanel', () => {
  it('renders nothing when the Service has never used Connect', async () => {
    getServiceConnections.mockResolvedValue([]);
    const { container } = renderInApp(<ServiceConnectionsPanel serviceId="svc-1" />);

    await waitFor(() => expect(getServiceConnections).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('lists what the Service is connected to', async () => {
    getServiceConnections.mockResolvedValue([connection()]);
    renderInApp(<ServiceConnectionsPanel serviceId="svc-1" />);

    expect(await screen.findByText('Connected to')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
    expect(screen.getByText('REDIS_*')).toBeInTheDocument();
  });
});
