/**
 * useAppState — React hook for monitoring app foreground/background state. (task 14.4)
 *
 * Why a dedicated hook?
 * React Native's AppState API is imperative (event listeners, cleanup).
 * This hook wraps it in a clean React interface so any component can react
 * to state changes without managing subscriptions manually.
 *
 * What uses this hook?
 * - POS screen: pause expensive operations (camera, BT printer scanning) in background
 * - Cart store: persist drafts immediately when app goes to background
 * - Any component needing to know if the user is actively looking at the screen
 *
 * Note on sync triggers:
 * The SyncScheduler already handles "sync on foreground" at the service level.
 * This hook is for UI components that need to respond to state changes for
 * their own purposes (pausing timers, saving drafts, etc.).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppStateResult {
  /** Current app state: "active" | "background" | "inactive" | "unknown" */
  appState: AppStateStatus;
  /** True when the app is in the foreground and visible to the user */
  isActive: boolean;
  /** True when the app is in the background (not visible) */
  isBackground: boolean;
  /**
   * Epoch ms of the most recent transition TO the foreground.
   * Useful for computing "how long were we in the background?"
   */
  lastForegroundAt: number | null;
  /**
   * Epoch ms of the most recent transition TO the background.
   * Useful for showing "session paused" UI after a long absence.
   */
  lastBackgroundAt: number | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to React Native AppState and return structured state.
 *
 * @example
 * ```tsx
 * function PosScreen() {
 *   const { isActive, lastBackgroundAt } = useAppState({
 *     onForeground: () => refetchData(),
 *     onBackground: () => saveCartDraft(),
 *   });
 *
 *   if (!isActive) return <SessionPausedScreen />;
 *   return <ActivePosScreen />;
 * }
 * ```
 */
export function useAppState(options?: {
  /** Called once when the app transitions TO the foreground ("active") */
  onForeground?: () => void;
  /** Called once when the app transitions TO the background */
  onBackground?: () => void;
}): AppStateResult {
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState
  );
  const [lastForegroundAt, setLastForegroundAt] = useState<number | null>(
    AppState.currentState === "active" ? Date.now() : null
  );
  const [lastBackgroundAt, setLastBackgroundAt] = useState<number | null>(null);

  // Use refs for callbacks to avoid recreating the subscription on every render
  // when the parent passes inline arrow functions.
  const onForegroundRef = useRef(options?.onForeground);
  const onBackgroundRef = useRef(options?.onBackground);
  useEffect(() => {
    onForegroundRef.current = options?.onForeground;
    onBackgroundRef.current = options?.onBackground;
  });

  const handleAppStateChange = useCallback(
    (nextState: AppStateStatus) => {
      setAppState((prevState) => {
        // Transition: not-active → active (foreground restore)
        if (nextState === "active" && prevState !== "active") {
          setLastForegroundAt(Date.now());
          onForegroundRef.current?.();
        }

        // Transition: active → background/inactive (goes to background)
        if (nextState !== "active" && prevState === "active") {
          setLastBackgroundAt(Date.now());
          onBackgroundRef.current?.();
        }

        return nextState;
      });
    },
    [] // no dependencies — relies on refs for callbacks
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  return {
    appState,
    isActive: appState === "active",
    isBackground: appState === "background",
    lastForegroundAt,
    lastBackgroundAt,
  };
}
