import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteDrift } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

const inspectNodeRoutes = vi.fn();
const repairNodeRoutes = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  inspectNodeRoutes: (...a: unknown[]) => inspectNodeRoutes(...a),
  repairNodeRoutes: (...a: unknown[]) => repairNodeRoutes(...a),
}));

const { NodeRoutes } = await import('./NodeRoutes');

function drift(over: Partial<RouteDrift> = {}): RouteDrift {
  return {
    node_id: 'n-1',
    missing: [],
    unmanaged: [],
    healthy: true,
    summary: 'Every domain SlideOps manages on this server is routed.',
    ...over,
  };
}

function show() {
  return renderInApp(
    <MemoryRouter>
      <NodeRoutes nodeId="n-1" />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  inspectNodeRoutes.mockReset();
  repairNodeRoutes.mockReset();
  inspectNodeRoutes.mockResolvedValue(drift());
});

describe('NodeRoutes', () => {
  it('says everything is routed when it is', async () => {
    show();
    expect(
      await screen.findByText(/Every domain SlideOps manages on this server is routed/),
    ).toBeInTheDocument();
  });

  it('lists what is missing without offering to change it from here', async () => {
    inspectNodeRoutes.mockResolvedValue(
      drift({
        missing: ['api.example.com'],
        healthy: false,
        summary: '1 domain is missing a route on this server.',
      }),
    );
    show();

    expect(await screen.findByText('api.example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Put them back/ })).not.toBeInTheDocument();
    expect(repairNodeRoutes).not.toHaveBeenCalled();
  });

  it('points at the one page where a missing route can be put back', async () => {
    show();
    expect(await screen.findByRole('link', { name: /Manage domains and DNS/ })).toHaveAttribute(
      'href',
      '/app/domains?node=n-1',
    );
  });

  it('says why a route went missing rather than only that it did', async () => {
    inspectNodeRoutes.mockResolvedValue(
      drift({ missing: ['api.example.com'], healthy: false, summary: 'x' }),
    );
    show();
    expect(
      await screen.findByText(/rebuilt server, a restored snapshot, or an edit by hand/i),
    ).toBeInTheDocument();
  });

  // The obvious reading of "SlideOps did not set this up" is that it should be
  // cleared away, and that is exactly wrong: it is the Operator's own site.
  it('says plainly that a site SlideOps did not set up is not a problem and will not be touched', async () => {
    inspectNodeRoutes.mockResolvedValue(
      drift({ unmanaged: ['blog.operators-own.com'], summary: 'x' }),
    );
    show();

    expect(await screen.findByText('blog.operators-own.com')).toBeInTheDocument();
    expect(screen.getByText(/not a problem and nothing\s+will touch them/i)).toBeInTheDocument();
  });

  // A server that cannot be read is not a server with no routes, and showing an
  // empty healthy panel would be a lie.
  it('shows the error when the server could not be read', async () => {
    inspectNodeRoutes.mockRejectedValue(new Error('the node could not be reached'));
    show();

    await waitFor(() => expect(inspectNodeRoutes).toHaveBeenCalled());
    expect(screen.queryByText(/is routed/)).not.toBeInTheDocument();
  });
});
