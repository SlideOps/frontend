import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../test/render';
import { RequireAuth } from './RequireAuth';
import { useAuthStore } from '../store/auth';

/*
 * The gate on the signed-in area, and the one place planned maintenance is
 * enforced on the Operator side: a non-admin sees the maintenance page in
 * place of the app while it is on, but an Admin always passes through, since
 * the one account that can turn maintenance back off must never be the one
 * locked out by it.
 */

type Operator = NonNullable<ReturnType<typeof useAuthStore.getState>['operator']>;

function signedInAs(over: Partial<Operator>) {
  useAuthStore.setState({
    status: 'authenticated',
    operator: {
      id: 'op-1',
      email: 'someone@example.test',
      role: 'operator',
      tier: 'starter',
      mfa_enabled: true,
      created_at: '2026-07-01T00:00:00Z',
      ...over,
    } as Operator,
  });
}

function show() {
  return renderInApp(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route path="/app" element={<RequireAuth />}>
          <Route index element={<div>the app</div>} />
        </Route>
        <Route path="/login" element={<div>sign in</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ status: 'authenticated', operator: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RequireAuth', () => {
  it('opens the app when maintenance is off', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ maintenance: false }), { status: 200 }),
    );
    signedInAs({ role: 'operator' });
    show();
    expect(await screen.findByText('the app')).toBeInTheDocument();
  });

  it('shows the maintenance page to a non-admin while maintenance is on', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ maintenance: true }), { status: 200 }),
    );
    signedInAs({ role: 'operator' });
    show();
    await waitFor(() => {
      expect(screen.getByText(/SlideOps is in maintenance/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('the app')).not.toBeInTheDocument();
  });

  it('never holds an admin back, even while maintenance is on', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ maintenance: true }), { status: 200 }),
    );
    signedInAs({ role: 'admin' });
    show();
    expect(await screen.findByText('the app')).toBeInTheDocument();
    expect(screen.queryByText(/SlideOps is in maintenance/i)).not.toBeInTheDocument();
  });

  it('sends an anonymous visitor to sign in without ever checking maintenance', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    useAuthStore.setState({ status: 'anonymous', operator: null });
    show();
    expect(screen.getByText('sign in')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
