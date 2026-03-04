/**
 * SplitPaymentService — pure functions for multi-tender split payment logic.
 * (integrated-payments tasks 7.1-7.4)
 *
 * Properties (from requirements):
 *   Property 1: Sum of all tender amounts SHALL equal the order total exactly.
 *   Property 2: Remaining balance SHALL always be >= 0 and <= order total.
 *   Property 3: An order is fully paid when remaining balance === 0.
 *
 * Why pure functions?
 * The split payment modal needs to recalculate remaining balance and validate
 * on every keystroke. Pure functions let us do this synchronously in useMemo.
 * The actual payment processing (card terminal, API call) happens in the
 * existing PaymentService after the user confirms.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TenderMethod = "cash" | "card" | "eft" | "room_charge" | "voucher";

export interface TenderLine {
  /** Unique ID for this tender line. */
  id: string;
  /** Payment method. */
  method: TenderMethod;
  /** Amount allocated to this tender. */
  amount: number;
  /** For cash: actual cash tendered (may be > amount). */
  cashTendered?: number;
  /** For card/EFT: external reference. */
  reference?: string;
  /** Whether this tender has been processed. */
  processed: boolean;
}

export interface SplitPaymentState {
  /** Order total to be paid. */
  orderTotal: number;
  /** All tender lines. */
  tenders: TenderLine[];
}

export interface SplitPaymentSummary {
  orderTotal: number;
  totalAllocated: number;
  remainingBalance: number;
  changeDue: number;
  isFullyPaid: boolean;
  tenderCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TENDER_METHODS: { value: TenderMethod; label: string; icon: string }[] = [
  { value: "cash", label: "Cash", icon: "cash-outline" },
  { value: "card", label: "Card", icon: "card-outline" },
  { value: "eft", label: "EFT", icon: "swap-horizontal" },
  { value: "room_charge", label: "Room Charge", icon: "bed-outline" },
  { value: "voucher", label: "Voucher", icon: "gift-outline" },
];

// ---------------------------------------------------------------------------
// Task 7.3: Calculate remaining balance
// ---------------------------------------------------------------------------

/**
 * Calculate the split payment summary.
 *
 * Property 2: remainingBalance is clamped to [0, orderTotal].
 * Property 3: isFullyPaid is true when remaining === 0.
 */
export function calculateSplitSummary(state: SplitPaymentState): SplitPaymentSummary {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const totalAllocated = round2(
    state.tenders.reduce((sum, t) => sum + t.amount, 0)
  );

  const remainingBalance = round2(Math.max(0, state.orderTotal - totalAllocated));

  // Change due: only from cash tenders where cashTendered > amount
  const changeDue = round2(
    state.tenders.reduce((sum, t) => {
      if (t.method === "cash" && t.cashTendered && t.cashTendered > t.amount) {
        return sum + (t.cashTendered - t.amount);
      }
      return sum;
    }, 0)
  );

  return {
    orderTotal: state.orderTotal,
    totalAllocated,
    remainingBalance,
    changeDue,
    isFullyPaid: remainingBalance === 0,
    tenderCount: state.tenders.length,
  };
}

// ---------------------------------------------------------------------------
// Task 7.2: Multi-tender tracking
// ---------------------------------------------------------------------------

/**
 * Add a new tender line to the split payment.
 * The amount defaults to the remaining balance.
 */
export function addTender(
  state: SplitPaymentState,
  method: TenderMethod,
  id: string
): SplitPaymentState {
  const summary = calculateSplitSummary(state);
  const newTender: TenderLine = {
    id,
    method,
    amount: summary.remainingBalance,
    processed: false,
  };

  return {
    ...state,
    tenders: [...state.tenders, newTender],
  };
}

/**
 * Update the amount on a specific tender line.
 */
export function updateTenderAmount(
  state: SplitPaymentState,
  tenderId: string,
  amount: number
): SplitPaymentState {
  // Clamp amount to non-negative
  const clamped = Math.max(0, Math.round(amount * 100) / 100);

  return {
    ...state,
    tenders: state.tenders.map((t) =>
      t.id === tenderId ? { ...t, amount: clamped } : t
    ),
  };
}

/**
 * Update cash tendered for a cash tender line.
 */
export function updateCashTendered(
  state: SplitPaymentState,
  tenderId: string,
  cashTendered: number
): SplitPaymentState {
  return {
    ...state,
    tenders: state.tenders.map((t) =>
      t.id === tenderId ? { ...t, cashTendered: Math.max(0, cashTendered) } : t
    ),
  };
}

/**
 * Remove a tender line (only if not yet processed).
 */
export function removeTender(
  state: SplitPaymentState,
  tenderId: string
): SplitPaymentState {
  return {
    ...state,
    tenders: state.tenders.filter(
      (t) => t.id !== tenderId || t.processed
    ),
  };
}

/**
 * Mark a tender as processed (payment confirmed).
 */
export function markTenderProcessed(
  state: SplitPaymentState,
  tenderId: string,
  reference?: string
): SplitPaymentState {
  return {
    ...state,
    tenders: state.tenders.map((t) =>
      t.id === tenderId
        ? { ...t, processed: true, reference: reference ?? t.reference }
        : t
    ),
  };
}

// ---------------------------------------------------------------------------
// Task 7.4: Validation for partial payments
// ---------------------------------------------------------------------------

/**
 * Validate the split payment state before final submission.
 * Returns an array of error messages (empty = valid).
 *
 * Property 1: totalAllocated must equal orderTotal exactly.
 */
export function validateSplitPayment(state: SplitPaymentState): string[] {
  const errors: string[] = [];
  const summary = calculateSplitSummary(state);

  if (state.tenders.length === 0) {
    errors.push("At least one payment method is required");
  }

  if (summary.remainingBalance > 0) {
    errors.push(
      `R ${summary.remainingBalance.toFixed(2)} remaining — add more payment or increase amounts`
    );
  }

  if (summary.totalAllocated > state.orderTotal) {
    errors.push(
      `Over-allocated by R ${(summary.totalAllocated - state.orderTotal).toFixed(2)}`
    );
  }

  // Check cash tenders have enough tendered
  for (const tender of state.tenders) {
    if (tender.method === "cash") {
      if (!tender.cashTendered || tender.cashTendered < tender.amount) {
        errors.push(`Cash tender #${tender.id.slice(-4)}: tendered amount must be >= allocated amount`);
      }
    }
    if (tender.amount <= 0) {
      errors.push(`Tender #${tender.id.slice(-4)}: amount must be greater than zero`);
    }
  }

  return errors;
}
