/**
 * BizPilot Mobile POS — Sync Status Zustand Store
 *
 * Tracks synchronization state for the offline-first engine.
 * Components use this to show sync indicators and pending counts.
 *
 * Why a dedicated sync store?
 * Sync status affects multiple unrelated UI areas — the status
 * bar badge, the settings screen, the manual sync button.
 * A Zustand store lets each consume only the slice it needs.
 */

import { create } from "zustand";
import type { SyncStatus } from "@/types";

interface SyncStore {
  status: SyncStatus;
  lastSyncAt: number | null;
  pendingChanges: number;
  isOnline: boolean;
  lastError: string | null;

  // Actions
  setStatus: (status: SyncStatus) => void;
  setOnline: (isOnline: boolean) => void;
  setLastSync: (timestamp: number) => void;
  setPendingChanges: (count: number) => void;
  setError: (error: string | null) => void;
  incrementPending: () => void;
  decrementPending: (by?: number) => void;
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  status: "idle",
  lastSyncAt: null,
  pendingChanges: 0,
  isOnline: true,
  lastError: null,

  setStatus: (status) => set({ status }),
  setOnline: (isOnline) => set({ isOnline }),
  setLastSync: (timestamp) => set({ lastSyncAt: timestamp }),
  setPendingChanges: (count) => set({ pendingChanges: count }),
  setError: (error) => set({ lastError: error }),

  incrementPending: () =>
    set({ pendingChanges: get().pendingChanges + 1 }),

  decrementPending: (by = 1) =>
    set({ pendingChanges: Math.max(0, get().pendingChanges - by) }),
}));
