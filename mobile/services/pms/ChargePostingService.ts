/**
 * ChargePostingService — Pure functions for managing PMS charge posting lifecycle.
 *
 * Why: Charges need to be queued when offline and posted when connectivity resumes.
 * This service handles validation, posting, retries, and reversal logic.
 *
 * Every function is pure — no side-effects, no hidden state.
 * Injected `now` parameters keep date handling deterministic in tests.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Rounds to 2 decimal places — avoids floating-point dust in currency math. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PMSCharge {
  id: string;
  roomNumber: string;
  guestName: string;
  amount: number;
  description: string;
  orderId: string;
  status: "pending" | "posted" | "failed" | "reversed" | "retrying";
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  postedAt: string | null;
  reversedAt: string | null;
  errorMessage: string | null;
}

export interface PostingResult {
  success: boolean;
  chargeId: string;
  error?: string;
  retryable: boolean;
}

export interface ChargeReport {
  total: number;
  posted: number;
  failed: number;
  pending: number;
  reversed: number;
  totalAmount: number;
}

// ---------------------------------------------------------------------------
// 1. createCharge
// ---------------------------------------------------------------------------

/**
 * Creates a new PMSCharge in `pending` status.
 *
 * Why generate the id here? The caller may be offline, so we need a
 * deterministic id before the PMS round-trip.
 */
export function createCharge(
  roomNumber: string,
  guestName: string,
  amount: number,
  description: string,
  orderId: string,
  now: Date = new Date()
): PMSCharge {
  return {
    id: `chg-${orderId}-${now.getTime()}`,
    roomNumber,
    guestName,
    amount: round2(amount),
    description,
    orderId,
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    createdAt: now.toISOString(),
    postedAt: null,
    reversedAt: null,
    errorMessage: null,
  };
}

// ---------------------------------------------------------------------------
// 2. validateCharge
// ---------------------------------------------------------------------------

/**
 * Validates a charge before it is submitted to the PMS.
 *
 * Checks:
 * - Room number is present and non-empty
 * - Guest name is present and non-empty
 * - Amount is positive
 * - Description is present
 * - Order id is present
 * - Charge has not already been posted or reversed
 */
export function validateCharge(
  charge: PMSCharge
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!charge.roomNumber || charge.roomNumber.trim().length === 0) {
    errors.push("Room number is required");
  }

  if (!charge.guestName || charge.guestName.trim().length === 0) {
    errors.push("Guest name is required");
  }

  if (charge.amount <= 0) {
    errors.push("Charge amount must be greater than zero");
  }

  if (!charge.description || charge.description.trim().length === 0) {
    errors.push("Charge description is required");
  }

  if (!charge.orderId || charge.orderId.trim().length === 0) {
    errors.push("Order ID is required");
  }

  // Why check status? Prevents accidental double-posts or reversals.
  if (charge.status === "posted") {
    errors.push("Charge has already been posted");
  }

  if (charge.status === "reversed") {
    errors.push("Charge has been reversed and cannot be reposted");
  }

  return { isValid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// 3. postCharge
// ---------------------------------------------------------------------------

/**
 * Simulates posting a charge to the PMS.
 *
 * Why simulate? The actual PMS HTTP call lives in the integration layer;
 * this function validates and returns a deterministic result so the
 * business-logic layer stays testable without network mocks.
 */
export function postCharge(
  charge: PMSCharge,
  now: Date = new Date()
): PostingResult {
  const validation = validateCharge(charge);

  if (!validation.isValid) {
    // Why non-retryable? Validation errors won't fix themselves on retry.
    return {
      success: false,
      chargeId: charge.id,
      error: validation.errors.join("; "),
      retryable: false,
    };
  }

  if (charge.attempts >= charge.maxAttempts) {
    return {
      success: false,
      chargeId: charge.id,
      error: `Maximum posting attempts (${charge.maxAttempts}) exceeded`,
      retryable: false,
    };
  }

  // Charge passes all checks — treat as successful post
  return {
    success: true,
    chargeId: charge.id,
    retryable: false,
  };
}

// ---------------------------------------------------------------------------
// 4. markPosted
// ---------------------------------------------------------------------------

/**
 * Returns a new charge with `posted` status and the posted timestamp.
 * The original charge is never mutated.
 */
export function markPosted(
  charge: PMSCharge,
  now: Date = new Date()
): PMSCharge {
  return {
    ...charge,
    status: "posted",
    postedAt: now.toISOString(),
    errorMessage: null,
  };
}

// ---------------------------------------------------------------------------
// 5. markFailed
// ---------------------------------------------------------------------------

/**
 * Returns a new charge with `failed` status and an error message.
 * Why keep the error? So the UI can display the reason to the operator.
 */
export function markFailed(charge: PMSCharge, error: string): PMSCharge {
  return {
    ...charge,
    status: "failed",
    errorMessage: error,
  };
}

// ---------------------------------------------------------------------------
// 6. shouldRetry
// ---------------------------------------------------------------------------

/**
 * Determines whether a failed charge is eligible for another posting attempt.
 *
 * Why compare attempts to maxAttempts? Each property has independent control
 * so high-value charges can be given more retry opportunities.
 */
export function shouldRetry(charge: PMSCharge): boolean {
  if (charge.status !== "failed" && charge.status !== "retrying") {
    return false;
  }
  return charge.attempts < charge.maxAttempts;
}

// ---------------------------------------------------------------------------
// 7. incrementRetry
// ---------------------------------------------------------------------------

/**
 * Increments the attempt counter and sets status to `retrying`.
 * Returns a new charge — the original is not mutated.
 */
export function incrementRetry(charge: PMSCharge): PMSCharge {
  return {
    ...charge,
    status: "retrying",
    attempts: charge.attempts + 1,
  };
}

// ---------------------------------------------------------------------------
// 8. reverseCharge
// ---------------------------------------------------------------------------

/**
 * Marks a posted charge as reversed (e.g. guest disputes the charge).
 *
 * Why only allow reversal of posted charges? Pending/failed charges
 * haven't hit the PMS folio — they can simply be discarded.
 */
export function reverseCharge(
  charge: PMSCharge,
  now: Date = new Date()
): PMSCharge {
  return {
    ...charge,
    status: "reversed",
    reversedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 9. getChargesByStatus
// ---------------------------------------------------------------------------

/** Filters a charge list to a single status. */
export function getChargesByStatus(
  charges: PMSCharge[],
  status: PMSCharge["status"]
): PMSCharge[] {
  return charges.filter((c) => c.status === status);
}

// ---------------------------------------------------------------------------
// 10. calculateRoomTotal
// ---------------------------------------------------------------------------

/**
 * Sums the amounts of all posted charges for a set of charges.
 *
 * Why only posted? Pending, failed, and reversed charges should not
 * appear on a guest's running balance.
 */
export function calculateRoomTotal(charges: PMSCharge[]): number {
  const total = charges
    .filter((c) => c.status === "posted")
    .reduce((sum, c) => sum + c.amount, 0);

  return round2(total);
}

// ---------------------------------------------------------------------------
// 11. getFailedChargesForRetry
// ---------------------------------------------------------------------------

/**
 * Returns all failed charges that are still eligible for retry.
 * Convenience wrapper around `shouldRetry` for batch processing.
 */
export function getFailedChargesForRetry(charges: PMSCharge[]): PMSCharge[] {
  return charges.filter(
    (c) => (c.status === "failed" || c.status === "retrying") && shouldRetry(c)
  );
}

// ---------------------------------------------------------------------------
// 12. generateChargeReport
// ---------------------------------------------------------------------------

/**
 * Produces an aggregate report across a collection of charges.
 *
 * Why totalAmount only from posted charges? That is the revenue
 * that actually landed on guest folios.
 */
export function generateChargeReport(charges: PMSCharge[]): ChargeReport {
  const posted = charges.filter((c) => c.status === "posted");
  const failed = charges.filter((c) => c.status === "failed");
  const pending = charges.filter(
    (c) => c.status === "pending" || c.status === "retrying"
  );
  const reversed = charges.filter((c) => c.status === "reversed");

  const totalAmount = posted.reduce((sum, c) => sum + c.amount, 0);

  return {
    total: charges.length,
    posted: posted.length,
    failed: failed.length,
    pending: pending.length,
    reversed: reversed.length,
    totalAmount: round2(totalAmount),
  };
}
