/**
 * RefundService — refund flow for completed orders.
 * (integrated-payments tasks 8.1-8.4)
 *
 * Architecture decision: pure validation layer + thin DB wrapper.
 * The "process refund" DB write is handled by processPayment() in PaymentService
 * with method "refund". This module owns:
 *   1. Partial refund calculation (task 8.2)
 *   2. Routing to original payment method (task 8.3)
 *   3. Manager authorization checks (task 8.4)
 *
 * validateRefundAmount() lives in PaymentService (task 8.5 PBT was there).
 * These helpers are imported alongside it for the full refund flow.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RefundRequest {
  orderId: string;
  /** Amount to refund (must be <= totalPaid) */
  refundAmount: number;
  /** "full" for the whole order, "partial" for line-level or custom amount */
  refundType: "full" | "partial";
  /** Payment method to return money to (must match original) */
  refundMethod: "cash" | "card" | "eft";
  /** Manager who authorized the refund (required for amounts > thresholdAmount) */
  authorizedBy?: string;
  reason: string;
}

export interface RefundValidationResult {
  valid: boolean;
  errors: string[];
}

export interface OriginalPaymentSummary {
  method: "cash" | "card" | "eft";
  /** Total successfully paid via this method */
  amount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Refunds above this threshold require manager authorization (task 8.4).
 * Set at R500 by default; can be overridden at call sites if the business
 * has a different policy.
 */
export const MANAGER_AUTH_THRESHOLD = 500;

// ---------------------------------------------------------------------------
// Partial refund calculation (task 8.2)
// ---------------------------------------------------------------------------

/**
 * Calculate the maximum refundable amount for a partial refund.
 *
 * @param lineTotal      - Total for the line being refunded
 * @param quantity       - Units being returned
 * @param totalQuantity  - Total units in the original line
 */
export function calculatePartialRefundAmount(
  lineTotal: number,
  quantity: number,
  totalQuantity: number
): number {
  if (totalQuantity <= 0 || quantity <= 0) return 0;
  const refund = (lineTotal * Math.min(quantity, totalQuantity)) / totalQuantity;
  return Math.round(refund * 100) / 100;
}

// ---------------------------------------------------------------------------
// Routing to original method (task 8.3)
// ---------------------------------------------------------------------------

/**
 * Determine the correct refund method based on original payment methods.
 *
 * Rule: money goes back to the same method it came from.
 * If the order was split across multiple methods, the caller must specify
 * which method to refund to.
 *
 * Returns the method if valid; throws if the requested method wasn't used.
 */
export function resolveRefundMethod(
  requested: "cash" | "card" | "eft",
  originalPayments: OriginalPaymentSummary[]
): "cash" | "card" | "eft" {
  const methodUsed = originalPayments.find((p) => p.method === requested);
  if (!methodUsed || methodUsed.amount <= 0) {
    const methods = originalPayments.map((p) => p.method).join(", ");
    throw new Error(
      `Cannot refund via '${requested}': original payment methods were [${methods}]`
    );
  }
  return requested;
}

// ---------------------------------------------------------------------------
// Manager authorization check (task 8.4)
// ---------------------------------------------------------------------------

/**
 * Return true if manager authorization is required for this refund amount.
 */
export function requiresManagerAuth(
  refundAmount: number,
  threshold: number = MANAGER_AUTH_THRESHOLD
): boolean {
  return refundAmount > threshold;
}

// ---------------------------------------------------------------------------
// Full refund validation (tasks 8.1-8.4 combined)
// ---------------------------------------------------------------------------

/**
 * Validate a complete refund request before writing to the database.
 *
 * @param request          - The refund details
 * @param totalPaid        - Total paid for the order (DB-sourced)
 * @param alreadyRefunded  - Amount already refunded (DB-sourced)
 * @param originalPayments - Payment method breakdown (DB-sourced)
 * @param threshold        - Manager auth threshold
 */
export function validateRefundRequest(
  request: RefundRequest,
  totalPaid: number,
  alreadyRefunded: number,
  originalPayments: OriginalPaymentSummary[],
  threshold: number = MANAGER_AUTH_THRESHOLD
): RefundValidationResult {
  const errors: string[] = [];

  if (request.refundAmount <= 0) {
    errors.push("Refund amount must be greater than zero");
  }

  const maxRefund = Math.round((totalPaid - alreadyRefunded) * 100) / 100;
  if (request.refundAmount > maxRefund) {
    errors.push(
      `Refund of ${request.refundAmount.toFixed(2)} exceeds maximum refundable amount of ${maxRefund.toFixed(2)}`
    );
  }

  if (!request.reason.trim()) {
    errors.push("Refund reason is required");
  }

  // Check refund method against original payments
  const methodUsed = originalPayments.find((p) => p.method === request.refundMethod);
  if (!methodUsed || methodUsed.amount <= 0) {
    const methods = originalPayments.map((p) => p.method).join(", ");
    errors.push(
      `Cannot refund via '${request.refundMethod}': original payment used [${methods}]`
    );
  }

  // Manager authorization check
  if (requiresManagerAuth(request.refundAmount, threshold)) {
    if (!request.authorizedBy || !request.authorizedBy.trim()) {
      errors.push(
        `Refunds above R${threshold.toFixed(2)} require manager authorization`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
