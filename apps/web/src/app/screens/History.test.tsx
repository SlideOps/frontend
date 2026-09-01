import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';

/*
 * History used to say what had run and never where.
 *
 * A row carried a raw Capability key and a timestamp, so on a platform whose
 * point is knowing what happened to which machine, the record could not answer
 * the one question it exists for. The names are resolved by the server; this
 * pins that the screen actually shows them, and still reads sensibly when it
 * cannot.
 *
 * It also used to load every Operation an account had ever run in one
 * request, with no way to see more or less of it. listOperationsPage is what
 * the list itself now reads, one bounded page at a time; listOperations
 * stays the small, unbounded, always-current source for the "required
 * actions" badge, which must not undercount just because the list below it
 * is paginated.
 */

const opA = {
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
};

const opB = {
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
};

const listOperations = vi.fn();
const listOperationsPage = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listOperations: (...a: unknown[]) => listOperations(...a),
  listOperationsPage: (...a: unknown[]) => listOperationsPage(...a),
  deleteOperation: vi.fn(),
}));

const { History } = await import('./History');

function show() {
  return renderInApp(
    <MemoryRouter>
      <History />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listOperations.mockReset().mockResolvedValue([]);
  listOperationsPage.mockReset().mockResolvedValue({ operations: [opA, opB], hasMore: false });
});

describe('History', () => {
  it('names the Capability rather than showing its key', async () => {
    show();
    expect(await screen.findByText('Disable server user')).toBeInTheDocument();
    expect(screen.queryByText('disable-server-user')).not.toBeInTheDocument();
  });

  it('says which server and Project it ran against', async () => {
    show();
    expect(await screen.findByText(/contabo vmi cloud VPS 6 · SlideOps Infra/)).toBeInTheDocument();
  });

  // A name the server could not resolve must not leave the row blank.
  it('falls back to the key and the time when there are no names', async () => {
    show();
    expect(await screen.findByText('secure-ssh')).toBeInTheDocument();
  });
});

describe('History pagination', () => {
  it('offers Load more only when the backend says there is a next page, and appends it', async () => {
    listOperationsPage
      .mockReset()
      .mockResolvedValueOnce({ operations: [opA], hasMore: true })
      .mockResolvedValueOnce({ operations: [opB], hasMore: false });

    show();

    await screen.findByText('Disable server user');
    expect(screen.queryByText('secure-ssh')).not.toBeInTheDocument();

    const loadMore = await screen.findByRole('button', { name: 'Load more' });
    const operator = userEvent.setup();
    await operator.click(loadMore);

    expect(await screen.findByText('secure-ssh')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(listOperationsPage).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1 }));
  });

  it('offers no Load more button when the first page is already everything', async () => {
    listOperationsPage.mockReset().mockResolvedValue({ operations: [opA, opB], hasMore: false });

    show();

    await screen.findByText('Disable server user');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('starts a fresh first page, not an appended one, when the filter changes', async () => {
    listOperationsPage.mockReset().mockResolvedValue({ operations: [opA], hasMore: false });

    show();
    await screen.findByText('Disable server user');
    listOperationsPage.mockClear();

    const operator = userEvent.setup();
    await operator.click(screen.getByRole('button', { name: 'Completed' }));

    expect(await screen.findByText('Disable server user')).toBeInTheDocument();
    const [args] = listOperationsPage.mock.calls.at(-1) ?? [];
    expect(args).toMatchObject({ status: 'completed' });
    expect(args?.offset).toBeUndefined();
  });
});
