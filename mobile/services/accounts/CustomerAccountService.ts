/**
 * CustomerAccountService — pure functions for customer account logic.
 * (customer-accounts tasks 13.1-13.5, 14.1-14.3)
 *
 * Handles:
 *   - Account display helpers (balance, credit status, aging)
 *   - Charge-to-account validation (credit limit checks)
 *   - Payment entry validation and allocation
 *   - Transaction history filtering
 *
 * Why pure functions?
 * Account balance calculations must be deterministic and auditable.
 * Pure functions ensure the same inputs always produce the same outputs,
 * critical for financial accuracy in POS systems.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AccountStatus = "active" | "suspended" | "closed" | "pending_approval";

export type TransactionType = "charge" | "payment" | "credit_note" | "write_off";

export type PaymentTerms = "net_7" | "net_14" | "net_30" | "net_60" | "cod";

export interface CustomerAccount {
  id: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  status: AccountStatus;
  creditLimit: number;
  currentBalance: number;
  paymentTerms: PaymentTerms;
  openedAt: string; // ISO
  lastTransactionAt?: string;
}

export interface AccountTransaction {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  /** Running balance after this transaction. */
  balanceAfter: number;
  description: string;
  reference?: string;
  createdAt: string; // ISO
  staffName: string;
}

export interface ChargeRequest {
  accountId: string;
  orderId: string;
  amount: number;
  description: string;
}

export interface PaymentRequest {
  accountId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
}

export interface BalanceSummary {
  currentBalance: number;
  creditLimit: number;
  availableCredit: number;
  creditUtilisation: number; // percentage 0-100
  isOverLimit: boolean;
  isOverdue: boolean;
  daysSinceLastPayment: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  closed: "Closed",
  pending_approval: "Pending Approval",
};

export const ACCOUNT_STATUS_COLORS: Record<AccountStatus, string> = {
  active: "#22c55e",
  suspended: "#fbbf24",
  closed: "#ef4444",
  pending_approval: "#3b82f6",
};

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  net_7: "Net 7 Days",
  net_14: "Net 14 Days",
  net_30: "Net 30 Days",
  net_60: "Net 60 Days",
  cod: "Cash on Delivery",
};

export const PAYMENT_TERMS_DAYS: Record<PaymentTerms, number> = {
  net_7: 7,
  net_14: 14,
  net_30: 30,
  net_60: 60,
  cod: 0,
};

// ---------------------------------------------------------------------------
// Task 13.5: Balance display logic
// ---------------------------------------------------------------------------

/**
 * Calculate balance summary for display.
 */
export function calculateBalanceSummary(
  account: CustomerAccount,
  now: string
): BalanceSummary {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const availableCredit = round2(
    Math.max(0, account.creditLimit - account.currentBalance)
  );

  const creditUtilisation =
    account.creditLimit > 0
      ? round2((account.currentBalance / account.creditLimit) * 100)
      : 0;

  const isOverLimit = account.currentBalance > account.creditLimit;

  // Check if overdue based on payment terms
  const termDays = PAYMENT_TERMS_DAYS[account.paymentTerms];
  let isOverdue = false;
  let daysSinceLastPayment: number | null = null;

  if (account.lastTransactionAt) {
    const lastTxMs = new Date(account.lastTransactionAt).getTime();
    const nowMs = new Date(now).getTime();
    daysSinceLastPayment = Math.floor((nowMs - lastTxMs) / 86400000);
    isOverdue = daysSinceLastPayment > termDays && account.currentBalance > 0;
  }

  return {
    currentBalance: account.currentBalance,
    creditLimit: account.creditLimit,
    availableCredit,
    creditUtilisation,
    isOverLimit,
    isOverdue,
    daysSinceLastPayment,
  };
}

// ---------------------------------------------------------------------------
// Task 14.1: Charge to account validation
// ---------------------------------------------------------------------------

/**
 * Validate a charge-to-account request.
 * Returns array of error messages (empty = valid).
 */
export function validateCharge(
  account: CustomerAccount,
  request: ChargeRequest
): string[] {
  const errors: string[] = [];

  if (account.status !== "active") {
    errors.push(`Account is ${ACCOUNT_STATUS_LABELS[account.status].toLowerCase()} — cannot charge`);
  }

  if (request.amount <= 0) {
    errors.push("Charge amount must be greater than zero");
  }

  const newBalance = account.currentBalance + request.amount;
  if (newBalance > account.creditLimit) {
    const overBy = Math.round((newBalance - account.creditLimit) * 100) / 100;
    errors.push(`Charge exceeds credit limit by R ${overBy.toFixed(2)}`);
  }

  if (!request.description.trim()) {
    errors.push("Description is required for audit trail");
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Task 14.2: Payment entry validation
// ---------------------------------------------------------------------------

/**
 * Validate a payment request.
 * Returns array of error messages (empty = valid).
 */
export function validatePayment(
  account: CustomerAccount,
  request: PaymentRequest
): string[] {
  const errors: string[] = [];

  if (request.amount <= 0) {
    errors.push("Payment amount must be greater than zero");
  }

  if (request.amount > account.currentBalance) {
    errors.push("Payment exceeds current balance");
  }

  if (!request.paymentMethod.trim()) {
    errors.push("Payment method is required");
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Task 13.4: Transaction history filtering
// ---------------------------------------------------------------------------

/**
 * Filter transactions by type and date range.
 */
export function filterTransactions(
  transactions: AccountTransaction[],
  typeFilter: TransactionType | "all",
  dateFrom?: string,
  dateTo?: string
): AccountTransaction[] {
  let result = transactions;

  if (typeFilter !== "all") {
    result = result.filter((t) => t.type === typeFilter);
  }

  if (dateFrom) {
    const from = new Date(dateFrom).getTime();
    result = result.filter((t) => new Date(t.createdAt).getTime() >= from);
  }

  if (dateTo) {
    const to = new Date(dateTo).getTime() + 86400000;
    result = result.filter((t) => new Date(t.createdAt).getTime() < to);
  }

  return result;
}

/**
 * Search accounts by name, email, or phone.
 */
export function searchAccounts(
  accounts: CustomerAccount[],
  query: string
): CustomerAccount[] {
  if (!query.trim()) return accounts;

  const lowerQuery = query.toLowerCase().trim();

  return accounts.filter((a) => {
    if (a.customerName.toLowerCase().includes(lowerQuery)) return true;
    if (a.customerEmail?.toLowerCase().includes(lowerQuery)) return true;
    if (a.customerPhone?.includes(lowerQuery)) return true;
    return false;
  });
}

/**
 * Sort accounts by balance (highest first) for collections prioritisation.
 */
export function sortAccountsByBalance(
  accounts: CustomerAccount[]
): CustomerAccount[] {
  return [...accounts].sort((a, b) => b.currentBalance - a.currentBalance);
}
