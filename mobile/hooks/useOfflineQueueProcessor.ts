/**
 * BizPilot Mobile POS — useOfflineQueueProcessor Hook
 *
 * Orchestrates automatic queue processing when the device reconnects
 * to the PMS after being offline. Covers tasks 31.1–31.5:
 *
 *   31.1 — Offline mode detection + indicator display
 *   31.2 — Charge queuing when offline (handled by useRoomCharge; this
 *           hook handles the "process on reconnect" side)
 *   31.3 — Automatic queue processing on reconnection
 *   31.4 — Failed charge flagging for manual review
 *   31.5 — Duplicate charge prevention (enqueueCharge dedup + idempotency key)
 *
 * Why a separate hook from useRoomCharge?
 * useRoomCharge handles the *posting* workflow — one charge at a time.
 * This hook handles the *background queue draining* workflow — watching
 * for connectivity changes and batch-processing queued charges automatically.
 * Separating them keeps each hook focused and testable.
 *
 * Why not a service?
 * Queue processing needs to subscribe to reactive state (connection
 * status, isOnline, queue changes). A React hook can subscribe to
 * Zustand stores and trigger effects; a pure service cannot.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { usePMSStore } from "@/stores/pmsStore";
import { useSyncStore } from "@/stores/syncStore";
import {
  getNextBatch,
  categorizeBatch,
  shouldFlagForReview,
  calculateRetryDelay,
  resetStuckItems,
  isQueueHealthy,
  getStaleItems,
  PROCESS_BATCH_SIZE,
} from "@/services/pms/QueueProcessorService";
import type { PMSChargeQueueItem } from "@/types/pms";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueueProcessorState {
  /** Whether the processor is actively draining the queue */
  isProcessing: boolean;
  /** Number of charges successfully posted this session */
  processedCount: number;
  /** Number of charges flagged for manual review */
  flaggedCount: number;
  /** Last processing error (null if none) */
  lastError: string | null;
  /** Whether the queue has stale items needing attention */
  hasStaleItems: boolean;
  /** Whether the queue is healthy overall */
  queueHealthy: boolean;
}

export interface UseOfflineQueueProcessorReturn extends QueueProcessorState {
  /** Manually trigger queue processing (e.g., from a "Retry" button) */
  processQueue: () => Promise<void>;
  /** Reset stuck items back to queued status */
  recoverStuckItems: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Minimum delay (ms) after reconnection before starting queue processing.
 * Prevents hammering the PMS API immediately on flaky connections.
 */
const RECONNECT_DELAY_MS = 3000;

/**
 * Interval (ms) between batch processing cycles while draining.
 * Gives the PMS server breathing room between batches.
 */
const BATCH_INTERVAL_MS = 2000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOfflineQueueProcessor(): UseOfflineQueueProcessorReturn {
  // ---------------------
  // Store subscriptions
  // ---------------------
  const connectionStatus = usePMSStore((s) => s.connectionStatus);
  const isEnabled = usePMSStore((s) => s.isEnabled);
  const chargeQueue = usePMSStore((s) => s.chargeQueue);
  const isProcessingQueue = usePMSStore((s) => s.isProcessingQueue);
  const setProcessingQueue = usePMSStore((s) => s.setProcessingQueue);
  const dequeueCharge = usePMSStore((s) => s.dequeueCharge);
  const updateQueueItem = usePMSStore((s) => s.updateQueueItem);
  const isOnline = useSyncStore((s) => s.isOnline);

  // ---------------------
  // Local state
  // ---------------------
  const [processedCount, setProcessedCount] = useState(0);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // Track the previous connection status so we can detect reconnects
  const prevConnectedRef = useRef(false);
  const processingRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------
  // Derived state
  // ---------------------
  const canProcess = isOnline && connectionStatus === "connected" && isEnabled;

  const staleItems = getStaleItems(
    chargeQueue as any[], // QueuedCharge vs PMSChargeQueueItem — shape is compatible
    undefined,
    new Date()
  );
  const hasStaleItems = staleItems.length > 0;
  const queueHealthy = isQueueHealthy(chargeQueue as any[]);

  // ---------------------
  // postSingleCharge — simulated charge posting
  // ---------------------
  /**
   * Posts a single charge to the PMS API.
   *
   * Returns true on success, false on failure.
   *
   * TODO: Replace mock implementation with actual API call when
   * the backend PMS charge endpoint is available.
   */
  const postSingleCharge = useCallback(
    async (item: PMSChargeQueueItem): Promise<boolean> => {
      try {
        // TODO: Replace with real API call:
        // const res = await apiClient.post("/pms/charges", {
        //   ...item.charge,
        //   idempotencyKey: item.id, // 31.5: duplicate prevention
        // });
        // return res.status === 200 || res.status === 201;

        // Mock: simulate 90% success rate for development
        const success = Math.random() > 0.1;
        if (!success) throw new Error("PMS rejected the charge (mock)");
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  // ---------------------
  // processQueue — batch processor
  // ---------------------
  const processQueue = useCallback(async () => {
    // Guard: don't double-process
    if (processingRef.current || !canProcess) return;

    processingRef.current = true;
    setProcessingQueue(true);
    setLastError(null);

    try {
      // Reset any items stuck in "syncing" from a previous crash
      const queue = usePMSStore.getState().chargeQueue as any[];
      const recovered = resetStuckItems(queue);
      if (recovered !== queue) {
        // Apply recovery — update each stuck item in store
        recovered.forEach((item: any) => {
          if (item.syncStatus === "queued") {
            updateQueueItem(item.id, item);
          }
        });
      }

      // Process in batches until queue is empty or connection drops
      let hasMore = true;
      while (hasMore) {
        const currentQueue = usePMSStore.getState().chargeQueue as any[];
        const batch = getNextBatch(currentQueue, PROCESS_BATCH_SIZE);

        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        // Check if we're still connected before each batch
        const storeState = usePMSStore.getState();
        if (storeState.connectionStatus !== "connected") {
          setLastError("PMS disconnected during queue processing");
          break;
        }

        // Process the batch
        const successIds = new Set<string>();

        for (const item of batch) {
          // 31.4: Flag items that have exceeded retry limits
          if (shouldFlagForReview(item)) {
            setFlaggedCount((c) => c + 1);
            updateQueueItem(item.id, {
              lastError: "Flagged for manual review: too many retries or too old",
            });
            continue;
          }

          // Update attempt count
          updateQueueItem(item.id, {
            attempts: item.charge.attempts + 1,
          });

          const success = await postSingleCharge(item);

          if (success) {
            successIds.add(item.id);
            dequeueCharge(item.id);
            setProcessedCount((c) => c + 1);
          } else {
            // Calculate next retry delay (for UI display, not scheduling)
            const delay = calculateRetryDelay(item.charge.attempts + 1);
            updateQueueItem(item.id, {
              lastError: `Post failed. Next retry in ~${Math.round(delay / 1000)}s`,
              attempts: item.charge.attempts + 1,
            });
          }
        }

        // Categorize results for logging/metrics
        const results = categorizeBatch(batch, successIds);
        if (results.flagged.length > 0) {
          setFlaggedCount((c) => c + results.flagged.length);
        }

        // Brief pause between batches to avoid overwhelming PMS
        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_INTERVAL_MS));
        }
      }
    } catch (error) {
      setLastError(
        error instanceof Error ? error.message : "Queue processing failed"
      );
    } finally {
      processingRef.current = false;
      setProcessingQueue(false);
    }
  }, [
    canProcess,
    setProcessingQueue,
    dequeueCharge,
    updateQueueItem,
    postSingleCharge,
  ]);

  // ---------------------
  // recoverStuckItems
  // ---------------------
  const recoverStuckItems = useCallback(() => {
    const queue = usePMSStore.getState().chargeQueue as any[];
    const recovered = resetStuckItems(queue);
    recovered.forEach((item: any) => {
      updateQueueItem(item.id, item);
    });
  }, [updateQueueItem]);

  // ---------------------
  // 31.3: Auto-process on reconnection
  // ---------------------
  useEffect(() => {
    const wasConnected = prevConnectedRef.current;
    const isNowConnected = canProcess;

    prevConnectedRef.current = isNowConnected;

    // Detect reconnection: was disconnected, now connected
    if (!wasConnected && isNowConnected && chargeQueue.length > 0) {
      // Clear any existing reconnect timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      // Delay before processing to let connection stabilize
      reconnectTimerRef.current = setTimeout(() => {
        processQueue();
      }, RECONNECT_DELAY_MS);
    }

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [canProcess, chargeQueue.length, processQueue]);

  return {
    isProcessing: isProcessingQueue,
    processedCount,
    flaggedCount,
    lastError,
    hasStaleItems,
    queueHealthy,
    processQueue,
    recoverStuckItems,
  };
}
