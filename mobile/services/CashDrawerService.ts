/**
 * CashDrawerService — cash drawer tracking for the POS.
 * (integrated-payments tasks 9.1-9.4)
 *
 * A "cash drawer session" runs from when the till is opened (float counted)
 * until it is closed (end-of-shift reconciliation).
 *
 * Why pure functions?
 * The drawer state is derived from a list of CashDrawerEvent records stored
 * in WatermelonDB. Keeping calculations pure makes reconciliation math
 * testable without a database, which matters for offline POS reliability.
 *
 * Tasks:
 *   9.1 Cash drawer tracking (session model + running balance)
 *   9.2 Cash drops (mid-shift cash removed for security)
 *   9.3 Paid-outs (petty cash payments to suppliers)
 *   9.4 Expected cash calculation (balance audit)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CashDrawerEventType =
  | "open"        // Shift start — float put in drawer
  | "sale"        // Cash payment received
  | "refund"      // Cash refund paid out
  | "drop"        // Mid-shift cash drop to safe
  | "paidout"     // Petty cash payment to supplier
  | "close";      // Shift end — counting drawer

export interface CashDrawerEvent {
  type: CashDrawerEventType;
  amount: number;  // Always positive; direction is determined by type
  timestamp: string;
  note?: string;
}

export interface CashDrawerSession {
  sessionId: string;
  /** Opening float amount */
  openingFloat: number;
  events: CashDrawerEvent[];
  /** ISO timestamp when the session was opened */
  openedAt: string;
  /** ISO timestamp when the session was closed; null if still open */
  closedAt: string | null;
}

export interface CashDrawerBalance {
  /** Float + sales - refunds - drops - paidouts */
  expectedCash: number;
  /** Total cash sales received during this session */
  totalSales: number;
  /** Total cash refunds paid out */
  totalRefunds: number;
  /** Total cash drops to the safe */
  totalDrops: number;
  /** Total petty cash paid out */
  totalPaidOuts: number;
}

export interface DrawerReconciliation {
  expectedCash: number;
  /** Cash counted at close */
  actualCash: number;
  /** actualCash - expectedCash (positive = over, negative = short) */
  variance: number;
  isBalanced: boolean;
}

// ---------------------------------------------------------------------------
// Task 9.1: Running balance calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the expected cash balance for a drawer session.
 *
 * Cash in:  opening_float, sales
 * Cash out: refunds, drops, paidouts
 *
 * The "close" event itself doesn't change the balance; it just marks the
 * session as ended. Actual counted cash is stored separately for reconciliation.
 */
export function calculateDrawerBalance(
  session: CashDrawerSession
): CashDrawerBalance {
  let totalSales = 0;
  let totalRefunds = 0;
  let totalDrops = 0;
  let totalPaidOuts = 0;

  for (const event of session.events) {
    switch (event.type) {
      case "sale":
        totalSales += event.amount;
        break;
      case "refund":
        totalRefunds += event.amount;
        break;
      case "drop":
        totalDrops += event.amount;
        break;
      case "paidout":
        totalPaidOuts += event.amount;
        break;
      default:
        // "open" and "close" events don't affect running balance
        break;
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const expectedCash = round2(
    session.openingFloat + totalSales - totalRefunds - totalDrops - totalPaidOuts
  );

  return {
    expectedCash: Math.max(0, expectedCash),
    totalSales: round2(totalSales),
    totalRefunds: round2(totalRefunds),
    totalDrops: round2(totalDrops),
    totalPaidOuts: round2(totalPaidOuts),
  };
}

// ---------------------------------------------------------------------------
// Task 9.2: Cash drops
// ---------------------------------------------------------------------------

/**
 * Build a cash drop event for recording a mid-shift cash removal.
 *
 * @param amount - Amount being removed to the safe
 * @param note   - Reason / description for the drop (required for audit)
 */
export function createCashDropEvent(
  amount: number,
  note: string,
  now: Date = new Date()
): CashDrawerEvent {
  if (amount <= 0) throw new Error("Cash drop amount must be greater than zero");
  if (!note.trim()) throw new Error("Cash drop note is required for audit trail");
  return { type: "drop", amount, timestamp: now.toISOString(), note };
}

// ---------------------------------------------------------------------------
// Task 9.3: Paid-outs
// ---------------------------------------------------------------------------

/**
 * Build a paid-out event for petty cash payments to suppliers.
 *
 * @param amount - Amount paid out
 * @param note   - Supplier name / reason (required for audit)
 */
export function createPaidOutEvent(
  amount: number,
  note: string,
  now: Date = new Date()
): CashDrawerEvent {
  if (amount <= 0) throw new Error("Paid-out amount must be greater than zero");
  if (!note.trim()) throw new Error("Paid-out recipient/reason is required for audit trail");
  return { type: "paidout", amount, timestamp: now.toISOString(), note };
}

// ---------------------------------------------------------------------------
// Task 9.4: Expected cash & reconciliation
// ---------------------------------------------------------------------------

/**
 * Reconcile end-of-shift counted cash against expected cash.
 *
 * @param session     - The complete drawer session
 * @param actualCash  - Cash physically counted at close
 * @param tolerance   - Max acceptable variance (default: R0, i.e., must balance)
 */
export function reconcileDrawer(
  session: CashDrawerSession,
  actualCash: number,
  tolerance: number = 0
): DrawerReconciliation {
  const { expectedCash } = calculateDrawerBalance(session);
  const variance = Math.round((actualCash - expectedCash) * 100) / 100;
  return {
    expectedCash,
    actualCash,
    variance,
    isBalanced: Math.abs(variance) <= tolerance,
  };
}

/**
 * Validate that a new cash event is legal given the current session state.
 * Prevents negative drawer balance from refunds or drops.
 */
export function validateCashEvent(
  event: CashDrawerEvent,
  session: CashDrawerSession
): { valid: boolean; error: string | null } {
  const { expectedCash } = calculateDrawerBalance(session);

  if (event.type === "refund" || event.type === "drop" || event.type === "paidout") {
    if (event.amount > expectedCash) {
      return {
        valid: false,
        error: `Cannot remove R${event.amount.toFixed(2)} — only R${expectedCash.toFixed(2)} in drawer`,
      };
    }
  }

  return { valid: true, error: null };
}
