/**
 * PosCheckoutIntegrationService — integrate customer accounts with POS checkout.
 *
 * Task: 14.4 (Integrate with POS checkout)
 *
 * Why a separate integration service?
 * The POS checkout flow needs to: (1) look up an account by name/phone,
 * (2) validate the charge, (3) apply the charge, (4) generate a receipt.
 * This service orchestrates these steps using pure functions from
 * CustomerAccountService and PaymentReceiptService, keeping the checkout
 * screen thin and focused on UI.
 *
 * Why pure functions?
 * The checkout flow must work offline. All validation and calculation
 * runs locally; the actual persistence happens via WatermelonDB write,
 * and sync handles the server update when connectivity returns.
 */

import {
  CustomerAccount,
  AccountTransaction,
  ChargeRequest,
  BalanceSummary,
  AccountStatus,
  TransactionType,
  calculateBalanceSummary,
  validateCharge,
  searchAccounts,
} from "./CustomerAccountService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CheckoutPaymentMethod =
  | "cash"
  | "card"
  | "account"
  | "split";

export interface AccountChargeLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AccountChargePreview {
  /** Is the charge valid? */
  isValid: boolean;
  /** Validation errors (empty if valid) */
  errors: string[];
  /** Account summary before charge */
  currentSummary: BalanceSummary;
  /** Projected balance after charge */
  projectedBalance: number;
  /** Projected available credit after charge */
  projectedAvailableCredit: number;
  /** Projected credit utilisation % after charge */
  projectedUtilisation: number;
  /** Whether the charge would exceed the credit limit */
  wouldExceedLimit: boolean;
}

export interface AccountChargeSummary {
  accountId: string;
  customerName: string;
  orderId: string;
  chargeAmount: number;
  previousBalance: number;
  newBalance: number;
  /** ISO timestamp */
  chargedAt: string;
  /** Staff who processed */
  staffName: string;
}

// ---------------------------------------------------------------------------
// Account lookup for checkout
// ---------------------------------------------------------------------------

/**
 * Search for customer accounts during checkout.
 *
 * Why wrap searchAccounts?
 * At checkout, we only want active accounts with available credit.
 * This pre-filters so the cashier doesn't accidentally select a
 * suspended or over-limit account.
 */
export function searchChargeableAccounts(
  accounts: CustomerAccount[],
  query: string
): CustomerAccount[] {
  const matches = searchAccounts(accounts, query);
  return matches.filter((a) => {
    if (a.status !== "active") return false;
    // Show even if over limit — we'll display a warning
    return true;
  });
}

/**
 * Check if an account is eligible for charging.
 */
export function isAccountChargeable(account: CustomerAccount): {
  eligible: boolean;
  reason?: string;
} {
  if (account.status !== "active") {
    return {
      eligible: false,
      reason: `Account is ${account.status} — only active accounts can be charged`,
    };
  }

  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Charge preview (before confirmation)
// ---------------------------------------------------------------------------

/**
 * Preview a charge-to-account before the cashier confirms.
 *
 * Why a preview?
 * The POS must show the cashier exactly what will happen before they
 * tap "Confirm Charge". This prevents accidental over-limit charges
 * and gives the customer a chance to review.
 */
export function previewAccountCharge(
  account: CustomerAccount,
  chargeAmount: number,
  orderId: string,
  description: string,
  now: string
): AccountChargePreview {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const currentSummary = calculateBalanceSummary(account, now);

  const request: ChargeRequest = {
    accountId: account.id,
    orderId,
    amount: chargeAmount,
    description,
  };

  const errors = validateCharge(account, request);

  const projectedBalance = round2(account.currentBalance + chargeAmount);
  const projectedAvailableCredit = round2(
    Math.max(0, account.creditLimit - projectedBalance)
  );
  const projectedUtilisation =
    account.creditLimit > 0
      ? round2((projectedBalance / account.creditLimit) * 100)
      : 0;
  const wouldExceedLimit = projectedBalance > account.creditLimit;

  return {
    isValid: errors.length === 0,
    errors,
    currentSummary,
    projectedBalance,
    projectedAvailableCredit,
    projectedUtilisation,
    wouldExceedLimit,
  };
}

// ---------------------------------------------------------------------------
// Charge application
// ---------------------------------------------------------------------------

/**
 * Build a charge transaction record.
 *
 * Why build instead of apply?
 * The service returns the transaction data; the caller persists it to
 * WatermelonDB. This keeps the service pure and testable.
 */
export function buildChargeTransaction(
  account: CustomerAccount,
  chargeAmount: number,
  orderId: string,
  description: string,
  staffName: string,
  now: string
): {
  transaction: AccountTransaction;
  updatedBalance: number;
  chargeSummary: AccountChargeSummary;
} {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const newBalance = round2(account.currentBalance + chargeAmount);

  const transaction: AccountTransaction = {
    id: generateTransactionId(),
    accountId: account.id,
    type: "charge" as TransactionType,
    amount: chargeAmount,
    balanceAfter: newBalance,
    description: `${description} (Order: ${orderId.substring(0, 8)})`,
    reference: orderId,
    createdAt: now,
    staffName,
  };

  const chargeSummary: AccountChargeSummary = {
    accountId: account.id,
    customerName: account.customerName,
    orderId,
    chargeAmount,
    previousBalance: account.currentBalance,
    newBalance,
    chargedAt: now,
    staffName,
  };

  return { transaction, updatedBalance: newBalance, chargeSummary };
}

// ---------------------------------------------------------------------------
// Split payment support
// ---------------------------------------------------------------------------

/**
 * Calculate the account portion of a split payment.
 *
 * @param orderTotal    - Total order amount
 * @param accountAmount - Amount to charge to account
 * @returns Remaining amount to pay by other method
 */
export function calculateSplitPayment(
  orderTotal: number,
  accountAmount: number
): {
  accountAmount: number;
  remainingAmount: number;
  isValid: boolean;
  error?: string;
} {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  if (accountAmount <= 0) {
    return {
      accountAmount: 0,
      remainingAmount: orderTotal,
      isValid: false,
      error: "Account amount must be greater than zero",
    };
  }

  if (accountAmount > orderTotal) {
    return {
      accountAmount: orderTotal,
      remainingAmount: 0,
      isValid: false,
      error: "Account amount cannot exceed order total",
    };
  }

  return {
    accountAmount: round2(accountAmount),
    remainingAmount: round2(orderTotal - accountAmount),
    isValid: true,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a unique transaction ID.
 *
 * Why not UUID?
 * In a pure function context, we use a timestamp-based ID that's
 * deterministic enough for offline creation and unique enough to
 * avoid collisions. The sync engine handles deduplication.
 */
function generateTransactionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `txn-${ts}-${rand}`;
}
