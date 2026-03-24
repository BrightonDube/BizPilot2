/**
 * BizPilot Mobile POS — Sync Zustand Store
 *
 * Tracks synchronization state for the offline-first engine.
 */

import { create } from "zustand";

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  syncError: string | null;

  // Aliases for compatibility
  pendingChanges: number;
  lastError: string | null;

  // Mandated Actions
  setOnline: (isOnline: boolean) => void;
  startSync: () => void;
  finishSync: (result: { success: boolean; pushed: number; pulled: number; error?: string }) => void;
  setSyncError: (error: string | null) => void;

  // Compatibility Actions
  setStatus: (status: any) => void;
  setLastSync: (timestamp: number) => void;
  setPendingChanges: (count: number) => void;
  setError: (error: string | null) => void;
  incrementPending: () => void;
  decrementPending: (by?: number) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  syncError: null,
  
  // Initialize aliases
  pendingChanges: 0,
  lastError: null,

  setOnline: (isOnline) => set({ isOnline }),
  
  startSync: () => set({ isSyncing: true, syncError: null, lastError: null }),

  finishSync: (result) => set((state) => ({
    isSyncing: false,
    lastSyncAt: result.success ? Date.now() : state.lastSyncAt,
    syncError: result.error || null,
    lastError: result.error || null,
  })),

  setSyncError: (error) => set({ syncError: error, lastError: error }),

  // Compatibility implementations
  setStatus: (status) => set({ isSyncing: status === "syncing" }),
  setLastSync: (timestamp) => set({ lastSyncAt: timestamp }),
  setPendingChanges: (count) => set({ pendingCount: count, pendingChanges: count }),
  setError: (error) => set({ syncError: error, lastError: error }),
  incrementPending: () => set((state) => ({ 
    pendingCount: state.pendingCount + 1,
    pendingChanges: state.pendingChanges + 1
  })),
  decrementPending: (by = 1) => set((state) => ({ 
    pendingCount: Math.max(0, state.pendingCount - by),
    pendingChanges: Math.max(0, state.pendingChanges - by)
  })),
}));
