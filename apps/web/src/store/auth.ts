import { logout as apiLogout, me, type Operator } from '@slideops/api-client';
import { create } from 'zustand';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  operator: Operator | null;
  /** Read the session on boot. Sets authenticated or anonymous, never throws. */
  loadSession: () => Promise<void>;
  /** Record a completed sign in (from register, login, MFA verify, or MFA change). */
  signIn: (operator: Operator) => void;
  /** Sign out on the backend and clear local state, even if the call fails. */
  signOut: () => Promise<void>;
}

/**
 * The single session store for the whole application. Every account is an
 * Operator; the `role` on that Operator decides whether the admin area is
 * reachable. There is one account, one session cookie, and one login, so this
 * store gates the operator area and the admin area alike. The session itself
 * lives in an HttpOnly cookie the backend manages, so nothing sensitive is kept
 * here.
 */
export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  operator: null,
  async loadSession() {
    try {
      const operator = await me();
      set({ status: 'authenticated', operator });
    } catch {
      set({ status: 'anonymous', operator: null });
    }
  },
  signIn(operator) {
    set({ status: 'authenticated', operator });
  },
  async signOut() {
    try {
      await apiLogout();
    } catch {
      // Even if the backend logout call fails, drop the local session so the
      // account is signed out on this device.
    } finally {
      set({ status: 'anonymous', operator: null });
    }
  },
}));

/** Whether the current account carries the admin role. */
export function isAdmin(operator: Operator | null): boolean {
  return operator?.role === 'admin';
}
