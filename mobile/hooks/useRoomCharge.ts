/**
 * BizPilot Mobile POS — useRoomCharge Hook
 *
 * Manages the room charge posting workflow:
 * 1. Validate guest can be charged
 * 2. Check charge limits
 * 3. Post charge (or queue if offline)
 * 4. Track result
 *
 * Why a hook instead of a service function?
 * The charge workflow involves UI state (loading, success, error)
 * that components need to render. A hook encapsulates both the
 * business logic AND the React state management.
 */

import { useState, useCallback } from "react";
import { usePMSStore } from "@/stores/pmsStore";
import { useSyncStore } from "@/stores/syncStore";
import type { PMSCharge, PMSChargeQueueItem, PMSGuest } from "@/types/pms";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChargeInput {
  /** Guest to charge */
  guest: PMSGuest;
  /** Amount to charge in ZAR */
  amount: number;
  /** Charge description (e.g., "Restaurant - Table 5") */
  description: string;
  /** Related POS order ID */
  orderId: string | null;
  /** Authorization type */
  authorizationType: "signature" | "pin" | "bypass";
}

interface ChargeResult {
  success: boolean;
  charge: PMSCharge | null;
  error: string | null;
  queued: boolean;
}

interface UseRoomChargeReturn {
  /** Post a room charge */
  postCharge: (input: ChargeInput) => Promise<ChargeResult>;
  /** Whether a charge is being processed */
  loading: boolean;
  /** Last charge result */
  lastResult: ChargeResult | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateChargeId(): string {
  return `chg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function validateChargeInput(input: ChargeInput): string | null {
  if (input.amount <= 0) {
    return "Charge amount must be greater than zero";
  }
  if (!input.guest.isActive) {
    return "Guest stay is not active";
  }
  if (!input.guest.canCharge) {
    return "Guest folio does not accept charges (no-post flag)";
  }
  if (
    input.guest.transactionChargeLimit !== null &&
    input.amount > input.guest.transactionChargeLimit
  ) {
    return `Amount exceeds per-transaction limit of R${input.guest.transactionChargeLimit.toFixed(2)}`;
  }
  if (!input.description.trim()) {
    return "Charge description is required";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRoomCharge(): UseRoomChargeReturn {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ChargeResult | null>(null);

  const isOnline = useSyncStore((s) => s.isOnline);
  const enqueueCharge = usePMSStore((s) => s.enqueueCharge);
  const canPostCharges = usePMSStore((s) => s.canPostCharges);

  const postCharge = useCallback(
    async (input: ChargeInput): Promise<ChargeResult> => {
      setLoading(true);

      // 1. Validate input
      const validationError = validateChargeInput(input);
      if (validationError) {
        const result: ChargeResult = {
          success: false,
          charge: null,
          error: validationError,
          queued: false,
        };
        setLastResult(result);
        setLoading(false);
        return result;
      }

      const chargeId = generateChargeId();
      const now = new Date().toISOString();

      // 2. If offline or PMS disconnected, queue the charge
      if (!isOnline || !canPostCharges()) {
        const queueItem: PMSChargeQueueItem = {
          id: chargeId,
          charge: {
            guestId: input.guest.id,
            roomNumber: input.guest.roomNumber,
            guestName: input.guest.name,
            amount: input.amount,
            description: input.description,
            terminalId: "mobile-pos", // TODO: get from device settings
            operatorId: "current-user", // TODO: get from auth store
            authorizationType: input.authorizationType,
            orderId: input.orderId,
            createdAt: now,
          },
          attempts: 0,
          lastError: null,
          queuedAt: now,
        };
        enqueueCharge(queueItem);

        const result: ChargeResult = {
          success: true,
          charge: null,
          error: null,
          queued: true,
        };
        setLastResult(result);
        setLoading(false);
        return result;
      }

      // 3. Post charge to PMS via API
      try {
        // TODO: Replace with actual API call when backend is ready
        // const response = await apiClient.post("/pms/charges", { ... });

        // Simulate successful posting
        const charge: PMSCharge = {
          id: chargeId,
          guestId: input.guest.id,
          roomNumber: input.guest.roomNumber,
          guestName: input.guest.name,
          amount: input.amount,
          description: input.description,
          terminalId: "mobile-pos",
          operatorId: "current-user",
          status: "posted",
          pmsReference: `PMS-${Date.now()}`,
          authorizationType: input.authorizationType,
          orderId: input.orderId,
          attempts: 1,
          lastError: null,
          createdAt: now,
          postedAt: now,
        };

        const result: ChargeResult = {
          success: true,
          charge,
          error: null,
          queued: false,
        };
        setLastResult(result);
        setLoading(false);
        return result;
      } catch (error) {
        // On API failure, queue the charge for later retry
        const queueItem: PMSChargeQueueItem = {
          id: chargeId,
          charge: {
            guestId: input.guest.id,
            roomNumber: input.guest.roomNumber,
            guestName: input.guest.name,
            amount: input.amount,
            description: input.description,
            terminalId: "mobile-pos",
            operatorId: "current-user",
            authorizationType: input.authorizationType,
            orderId: input.orderId,
            createdAt: now,
          },
          attempts: 1,
          lastError: error instanceof Error ? error.message : "Posting failed",
          queuedAt: now,
        };
        enqueueCharge(queueItem);

        const result: ChargeResult = {
          success: false,
          charge: null,
          error: "Charge posting failed. Added to offline queue for retry.",
          queued: true,
        };
        setLastResult(result);
        setLoading(false);
        return result;
      }
    },
    [isOnline, canPostCharges, enqueueCharge]
  );

  return { postCharge, loading, lastResult };
}
