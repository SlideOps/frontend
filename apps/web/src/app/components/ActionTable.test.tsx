import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderInApp } from '../../test/render';
import { HardDrive } from '@slideops/icons';
import type { ActionTable as ActionTableResult } from '@slideops/api-client';

/*
 * The one flat table shape shared by web, messaging, search, runtime, and
 * networking's Stage E panels. This exercises the shared mechanism directly
 * rather than through every thin per-category wrapper, since the wrappers
 * only supply labels and an Action key.
 */

const runCapabilityAction = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runCapabilityAction: (...args: unknown[]) => runCapabilityAction(...args),
}));

const { ActionTable } = await import('./ActionTable');

function table(overrides: Partial<ActionTableResult> = {}): ActionTableResult {
  return { columns: ['Name', 'Value'], rows: [], ...overrides };
}

function show() {
  return renderInApp(
    <MemoryRouter>
      <ActionTable
        capabilityKey="install-meilisearch"
        actionKey="list-indexes"
        nodeId="n1"
        icon={HardDrive}
        loadingLabel="Reading"
        emptyTitle="Nothing yet"
        emptyDescription="Nothing here yet."
      />
    </MemoryRouter>,
  );
}

describe('ActionTable', () => {
  beforeEach(() => {
    runCapabilityAction.mockReset();
  });

  it('renders the rows a read Action returns', async () => {
    runCapabilityAction.mockResolvedValue(
      table({ rows: [['movies', '42'], ['books', '7']] }),
    );
    show();
    expect(await screen.findByText('movies')).toBeInTheDocument();
    expect(screen.getByText('books')).toBeInTheDocument();
    expect(runCapabilityAction).toHaveBeenCalledWith('install-meilisearch', 'list-indexes', {
      node_id: 'n1',
      service_id: undefined,
      parameters: undefined,
    });
  });

  it('shows the empty state the backend supplies when there is nothing', async () => {
    runCapabilityAction.mockResolvedValue(table({ empty: 'No indexes exist on this server yet.' }));
    show();
    expect(await screen.findByText('No indexes exist on this server yet.')).toBeInTheDocument();
  });

  it('filters rows client side across every column', async () => {
    runCapabilityAction.mockResolvedValue(table({ rows: [['movies', '42'], ['books', '7']] }));
    const operator = userEvent.setup();
    show();

    await screen.findByText('movies');
    await operator.type(screen.getByRole('searchbox'), '42');
    expect(screen.queryByText('books')).toBeNull();
    expect(screen.getByText('movies')).toBeInTheDocument();
  });

  it('opens a row in the drawer with its full record', async () => {
    runCapabilityAction.mockResolvedValue(table({ rows: [['movies', '42']] }));
    const operator = userEvent.setup();
    show();

    await operator.click(await screen.findByText('movies'));
    await waitFor(() => expect(screen.getAllByText('Name').length).toBeGreaterThan(0));
    expect(screen.getAllByText('movies').length).toBeGreaterThan(1);
  });

  it('refreshes on demand', async () => {
    runCapabilityAction.mockResolvedValue(table({ rows: [['movies', '42']] }));
    const operator = userEvent.setup();
    show();

    await screen.findByText('movies');
    await operator.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(runCapabilityAction).toHaveBeenCalledTimes(2));
  });

  it('shows the backend error plainly when the read fails', async () => {
    runCapabilityAction.mockRejectedValue(new Error('boom'));
    show();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
