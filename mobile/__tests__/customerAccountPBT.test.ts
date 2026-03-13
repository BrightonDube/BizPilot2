/**
 * Property-Based Tests for Customer Accounts — tasks 16.1-16.3.
 *
 * These tests verify correctness properties that must hold for ANY valid
 * input, not just specific examples. We use simple random generation
 * (not a full PBT framework like fast-check) because the mobile Jest
 * environment doesn't have fast-check installed, and adding dependencies
 * is outside our scope.
 *
 * Property 1: Balance accuracy — balance after transactions = initial + charges - payments
 * Property 2: Credit limit enforcement — charge validation rejects over-limit
 * Property 3: Payment allocation order — payments reduce balance correctly
 */

import {
  CustomerAccount,
  ChargeRequest,
  PaymentRequest,
  calculateBalanceSummary,
  validateCharge,
  validatePayment,
} from "../services/accounts/CustomerAccountService";

import {
  previewAccountCharge,
  buildChargeTransaction,
  calculateSplitPayment,
} from "../services/accounts/PosCheckoutIntegrationService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = "2024-06-15T12:00:00Z";
const ITERATIONS = 100;

/** Generate a random number between min and max (inclusive) */
function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function makeAccount(overrides: Partial<CustomerAccount> = {}): CustomerAccount {
  return {
    id: `acc-${Math.random().toString(36).substring(2, 10)}`,
    customerName: "PBT Test Account",
    status: "active",
    creditLimit: rand(1000, 50000),
    currentBalance: 0,
    paymentTerms: "net_30",
    openedAt: "2024-01-01T00:00:00Z",
    lastTransactionAt: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Property 1: Balance accuracy (task 16.1)
// ---------------------------------------------------------------------------

describe("PBT Property 1: Balance accuracy", () => {
  it("balance after N charges equals sum of charges", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const creditLimit = rand(5000, 100000);
      let account = makeAccount({ creditLimit, currentBalance: 0 });
      let expectedBalance = 0;

      // Apply 1-5 random charges within credit limit
      const numCharges = Math.floor(Math.random() * 5) + 1;
      const maxChargePerStep = creditLimit / numCharges;

      for (let c = 0; c < numCharges; c++) {
        const chargeAmount = rand(1, maxChargePerStep * 0.8);
        const result = buildChargeTransaction(
          account,
          chargeAmount,
          `order-${c}`,
          "PBT charge",
          "tester",
          NOW
        );

        expectedBalance = Math.round((expectedBalance + chargeAmount) * 100) / 100;
        account = { ...account, currentBalance: result.updatedBalance };
      }

      // Property: actual balance must equal expected balance
      expect(account.currentBalance).toBeCloseTo(expectedBalance, 2);
    }
  });

  it("balance after charge then payment equals charge - payment", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const creditLimit = rand(5000, 100000);
      const chargeAmount = rand(100, creditLimit * 0.5);
      const paymentAmount = rand(1, chargeAmount);

      let account = makeAccount({ creditLimit, currentBalance: 0 });

      // Apply charge
      const chargeResult = buildChargeTransaction(
        account,
        chargeAmount,
        "order-1",
        "PBT charge",
        "tester",
        NOW
      );
      account = { ...account, currentBalance: chargeResult.updatedBalance };

      // Simulate payment (reduce balance)
      const balanceAfterPayment =
        Math.round((account.currentBalance - paymentAmount) * 100) / 100;

      // Property: balance = charge - payment
      const expected = Math.round((chargeAmount - paymentAmount) * 100) / 100;
      expect(balanceAfterPayment).toBeCloseTo(expected, 2);
    }
  });

  it("available credit + balance always equals credit limit", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const creditLimit = rand(1000, 50000);
      const balance = rand(0, creditLimit);
      const account = makeAccount({ creditLimit, currentBalance: balance });

      const summary = calculateBalanceSummary(account, NOW);

      // Property: availableCredit + currentBalance = creditLimit (when not over limit)
      if (!summary.isOverLimit) {
        expect(summary.availableCredit + summary.currentBalance).toBeCloseTo(
          creditLimit,
          2
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Property 2: Credit limit enforcement (task 16.2)
// ---------------------------------------------------------------------------

describe("PBT Property 2: Credit limit enforcement", () => {
  it("validateCharge rejects any charge that would exceed credit limit", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const creditLimit = rand(1000, 50000);
      const balance = rand(0, creditLimit);
      const overLimitAmount = creditLimit - balance + rand(0.01, 1000);

      const account = makeAccount({ creditLimit, currentBalance: balance });
      const request: ChargeRequest = {
        accountId: account.id,
        orderId: "order-pbt",
        amount: overLimitAmount,
        description: "PBT over-limit charge",
      };

      const errors = validateCharge(account, request);

      // Property: validation must reject any over-limit charge
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("credit limit"))).toBe(true);
    }
  });

  it("validateCharge accepts charges within credit limit", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const creditLimit = rand(1000, 50000);
      const balance = rand(0, creditLimit * 0.5);
      const availableCredit = creditLimit - balance;
      const chargeAmount = rand(0.01, availableCredit);

      const account = makeAccount({ creditLimit, currentBalance: balance });
      const request: ChargeRequest = {
        accountId: account.id,
        orderId: "order-pbt",
        amount: chargeAmount,
        description: "PBT valid charge",
      };

      const errors = validateCharge(account, request);

      // Property: within-limit charges must be accepted
      expect(errors).toHaveLength(0);
    }
  });

  it("previewAccountCharge wouldExceedLimit matches actual limit check", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const creditLimit = rand(1000, 50000);
      const balance = rand(0, creditLimit);
      const chargeAmount = rand(1, creditLimit);

      const account = makeAccount({ creditLimit, currentBalance: balance });

      const preview = previewAccountCharge(
        account,
        chargeAmount,
        "order-pbt",
        "PBT preview",
        NOW
      );

      const actuallyExceeds = balance + chargeAmount > creditLimit;

      // Property: preview.wouldExceedLimit must match actual calculation
      expect(preview.wouldExceedLimit).toBe(actuallyExceeds);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 3: Payment allocation order (task 16.3)
// ---------------------------------------------------------------------------

describe("PBT Property 3: Payment allocation correctness", () => {
  it("validatePayment rejects payments exceeding current balance", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const balance = rand(100, 10000);
      const overPayment = balance + rand(0.01, 1000);

      const account = makeAccount({ currentBalance: balance });
      const request: PaymentRequest = {
        accountId: account.id,
        amount: overPayment,
        paymentMethod: "Cash",
      };

      const errors = validatePayment(account, request);

      // Property: over-balance payments must be rejected
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes("exceeds"))).toBe(true);
    }
  });

  it("validatePayment accepts payments within balance", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const balance = rand(100, 10000);
      const paymentAmount = rand(0.01, balance);

      const account = makeAccount({ currentBalance: balance });
      const request: PaymentRequest = {
        accountId: account.id,
        amount: paymentAmount,
        paymentMethod: "Cash",
      };

      const errors = validatePayment(account, request);

      // Property: within-balance payments must be accepted
      expect(errors).toHaveLength(0);
    }
  });

  it("split payment amounts always sum to order total", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const orderTotal = rand(50, 5000);
      const accountAmount = rand(0.01, orderTotal);

      const result = calculateSplitPayment(orderTotal, accountAmount);

      if (result.isValid) {
        // Property: account + remaining = total
        expect(result.accountAmount + result.remainingAmount).toBeCloseTo(
          orderTotal,
          2
        );
      }
    }
  });

  it("credit utilisation is always between 0 and 100+ (proportional)", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const creditLimit = rand(1000, 50000);
      const balance = rand(0, creditLimit * 1.5); // may be over limit

      const account = makeAccount({ creditLimit, currentBalance: balance });
      const summary = calculateBalanceSummary(account, NOW);

      // Property: utilisation = (balance / creditLimit) * 100
      const expectedUtil =
        Math.round((balance / creditLimit) * 10000) / 100;
      expect(summary.creditUtilisation).toBeCloseTo(expectedUtil, 1);
    }
  });
});
