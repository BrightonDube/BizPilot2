/**
 * BizPilot Mobile POS — useSync Hook
 *
 * Provides sync state and manual sync trigger to components.
 * Wraps the sync store and SyncService in a clean interface.
 */

import { useCallback } from "react";
import { useSyncStore } from "@/stores/syncStore";
import { triggerManualSync } from "@/services/sync/SyncService";

interface UseSyncReturn {
  /** Current sync status: "idle" | "syncing" | "error" */
  status: string;
  /** Whether the device is online */
  isOnline: boolean;
  /** Timestamp of last successful sync (epoch ms), or null */
  lastSyncAt: number | null;
  /** Number of pending changes in the sync queue */
  pendingChanges: number;
  /** Last error message, or null */
  lastError: string | null;
  /** Trigger a manual sync */
  syncNow: () => Promise<void>;
}

export function useSync(): UseSyncReturn {
  const status = useSyncStore((s) => s.status);
  const isOnline = useSyncStore((s) => s.isOnline);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const pendingChanges = useSyncStore((s) => s.pendingChanges);
  const lastError = useSyncStore((s) => s.lastError);

  const syncNow = useCallback(async () => {
    await triggerManualSync();
  }, []);

  return { status, isOnline, lastSyncAt, pendingChanges, lastError, syncNow };
}
