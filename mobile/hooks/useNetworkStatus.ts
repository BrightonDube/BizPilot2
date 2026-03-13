/**
 * BizPilot Mobile POS — useNetworkStatus Hook
 *
 * Monitors device network connectivity and updates the sync store.
 *
 * Why a dedicated hook instead of inline NetInfo calls?
 * Network status is needed across multiple screens and services.
 * This hook centralizes the listener and cleanup, preventing
 * memory leaks from duplicate subscriptions.
 *
 * Why @react-native-community/netinfo?
 * It's the de facto standard for RN network monitoring, supports
 * all platforms, and provides connection type info (wifi/cellular).
 */

import { useEffect, useRef } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useSyncStore } from "@/stores/syncStore";

/**
 * Sets up a network connectivity listener.
 * Call this once in the root layout — it auto-cleans up on unmount.
 *
 * Behavior:
 * - Updates syncStore.isOnline on every connectivity change
 * - Debounces rapid toggles (e.g., tunnel switching) by 500ms
 */
export function useNetworkStatus(): void {
  const setOnline = useSyncStore((s) => s.setOnline);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleNetworkChange = (state: NetInfoState) => {
      // Debounce rapid toggles (e.g., switching between wifi and cellular)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        const isConnected = state.isConnected ?? false;
        setOnline(isConnected);
      }, 500);
    };

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    // Also fetch initial state immediately
    NetInfo.fetch().then(handleNetworkChange);

    return () => {
      unsubscribe();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [setOnline]);
}
