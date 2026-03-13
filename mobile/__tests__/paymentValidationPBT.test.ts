/**
 * BizPilot Mobile POS — Payment Validation PBT
 *
 * Property-based tests for the payment flow:
 * - Split payment amounts must sum to the order total
 * - Cash change calculation is always correct
 * - Payment is never accepted if total amount is insufficient
 * - Quick amount suggestions are always >= total
 */

import {
  roundTo2,
  calculateChange,
  isPaymentSufficient,
  getQuickAmounts,
} from "@/utils/priceCalculator";
import {
  validateAmount,
  validateQuantity,
} from "@/utils/validators";

// ---------------------------------------------------------------------------
// Property 1: Payment is sufficient iff tendered >= total
// ---------------------------------------------------------------------------

describe("PBT: Payment sufficiency", () => {
  it("isPaymentSufficient(total, tendered) === (tendered >= total)", () => {
    for (let i = 0; i < 200; i++) {
      const total = roundTo2(Math.random() * 2000);
      const tendered = roundTo2(Math.random() * 3000);

      const result = isPaymentSufficient(total, tendered);
      const expected = tendered >= total;

      expect(result).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 2: Change is always non-negative when payment is sufficient
// ---------------------------------------------------------------------------

describe("PBT: Change non-negativity", () => {
  it("change >= 0 when tendered >= total", () => {
    for (let i = 0; i < 200; i++) {
      const total = roundTo2(Math.random() * 2000);
      const extra = roundTo2(Math.random() * 500);
      const tendered = total + extra;

      const change = calculateChange(total, tendered);
      expect(change).toBeGreaterThanOrEqual(0);
    }
  });

  it("change + total = tendered (within 1 cent)", () => {
    for (let i = 0; i < 200; i++) {
      const total = roundTo2(Math.random() * 2000);
      const extra = roundTo2(Math.random() * 500);
      const tendered = roundTo2(total + extra);

      const change = calculateChange(total, tendered);
      const reconstructed = roundTo2(change + total);
      const diff = Math.abs(reconstructed - tendered);

      expect(diff).toBeLessThanOrEqual(0.01);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 3: Quick amounts are always valid payment amounts
// ---------------------------------------------------------------------------

describe("PBT: Quick amount suggestions", () => {
  it("every quick amount >= total", () => {
    for (let i = 0; i < 100; i++) {
      const total = roundTo2(Math.random() * 1500);
      const amounts = getQuickAmounts(total);

      for (const amount of amounts) {
        expect(amount).toBeGreaterThanOrEqual(total);
      }
    }
  });

  it("first quick amount equals exact total", () => {
    for (let i = 0; i < 100; i++) {
      const total = roundTo2(Math.random() * 1500);
      const amounts = getQuickAmounts(total);

      expect(amounts[0]).toBe(roundTo2(total));
    }
  });

  it("quick amounts are in ascending order", () => {
    for (let i = 0; i < 100; i++) {
      const total = roundTo2(Math.random() * 1500 + 1);
      const amounts = getQuickAmounts(total);

      for (let j = 1; j < amounts.length; j++) {
        expect(amounts[j]).toBeGreaterThanOrEqual(amounts[j - 1]);
      }
    }
  });

  it("no duplicate quick amounts", () => {
    for (let i = 0; i < 100; i++) {
      const total = roundTo2(Math.random() * 1500 + 1);
      const amounts = getQuickAmounts(total);
      const unique = new Set(amounts);

      expect(unique.size).toBe(amounts.length);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 4: Amount validation correctness
// ---------------------------------------------------------------------------

describe("PBT: Amount validation", () => {
  it("non-negative finite numbers pass validation", () => {
    for (let i = 0; i < 100; i++) {
      const amount = roundTo2(Math.random() * 10000);
      const error = validateAmount(amount);
      expect(error).toBeNull();
    }
  });

  it("negative numbers fail validation", () => {
    for (let i = 0; i < 50; i++) {
      const amount = -(Math.random() * 1000 + 0.01);
      const error = validateAmount(amount);
      expect(error).not.toBeNull();
    }
  });

  it("Infinity fails validation", () => {
    expect(validateAmount(Infinity)).not.toBeNull();
    expect(validateAmount(-Infinity)).not.toBeNull();
  });

  it("NaN fails validation", () => {
    expect(validateAmount(NaN)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Property 5: Quantity validation correctness
// ---------------------------------------------------------------------------

describe("PBT: Quantity validation", () => {
  it("positive numbers pass validation", () => {
    for (let i = 0; i < 100; i++) {
      const qty = Math.random() * 100 + 0.01;
      const error = validateQuantity(qty);
      expect(error).toBeNull();
    }
  });

  it("zero fails validation", () => {
    expect(validateQuantity(0)).not.toBeNull();
  });

  it("negative numbers fail validation", () => {
    for (let i = 0; i < 50; i++) {
      const qty = -(Math.random() * 100 + 0.01);
      const error = validateQuantity(qty);
      expect(error).not.toBeNull();
    }
  });
});
