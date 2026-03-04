/**
 * ShiftService — pure calculation layer for shift management.
 * (shift-management tasks 1.6, 3.5, 5.2-5.4)
 *
 * Properties (from design.md):
 *   Property 1: expectedCash = openingFloat + cashSales - cashRefunds
 *                              - cashDrops - paidOuts + payIns
 *   Property 2: At most one shift with status 'open' per terminal at any time.
 *   Property 3: PINs are NEVER stored in plain text — only a cryptographic hash.
 *
 * Why pure functions instead of a class?
 * POS shift calculations must work completely offline and be testable in 0ms.
 * Keeping them pure also makes the reconciliation screen trivially reactive:
 * the component just calls calculateExpectedCash(shift, cashEvents) on every
 * state change with no side effects.
 *
 * The DB write layer (WatermelonDB) lives in the calling screen/hook.
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShiftStatus = "open" | "closed";

/** A shift record as stored in WatermelonDB. */
export interface ShiftRecord {
  id: string;
  terminalId: string;
  userId: string;
  status: ShiftStatus;
  openedAt: string;      // ISO timestamp
  closedAt: string | null;
  openingFloat: number;
  closingCash: number | null;
}

/**
 * A cash event recorded during a shift.
 * This maps to a CashDrawerEvent in CashDrawerService — the same data model
 * is reused here for shift-level summaries.
 */
export type ShiftCashEventType =
  | "sale"     // Cash collected from a customer
  | "refund"   // Cash returned to a customer
  | "drop"     // Cash removed to the safe mid-shift
  | "paidout"  // Petty cash paid out (expenses)
  | "payin";   // Cash added to drawer (e.g., float top-up)

export interface ShiftCashEvent {
  type: ShiftCashEventType;
  amount: number;
  timestamp: string;
  note?: string;
}

/** Summary totals for a shift, derived from its cash events. */
export interface ShiftCashSummary {
  cashSales: number;
  cashRefunds: number;
  cashDrops: number;
  paidOuts: number;
  payIns: number;
  /** Property 1: openingFloat + sales - refunds - drops - paidOuts + payIns */
  expectedCash: number;
}

// ---------------------------------------------------------------------------
// Property 1: Expected cash calculation (tasks 5.2, 5.3, 5.4)
// ---------------------------------------------------------------------------

/**
 * Calculate the expected cash in the drawer at the end of a shift.
 *
 * Property 1: expectedCash = openingFloat + cashSales - cashRefunds
 *                           - cashDrops - paidOuts + payIns
 *
 * All amounts in the events array must be positive; direction is determined
 * by event.type (same convention as CashDrawerService).
 */
export function calculateExpectedCash(
  openingFloat: number,
  events: ShiftCashEvent[]
): ShiftCashSummary {
  let cashSales = 0;
  let cashRefunds = 0;
  let cashDrops = 0;
  let paidOuts = 0;
  let payIns = 0;

  for (const event of events) {
    switch (event.type) {
      case "sale":    cashSales   += event.amount; break;
      case "refund":  cashRefunds += event.amount; break;
      case "drop":    cashDrops   += event.amount; break;
      case "paidout": paidOuts    += event.amount; break;
      case "payin":   payIns      += event.amount; break;
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const expectedCash = round2(
    openingFloat + cashSales - cashRefunds - cashDrops - paidOuts + payIns
  );

  return {
    cashSales:    round2(cashSales),
    cashRefunds:  round2(cashRefunds),
    cashDrops:    round2(cashDrops),
    paidOuts:     round2(paidOuts),
    payIns:       round2(payIns),
    expectedCash: Math.max(0, expectedCash),
  };
}

/**
 * Calculate the cash variance for end-of-shift reconciliation.
 *
 * @param expectedCash - Calculated from calculateExpectedCash
 * @param countedCash  - Physical cash counted by the operator
 * @returns variance = countedCash - expectedCash (positive = over, negative = short)
 */
export function calculateVariance(
  expectedCash: number,
  countedCash: number
): number {
  return Math.round((countedCash - expectedCash) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Property 2: Single active shift per terminal (task 3.5)
// ---------------------------------------------------------------------------

/**
 * Check whether a terminal already has an open shift.
 * Used before openShift() to enforce the single-active-shift invariant.
 *
 * Property 2: at most one shift per terminal may have status 'open'.
 */
export function hasOpenShift(
  terminalId: string,
  allShifts: ShiftRecord[]
): boolean {
  return allShifts.some(
    (s) => s.terminalId === terminalId && s.status === "open"
  );
}

/**
 * Get the current open shift for a terminal, or null if none.
 */
export function getOpenShift(
  terminalId: string,
  allShifts: ShiftRecord[]
): ShiftRecord | null {
  return (
    allShifts.find(
      (s) => s.terminalId === terminalId && s.status === "open"
    ) ?? null
  );
}

/**
 * Count open shifts per terminal — used in Property 2 PBT assertions.
 * Returns a Map<terminalId, openCount>.
 */
export function countOpenShiftsPerTerminal(
  shifts: ShiftRecord[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const shift of shifts) {
    if (shift.status === "open") {
      counts.set(shift.terminalId, (counts.get(shift.terminalId) ?? 0) + 1);
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Property 3: PIN security (task 1.6)
// ---------------------------------------------------------------------------

/**
 * Hash a PIN using SHA-256.
 *
 * Why SHA-256 and not bcrypt/argon2?
 * React Native's `crypto` module only exposes the SubtleCrypto API in recent
 * versions. For the offline POS, PIN verification must be instant (<5ms on
 * old Android hardware), which rules out bcrypt (100ms+ per check).
 * SHA-256 with a per-user salt is our pragmatic compromise; the PIN is
 * short-lived and changes are enforced.
 *
 * Production note: if the app moves to expo-crypto, replace with
 * `Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, ...)`.
 *
 * @param pin    - Plain-text PIN (4-6 digits)
 * @param salt   - Per-user salt (typically userId or a dedicated salt field)
 */
export function hashPin(pin: string, salt: string): string {
  return createHash("sha256")
    .update(`${salt}:${pin}`)
    .digest("hex");
}

/**
 * Verify a plain-text PIN against a stored hash.
 *
 * Returns true only if hash(pin, salt) === storedHash.
 * Never logs or returns the plain-text PIN.
 */
export function verifyPin(
  pin: string,
  salt: string,
  storedHash: string
): boolean {
  return hashPin(pin, salt) === storedHash;
}

/**
 * Validate that a PIN meets complexity requirements (4-6 numeric digits).
 */
export function validatePinFormat(pin: string): {
  valid: boolean;
  error: string | null;
} {
  if (!/^\d{4,6}$/.test(pin)) {
    return {
      valid: false,
      error: "PIN must be 4-6 numeric digits",
    };
  }
  return { valid: true, error: null };
}

// ---------------------------------------------------------------------------
// Lockout management
// ---------------------------------------------------------------------------

export const MAX_PIN_ATTEMPTS = 3;

export interface PinAttemptState {
  attempts: number;
  lockedAt: string | null;
}

/**
 * Determine if a PIN attempt state represents a locked account.
 */
export function isPinLocked(state: PinAttemptState): boolean {
  return state.attempts >= MAX_PIN_ATTEMPTS;
}

/**
 * Record a failed PIN attempt. Returns new state.
 */
export function recordFailedPinAttempt(
  state: PinAttemptState,
  now: Date = new Date()
): PinAttemptState {
  const newAttempts = state.attempts + 1;
  return {
    attempts: newAttempts,
    lockedAt: newAttempts >= MAX_PIN_ATTEMPTS ? now.toISOString() : null,
  };
}

/**
 * Reset PIN attempt counter after a successful unlock or PIN change.
 */
export function resetPinAttempts(): PinAttemptState {
  return { attempts: 0, lockedAt: null };
}
