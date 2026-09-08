import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { Arrangements } from './Arrangements';

/*
 * The arrangements list, rendered against the shapes the API returns.
 *
 * The property under test is the one the console exists for: an admin can see
 * what every customer's access is doing, what they owe, and whether the money
 * arrived, without opening anything. The reading rules themselves are tested as
 * pure logic in arrangements.test.ts; what is tested here is that the screen
 * puts all three on the row and keeps them apart.
 */

const { listAllArrangements } = vi.hoisted(() => ({ listAllArrangements: vi.fn() }));

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listAllArrangements,
}));

const granted = {
  id: 'arr-granted',
  operator_id: 'op-1',
  operator_email: 'chidi@example.test',
  tier: 'pro',
  amount_minor: 15000000,
  currency: 'NGN',
  condition: 'temporary_access',
  status: 'awaiting_payment',
  auto_expire_on_deadline: false,
  created_by_operator_id: 'admin-1',
  created_at: '2026-07-01T00:00:00Z',
  payment_deadline: '2126-09-22T00:00:00Z',
  last_communication_at: '2026-07-04T09:00:00Z',
  updated_at: '2026-07-04T09:00:00Z',
};

const unpriced = {
  id: 'arr-unpriced',
  operator_id: 'op-2',
  operator_email: 'ada@example.test',
  tier: 'starter',
  amount_minor: 0,
  condition: 'payment_required',
  status: 'awaiting_payment',
  auto_expire_on_deadline: false,
  created_by_operator_id: 'admin-1',
  created_at: '2026-07-02T00:00:00Z',
};

const paid = {
  id: 'arr-paid',
  operator_id: 'op-3',
  operator_email: 'bola@example.test',
  tier: 'starter',
  amount_minor: 190000,
  currency: 'USD',
  condition: 'offline_settled',
  status: 'completed',
  auto_expire_on_deadline: false,
  created_by_operator_id: 'admin-1',
  created_at: '2026-07-03T00:00:00Z',
};

beforeEach(() => {
  listAllArrangements.mockReset().mockResolvedValue({
    arrangements: [granted, unpriced, paid],
    limit: 25,
    offset: 0,
    has_more: false,
  });
});

/** Stands in for the detail, so where Manage leads can be asserted. */
function OpenedArrangement() {
  const { id = '' } = useParams();
  return <div>opened {id}</div>;
}

function renderScreen() {
  return renderInApp(
    <MemoryRouter initialEntries={['/admin/arrangements']}>
      <Routes>
        <Route path="/admin/arrangements" element={<Arrangements />} />
        <Route path="/admin/arrangements/:id" element={<OpenedArrangement />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The table row a customer's arrangement is on. */
async function rowFor(email: string): Promise<HTMLElement> {
  const cell = await screen.findByText(email);
  return cell.closest('tr') as HTMLElement;
}

describe('the arrangements list', () => {
  it('shows the amount and the payment state without anything being opened', async () => {
    renderScreen();
    const row = await rowFor('chidi@example.test');
    expect(within(row).getByText(/150,000/)).toBeInTheDocument();
    expect(within(row).getByText('Pending')).toBeInTheDocument();
  });

  it('reads access, payment and what is owed as three separate answers on one row', async () => {
    renderScreen();
    const row = await rowFor('chidi@example.test');

    // All three at once, and they disagree, which is the ordinary shape of
    // temporary access rather than a contradiction.
    expect(within(row).getByText('Active')).toBeInTheDocument();
    expect(within(row).getByText('Pending')).toBeInTheDocument();
    expect(within(row).getByText(/due by/)).toBeInTheDocument();
  });

  it('names an unrecorded amount as unrecorded instead of rendering a zero', async () => {
    renderScreen();
    const row = await rowFor('ada@example.test');
    expect(within(row).getByText('Amount not recorded')).toBeInTheDocument();
    expect(within(row).queryByText(/0\.00/)).not.toBeInTheDocument();
  });

  it('shows each amount in the currency it was agreed in', async () => {
    renderScreen();
    const settled = await rowFor('bola@example.test');
    expect(within(settled).getByText(/1,900/)).toBeInTheDocument();
    expect(within(settled).getByText('Paid')).toBeInTheDocument();
  });

  it('narrows to what is still owed when the unpaid filter is chosen', async () => {
    renderScreen();
    await rowFor('bola@example.test');

    await userEvent.selectOptions(screen.getByLabelText('Filter by lifecycle'), 'unpaid');

    expect(screen.getByText('chidi@example.test')).toBeInTheDocument();
    expect(screen.getByText('ada@example.test')).toBeInTheDocument();
    expect(screen.queryByText('bola@example.test')).not.toBeInTheDocument();
  });

  it('narrows to what was typed into the search, across customer, plan and amount', async () => {
    renderScreen();
    await rowFor('chidi@example.test');

    const search = screen.getByLabelText('Search arrangements');
    await userEvent.type(search, 'bola');
    expect(screen.getByText('bola@example.test')).toBeInTheDocument();
    expect(screen.queryByText('chidi@example.test')).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, '150,000');
    expect(screen.getByText('chidi@example.test')).toBeInTheDocument();
    expect(screen.queryByText('bola@example.test')).not.toBeInTheDocument();
  });

  it('says nothing matched rather than showing an empty table', async () => {
    renderScreen();
    await rowFor('chidi@example.test');
    await userEvent.type(screen.getByLabelText('Search arrangements'), 'nobody at all');
    expect(await screen.findByText('No arrangements found')).toBeInTheDocument();
  });

  it('opens the detail for the arrangement whose Manage was chosen', async () => {
    renderScreen();
    const row = await rowFor('ada@example.test');
    await userEvent.click(within(row).getByRole('button', { name: /Manage the arrangement/ }));
    expect(await screen.findByText('opened arr-unpriced')).toBeInTheDocument();
  });

  it('surfaces a failure to load rather than an empty list', async () => {
    listAllArrangements.mockRejectedValue(new Error('unreachable'));
    renderScreen();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
