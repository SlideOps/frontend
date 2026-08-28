import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acceptNodeTransfer,
  cancelNodeTransfer,
  declineNodeTransfer,
  getNodeTransferPreview,
  getPendingNodeTransfer,
  initiateNodeTransfer,
  listIncomingNodeTransfers,
} from './nodeTransfers';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('node transfer requests', () => {
  it('initiates a transfer with an email and a message', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(201, {
        transfer: {
          id: 'nt_1',
          node_id: 'node_1',
          to_email: 'client@example.com',
          status: 'pending',
          message: 'enjoy',
          created_at: '2026-08-28T00:00:00Z',
        },
      }),
    );

    const transfer = await initiateNodeTransfer('node_1', 'Client@Example.com', 'enjoy');

    expect(transfer.status).toBe('pending');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    const sent = JSON.parse(String(init?.body)) as { to_email: string; message: string };
    expect(sent).toEqual({ to_email: 'Client@Example.com', message: 'enjoy' });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/nodes/node_1/transfer');
  });

  it('reads the node outstanding transfer', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        transfer: {
          id: 'nt_1',
          node_id: 'node_1',
          to_email: 'client@example.com',
          status: 'pending',
          message: '',
          created_at: '2026-08-28T00:00:00Z',
        },
      }),
    );

    const transfer = await getPendingNodeTransfer('node_1');
    expect(transfer.to_email).toBe('client@example.com');
  });

  it('cancels a pending transfer', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));

    await cancelNodeTransfer('node_1');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('DELETE');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/nodes/node_1/transfer');
  });

  it('reads what a transfer offers without a session', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        node_name: 'client-vps',
        from_workspace_name: 'Agency',
        message: 'here you go',
      }),
    );

    const preview = await getNodeTransferPreview('tok_abc');
    expect(preview.node_name).toBe('client-vps');
  });

  it('accepts a transfer, defaulting to no destination workspace', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        transfer: {
          id: 'nt_1',
          node_id: 'node_1',
          to_email: 'client@example.com',
          status: 'accepted',
          message: '',
          created_at: '2026-08-28T00:00:00Z',
          decided_at: '2026-08-28T00:05:00Z',
        },
      }),
    );

    const transfer = await acceptNodeTransfer('tok_abc');

    expect(transfer.status).toBe('accepted');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    const sent = JSON.parse(String(init?.body)) as { workspace_id: string };
    expect(sent.workspace_id).toBe('');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/node-transfers/tok_abc/accept');
  });

  it('accepts a transfer into a chosen workspace', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        transfer: {
          id: 'nt_1',
          node_id: 'node_1',
          to_email: 'client@example.com',
          status: 'accepted',
          message: '',
          created_at: '2026-08-28T00:00:00Z',
        },
      }),
    );

    await acceptNodeTransfer('tok_abc', 'ws_9');

    const init = fetchMock.mock.calls[0]?.[1];
    const sent = JSON.parse(String(init?.body)) as { workspace_id: string };
    expect(sent.workspace_id).toBe('ws_9');
  });

  it('declines a transfer', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));

    await declineNodeTransfer('tok_abc');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/node-transfers/tok_abc/decline');
  });

  it('lists transfers waiting for the signed in email', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        transfers: [
          {
            token: 'tok_abc',
            node_name: 'client-vps',
            from_workspace_name: 'Agency',
            message: '',
            created_at: '2026-08-28T00:00:00Z',
          },
        ],
      }),
    );

    const transfers = await listIncomingNodeTransfers();
    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.node_name).toBe('client-vps');
  });
});
