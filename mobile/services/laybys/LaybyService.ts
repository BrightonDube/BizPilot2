/**
 * LaybyService — pure functions for lay-away / layby management.
 *
 * Handles:
 *   - Deposit and payment schedule calculations
 *   - Cancellation fee computation
 *   - Validation, progress tracking, and overdue detection
 *   - Search, filter, sort utilities
 *
 * Why pure functions?
 * Layby payment schedules and cancellation fees involve money.
 * Pure functions ensure the same inputs always produce the same outputs,
 * critical for financial accuracy and auditability in POS systems.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LaybyStatus =
  | "draft"
  | "active"
  | "ready_for_collection"
  | "completed"
  | "cancelled"
  | "overdue";

export type PaymentFrequency = "weekly" | "bi_weekly" | "monthly";

export interface LaybyItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PaymentScheduleEntry {
  dueDate: string;
  amount: number;
  status: "pending" | "partial" | "paid" | "overdue";
  paidAmount: number;
}

export interface Layby {
  id: string;
  referenceNumber: string;
  status: LaybyStatus;
  customerName: string;
  customerId: string;
  items: LaybyItem[];
  totalAmount: number;
  depositAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentFrequency: PaymentFrequency;
  schedule: PaymentScheduleEntry[];
  startDate: string;
  endDate: string;
  nextPaymentDate: string | null;
  nextPaymentAmount: number;
  extensionCount: number;
  notes: string;
  createdAt: string;
}

export interface CancellationResult {
  totalPaid: number;
  cancellationFee: number;
  restockingFee: number;
  refundAmount: number;
}

export interface LaybyValidation {
  isValid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LAYBY_STATUS_LABELS: Record<LaybyStatus, string> = {
  draft: "Draft",
  active: "Active",
  ready_for_collection: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
  overdue: "Overdue",
};

export const LAYBY_STATUS_COLORS: Record<LaybyStatus, string> = {
  draft: "#6b7280",
  active: "#22c55e",
  ready_for_collection: "#3b82f6",
  completed: "#22c55e",
  cancelled: "#ef4444",
  overdue: "#fbbf24",
};

export const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  weekly: "Weekly",
  bi_weekly: "Bi-weekly",
  monthly: "Monthly",
};

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Calculate the deposit amount, enforcing a minimum floor.
 *
 * Why a minimum deposit?
 * Prevents trivially small deposits that don't justify holding stock
 * off the shelf for extended periods.
 */
export function calculateDeposit(
  totalAmount: number,
  depositPercentage: number,
  minimumDeposit: number
): number {
  const calculated = totalAmount * (depositPercentage / 100);
  return Math.max(calculated, minimumDeposit);
}

/**
 * Generate an even payment schedule between start and end dates.
 *
 * Splits the balance into equal instalments at the given frequency.
 * Any rounding remainder is added to the final instalment so the
 * schedule always sums exactly to the balance.
 */
export function generatePaymentSchedule(
  balanceAfterDeposit: number,
  frequency: PaymentFrequency,
  startDate: string,
  endDate: string
): PaymentScheduleEntry[] {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Build due-date list by stepping forward at the chosen frequency
  const dueDates: Date[] = [];
  const cursor = new Date(start);
  advanceCursor(cursor, frequency); // first instalment is one period after start

  while (cursor <= end) {
    dueDates.push(new Date(cursor));
    advanceCursor(cursor, frequency);
  }

  // Edge case: if no dates fit, create a single instalment on the end date
  if (dueDates.length === 0) {
    dueDates.push(new Date(end));
  }

  const count = dueDates.length;
  const baseAmount = Math.floor((balanceAfterDeposit / count) * 100) / 100;
  // Remainder cents go on the last instalment to keep the total exact
  const remainder =
    Math.round((balanceAfterDeposit - baseAmount * count) * 100) / 100;

  return dueDates.map((date, i) => ({
    dueDate: date.toISOString(),
    amount: i === count - 1 ? baseAmount + remainder : baseAmount,
    status: "pending" as const,
    paidAmount: 0,
  }));
}

/**
 * Calculate cancellation fees and the customer's refund.
 *
 * Why both a cancellation fee *and* a restocking fee?
 * The cancellation fee covers admin costs and is percentage-based.
 * The restocking fee covers the cost of returning items to shelf
 * and is per-item to reflect labour regardless of item value.
 */
export function calculateCancellationFees(
  totalPaid: number,
  totalAmount: number,
  cancellationFeePercentage: number,
  minimumFee: number,
  restockingFeePerItem: number,
  itemCount: number
): CancellationResult {
  const cancellationFee = Math.max(
    totalAmount * (cancellationFeePercentage / 100),
    minimumFee
  );
  const restockingFee = restockingFeePerItem * itemCount;
  const totalDeductions = cancellationFee + restockingFee;
  // Never refund more than what was paid, never go negative
  const refundAmount = Math.max(totalPaid - totalDeductions, 0);

  return { totalPaid, cancellationFee, restockingFee, refundAmount };
}

/**
 * Validate a new layby before creation.
 *
 * Checks items, deposit, and totals to catch obvious errors before
 * persisting the layby.
 */
export function validateLaybyCreation(
  items: LaybyItem[],
  depositAmount: number,
  totalAmount: number,
  minimumDeposit: number
): LaybyValidation {
  const errors: string[] = [];

  if (items.length === 0) {
    errors.push("At least one item is required.");
  }

  items.forEach((item, i) => {
    if (item.quantity <= 0) {
      errors.push(`Item ${i + 1} must have a quantity greater than 0.`);
    }
    if (item.unitPrice < 0) {
      errors.push(`Item ${i + 1} has an invalid price.`);
    }
  });

  if (totalAmount <= 0) {
    errors.push("Total amount must be greater than 0.");
  }

  if (depositAmount < minimumDeposit) {
    errors.push(
      `Deposit must be at least ${minimumDeposit.toFixed(2)}.`
    );
  }

  if (depositAmount > totalAmount) {
    errors.push("Deposit cannot exceed the total amount.");
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Get progress percentage and whether the customer is on track.
 *
 * A simple ratio; "behind" / "ahead" is left to the caller's
 * schedule-based logic — here we only report the raw percentage.
 */
export function getLaybyProgress(
  amountPaid: number,
  totalAmount: number
): { percentage: number; status: "on_track" | "behind" | "ahead" } {
  if (totalAmount <= 0) return { percentage: 100, status: "on_track" };

  const percentage = Math.min((amountPaid / totalAmount) * 100, 100);

  // Compare paid vs what *should* have been paid by now using the schedule
  // Without schedule context we default to on_track — the component can
  // refine this further.
  let status: "on_track" | "behind" | "ahead" = "on_track";
  if (percentage >= 100) {
    status = "ahead";
  }

  return { percentage: Math.round(percentage * 100) / 100, status };
}

/**
 * Check if any scheduled payment is overdue.
 */
export function isPaymentOverdue(
  schedule: PaymentScheduleEntry[],
  now: Date
): boolean {
  return schedule.some(
    (entry) =>
      entry.status !== "paid" && new Date(entry.dueDate) < now
  );
}

/**
 * Find the next unpaid / partially-paid scheduled payment.
 */
export function getNextPayment(
  schedule: PaymentScheduleEntry[]
): PaymentScheduleEntry | null {
  return (
    schedule.find(
      (entry) => entry.status === "pending" || entry.status === "partial"
    ) ?? null
  );
}

/**
 * Filter laybys to only those matching the given statuses.
 */
export function filterLaybysByStatus(
  laybys: Layby[],
  statuses: LaybyStatus[]
): Layby[] {
  const set = new Set(statuses);
  return laybys.filter((l) => set.has(l.status));
}

/**
 * Search laybys by reference number or customer name.
 *
 * Why case-insensitive substring?
 * Cashiers often type partial reference numbers or approximate
 * customer names on a busy shop floor.
 */
export function searchLaybys(laybys: Layby[], query: string): Layby[] {
  if (!query.trim()) return laybys;
  const q = query.toLowerCase();
  return laybys.filter(
    (l) =>
      l.referenceNumber.toLowerCase().includes(q) ||
      l.customerName.toLowerCase().includes(q)
  );
}

/**
 * Sort laybys by a date field in the given direction.
 *
 * Null `nextPaymentDate` values sort to the end regardless of direction
 * so completed / cancelled laybys don't clutter the top.
 */
export function sortLaybysByDate(
  laybys: Layby[],
  field: "startDate" | "endDate" | "nextPaymentDate",
  direction: "asc" | "desc"
): Layby[] {
  return [...laybys].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    // Push nulls to end
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    const diff = new Date(aVal).getTime() - new Date(bVal).getTime();
    return direction === "asc" ? diff : -diff;
  });
}

/**
 * Sum the outstanding amounts on all overdue schedule entries.
 */
export function calculateOverdueAmount(
  schedule: PaymentScheduleEntry[],
  now: Date
): number {
  return schedule.reduce((sum, entry) => {
    if (entry.status !== "paid" && new Date(entry.dueDate) < now) {
      return sum + (entry.amount - entry.paidAmount);
    }
    return sum;
  }, 0);
}

/**
 * Map a layby status to its display colour.
 */
export function getStatusColor(status: LaybyStatus): string {
  return LAYBY_STATUS_COLORS[status];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Advance a Date cursor by one period of the given frequency. */
function advanceCursor(cursor: Date, frequency: PaymentFrequency): void {
  switch (frequency) {
    case "weekly":
      cursor.setDate(cursor.getDate() + 7);
      break;
    case "bi_weekly":
      cursor.setDate(cursor.getDate() + 14);
      break;
    case "monthly":
      cursor.setMonth(cursor.getMonth() + 1);
      break;
  }
}
