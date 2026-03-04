/**
 * BizPilot Mobile POS — Auto-Logout Hook
 *
 * Tracks user inactivity and automatically logs out after
 * the configured timeout period.
 *
 * Why auto-logout?
 * POS terminals are shared devices in public spaces. If a cashier
 * walks away, the next person shouldn't have access to the previous
 * user's session. Auto-logout after inactivity prevents unauthorized
 * access to financial operations.
 *
 * How it works:
 * 1. Records the timestamp of the last user interaction
 * 2. Runs a periodic check (every 60s) comparing elapsed time
 * 3. If elapsed > configured timeout, clears auth and navigates to login
 * 4. The timer resets on every touch/press event
 */

import { useEffect, useRef, useCallback } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { logout } from "@/services/auth/AuthService";
import { logger } from "@/utils/logger";

/** How often to check for inactivity (ms) */
const CHECK_INTERVAL_MS = 60_000;

/**
 * Hook that auto-logs out the user after a period of inactivity.
 *
 * Call this once in the root authenticated layout. It will:
 * - Track the last activity timestamp
 * - Check periodically if the user has been inactive too long
 * - Log out and redirect to the auth screen if the timeout is exceeded
 *
 * @returns resetTimer — call this on any user interaction to reset the countdown
 */
export function useAutoLogout(): { resetTimer: () => void } {
  const lastActivityRef = useRef<number>(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAuth = useAuthStore((s) => s.clearAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const autoLogoutMinutes = useSettingsStore((s) => s.autoLogoutMinutes);

  /**
   * Reset the inactivity timer.
   * Call this from touch handlers, button presses, or navigation events.
   */
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  /**
   * Perform the auto-logout sequence.
   */
  const performAutoLogout = useCallback(async () => {
    logger.info("auth", "Auto-logout triggered due to inactivity", {
      timeoutMinutes: autoLogoutMinutes,
    });

    try {
      await logout();
    } catch {
      // Ignore logout errors — we're clearing state regardless
    }

    clearAuth();
    router.replace("/(auth)/login");
  }, [clearAuth, autoLogoutMinutes]);

  // Periodic inactivity check
  useEffect(() => {
    // Auto-logout disabled if set to 0
    if (autoLogoutMinutes <= 0 || !isAuthenticated) return;

    const timeoutMs = autoLogoutMinutes * 60 * 1000;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= timeoutMs) {
        performAutoLogout();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoLogoutMinutes, isAuthenticated, performAutoLogout]);

  // Also check on app foreground (user might have backgrounded the app)
  useEffect(() => {
    if (autoLogoutMinutes <= 0 || !isAuthenticated) return;

    const timeoutMs = autoLogoutMinutes * 60 * 1000;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= timeoutMs) {
          performAutoLogout();
        }
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => subscription.remove();
  }, [autoLogoutMinutes, isAuthenticated, performAutoLogout]);

  return { resetTimer };
}

export default useAutoLogout;
