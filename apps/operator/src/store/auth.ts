import { logout as apiLogout, me, type Operator } from '@slideops/api-client';
import { create } from 'zustand';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  operator: Operator | null;
  /** Read the session on boot. Sets authenticated or anonymous, never throws. */
  loadSession: () => Promise<void>;
  /** Record a completed sign in (from login or MFA verify). */
  signIn: (operator: Operator) => void;
  /** Sign out on the backend and clear local state, even if the call fails. */
  signOut: () => Promise<void>;
}

/**
 * The Operator session store. It holds the minimum needed to gate routes: the
 * status and the current Operator. The session itself lives in an HttpOnly
 * cookie the backend manages, so nothing sensitive is kept here.
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
      // Operator is signed out on this device.
    } finally {
      set({ status: 'anonymous', operator: null });
    }
  },
}));
