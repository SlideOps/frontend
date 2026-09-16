import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DNSConnection } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

const listDNSConnections = vi.fn();
const connectDNS = vi.fn();
const disconnectDNS = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listDNSConnections: (...a: unknown[]) => listDNSConnections(...a),
  connectDNS: (...a: unknown[]) => connectDNS(...a),
  disconnectDNS: (...a: unknown[]) => disconnectDNS(...a),
}));

const { CloudflareConnections } = await import('./CloudflareConnections');

function connection(over: Partial<DNSConnection> = {}): DNSConnection {
  return {
    id: 'dns-1',
    kind: 'cloudflare',
    zone: 'example.com',
    state: 'active',
    usable: true,
    created_at: '2026-09-07T10:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  for (const fn of [listDNSConnections, connectDNS, disconnectDNS]) {
    fn.mockReset();
  }
  listDNSConnections.mockResolvedValue([]);
});

describe('CloudflareConnections', () => {
  // A zone holds mail routing and ownership proofs. Somebody handing over a
  // token deserves to know what will and will not be touched.
  it('says what SlideOps will and will not touch before asking for a token', async () => {
    renderInApp(<CloudflareConnections canAdminister />);

    expect(
      await screen.findByText(/only ever changes or removes records it created itself/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/mail and\s+verification records, is left alone/i)).toBeInTheDocument();
  });

  it('keeps the token out of the page after connecting', async () => {
    connectDNS.mockResolvedValue(connection());
    const { container } = renderInApp(<CloudflareConnections canAdminister />);

    await userEvent.type(
      await screen.findByLabelText(/Domain this credential may manage/),
      'example.com',
    );
    await userEvent.type(screen.getByLabelText(/Cloudflare API token/), 'super-secret-token');
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => expect(connectDNS).toHaveBeenCalled());
    expect(container.textContent ?? '').not.toContain('super-secret-token');
  });

  it('says a domain can still be added with no DNS connected', async () => {
    renderInApp(<CloudflareConnections canAdminister />);
    expect(
      await screen.findByText(/show you the exact record to create yourself/i),
    ).toBeInTheDocument();
  });

  it('shows why a credential stopped working', async () => {
    listDNSConnections.mockResolvedValue([
      connection({ usable: false, state: 'invalid', last_error: 'Authentication error' }),
    ]);
    renderInApp(<CloudflareConnections canAdminister />);

    expect(await screen.findByText('Authentication error')).toBeInTheDocument();
  });

  // Disconnecting must not read as "this will break my sites", because it does
  // not: the records already written stay exactly where they are.
  it('says disconnecting leaves existing records alone', async () => {
    listDNSConnections.mockResolvedValue([connection()]);
    renderInApp(<CloudflareConnections canAdminister />);

    await userEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(await screen.findByText(/left exactly where they are/i)).toBeInTheDocument();
    expect(disconnectDNS).not.toHaveBeenCalled();
  });

  it('leaves the controls out for a role that cannot change any of this', async () => {
    listDNSConnections.mockResolvedValue([connection()]);
    renderInApp(<CloudflareConnections canAdminister={false} />);

    await screen.findByText('example.com');
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
    expect(screen.getByText(/requires the Owner or an Admin/i)).toBeInTheDocument();
  });
});
