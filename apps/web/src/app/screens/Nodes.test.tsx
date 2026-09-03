import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Node } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

/*
 * The Nodes list has no search or grouping of its own; an Operator with more
 * than a handful of servers has to read the whole list to find one. Tags
 * already exist end to end, just unused here, so search and a group-by-tag
 * toggle are built on top of them rather than a new schema concept.
 */

const web1: Node = {
  id: 'n1',
  name: 'web-1',
  hostname: '',
  address: '10.0.0.5',
  port: 22,
  ssh_username: 'deploy',
  auth_kind: 'private_key',
  ssh_key_id: null,
  project_id: null,
  os: null,
  distro: null,
  distro_version: null,
  status: 'reachable',
  tags: ['production'],
  last_discovered_at: null,
  created_at: '2026-07-30T22:12:00Z',
};

const db1: Node = {
  ...web1,
  id: 'n2',
  name: 'db-1',
  address: '10.0.0.6',
  tags: ['production', 'database'],
};

const staging1: Node = {
  ...web1,
  id: 'n3',
  name: 'staging-1',
  address: '10.0.0.7',
  tags: ['staging'],
};

const untagged: Node = {
  ...web1,
  id: 'n4',
  name: 'scratch-1',
  address: '10.0.0.8',
  tags: [],
};

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listNodes: async () => [web1, db1, staging1, untagged],
}));

const { Nodes } = await import('./Nodes');

function renderList() {
  return renderInApp(
    <MemoryRouter>
      <Nodes />
    </MemoryRouter>,
  );
}

describe('Nodes list', () => {
  it('shows every Node with no search term', async () => {
    renderList();
    expect(await screen.findByText('web-1')).toBeInTheDocument();
    expect(screen.getByText('db-1')).toBeInTheDocument();
    expect(screen.getByText('staging-1')).toBeInTheDocument();
    expect(screen.getByText('scratch-1')).toBeInTheDocument();
  });

  it('filters by name', async () => {
    renderList();
    await screen.findByText('web-1');
    await userEvent.type(screen.getByPlaceholderText('Search by name, address, or tag'), 'web');
    expect(screen.getByText('web-1')).toBeInTheDocument();
    expect(screen.queryByText('db-1')).not.toBeInTheDocument();
    expect(screen.queryByText('staging-1')).not.toBeInTheDocument();
  });

  it('filters by tag, not just name or address', async () => {
    renderList();
    await screen.findByText('web-1');
    await userEvent.type(screen.getByPlaceholderText('Search by name, address, or tag'), 'database');
    expect(screen.getByText('db-1')).toBeInTheDocument();
    expect(screen.queryByText('web-1')).not.toBeInTheDocument();
  });

  it('says plainly when nothing matches, rather than showing an empty list', async () => {
    renderList();
    await screen.findByText('web-1');
    await userEvent.type(
      screen.getByPlaceholderText('Search by name, address, or tag'),
      'nothing-matches-this',
    );
    expect(await screen.findByText(/No servers match/)).toBeInTheDocument();
  });

  it('groups by first tag when the toggle is on, with untagged Nodes last', async () => {
    renderList();
    await screen.findByText('web-1');
    await userEvent.click(screen.getByLabelText('Group by tag'));

    // Narrowed to the group heading's own class so the tag chips rendered on
    // each row (which repeat the same text) are not also picked up.
    const headings = screen.getAllByText(/^(production|staging|Ungrouped)$/i, {
      selector: '.uppercase',
    });
    const order = headings.map((el) => el.textContent);
    expect(order).toEqual(['production', 'staging', 'Ungrouped']);

    // db-1 groups under its first tag, "production", alongside web-1 -- not
    // under "database", its second tag.
    const productionHeading = screen.getByText('production', { selector: '.uppercase' });
    const productionSection = productionHeading.closest('div');
    expect(productionSection?.textContent).toContain('web-1');
    expect(productionSection?.textContent).toContain('db-1');
  });
});
