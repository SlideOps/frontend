import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { AdminShell, type ActiveKey } from './AdminShell';

/*
 * The admin sidebar gets the same treatment as the Operator one, from the same
 * component, so the two surfaces cannot drift into two different ideas of what
 * a sidebar is. Same guarantees, different destinations.
 */

const api = vi.hoisted(() => ({
  getNavigationPreferences: vi.fn(),
  saveNavigationPreferences: vi.fn(),
}));

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

const structure: { heading: string | null; items: { label: string; path: string }[] }[] = [
  { heading: null, items: [{ label: 'Control Center', path: '/admin' }] },
  {
    heading: 'People section',
    items: [{ label: 'Operators', path: '/admin/operators' }],
  },
  {
    heading: 'Billing section',
    items: [
      { label: 'Subscribers', path: '/admin/subscribers' },
      { label: 'Tiers', path: '/admin/tiers' },
      { label: 'Arrangements', path: '/admin/arrangements' },
      { label: 'Promo Codes', path: '/admin/promo-codes' },
      { label: 'Billing Communications', path: '/admin/billing-communications' },
    ],
  },
  {
    heading: 'Platform section',
    items: [
      { label: 'Operations', path: '/admin/operations' },
      { label: 'Domains', path: '/admin/domains' },
      { label: 'Feature Flags', path: '/admin/feature-flags' },
    ],
  },
  {
    heading: 'Delivery section',
    items: [
      { label: 'Webhooks', path: '/admin/webhooks' },
      { label: 'Email Deliveries', path: '/admin/email-deliveries' },
      { label: 'Rate Limits', path: '/admin/rate-limits' },
    ],
  },
  {
    heading: 'Insight section',
    items: [
      { label: 'Analytics', path: '/admin/analytics' },
      { label: 'Audit', path: '/admin/audit' },
    ],
  },
  {
    heading: 'Controls section',
    items: [{ label: 'Emergency', path: '/admin/emergency' }],
  },
];

function CurrentPath() {
  const location = useLocation();
  return <p>at {location.pathname}</p>;
}

function show(active: ActiveKey = 'overview') {
  return renderInApp(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="*"
          element={
            <AdminShell active={active}>
              <CurrentPath />
            </AdminShell>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function sidebar() {
  return within(screen.getByRole('navigation', { name: 'Admin navigation' }));
}

beforeEach(() => {
  window.localStorage.clear();
  api.getNavigationPreferences.mockReset().mockRejectedValue(new Error('not deployed yet'));
  api.saveNavigationPreferences.mockReset().mockResolvedValue(undefined);
});

describe('the admin sidebar', () => {
  it('opens People, Billing and Platform and leaves Delivery, Insight and Controls closed', () => {
    show();

    for (const open of ['People section', 'Billing section', 'Platform section']) {
      expect(sidebar().getByRole('button', { name: open })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    }
    for (const closed of ['Delivery section', 'Insight section', 'Controls section']) {
      expect(sidebar().getByRole('button', { name: closed })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    }
  });

  for (const group of structure) {
    const where = group.heading ? group.heading.replace(' section', '') : 'the sidebar';
    it(`leads from ${where} to every admin address that part already had`, async () => {
      const operator = userEvent.setup();
      show();

      if (group.heading) {
        const heading = sidebar().getByRole('button', { name: group.heading });
        if (heading.getAttribute('aria-expanded') === 'false') {
          await operator.click(heading);
        }
      }
      for (const destination of group.items) {
        await operator.click(sidebar().getByRole('button', { name: destination.label }));
        expect(screen.getByText(`at ${destination.path}`)).toBeInTheDocument();
      }
    });
  }

  it('keeps the way back to the app out of the admin destinations', async () => {
    const operator = userEvent.setup();
    show();

    const [exit] = screen.getAllByRole('button', { name: 'Exit to app' });
    await operator.click(exit as HTMLElement);
    expect(screen.getByText('at /app')).toBeInTheDocument();
  });

  it('opens the group holding the current page even when that group was collapsed', () => {
    show('audit');

    expect(sidebar().getByRole('button', { name: 'Insight section' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(sidebar().getByRole('button', { name: 'Audit' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('names every destination in full once the sidebar is reduced to an icon rail', async () => {
    const operator = userEvent.setup();
    show();

    await operator.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));

    expect(sidebar().getByRole('button', { name: 'Control Center' })).toBeInTheDocument();
    expect(sidebar().getByRole('button', { name: 'Operators' })).toBeInTheDocument();
    expect(sidebar().getByRole('button', { name: 'Billing section' })).toBeInTheDocument();
  });
});
