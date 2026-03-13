/**
 * Tests for PaymentReceiptService (task 14.3) and PosCheckoutIntegrationService (task 14.4).
 *
 * Coverage:
 * - Receipt number generation
 * - Receipt data building
 * - Receipt display formatting
 * - Plain text receipt generation
 * - Account search for checkout
 * - Account chargeability check
 * - Charge preview (valid and invalid)
 * - Charge transaction building
 * - Split payment calculation
 */

import {
  buildPaymentReceiptData,
  formatReceiptForDisplay,
  generateReceiptNumber,
} from "../services/accounts/PaymentReceiptService";

import {
  searchChargeableAccounts,
  isAccountChargeable,
  previewAccountCharge,
  buildChargeTransaction,
  calculateSplitPayment,
} from "../services/accounts/PosCheckoutIntegrationService";

import {
  CustomerAccount,
  AccountTransaction,
} from "../services/accounts/CustomerAccountService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAccount(overrides: Partial<CustomerAccount> = {}): CustomerAccount {
  return {
    id: "acc-12345678-abcd",
    customerName: "John Smith",
    customerEmail: "john@example.com",
    customerPhone: "0821234567",
    status: "active",
    creditLimit: 5000,
    currentBalance: 2000,
    paymentTerms: "net_30",
    openedAt: "2024-01-01T00:00:00Z",
    lastTransactionAt: "2024-01-10T12:00:00Z",
    ...overrides,
  };
}

function makeTransaction(
  overrides: Partial<AccountTransaction> = {}
): AccountTransaction {
  return {
    id: "txn-abc12345-def6",
    accountId: "acc-12345678-abcd",
    type: "payment",
    amount: 500,
    balanceAfter: 1500,
    description: "Payment received",
    reference: "REF-001",
    createdAt: "2024-01-15T14:30:00Z",
    staffName: "Alice",
    ...overrides,
  };
}

const NOW = "2024-01-15T14:30:00Z";

// ---------------------------------------------------------------------------
// PaymentReceiptService
// ---------------------------------------------------------------------------

describe("generateReceiptNumber", () => {
  it("generates a formatted receipt number from transaction ID", () => {
    const result = generateReceiptNumber("txn-abc12345-def6");
    expect(result).toMatch(/^RCP-[A-Z0-9]{8}$/);
  });

  it("produces consistent output for same input", () => {
    const a = generateReceiptNumber("txn-abc12345-def6");
    const b = generateReceiptNumber("txn-abc12345-def6");
    expect(a).toBe(b);
  });
});

describe("buildPaymentReceiptData", () => {
  it("builds receipt data with correct balances", () => {
    const account = makeAccount({ currentBalance: 1500 });
    const transaction = makeTransaction({ amount: 500 });

    const receipt = buildPaymentReceiptData(
      account,
      transaction,
      500,
      "Cash",
      "Alice",
      "Test Restaurant"
    );

    expect(receipt.paymentAmount).toBe(500);
    expect(receipt.previousBalance).toBe(2000); // 1500 + 500
    expect(receipt.newBalance).toBe(1500);
    expect(receipt.availableCredit).toBe(3500); // 5000 - 1500
    expect(receipt.customerName).toBe("John Smith");
    expect(receipt.businessName).toBe("Test Restaurant");
  });

  it("includes business details when provided", () => {
    const receipt = buildPaymentReceiptData(
      makeAccount(),
      makeTransaction(),
      500,
      "Card",
      "Bob",
      "My Business",
      { address: "123 Main St", phone: "012345", vatNumber: "VAT123" }
    );

    expect(receipt.businessAddress).toBe("123 Main St");
    expect(receipt.businessPhone).toBe("012345");
    expect(receipt.businessVatNumber).toBe("VAT123");
  });
});

describe("formatReceiptForDisplay", () => {
  it("generates header with business name", () => {
    const receipt = buildPaymentReceiptData(
      makeAccount(),
      makeTransaction(),
      500,
      "Cash",
      "Alice",
      "Test Restaurant"
    );
    const formatted = formatReceiptForDisplay(receipt);

    expect(formatted.header[0]).toBe("Test Restaurant");
    expect(formatted.header).toContain("--- PAYMENT RECEIPT ---");
  });

  it("includes payment amount in line items", () => {
    const receipt = buildPaymentReceiptData(
      makeAccount(),
      makeTransaction(),
      500,
      "Cash",
      "Alice",
      "Test Restaurant"
    );
    const formatted = formatReceiptForDisplay(receipt);

    const amountLine = formatted.lineItems.find(
      (l) => l.label === "Amount Paid"
    );
    expect(amountLine?.value).toBe("R 500.00");
    expect(amountLine?.isTotal).toBe(true);
  });

  it("includes footer with staff name", () => {
    const receipt = buildPaymentReceiptData(
      makeAccount(),
      makeTransaction(),
      500,
      "Cash",
      "Alice",
      "Test Restaurant"
    );
    const formatted = formatReceiptForDisplay(receipt);

    expect(formatted.footer[0]).toContain("Alice");
    expect(formatted.footer[1]).toContain("Thank you");
  });

  it("generates plain text for printing", () => {
    const receipt = buildPaymentReceiptData(
      makeAccount(),
      makeTransaction(),
      500,
      "Cash",
      "Alice",
      "Test Restaurant"
    );
    const formatted = formatReceiptForDisplay(receipt);

    expect(typeof formatted.plainText).toBe("string");
    expect(formatted.plainText).toContain("Test Restaurant");
    expect(formatted.plainText).toContain("R 500.00");
  });
});

// ---------------------------------------------------------------------------
// PosCheckoutIntegrationService
// ---------------------------------------------------------------------------

describe("searchChargeableAccounts", () => {
  const accounts = [
    makeAccount({ id: "a1", customerName: "John Smith", status: "active" }),
    makeAccount({
      id: "a2",
      customerName: "Jane Doe",
      status: "suspended",
    }),
    makeAccount({
      id: "a3",
      customerName: "John Wick",
      status: "active",
    }),
  ];

  it("returns only active accounts matching query", () => {
    const results = searchChargeableAccounts(accounts, "john");
    expect(results).toHaveLength(2);
    expect(results.every((a) => a.status === "active")).toBe(true);
  });

  it("excludes suspended accounts", () => {
    const results = searchChargeableAccounts(accounts, "doe");
    expect(results).toHaveLength(0);
  });
});

describe("isAccountChargeable", () => {
  it("returns eligible for active accounts", () => {
    const result = isAccountChargeable(makeAccount({ status: "active" }));
    expect(result.eligible).toBe(true);
  });

  it("returns not eligible for suspended accounts", () => {
    const result = isAccountChargeable(makeAccount({ status: "suspended" }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("suspended");
  });

  it("returns not eligible for closed accounts", () => {
    const result = isAccountChargeable(makeAccount({ status: "closed" }));
    expect(result.eligible).toBe(false);
  });
});

describe("previewAccountCharge", () => {
  it("shows valid preview within credit limit", () => {
    const account = makeAccount({
      currentBalance: 1000,
      creditLimit: 5000,
    });

    const preview = previewAccountCharge(
      account,
      500,
      "order-1",
      "Lunch order",
      NOW
    );

    expect(preview.isValid).toBe(true);
    expect(preview.errors).toHaveLength(0);
    expect(preview.projectedBalance).toBe(1500);
    expect(preview.projectedAvailableCredit).toBe(3500);
    expect(preview.wouldExceedLimit).toBe(false);
  });

  it("shows invalid preview when exceeding credit limit", () => {
    const account = makeAccount({
      currentBalance: 4800,
      creditLimit: 5000,
    });

    const preview = previewAccountCharge(
      account,
      500,
      "order-1",
      "Large order",
      NOW
    );

    expect(preview.isValid).toBe(false);
    expect(preview.errors.length).toBeGreaterThan(0);
    expect(preview.wouldExceedLimit).toBe(true);
  });

  it("calculates projected utilisation correctly", () => {
    const account = makeAccount({
      currentBalance: 0,
      creditLimit: 10000,
    });

    const preview = previewAccountCharge(
      account,
      2500,
      "order-1",
      "Test",
      NOW
    );

    expect(preview.projectedUtilisation).toBe(25);
  });
});

describe("buildChargeTransaction", () => {
  it("builds a transaction with correct balances", () => {
    const account = makeAccount({ currentBalance: 2000 });

    const result = buildChargeTransaction(
      account,
      750,
      "order-123",
      "Dinner order",
      "Bob",
      NOW
    );

    expect(result.updatedBalance).toBe(2750);
    expect(result.transaction.type).toBe("charge");
    expect(result.transaction.amount).toBe(750);
    expect(result.transaction.balanceAfter).toBe(2750);
    expect(result.transaction.staffName).toBe("Bob");
  });

  it("includes order reference in description", () => {
    const result = buildChargeTransaction(
      makeAccount(),
      100,
      "order-abcdefgh",
      "Test",
      "Staff",
      NOW
    );

    expect(result.transaction.description).toContain("order-ab");
  });

  it("builds charge summary", () => {
    const account = makeAccount({ currentBalance: 1000 });
    const result = buildChargeTransaction(
      account,
      500,
      "order-1",
      "Lunch",
      "Alice",
      NOW
    );

    expect(result.chargeSummary.previousBalance).toBe(1000);
    expect(result.chargeSummary.newBalance).toBe(1500);
    expect(result.chargeSummary.chargeAmount).toBe(500);
  });
});

describe("calculateSplitPayment", () => {
  it("calculates split correctly", () => {
    const result = calculateSplitPayment(1000, 400);
    expect(result.accountAmount).toBe(400);
    expect(result.remainingAmount).toBe(600);
    expect(result.isValid).toBe(true);
  });

  it("rejects zero account amount", () => {
    const result = calculateSplitPayment(1000, 0);
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects account amount exceeding total", () => {
    const result = calculateSplitPayment(1000, 1500);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("exceed");
  });

  it("handles full payment to account", () => {
    const result = calculateSplitPayment(1000, 1000);
    expect(result.remainingAmount).toBe(0);
    expect(result.isValid).toBe(true);
  });
});
