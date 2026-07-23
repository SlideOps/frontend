import { adminLogout, adminMe, type Admin } from '@slideops/api-client';
import { create } from 'zustand';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  admin: Admin | null;
  /** Read the session on boot. Sets authenticated or anonymous, never throws. */
  loadSession: () => Promise<void>;
  /** Record a completed sign in (from login or MFA verify). */
  signIn: (admin: Admin) => void;
  /** Sign out on the backend and clear local state, even if the call fails. */
  signOut: () => Promise<void>;
}

/**
 * The Admin session store. Separate from the Operator store because the control
 * plane uses its own endpoints and its own cookie. The session lives in an
 * HttpOnly cookie the backend manages, so nothing sensitive is kept here.
 */
export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  admin: null,
  async loadSession() {
    try {
      const admin = await adminMe();
      set({ status: 'authenticated', admin });
    } catch {
      set({ status: 'anonymous', admin: null });
    }
  },
  signIn(admin) {
    set({ status: 'authenticated', admin });
  },
  async signOut() {
    try {
      await adminLogout();
    } catch {
      // Even if the backend logout call fails, drop the local session so the
      // Admin is signed out on this device.
    } finally {
      set({ status: 'anonymous', admin: null });
    }
  },
}));
