import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderInApp } from '../test/render';
import { RequireAdmin } from './RequireAdmin';
import { useAuthStore } from '../store/auth';

/*
 * The gate on the admin area.
 *
 * An administrator opened /admin, every panel called the API, every call came
 * back 403 "enable multi factor authentication to use the admin area", and each
 * screen rendered that as its own failure. What they saw was an admin area where
 * nothing worked and a message naming something they were given no way to reach:
 * the setting was on the Security page the whole time, one click away and
 * mentioned nowhere.
 *
 * So the requirement is stated before anything loads, with the way to satisfy it
 * attached.
 */

type Operator = NonNullable<ReturnType<typeof useAuthStore.getState>['operator']>;

function signedInAs(over: Partial<Operator>) {
  useAuthStore.setState({
    status: 'authenticated',
    operator: {
      id: 'op-1',
      email: 'admin@example.test',
      role: 'admin',
      tier: 'enterprise',
      mfa_enabled: true,
      created_at: '2026-07-01T00:00:00Z',
      ...over,
    } as Operator,
  });
}

function show() {
  return renderInApp(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<RequireAdmin />}>
          <Route index element={<div>the control plane</div>} />
        </Route>
        <Route path="/app" element={<div>the app</div>} />
        <Route path="/app/security" element={<div>security page</div>} />
        <Route path="/login" element={<div>sign in</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ status: 'authenticated', operator: null });
});

describe('RequireAdmin', () => {
  it('opens for an admin with two step verification on', () => {
    signedInAs({ mfa_enabled: true });
    show();
    expect(screen.getByText('the control plane')).toBeInTheDocument();
  });

  /*
   * The whole point. Without this the area opens and every panel fails
   * separately, which reads as "admin is broken" rather than "you need one more
   * thing first".
   */
  it('says what is needed, and where, when two step verification is off', () => {
    signedInAs({ mfa_enabled: false });
    show();

    expect(screen.queryByText('the control plane')).not.toBeInTheDocument();
    expect(screen.getByText(/two step verification is required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /turn it on/i })).toBeInTheDocument();
  });

  it('leaves a way out that is not the browser back button', () => {
    signedInAs({ mfa_enabled: false });
    show();
    expect(screen.getByRole('button', { name: /back to the app/i })).toBeInTheDocument();
  });

  // The role check comes first: somebody who is not an admin at all should not
  // be told to configure two step verification.
  it('turns away a non admin without mentioning two step verification', () => {
    signedInAs({ role: 'operator', mfa_enabled: false });
    show();
    expect(screen.getByText('the app')).toBeInTheDocument();
    expect(screen.queryByText(/two step verification/i)).not.toBeInTheDocument();
  });

  it('sends an anonymous visitor to sign in', () => {
    useAuthStore.setState({ status: 'anonymous', operator: null });
    show();
    expect(screen.getByText('sign in')).toBeInTheDocument();
  });
});
