import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';

/*
 * History used to say what had run and never where.
 *
 * A row carried a raw Capability key and a timestamp, so on a platform whose
 * point is knowing what happened to which machine, the record could not answer
 * the one question it exists for. The names are resolved by the server; this
 * pins that the screen actually shows them, and still reads sensibly when it
 * cannot.
 */

const operations = [
  {
    id: 'op-1',
    node_id: 'n1',
    project_id: 'p1',
    capability_key: 'disable-server-user',
    capability_name: 'Disable server user',
    node_name: 'contabo vmi cloud VPS 6',
    project_name: 'SlideOps Infra',
    status: 'completed',
    plan: null,
    verification: null,
    error: null,
    created_at: '2026-07-31T09:00:00Z',
    approved_at: null,
    started_at: null,
    completed_at: null,
  },
  {
    id: 'op-2',
    node_id: 'n2',
    capability_key: 'secure-ssh',
    status: 'failed',
    plan: null,
    verification: null,
    error: null,
    created_at: '2026-07-31T08:00:00Z',
    approved_at: null,
    started_at: null,
    completed_at: null,
  },
];

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listOperations: async () => operations,
  deleteOperation: vi.fn(),
}));

const { History } = await import('./History');

describe('History', () => {
  it('names the Capability rather than showing its key', async () => {
    renderInApp(
      <MemoryRouter>
        <History />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Disable server user')).toBeInTheDocument();
    expect(screen.queryByText('disable-server-user')).not.toBeInTheDocument();
  });

  it('says which server and Project it ran against', async () => {
    renderInApp(
      <MemoryRouter>
        <History />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/contabo vmi cloud VPS 6 · SlideOps Infra/)).toBeInTheDocument();
  });

  // A name the server could not resolve must not leave the row blank.
  it('falls back to the key and the time when there are no names', async () => {
    renderInApp(
      <MemoryRouter>
        <History />
      </MemoryRouter>,
    );
    expect(await screen.findByText('secure-ssh')).toBeInTheDocument();
  });
});
