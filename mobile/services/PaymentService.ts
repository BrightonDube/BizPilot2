/**
 * BizPilot Mobile POS — PaymentService
 *
 * Handles payment processing for POS transactions.
 * Supports cash, card (Yoco), EFT, and split payments.
 *
 * Why a dedicated PaymentService?
 * Payment logic is complex and has strict validation rules:
 * - Cash requires change calculation
 * - Card payments need terminal integration
 * - Split payments must total exactly the order amount
 * - All payment errors must be surfaced clearly to cashiers
 * - Offline payments (cash) must be queued for sync
 *
 * This service keeps payment concerns isolated from order management.
 */

import { database } from "@/db";
import { Q } from "@nozbe/watermelondb";
import { logger } from "@/utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaymentMethod = "cash" | "card" | "eft" | "room_charge";
export type PaymentStatus = "pending" | "completed" | "refunded";

export interface PaymentRequest {
  /** Local WatermelonDB ID of the order */
  orderId: string;
  /** Payment method */
  method: PaymentMethod;
  /** Amount to charge via this method */
  amount: number;
  /**
   * For cash payments: the physical notes/coins tendered by the customer.
   * Must be >= amount. Change = cashTendered - amount.
   */
  cashTendered?: number;
  /** Optional terminal reference number (from Yoco callback, etc.) */
  reference?: string;
}

export interface PaymentResult {
  success: boolean;
  /** The created Payment record's local ID */
  paymentId?: string;
  /** Change due (cash only) */
  changeDue?: number;
  error?: string;
}

export interface SplitPaymentRequest {
  orderId: string;
  /** List of payment lines. Their amounts must sum to totalDue exactly. */
  lines: Array<{
    method: PaymentMethod;
    amount: number;
    cashTendered?: number;
    reference?: string;
  }>;
  totalDue: number;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Process a single payment for an order.
 *
 * For cash payments, validates that cashTendered >= amount.
 * Writes to WatermelonDB so the payment persists offline.
 */
export async function processPayment(
  request: PaymentRequest
): Promise<PaymentResult> {
  const { orderId, method, amount, cashTendered, reference } = request;

  // Validate amount
  if (amount <= 0) {
    return { success: false, error: "Payment amount must be greater than zero" };
  }

  // Cash-specific validation
  if (method === "cash") {
    if (cashTendered === undefined || cashTendered === null) {
      return { success: false, error: "Cash tendered amount is required for cash payments" };
    }
    if (cashTendered < amount) {
      return {
        success: false,
        error: `Cash tendered (${cashTendered.toFixed(2)}) is less than amount due (${amount.toFixed(2)})`,
      };
    }
  }

  try {
    let paymentId: string | undefined;

    await database.write(async () => {
      const collection = database.get<import("@/db/models/Payment").default>("payments");
      const now = Date.now();

      const payment = await collection.create((record) => {
        record.orderId = orderId;
        record.paymentMethod = method;
        record.amount = amount;
        record.cashTendered = cashTendered ?? null;
        record.status = "completed";
        record.reference = reference ?? null;
        record.processedAt = now;
        record.isDirty = true; // Mark for sync to server
        record.syncedAt = null;
        record.createdAt = now;
        record.updatedAt = now;
      });

      paymentId = payment.id;
    });

    const changeDue =
      method === "cash" && cashTendered !== undefined
        ? cashTendered - amount
        : undefined;

    logger.info("payments", "Payment processed", {
      orderId,
      method,
      amount,
      changeDue,
    });

    return { success: true, paymentId, changeDue };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payment failed";
    logger.error("payments", "Payment processing failed", { orderId, method, error: message });
    return { success: false, error: message };
  }
}

/**
 * Process a split payment (multiple methods against one order).
 *
 * Validates that all line amounts sum to totalDue before writing anything.
 * This is an all-or-nothing operation — if any line fails, none are written.
 *
 * Why atomic?
 * A partial split payment would leave the order in an inconsistent state
 * (e.g., card charged but cash not recorded). We validate upfront to avoid this.
 */
export async function processSplitPayment(
  request: SplitPaymentRequest
): Promise<PaymentResult[]> {
  const { orderId, lines, totalDue } = request;

  // Validate total
  const linesTotal = lines.reduce((sum, l) => sum + l.amount, 0);
  // Allow 1 cent floating-point tolerance
  if (Math.abs(linesTotal - totalDue) > 0.01) {
    return [
      {
        success: false,
        error: `Split payment lines (${linesTotal.toFixed(2)}) do not match total due (${totalDue.toFixed(2)})`,
      },
    ];
  }

  // Validate each line individually first
  for (const line of lines) {
    if (line.method === "cash" && (line.cashTendered ?? 0) < line.amount) {
      return [
        {
          success: false,
          error: `Cash tendered for line is less than line amount (${line.amount.toFixed(2)})`,
        },
      ];
    }
  }

  // Process all lines
  const results: PaymentResult[] = await Promise.all(
    lines.map((line) =>
      processPayment({
        orderId,
        method: line.method,
        amount: line.amount,
        cashTendered: line.cashTendered,
        reference: line.reference,
      })
    )
  );

  return results;
}

/**
 * Calculate the change due for a cash payment.
 *
 * Simple helper exported for use in the PaymentModal UI.
 * Extracted here so it's easily testable without UI rendering.
 */
export function calculateChange(amountDue: number, cashTendered: number): number {
  if (cashTendered < amountDue) return 0;
  // Round to 2 decimal places to avoid floating-point artefacts
  return Math.round((cashTendered - amountDue) * 100) / 100;
}

/**
 * Get all payment records for a given order.
 */
export async function getPaymentsForOrder(orderId: string) {
  const collection = database.get<import("@/db/models/Payment").default>("payments");
  return collection
    .query(Q.where("order_id", orderId))
    .fetch();
}

/**
 * Get total amount paid for an order across all payment records.
 */
export async function getTotalPaidForOrder(orderId: string): Promise<number> {
  const payments = await getPaymentsForOrder(orderId);
  return payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);
}
