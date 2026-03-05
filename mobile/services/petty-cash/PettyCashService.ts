/**
 * PettyCashService — Pure TypeScript service for petty cash management.
 *
 * Design principles:
 * - Every function is pure: same inputs always produce the same outputs.
 * - Time-dependent logic accepts an injectable `now` / date parameter so
 *   callers (and tests) can control the clock.
 * - All monetary arithmetic goes through `round2` to avoid IEEE-754 drift.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round a number to 2 decimal places (banker-safe for ZAR cents). */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FundStatus = 'active' | 'frozen' | 'closed';

export type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'completed'
  | 'cancelled';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'delegated';

export type ReconciliationStatus = 'in_progress' | 'balanced' | 'variance_found' | 'approved';

export interface PettyCashFund {
  id: string;
  name: string;
  businessId: string;
  /** The amount the fund was originally seeded with. */
  initialBalance: number;
  /** Running balance after all disbursements and receipts. */
  currentBalance: number;
  /** Balance actually available for new requests (currentBalance - reservedAmount). */
  availableBalance: number;
  /** Amount earmarked for approved-but-not-yet-disbursed requests. */
  reservedAmount: number;
  /** Maximum a single expense can be without extra approval. */
  singleExpenseLimit: number;
  /** Maximum aggregate spend allowed per calendar day. */
  dailyExpenseLimit: number;
  status: FundStatus;
  custodianId: string;
  custodianName: string;
  /** ISO-8601 timestamp of last successful reconciliation, or null if never reconciled. */
  lastReconciledAt: string | null;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  /** General-ledger account code for journal entries. */
  accountCode: string;
  /** Hard cap on any single expense in this category (null = no cap). */
  spendingLimit: number | null;
  /** Amounts above this threshold require explicit approval (null = always auto-approve). */
  approvalRequiredAbove: number | null;
  isActive: boolean;
}

export interface ExpenseRequest {
  id: string;
  fundId: string;
  categoryId: string;
  categoryName: string;
  requestedBy: string;
  requestedByName: string;
  description: string;
  justification: string;
  requestedAmount: number;
  /** Set only after an approver decides; null while still pending. */
  approvedAmount: number | null;
  status: RequestStatus;
  /** ISO-8601 */
  createdAt: string;
  /** ISO-8601 */
  updatedAt: string;
}

export interface ExpenseApproval {
  id: string;
  requestId: string;
  approverId: string;
  approverName: string;
  /** Supports multi-level approval chains (1 = first level, 2 = second, …). */
  approvalLevel: number;
  status: ApprovalStatus;
  comments: string | null;
  /** ISO-8601, null until the approver acts. */
  decidedAt: string | null;
}

export interface ExpenseReceipt {
  id: string;
  disbursementId: string;
  vendorName: string;
  /** ISO-8601 date (YYYY-MM-DD). */
  receiptDate: string;
  receiptAmount: number;
  taxAmount: number;
  description: string;
  /** Local or remote URI to the receipt image, if captured. */
  imageUri: string | null;
  /** Whether OCR has been run on the image. */
  ocrProcessed: boolean;
}

export interface FundReconciliation {
  id: string;
  fundId: string;
  /** Balance the system expects based on transactions. */
  expectedBalance: number;
  /** Physical cash count entered by the custodian (null until counted). */
  actualBalance: number | null;
  /** expectedBalance − actualBalance (null until counted). */
  variance: number | null;
  status: ReconciliationStatus;
  reconciledBy: string;
  /** ISO-8601 */
  reconciledAt: string;
  notes: string;
}

export interface DailySpendingSummary {
  /** ISO-8601 date (YYYY-MM-DD). */
  date: string;
  totalSpent: number;
  transactionCount: number;
  remainingDailyLimit: number;
}

// ---------------------------------------------------------------------------
// Pure Functions
// ---------------------------------------------------------------------------

/**
 * Derive the true available balance from fund state.
 *
 * Why a standalone function instead of trusting `fund.availableBalance`?
 * Because the stored value may be stale if reservations changed since the
 * last write — this lets callers recompute on the fly.
 */
export function calculateAvailableBalance(fund: PettyCashFund): number {
  return round2(fund.currentBalance - fund.reservedAmount);
}

/**
 * Determine whether a given expense request can be approved against the fund.
 *
 * Checks are applied in order of cheapest-to-evaluate first so we can
 * short-circuit early and return a meaningful reason string.
 */
export function canApproveRequest(
  request: ExpenseRequest,
  fund: PettyCashFund,
): { canApprove: boolean; reason: string | null } {
  if (fund.status !== 'active') {
    return { canApprove: false, reason: `Fund is ${fund.status} — disbursements are blocked` };
  }

  if (request.requestedAmount > fund.singleExpenseLimit) {
    return {
      canApprove: false,
      reason: `Amount R${request.requestedAmount} exceeds single-expense limit of R${fund.singleExpenseLimit}`,
    };
  }

  const available = calculateAvailableBalance(fund);
  if (request.requestedAmount > available) {
    return {
      canApprove: false,
      reason: `Insufficient available balance (R${available}) for requested R${request.requestedAmount}`,
    };
  }

  return { canApprove: true, reason: null };
}

/**
 * Does this amount require explicit approval for the given category?
 *
 * If the category has no `approvalRequiredAbove` threshold, every amount
 * is considered pre-approved (returns false).
 */
export function requiresApproval(amount: number, category: ExpenseCategory): boolean {
  if (category.approvalRequiredAbove === null) {
    return false;
  }
  return amount > category.approvalRequiredAbove;
}

/**
 * Validate an expense request before it is submitted.
 *
 * Returns a list of human-readable errors so the UI can display them
 * next to the relevant fields.
 */
export function validateExpenseRequest(
  request: { amount: number; description: string; categoryId: string },
  fund: PettyCashFund,
  categories: ExpenseCategory[],
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // --- Amount checks ---
  if (request.amount <= 0) {
    errors.push('Amount must be greater than zero');
  }

  if (request.amount > fund.singleExpenseLimit) {
    errors.push(
      `Amount R${request.amount} exceeds the single-expense limit of R${fund.singleExpenseLimit}`,
    );
  }

  const available = calculateAvailableBalance(fund);
  if (request.amount > available) {
    errors.push(`Insufficient available balance (R${available})`);
  }

  // --- Description ---
  if (!request.description || request.description.trim().length === 0) {
    errors.push('Description is required');
  }

  // --- Category ---
  const category = categories.find((c) => c.id === request.categoryId);
  if (!category) {
    errors.push('Invalid expense category');
  } else {
    if (!category.isActive) {
      errors.push(`Category "${category.name}" is no longer active`);
    }
    // Enforce category-level spending cap when present
    if (category.spendingLimit !== null && request.amount > category.spendingLimit) {
      errors.push(
        `Amount R${request.amount} exceeds the category spending limit of R${category.spendingLimit}`,
      );
    }
  }

  // --- Fund status ---
  if (fund.status !== 'active') {
    errors.push(`Fund is ${fund.status} — new requests are not allowed`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Return a **new** fund object reflecting a disbursement.
 *
 * Both `currentBalance` and `reservedAmount` decrease because the money
 * has physically left the fund (it was previously reserved at approval time).
 */
export function applyDisbursement(fund: PettyCashFund, amount: number): PettyCashFund {
  const newCurrentBalance = round2(fund.currentBalance - amount);
  const newReservedAmount = round2(fund.reservedAmount - amount);
  return {
    ...fund,
    currentBalance: newCurrentBalance,
    reservedAmount: newReservedAmount,
    availableBalance: round2(newCurrentBalance - newReservedAmount),
  };
}

/**
 * Adjust the fund balance after a receipt is submitted.
 *
 * Why adjust? The actual receipt amount may differ from what was originally
 * disbursed (e.g. the employee spent R48 but was given R50). The difference
 * is returned to the fund.
 */
export function applyReceipt(
  fund: PettyCashFund,
  receiptAmount: number,
  requestedAmount: number,
): PettyCashFund {
  // Positive difference = employee returns unspent cash; negative = overspend
  const difference = round2(requestedAmount - receiptAmount);
  const newCurrentBalance = round2(fund.currentBalance + difference);
  return {
    ...fund,
    currentBalance: newCurrentBalance,
    availableBalance: round2(newCurrentBalance - fund.reservedAmount),
  };
}

/**
 * Compute the reconciliation variance between expected and actual balances.
 *
 * A tolerance of R0.01 is used to account for rounding in physical cash
 * counting (e.g. dropped coins).
 */
export function calculateReconciliationVariance(
  expected: number,
  actual: number,
): { variance: number; status: ReconciliationStatus; isBalanced: boolean } {
  const variance = round2(expected - actual);
  const isBalanced = Math.abs(variance) < 0.01;
  return {
    variance,
    status: isBalanced ? 'balanced' : 'variance_found',
    isBalanced,
  };
}

/**
 * Aggregate spending for a single calendar day.
 *
 * Only requests in terminal spending states (approved / disbursed / completed)
 * count toward the daily total — drafts and rejected requests do not.
 */
export function getDailySpending(
  requests: ExpenseRequest[],
  date: string,
  dailyLimit: number = 0,
): DailySpendingSummary {
  const spendingStatuses: RequestStatus[] = ['approved', 'disbursed', 'completed'];

  const dayRequests = requests.filter((r) => {
    // Compare only the YYYY-MM-DD portion so timezone offsets don't matter
    const requestDate = r.createdAt.substring(0, 10);
    return requestDate === date && spendingStatuses.includes(r.status);
  });

  const totalSpent = round2(
    dayRequests.reduce((sum, r) => sum + (r.approvedAmount ?? r.requestedAmount), 0),
  );

  return {
    date,
    totalSpent,
    transactionCount: dayRequests.length,
    remainingDailyLimit: round2(Math.max(0, dailyLimit - totalSpent)),
  };
}

/**
 * Check whether a new expense would breach the fund's daily spending limit.
 *
 * @param today - ISO-8601 date string (YYYY-MM-DD) so the caller (or test)
 *   can inject the current date instead of relying on `new Date()`.
 */
export function checkDailyLimit(
  fund: PettyCashFund,
  requests: ExpenseRequest[],
  newAmount: number,
  today: string,
): { withinLimit: boolean; remaining: number } {
  const summary = getDailySpending(requests, today, fund.dailyExpenseLimit);
  const projectedTotal = round2(summary.totalSpent + newAmount);
  const remaining = round2(fund.dailyExpenseLimit - projectedTotal);

  return {
    withinLimit: projectedTotal <= fund.dailyExpenseLimit,
    remaining: Math.max(0, remaining),
  };
}

/**
 * Filter expense requests by one or more statuses.
 *
 * Accepts an array so the caller can ask for e.g. all "active" requests
 * (`['submitted', 'pending_approval', 'approved']`) in a single call.
 */
export function filterRequestsByStatus(
  requests: ExpenseRequest[],
  statuses: RequestStatus[],
): ExpenseRequest[] {
  const statusSet = new Set(statuses);
  return requests.filter((r) => statusSet.has(r.status));
}

/**
 * Get expense requests that are waiting on a specific approver.
 *
 * A request is "pending for approverId" when it is in the `pending_approval`
 * state **and** there exists an approval record for that approver whose
 * status is still `pending`.
 */
export function getPendingApprovals(
  requests: ExpenseRequest[],
  approvals: ExpenseApproval[],
  approverId: string,
): ExpenseRequest[] {
  // Build a set of request IDs that have a pending approval for this approver
  const pendingRequestIds = new Set(
    approvals
      .filter((a) => a.approverId === approverId && a.status === 'pending')
      .map((a) => a.requestId),
  );

  return requests.filter(
    (r) => r.status === 'pending_approval' && pendingRequestIds.has(r.id),
  );
}

/**
 * Calculate how much of the fund has been consumed.
 *
 * Thresholds (≥ 80 % = healthy, ≥ 50 % = low, < 50 % = critical) are
 * intentionally generous because petty cash should be replenished well
 * before it runs dry.
 */
export function calculateFundUtilization(
  fund: PettyCashFund,
): { utilized: number; percentage: number; status: 'healthy' | 'low' | 'critical' } {
  if (fund.initialBalance === 0) {
    return { utilized: 0, percentage: 0, status: 'critical' };
  }

  const utilized = round2(fund.initialBalance - fund.currentBalance);
  const percentage = round2((fund.currentBalance / fund.initialBalance) * 100);

  let status: 'healthy' | 'low' | 'critical';
  if (percentage >= 80) {
    status = 'healthy';
  } else if (percentage >= 50) {
    status = 'low';
  } else {
    status = 'critical';
  }

  return { utilized, percentage, status };
}

/**
 * Sort expense requests so the most urgent ones appear first.
 *
 * Urgency order:
 *   1. `pending_approval` — someone needs to act on these
 *   2. `submitted` — newly created, waiting to enter the queue
 *   3. Everything else, newest first (by `createdAt`)
 */
export function sortRequestsByUrgency(requests: ExpenseRequest[]): ExpenseRequest[] {
  const priorityMap: Partial<Record<RequestStatus, number>> = {
    pending_approval: 0,
    submitted: 1,
  };
  const defaultPriority = 2;

  return [...requests].sort((a, b) => {
    const pa = priorityMap[a.status] ?? defaultPriority;
    const pb = priorityMap[b.status] ?? defaultPriority;

    if (pa !== pb) return pa - pb;

    // Within the same priority bucket, most recent first
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Generate a human-readable request reference number.
 *
 * Format: `PC-YYYYMMDD-XXXX` where XXXX is zero-padded.
 * The `date` parameter is an ISO-8601 string (YYYY-MM-DD or full timestamp)
 * so callers can inject a deterministic value in tests.
 */
export function formatRequestNumber(index: number, date: string): string {
  const datePart = date.substring(0, 10).replace(/-/g, '');
  const seqPart = String(index).padStart(4, '0');
  return `PC-${datePart}-${seqPart}`;
}
