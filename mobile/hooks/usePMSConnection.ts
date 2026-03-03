/**
 * BizPilot Mobile POS — usePMSConnection Hook
 *
 * Monitors PMS connection status and exposes connection health.
 *
 * Why poll instead of push?
 * PMS APIs (Opera, Protel, etc.) don't support WebSocket connections
 * for health monitoring. We poll the backend's cached status at a
 * reasonable interval (30s) to keep the UI indicator accurate.
 */

import { useEffect, useCallback, useRef } from "react";
import { usePMSStore } from "@/stores/pmsStore";
import { useSyncStore } from "@/stores/syncStore";
import type { PMSConnectionStatus } from "@/types/pms";

const HEALTH_CHECK_INTERVAL_MS = 30_000;

/**
 * Monitors PMS connection status and updates the pmsStore.
 *
 * @returns Connection status, isEnabled flag, and a manual check function.
 */
export function usePMSConnection() {
  const connectionStatus = usePMSStore((s) => s.connectionStatus);
  const isEnabled = usePMSStore((s) => s.isEnabled);
  const lastError = usePMSStore((s) => s.lastError);
  const setConnectionStatus = usePMSStore((s) => s.setConnectionStatus);
  const setLastError = usePMSStore((s) => s.setLastError);
  const isOnline = useSyncStore((s) => s.isOnline);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkConnection = useCallback(async () => {
    if (!isEnabled || !isOnline) {
      setConnectionStatus(isOnline ? "disconnected" : "disconnected");
      return;
    }

    try {
      // TODO: Replace with actual API call when backend PMS endpoints exist
      // const response = await apiClient.get("/pms/status");
      // setConnectionStatus(response.data.status);

      // For now, simulate connected when online
      setConnectionStatus("connected");
      setLastError(null);
    } catch (error) {
      setConnectionStatus("error");
      setLastError(error instanceof Error ? error.message : "PMS health check failed");
    }
  }, [isEnabled, isOnline, setConnectionStatus, setLastError]);

  // Poll for connection status
  useEffect(() => {
    if (!isEnabled) return;

    checkConnection();

    intervalRef.current = setInterval(checkConnection, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isEnabled, checkConnection]);

  return {
    connectionStatus,
    isEnabled,
    lastError,
    checkConnection,
  };
}
