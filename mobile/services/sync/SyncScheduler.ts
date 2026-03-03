/**
 * BizPilot Mobile POS — Sync Scheduler
 *
 * Automatically triggers sync at the right moments:
 * 1. On a periodic interval (every 5 minutes when online)
 * 2. When the device regains connectivity
 * 3. When the app returns to the foreground
 *
 * Why a scheduler instead of manual-only sync?
 * POS operators are focused on serving customers, not hitting sync
 * buttons. Automatic background sync ensures data is up-to-date
 * without requiring any manual intervention. The 5-minute interval
 * is a balance between freshness and battery/network usage.
 *
 * Why debounce connectivity changes?
 * When a device moves between WiFi and cellular, NetInfo fires
 * multiple rapid online/offline/online events. Without debouncing,
 * each event would trigger a sync, potentially causing 3–5 syncs
 * in a 2-second window. We debounce to only sync once after
 * connectivity stabilizes.
 */

import { AppState, type AppStateStatus } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { performSync } from "./SyncService";
import { useSyncStore } from "@/stores/syncStore";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sync every 5 minutes when the app is in the foreground and online */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Debounce connectivity changes by 2 seconds before triggering sync */
const CONNECTIVITY_DEBOUNCE_MS = 2000;

/** Minimum time between syncs (prevents rapid-fire sync attempts) */
const MIN_SYNC_GAP_MS = 30 * 1000;

// ---------------------------------------------------------------------------
// Scheduler State
// ---------------------------------------------------------------------------

let intervalId: ReturnType<typeof setInterval> | null = null;
let connectivityDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let netInfoSubscription: (() => void) | null = null;
let lastSyncAttempt = 0;
let isRunning = false;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Attempt a sync if enough time has passed since the last attempt.
 * Prevents rapid-fire syncs from multiple triggers.
 */
async function attemptSync(): Promise<void> {
  const now = Date.now();
  if (now - lastSyncAttempt < MIN_SYNC_GAP_MS) {
    return; // Too soon since last sync
  }

  const syncStore = useSyncStore.getState();
  if (syncStore.status === "syncing") {
    return; // Already syncing
  }

  if (!syncStore.isOnline) {
    return; // Offline — no point trying
  }

  lastSyncAttempt = now;

  try {
    await performSync();
  } catch {
    // Sync errors are already handled inside performSync
    // and reported to the sync store. No action needed here.
  }
}

/**
 * Handle connectivity state changes with debouncing.
 * Only triggers sync when transitioning from offline → online.
 */
function handleConnectivityChange(state: NetInfoState): void {
  const syncStore = useSyncStore.getState();
  const wasOffline = !syncStore.isOnline;
  const isNowOnline = state.isConnected === true;

  // Update the store regardless
  useSyncStore.setState({ isOnline: isNowOnline });

  // Only sync when going offline → online
  if (wasOffline && isNowOnline) {
    if (connectivityDebounceTimer) {
      clearTimeout(connectivityDebounceTimer);
    }
    connectivityDebounceTimer = setTimeout(() => {
      attemptSync();
    }, CONNECTIVITY_DEBOUNCE_MS);
  }
}

/**
 * Handle app state changes (foreground/background).
 * Triggers sync when app comes to foreground.
 */
function handleAppStateChange(nextState: AppStateStatus): void {
  if (nextState === "active") {
    // App returned to foreground — attempt sync
    attemptSync();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the sync scheduler.
 * Call once when the app initializes (after authentication).
 *
 * Sets up:
 * - Periodic interval sync
 * - Connectivity change listener
 * - App foreground listener
 */
export function startSyncScheduler(): void {
  if (isRunning) {
    return; // Already running — prevent duplicate listeners
  }
  isRunning = true;

  // 1. Periodic sync
  intervalId = setInterval(attemptSync, SYNC_INTERVAL_MS);

  // 2. Connectivity change sync
  netInfoSubscription = NetInfo.addEventListener(handleConnectivityChange);

  // 3. App foreground sync
  appStateSubscription = AppState.addEventListener(
    "change",
    handleAppStateChange
  );

  // 4. Initial sync on startup
  attemptSync();
}

/**
 * Stop the sync scheduler.
 * Call when the user logs out or the app is terminating.
 */
export function stopSyncScheduler(): void {
  isRunning = false;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  if (connectivityDebounceTimer) {
    clearTimeout(connectivityDebounceTimer);
    connectivityDebounceTimer = null;
  }

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  if (netInfoSubscription) {
    netInfoSubscription();
    netInfoSubscription = null;
  }
}

/**
 * Check if the scheduler is currently active.
 */
export function isSchedulerRunning(): boolean {
  return isRunning;
}
