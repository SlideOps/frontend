import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

beforeEach(() => {
  inspectNodeRoutes.mockReset();
  repairNodeRoutes.mockReset();
  inspectNodeRoutes.mockResolvedValue(drift());
});

describe('NodeRoutes', () => {
  it('says everything is routed when it is', async () => {
    renderInApp(<NodeRoutes nodeId="n-1" />);
    expect(
      await screen.findByText(/Every domain SlideOps manages on this server is routed/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Put them back/ })).not.toBeInTheDocument();
  });

  it('lists what is missing and offers to put it back', async () => {
    inspectNodeRoutes.mockResolvedValue(
      drift({
        missing: ['api.example.com'],
        healthy: false,
        summary: '1 domain is missing a route on this server.',
      }),
    );
    repairNodeRoutes.mockResolvedValue(drift());
    renderInApp(<NodeRoutes nodeId="n-1" />);

    expect(await screen.findByText('api.example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Put them back/ }));
    await waitFor(() => expect(repairNodeRoutes).toHaveBeenCalledWith('n-1'));
  });

  it('says why a route went missing rather than only that it did', async () => {
    inspectNodeRoutes.mockResolvedValue(
      drift({ missing: ['api.example.com'], healthy: false, summary: 'x' }),
    );
    renderInApp(<NodeRoutes nodeId="n-1" />);
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
    renderInApp(<NodeRoutes nodeId="n-1" />);

    expect(await screen.findByText('blog.operators-own.com')).toBeInTheDocument();
    expect(screen.getByText(/not a problem and nothing\s+will touch them/i)).toBeInTheDocument();
  });

  it('offers no repair when the only thing here is somebody else’s site', async () => {
    inspectNodeRoutes.mockResolvedValue(
      drift({ unmanaged: ['blog.operators-own.com'], summary: 'x' }),
    );
    renderInApp(<NodeRoutes nodeId="n-1" />);

    await screen.findByText('blog.operators-own.com');
    expect(screen.queryByRole('button', { name: /Put them back/ })).not.toBeInTheDocument();
  });

  // A server that cannot be read is not a server with no routes, and showing an
  // empty healthy panel would be a lie.
  it('shows the error when the server could not be read', async () => {
    inspectNodeRoutes.mockRejectedValue(new Error('the node could not be reached'));
    renderInApp(<NodeRoutes nodeId="n-1" />);

    await waitFor(() => expect(inspectNodeRoutes).toHaveBeenCalled());
    expect(screen.queryByText(/is routed/)).not.toBeInTheDocument();
  });
});
