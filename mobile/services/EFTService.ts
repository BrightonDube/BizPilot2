/**
 * EFTService — Electronic Fund Transfer payment flow.
 * (integrated-payments tasks 6.1-6.4)
 *
 * EFT in a South African POS context:
 * - Customer pays by bank transfer using a reference number.
 * - Payment appears as "pending" until staff manually confirms it after
 *   seeing the bank notification (typically same-day for instant payments).
 * - Unlike card (Yoco) or QR (SnapScan), there is NO third-party SDK.
 *
 * Why pure functions here?
 * The DB write (creating the pending payment record) is handled by
 * processPayment() in PaymentService. This module provides:
 *   1. Reference generation (task 6.2)
 *   2. Business rule validation (tasks 6.1, 6.4)
 *   3. Manual confirmation logic (task 6.4)
 *
 * The caller (PaymentModal or OrderService) owns the DB write via processPayment().
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EFTPaymentRequest {
  orderId: string;
  amount: number;
  /** Customer name or identifier for the bank reference */
  customerRef: string;
}

export interface EFTPaymentResult {
  /** The reference number to give the customer for their bank transfer */
  reference: string;
  /** ISO timestamp this reference was generated */
  generatedAt: string;
  /** Formatted instructions for the customer */
  instructions: string;
}

export interface EFTConfirmationRequest {
  /** Original payment record ID from the database */
  paymentId: string;
  /** Reference the customer used in their bank transfer */
  confirmedReference: string;
  /** Staff member who manually confirmed the payment */
  confirmedBy: string;
}

export interface EFTConfirmationResult {
  valid: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Reference generation (task 6.2)
// ---------------------------------------------------------------------------

/**
 * Generate a unique EFT reference number for a payment.
 *
 * Format: BP-{YYYYMMDD}-{orderId.slice(0,6).toUpperCase()}-{random4}
 * Example: BP-20240115-AB1C2D-9F3E
 *
 * Why this format?
 * - "BP" identifies BizPilot on the bank statement
 * - Date helps reconcile same-day payments
 * - Order prefix lets staff find the order if the customer calls
 * - Random 4-char suffix prevents collisions for orders on the same day
 */
export function generateEFTReference(
  orderId: string,
  now: Date = new Date()
): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  const orderPrefix = orderId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `BP-${dateStr}-${orderPrefix}-${randomSuffix}`;
}

/**
 * Build an EFT payment result with reference and instructions (tasks 6.1, 6.2).
 */
export function createEFTPayment(
  request: EFTPaymentRequest,
  now: Date = new Date()
): EFTPaymentResult {
  const reference = generateEFTReference(request.orderId, now);
  const generatedAt = now.toISOString();
  const instructions =
    `Please transfer R${request.amount.toFixed(2)} to our account ` +
    `using reference: ${reference}. ` +
    `The order will be confirmed once payment reflects.`;

  return { reference, generatedAt, instructions };
}

// ---------------------------------------------------------------------------
// Pending payment status (task 6.3)
// ---------------------------------------------------------------------------

/** Status values for an EFT payment in the WatermelonDB Payment record. */
export type EFTStatus = "pending" | "confirmed" | "cancelled" | "expired";

/**
 * Return the initial status for a newly created EFT payment.
 * All EFT payments start as "pending" — staff must manually confirm.
 */
export function getInitialEFTStatus(): EFTStatus {
  return "pending";
}

/**
 * Check whether an EFT payment has expired (i.e., created > 24 hours ago
 * without being confirmed).
 */
export function isEFTExpired(
  createdAt: string,
  status: EFTStatus,
  now: Date = new Date()
): boolean {
  if (status !== "pending") return false;
  const ageMs = now.getTime() - new Date(createdAt).getTime();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return ageMs > twentyFourHours;
}

// ---------------------------------------------------------------------------
// Manual confirmation (task 6.4)
// ---------------------------------------------------------------------------

/**
 * Validate a staff member's manual EFT confirmation request.
 *
 * Rules:
 * 1. The confirmedReference must be non-empty
 * 2. confirmedBy must be non-empty (audit trail)
 * 3. The payment must currently be in "pending" status
 */
export function validateEFTConfirmation(
  request: EFTConfirmationRequest,
  currentStatus: EFTStatus
): EFTConfirmationResult {
  if (!request.confirmedReference.trim()) {
    return { valid: false, error: "Bank reference is required to confirm EFT payment" };
  }
  if (!request.confirmedBy.trim()) {
    return { valid: false, error: "Staff member name is required for audit trail" };
  }
  if (currentStatus !== "pending") {
    return {
      valid: false,
      error: `Cannot confirm EFT in status '${currentStatus}' — only pending payments can be confirmed`,
    };
  }
  return { valid: true, error: null };
}
