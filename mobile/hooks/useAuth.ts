/**
 * BizPilot Mobile POS — useAuth Hook
 *
 * Provides authentication state and actions to components.
 * Wraps the Zustand auth store with convenience methods.
 *
 * Why a hook instead of using the store directly?
 * Components shouldn't know about store implementation details.
 * This hook provides a stable, tested API that we can refactor
 * without touching every screen.
 */

import { useCallback } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { login as authServiceLogin, logout as authServiceLogout, restoreSession } from "@/services/auth/AuthService";
import type { MobileUser } from "@/types";

interface UseAuthReturn {
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Current user, or null */
  user: MobileUser | null;
  /** Login with email and password */
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  /** Sign out and navigate to login screen */
  logout: () => Promise<void>;
  /** Restore session from secure storage on app startup */
  restore: () => Promise<boolean>;
}

export function useAuth(): UseAuthReturn {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authServiceLogin(email, password);

      if (result.success && result.user) {
        const mobileUser: MobileUser = {
          id: result.user.id,
          remoteId: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          pinHash: null,
          role: result.user.role as MobileUser["role"],
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          syncedAt: Date.now(),
        };

        setAuth(mobileUser, "token", "refreshToken");
        return { success: true };
      }

      return { success: false, error: result.error ?? "Login failed" };
    },
    [setAuth]
  );

  const logout = useCallback(async () => {
    await authServiceLogout();
    clearAuth();
    router.replace("/(auth)/login");
  }, [clearAuth]);

  const restore = useCallback(async () => {
    const result = await restoreSession();
    if (result.success && result.user) {
      const mobileUser: MobileUser = {
        id: result.user.id,
        remoteId: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        pinHash: null,
        role: result.user.role as MobileUser["role"],
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncedAt: Date.now(),
      };

      setAuth(mobileUser, "token", "refreshToken");
      return true;
    }
    return false;
  }, [setAuth]);

  return { isAuthenticated, user, login, logout, restore };
}
