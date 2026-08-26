import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderInApp } from '../../test/render';

/*
 * The visual Database Explorer: a Tree of what a server holds, a page of the
 * selected table or collection beside it, searchable. What is pinned here is
 * that each engine's shape reaches the right Action with the right
 * parameters, since that mapping is the one thing an Operator cannot see go
 * wrong from the screen alone.
 */

const runCapabilityAction = vi.fn();
const downloadCapabilityAction = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runCapabilityAction: (...args: unknown[]) => runCapabilityAction(...args),
  downloadCapabilityAction: (...args: unknown[]) => downloadCapabilityAction(...args),
}));

const { DatabaseExplorer, isExplorableDatabase } = await import('./DatabaseExplorer');

function show(capabilityKey: string, extra: { serviceId?: string } = {}) {
  return renderInApp(
    <MemoryRouter>
      <DatabaseExplorer capabilityKey={capabilityKey} nodeId="n1" serviceId={extra.serviceId} />
    </MemoryRouter>,
  );
}

describe('isExplorableDatabase', () => {
  it('recognizes every database engine and nothing else', () => {
    expect(isExplorableDatabase('install-postgresql')).toBe(true);
    expect(isExplorableDatabase('install-mysql')).toBe(true);
    expect(isExplorableDatabase('install-mariadb')).toBe(true);
    expect(isExplorableDatabase('install-mongodb')).toBe(true);
    expect(isExplorableDatabase('install-redis')).toBe(true);
    expect(isExplorableDatabase('install-nginx')).toBe(false);
  });
});

describe('DatabaseExplorer, PostgreSQL shaped engines', () => {
  beforeEach(() => {
    runCapabilityAction.mockReset();
    downloadCapabilityAction.mockReset().mockResolvedValue(undefined);
  });

  it('renders nothing for a Capability it does not know how to explore', () => {
    const { container } = show('install-nginx');
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the server\'s databases as the top level of the Tree', async () => {
    runCapabilityAction.mockResolvedValue({
      columns: ['Database', 'Size'],
      rows: [['app', '8 MB'], ['analytics', '2 MB']],
    });
    show('install-postgresql');

    expect(await screen.findByText('app')).toBeInTheDocument();
    expect(screen.getByText('analytics')).toBeInTheDocument();
    expect(runCapabilityAction).toHaveBeenCalledWith('install-postgresql', 'list-databases', {
      node_id: 'n1',
      service_id: undefined,
      parameters: {},
    });
  });

  it('lists tables once a database is expanded, and browses a table once picked', async () => {
    runCapabilityAction.mockImplementation((_key: string, action: string) => {
      if (action === 'list-databases') {
        return Promise.resolve({ columns: ['Database'], rows: [['app']] });
      }
      if (action === 'list-tables') {
        return Promise.resolve({ columns: ['Table', 'Rows'], rows: [['users', '3']] });
      }
      if (action === 'browse-rows') {
        return Promise.resolve({
          columns: ['id', 'email'],
          rows: [['1', 'a@example.test']],
        });
      }
      return Promise.resolve({ columns: [], rows: [] });
    });
    const operator = userEvent.setup();
    show('install-postgresql');

    await operator.click(await screen.findByText('app'));
    expect(await screen.findByText('users')).toBeInTheDocument();

    await operator.click(screen.getByText('users'));
    await waitFor(() =>
      expect(runCapabilityAction).toHaveBeenCalledWith('install-postgresql', 'browse-rows', {
        node_id: 'n1',
        service_id: undefined,
        parameters: { limit: '50', offset: '0', database: 'app', table: 'users' },
      }),
    );
    expect(await screen.findByText('a@example.test')).toBeInTheDocument();
  });

  it('searches by narrowing the search parameter, and resets to the first page', async () => {
    runCapabilityAction.mockImplementation((_key: string, action: string) => {
      if (action === 'list-databases') return Promise.resolve({ columns: [], rows: [['app']] });
      if (action === 'list-tables') return Promise.resolve({ columns: [], rows: [['users']] });
      return Promise.resolve({ columns: ['id'], rows: [['1']] });
    });
    const operator = userEvent.setup();
    show('install-postgresql');

    await operator.click(await screen.findByText('app'));
    await operator.click(await screen.findByText('users'));
    await screen.findByRole('searchbox');

    await operator.type(screen.getByRole('searchbox'), 'a');
    await waitFor(() =>
      expect(runCapabilityAction).toHaveBeenCalledWith(
        'install-postgresql',
        'browse-rows',
        expect.objectContaining({ parameters: expect.objectContaining({ search: 'a', offset: '0' }) }),
      ),
    );
  });

  it('opens a row in the Drawer on click', async () => {
    runCapabilityAction.mockImplementation((_key: string, action: string) => {
      if (action === 'list-databases') return Promise.resolve({ columns: [], rows: [['app']] });
      if (action === 'list-tables') return Promise.resolve({ columns: [], rows: [['users']] });
      return Promise.resolve({ columns: ['id', 'email'], rows: [['1', 'a@example.test']] });
    });
    const operator = userEvent.setup();
    show('install-postgresql');

    await operator.click(await screen.findByText('app'));
    await operator.click(await screen.findByText('users'));
    await operator.click(await screen.findByText('a@example.test'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('a@example.test')).toBeInTheDocument();
  });

  it('exports the selected database, scoped to the Service when given one', async () => {
    runCapabilityAction.mockImplementation((_key: string, action: string) => {
      if (action === 'list-databases') return Promise.resolve({ columns: [], rows: [['app']] });
      if (action === 'list-tables') return Promise.resolve({ columns: [], rows: [['users']] });
      return Promise.resolve({ columns: ['id'], rows: [] });
    });
    const operator = userEvent.setup();
    show('install-postgresql', { serviceId: 'svc-1' });

    await operator.click(await screen.findByText('app'));
    await operator.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() =>
      expect(downloadCapabilityAction).toHaveBeenCalledWith('install-postgresql', 'export-database', {
        node_id: 'n1',
        service_id: 'svc-1',
        parameters: { database: 'app' },
      }),
    );
  });
});

describe('DatabaseExplorer, MongoDB', () => {
  beforeEach(() => {
    runCapabilityAction.mockReset();
  });

  it('lists collections rather than tables, and filters rather than searches', async () => {
    runCapabilityAction.mockImplementation((_key: string, action: string) => {
      if (action === 'list-databases') return Promise.resolve({ columns: [], rows: [['app']] });
      if (action === 'list-collections') return Promise.resolve({ columns: [], rows: [['users']] });
      return Promise.resolve({ columns: ['Document'], rows: [['{"_id":1}']] });
    });
    const operator = userEvent.setup();
    show('install-mongodb');

    await operator.click(await screen.findByText('app'));
    await operator.click(await screen.findByText('users'));

    expect(await screen.findByRole('searchbox', { name: 'Filter, as JSON' })).toBeInTheDocument();
    // Curly braces are userEvent's own key syntax ({enter}, {shift}, ...), so a
    // literal brace has to be escaped by doubling it.
    await operator.type(screen.getByRole('searchbox'), '{{"a":1}}');
    await waitFor(() =>
      expect(runCapabilityAction).toHaveBeenCalledWith(
        'install-mongodb',
        'browse-documents',
        expect.objectContaining({ parameters: expect.objectContaining({ filter: '{"a":1}', collection: 'users' }) }),
      ),
    );
  });
});

describe('DatabaseExplorer, Redis', () => {
  beforeEach(() => {
    runCapabilityAction.mockReset();
  });

  it('has no second level: picking a keyspace browses it directly', async () => {
    runCapabilityAction.mockImplementation((_key: string, action: string) => {
      if (action === 'list-databases') return Promise.resolve({ columns: [], rows: [['db0']] });
      return Promise.resolve({ columns: ['Key', 'Type', 'TTL'], rows: [['session:1', 'string', '100']] });
    });
    const operator = userEvent.setup();
    show('install-redis');

    await operator.click(await screen.findByText('db0'));
    await waitFor(() =>
      expect(runCapabilityAction).toHaveBeenCalledWith(
        'install-redis',
        'list-keys',
        expect.objectContaining({ parameters: expect.objectContaining({ database: '0' }) }),
      ),
    );
    expect(await screen.findByText('session:1')).toBeInTheDocument();
  });

  it('offers no Export, since a live Redis has no consistent snapshot to take', async () => {
    runCapabilityAction.mockResolvedValue({ columns: [], rows: [['db0']] });
    const operator = userEvent.setup();
    show('install-redis');

    await operator.click(await screen.findByText('db0'));
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });
});
