/**
 * BizPilot Mobile POS — PMS Zustand Store
 *
 * Manages PMS-related state: connection status, current guest,
 * offline charge queue, and folio data.
 *
 * Why a dedicated store (not part of syncStore)?
 * PMS integration is a separate feature domain. Mixing PMS state
 * into the sync store would couple two independent concerns.
 * Hotels that don't use PMS integration never load this store.
 *
 * Why persist the charge queue?
 * If the app crashes while charges are queued offline, losing them
 * means unbilled room charges. We persist the queue and processing
 * state to AsyncStorage via Zustand's persist middleware so charges
 * survive app restarts, crashes, and background kills.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  PMSGuest,
  PMSFolio,
  PMSConnectionStatus,
  PMSChargeQueueItem,
} from "@/types/pms";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface PMSState {
  /** Current PMS connection status */
  connectionStatus: PMSConnectionStatus;
  /** Currently selected/active guest for charge posting */
  currentGuest: PMSGuest | null;
  /** Current guest's folio data */
  currentFolio: PMSFolio | null;
  /** Offline charge queue (charges waiting to be posted) */
  chargeQueue: PMSChargeQueueItem[];
  /** Whether we're actively posting charges from the queue */
  isProcessingQueue: boolean;
  /** Last error from PMS operations */
  lastError: string | null;
  /** Whether the PMS feature is enabled for this business */
  isEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

interface PMSActions {
  /** Set the PMS connection status */
  setConnectionStatus: (status: PMSConnectionStatus) => void;
  /** Set the current guest (after search/selection) */
  setCurrentGuest: (guest: PMSGuest | null) => void;
  /** Set the current folio */
  setCurrentFolio: (folio: PMSFolio | null) => void;
  /** Add a charge to the offline queue */
  enqueueCharge: (item: PMSChargeQueueItem) => void;
  /** Remove a charge from the queue (after successful posting) */
  dequeueCharge: (id: string) => void;
  /** Update a queued charge (e.g., increment attempts, set error) */
  updateQueueItem: (id: string, updates: Partial<PMSChargeQueueItem>) => void;
  /** Set queue processing state */
  setProcessingQueue: (processing: boolean) => void;
  /** Set last error */
  setLastError: (error: string | null) => void;
  /** Set whether PMS is enabled */
  setEnabled: (enabled: boolean) => void;
  /** Clear all PMS state (e.g., on logout) */
  reset: () => void;

  // Getters (Zustand doesn't support derived state natively)
  /** Get number of queued charges */
  getQueueCount: () => number;
  /** Check if we can post charges (connected + enabled) */
  canPostCharges: () => boolean;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: PMSState = {
  connectionStatus: "unknown",
  currentGuest: null,
  currentFolio: null,
  chargeQueue: [],
  isProcessingQueue: false,
  lastError: null,
  isEnabled: false,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePMSStore = create<PMSState & PMSActions>()(
  persist(
    (set, get) => ({
      ...initialState,

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setCurrentGuest: (guest) => set({ currentGuest: guest }),

  setCurrentFolio: (folio) => set({ currentFolio: folio }),

  enqueueCharge: (item) =>
    set((state) => {
      // Prevent duplicate charges for the same order
      const isDuplicate = state.chargeQueue.some(
        (q) => q.charge.orderId === item.charge.orderId && item.charge.orderId !== null
      );
      if (isDuplicate) return state;
      return { chargeQueue: [...state.chargeQueue, item] };
    }),

  dequeueCharge: (id) =>
    set((state) => ({
      chargeQueue: state.chargeQueue.filter((item) => item.id !== id),
    })),

  updateQueueItem: (id, updates) =>
    set((state) => ({
      chargeQueue: state.chargeQueue.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  setProcessingQueue: (processing) => set({ isProcessingQueue: processing }),

  setLastError: (error) => set({ lastError: error }),

  setEnabled: (enabled) => set({ isEnabled: enabled }),

  reset: () => set(initialState),

  getQueueCount: () => get().chargeQueue.length,

  canPostCharges: () => {
    const state = get();
    return state.isEnabled && state.connectionStatus === "connected";
  },
    }),
    {
      name: "bizpilot-pms",
      storage: createJSONStorage(() => AsyncStorage),
      /**
       * Only persist the charge queue and enabled flag.
       * Connection status and current guest/folio are ephemeral —
       * they're refreshed on app launch from the PMS API.
       * The charge queue is the only state that MUST survive restarts.
       */
      partialize: (state) => ({
        chargeQueue: state.chargeQueue,
        isEnabled: state.isEnabled,
      }),
    }
  )
);
