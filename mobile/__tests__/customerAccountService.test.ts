/**
 * Tests for CustomerAccountService — pure function tests.
 * (customer-accounts tasks 13.1-13.5, 14.1-14.3)
 */

import {
  CustomerAccount,
  AccountTransaction,
  ChargeRequest,
  PaymentRequest,
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_COLORS,
  PAYMENT_TERMS_LABELS,
  PAYMENT_TERMS_DAYS,
  calculateBalanceSummary,
  validateCharge,
  validatePayment,
  filterTransactions,
  searchAccounts,
  sortAccountsByBalance,
} from "@/services/accounts/CustomerAccountService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAccount(overrides: Partial<CustomerAccount> = {}): CustomerAccount {
  return {
    id: "acc-1",
    customerName: "Alice Smith",
    customerEmail: "alice@example.com",
    customerPhone: "0812345678",
    status: "active",
    creditLimit: 5000,
    currentBalance: 1500,
    paymentTerms: "net_30",
    openedAt: "2024-01-01T00:00:00Z",
    lastTransactionAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<AccountTransaction> = {}): AccountTransaction {
  return {
    id: "tx-1",
    accountId: "acc-1",
    type: "charge",
    amount: 100,
    balanceAfter: 1600,
    description: "Order #123",
    createdAt: "2025-01-15T12:00:00Z",
    staffName: "Jane",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Constants", () => {
  it("ACCOUNT_STATUS_LABELS covers all statuses", () => {
    expect(Object.keys(ACCOUNT_STATUS_LABELS)).toHaveLength(4);
  });

  it("ACCOUNT_STATUS_COLORS covers all statuses", () => {
    expect(Object.keys(ACCOUNT_STATUS_COLORS)).toHaveLength(4);
  });

  it("PAYMENT_TERMS_LABELS covers all terms", () => {
    expect(Object.keys(PAYMENT_TERMS_LABELS)).toHaveLength(5);
  });

  it("PAYMENT_TERMS_DAYS has correct values", () => {
    expect(PAYMENT_TERMS_DAYS.net_7).toBe(7);
    expect(PAYMENT_TERMS_DAYS.net_30).toBe(30);
    expect(PAYMENT_TERMS_DAYS.cod).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateBalanceSummary
// ---------------------------------------------------------------------------

describe("calculateBalanceSummary", () => {
  it("calculates available credit", () => {
    const account = makeAccount({ creditLimit: 5000, currentBalance: 2000 });
    const result = calculateBalanceSummary(account, "2025-01-15T12:00:00Z");
    expect(result.availableCredit).toBe(3000);
    expect(result.creditUtilisation).toBe(40);
    expect(result.isOverLimit).toBe(false);
  });

  it("detects over-limit accounts", () => {
    const account = makeAccount({ creditLimit: 1000, currentBalance: 1500 });
    const result = calculateBalanceSummary(account, "2025-01-15T12:00:00Z");
    expect(result.isOverLimit).toBe(true);
    expect(result.availableCredit).toBe(0);
  });

  it("calculates days since last payment", () => {
    const account = makeAccount({ lastTransactionAt: "2025-01-01T00:00:00Z" });
    const result = calculateBalanceSummary(account, "2025-01-15T00:00:00Z");
    expect(result.daysSinceLastPayment).toBe(14);
  });

  it("detects overdue accounts", () => {
    const account = makeAccount({
      paymentTerms: "net_7",
      lastTransactionAt: "2025-01-01T00:00:00Z",
      currentBalance: 500,
    });
    const result = calculateBalanceSummary(account, "2025-01-15T00:00:00Z");
    expect(result.isOverdue).toBe(true);
  });

  it("not overdue with zero balance", () => {
    const account = makeAccount({
      paymentTerms: "net_7",
      lastTransactionAt: "2025-01-01T00:00:00Z",
      currentBalance: 0,
    });
    const result = calculateBalanceSummary(account, "2025-01-15T00:00:00Z");
    expect(result.isOverdue).toBe(false);
  });

  it("handles zero credit limit", () => {
    const account = makeAccount({ creditLimit: 0 });
    const result = calculateBalanceSummary(account, "2025-01-15T12:00:00Z");
    expect(result.creditUtilisation).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// validateCharge
// ---------------------------------------------------------------------------

describe("validateCharge", () => {
  it("valid charge within credit limit", () => {
    const account = makeAccount();
    const request: ChargeRequest = {
      accountId: "acc-1",
      orderId: "ord-1",
      amount: 500,
      description: "Order #456",
    };
    expect(validateCharge(account, request)).toEqual([]);
  });

  it("rejects charge on inactive account", () => {
    const account = makeAccount({ status: "suspended" });
    const request: ChargeRequest = {
      accountId: "acc-1",
      orderId: "ord-1",
      amount: 100,
      description: "Test",
    };
    const errors = validateCharge(account, request);
    expect(errors.some((e) => e.includes("suspended"))).toBe(true);
  });

  it("rejects negative amount", () => {
    const request: ChargeRequest = {
      accountId: "acc-1",
      orderId: "ord-1",
      amount: -50,
      description: "Test",
    };
    const errors = validateCharge(makeAccount(), request);
    expect(errors.some((e) => e.includes("greater than zero"))).toBe(true);
  });

  it("rejects charge exceeding credit limit", () => {
    const account = makeAccount({ creditLimit: 2000, currentBalance: 1800 });
    const request: ChargeRequest = {
      accountId: "acc-1",
      orderId: "ord-1",
      amount: 500,
      description: "Big order",
    };
    const errors = validateCharge(account, request);
    expect(errors.some((e) => e.includes("credit limit"))).toBe(true);
  });

  it("rejects empty description", () => {
    const request: ChargeRequest = {
      accountId: "acc-1",
      orderId: "ord-1",
      amount: 100,
      description: "  ",
    };
    const errors = validateCharge(makeAccount(), request);
    expect(errors.some((e) => e.includes("Description"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validatePayment
// ---------------------------------------------------------------------------

describe("validatePayment", () => {
  it("valid payment", () => {
    const account = makeAccount({ currentBalance: 1000 });
    const request: PaymentRequest = {
      accountId: "acc-1",
      amount: 500,
      paymentMethod: "cash",
    };
    expect(validatePayment(account, request)).toEqual([]);
  });

  it("rejects negative amount", () => {
    const request: PaymentRequest = {
      accountId: "acc-1",
      amount: -10,
      paymentMethod: "cash",
    };
    const errors = validatePayment(makeAccount(), request);
    expect(errors.some((e) => e.includes("greater than zero"))).toBe(true);
  });

  it("rejects payment exceeding balance", () => {
    const account = makeAccount({ currentBalance: 100 });
    const request: PaymentRequest = {
      accountId: "acc-1",
      amount: 200,
      paymentMethod: "cash",
    };
    const errors = validatePayment(account, request);
    expect(errors.some((e) => e.includes("exceeds current balance"))).toBe(true);
  });

  it("rejects empty payment method", () => {
    const request: PaymentRequest = {
      accountId: "acc-1",
      amount: 100,
      paymentMethod: "",
    };
    const errors = validatePayment(makeAccount(), request);
    expect(errors.some((e) => e.includes("Payment method"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// filterTransactions
// ---------------------------------------------------------------------------

describe("filterTransactions", () => {
  const transactions = [
    makeTransaction({ id: "tx-1", type: "charge", createdAt: "2025-01-10T12:00:00Z" }),
    makeTransaction({ id: "tx-2", type: "payment", createdAt: "2025-01-15T12:00:00Z" }),
    makeTransaction({ id: "tx-3", type: "charge", createdAt: "2025-01-20T12:00:00Z" }),
  ];

  it("returns all when type is all", () => {
    expect(filterTransactions(transactions, "all")).toHaveLength(3);
  });

  it("filters by type", () => {
    expect(filterTransactions(transactions, "charge")).toHaveLength(2);
    expect(filterTransactions(transactions, "payment")).toHaveLength(1);
  });

  it("filters by dateFrom", () => {
    const result = filterTransactions(transactions, "all", "2025-01-14");
    expect(result).toHaveLength(2);
  });

  it("filters by dateTo", () => {
    const result = filterTransactions(transactions, "all", undefined, "2025-01-15");
    expect(result).toHaveLength(2);
  });

  it("combines type and date filters", () => {
    const result = filterTransactions(transactions, "charge", "2025-01-15");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("tx-3");
  });
});

// ---------------------------------------------------------------------------
// searchAccounts
// ---------------------------------------------------------------------------

describe("searchAccounts", () => {
  const accounts = [
    makeAccount({ id: "a1", customerName: "Alice Smith", customerEmail: "alice@example.com", customerPhone: "0811111111" }),
    makeAccount({ id: "a2", customerName: "Bob Jones", customerEmail: "bob@test.com", customerPhone: "0822222222" }),
    makeAccount({ id: "a3", customerName: "Charlie Brown", customerEmail: "charlie@mail.com", customerPhone: "0833333333" }),
  ];

  it("returns all when query is empty", () => {
    expect(searchAccounts(accounts, "")).toHaveLength(3);
  });

  it("searches by name", () => {
    expect(searchAccounts(accounts, "alice")).toHaveLength(1);
  });

  it("searches by email", () => {
    expect(searchAccounts(accounts, "bob@test")).toHaveLength(1);
  });

  it("searches by phone", () => {
    expect(searchAccounts(accounts, "0822")).toHaveLength(1);
  });

  it("is case insensitive", () => {
    expect(searchAccounts(accounts, "CHARLIE")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// sortAccountsByBalance
// ---------------------------------------------------------------------------

describe("sortAccountsByBalance", () => {
  it("sorts highest balance first", () => {
    const accounts = [
      makeAccount({ id: "a1", currentBalance: 100 }),
      makeAccount({ id: "a2", currentBalance: 500 }),
      makeAccount({ id: "a3", currentBalance: 250 }),
    ];
    const sorted = sortAccountsByBalance(accounts);
    expect(sorted[0].id).toBe("a2");
    expect(sorted[1].id).toBe("a3");
    expect(sorted[2].id).toBe("a1");
  });

  it("does not mutate original", () => {
    const accounts = [
      makeAccount({ id: "a1", currentBalance: 500 }),
      makeAccount({ id: "a2", currentBalance: 100 }),
    ];
    sortAccountsByBalance(accounts);
    expect(accounts[0].id).toBe("a1");
  });
});
