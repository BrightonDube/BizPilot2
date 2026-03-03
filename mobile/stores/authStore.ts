/**
 * BizPilot Mobile POS — Auth Zustand Store
 *
 * Global authentication state. Drives navigation (auth vs tabs)
 * and provides the current user to all screens.
 *
 * Why Zustand over React Context for auth?
 * Zustand doesn't cause re-renders of the entire component tree
 * when auth state changes. Only components that select specific
 * slices (e.g., `useAuthStore(s => s.user)`) re-render.
 * This matters for POS performance — we don't want the product
 * grid to re-render when the sync status changes.
 */

import { create } from "zustand";
import type { MobileUser, AuthState } from "@/types";

interface AuthStore extends AuthState {
  /** Set authentication state after successful login */
  setAuth: (user: MobileUser, token: string, refreshToken: string) => void;
  /** Clear auth state on logout */
  clearAuth: () => void;
  /** Set the PIN-authenticated user for quick-login sessions */
  setPinUser: (user: MobileUser | null) => void;
  /** Update the access token (after refresh) */
  updateToken: (token: string) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  // Initial state — unauthenticated
  isAuthenticated: false,
  user: null,
  token: null,
  refreshToken: null,
  pinUser: null,

  setAuth: (user, token, refreshToken) =>
    set({
      isAuthenticated: true,
      user,
      token,
      refreshToken,
    }),

  clearAuth: () =>
    set({
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      pinUser: null,
    }),

  setPinUser: (user) => set({ pinUser: user }),

  updateToken: (token) => set({ token }),
}));
