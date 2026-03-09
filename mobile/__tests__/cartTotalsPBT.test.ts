/**
 * BizPilot Mobile POS — Cart Total Accuracy PBT
 *
 * Property-based tests that verify cart calculation invariants
 * hold for ANY valid combination of inputs.
 *
 * Why property-based tests for cart totals?
 * Example-based tests check specific scenarios we think of.
 * PBT tests verify mathematical properties that MUST always hold:
 * - Total = subtotal + tax - discount (within rounding tolerance)
 * - Total is never negative for valid inputs
 * - Adding items always increases the total
 * - Tax amount is always proportional to the VAT rate
 *
 * These tests run 200+ random inputs each, catching edge cases
 * that human testers would never think to write.
 */

import {
  roundTo2,
  calculateLineTotal,
  calculateCartTotals,
  calculateChange,
  isPaymentSufficient,
  type LineItem,
} from "@/utils/priceCalculator";
import { DEFAULT_VAT_RATE } from "@/utils/constants";

// ---------------------------------------------------------------------------
// Helpers for generating random test data
// ---------------------------------------------------------------------------

function randomPrice(): number {
  return roundTo2(Math.random() * 999 + 0.01);
}

function randomQuantity(): number {
  return Math.floor(Math.random() * 20) + 1;
}

function randomDiscount(maxAmount: number): number {
  return roundTo2(Math.random() * maxAmount);
}

function randomLineItem(): LineItem {
  const price = randomPrice();
  const qty = randomQuantity();
  return {
    unitPrice: price,
    quantity: qty,
    discount: randomDiscount(price * qty * 0.5), // Max 50% discount
  };
}

function randomCart(maxItems: number = 10): LineItem[] {
  const count = Math.floor(Math.random() * maxItems) + 1;
  return Array.from({ length: count }, randomLineItem);
}

// ---------------------------------------------------------------------------
// Property 1: Total = netAmount + taxAmount (exact equality or ±0.01)
// ---------------------------------------------------------------------------

describe("PBT: Cart total decomposition invariant", () => {
  it("netAmount + taxAmount = total (within 1 cent) for tax-inclusive pricing", () => {
    for (let i = 0; i < 200; i++) {
      const items = randomCart();
      const cartDiscount = randomDiscount(20);

      const totals = calculateCartTotals({
        items,
        cartDiscount,
        vatRate: DEFAULT_VAT_RATE,
        taxInclusive: true,
      });

      // For tax-inclusive: netAmount + taxAmount should equal total
      const reconstructed = roundTo2(totals.netAmount + totals.taxAmount);
      const diff = Math.abs(reconstructed - totals.total);

      expect(diff).toBeLessThanOrEqual(0.01);
    }
  });

  it("netAmount + taxAmount = total (within 1 cent) for tax-exclusive pricing", () => {
    for (let i = 0; i < 200; i++) {
      const items = randomCart();
      const cartDiscount = randomDiscount(20);

      const totals = calculateCartTotals({
        items,
        cartDiscount,
        vatRate: DEFAULT_VAT_RATE,
        taxInclusive: false,
      });

      const reconstructed = roundTo2(totals.netAmount + totals.taxAmount);
      const diff = Math.abs(reconstructed - totals.total);

      expect(diff).toBeLessThanOrEqual(0.01);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 2: Total is always non-negative for valid inputs
// ---------------------------------------------------------------------------

describe("PBT: Cart total non-negativity", () => {
  it("total >= 0 for any valid items with non-negative prices and quantities", () => {
    for (let i = 0; i < 200; i++) {
      const items = randomCart();

      const totals = calculateCartTotals({
        items,
        cartDiscount: 0,
        vatRate: DEFAULT_VAT_RATE,
      });

      expect(totals.total).toBeGreaterThanOrEqual(0);
      expect(totals.subtotal).toBeGreaterThanOrEqual(0);
      expect(totals.taxAmount).toBeGreaterThanOrEqual(0);
    }
  });

  it("total >= 0 even with maximum cart-level discount", () => {
    for (let i = 0; i < 100; i++) {
      const items = randomCart();
      // Discount up to the subtotal — should clamp to 0
      const totals = calculateCartTotals({
        items,
        cartDiscount: 99999,
        vatRate: DEFAULT_VAT_RATE,
      });

      expect(totals.total).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 3: Tax amount is proportional to VAT rate
// ---------------------------------------------------------------------------

describe("PBT: Tax proportionality", () => {
  it("tax-inclusive: taxAmount ≈ total * (rate / (1 + rate))", () => {
    for (let i = 0; i < 200; i++) {
      const items = randomCart();
      const rate = DEFAULT_VAT_RATE;

      const totals = calculateCartTotals({
        items,
        cartDiscount: 0,
        vatRate: rate,
        taxInclusive: true,
      });

      if (totals.total === 0) continue;

      const expectedTaxRatio = rate / (1 + rate);
      const actualTaxRatio = totals.taxAmount / totals.total;
      const diff = Math.abs(actualTaxRatio - expectedTaxRatio);

      // Should be within 1% due to rounding
      expect(diff).toBeLessThan(0.01);
    }
  });

  it("tax-exclusive: taxAmount ≈ netAmount * rate", () => {
    for (let i = 0; i < 200; i++) {
      const items = randomCart();
      const rate = DEFAULT_VAT_RATE;

      const totals = calculateCartTotals({
        items,
        cartDiscount: 0,
        vatRate: rate,
        taxInclusive: false,
      });

      if (totals.netAmount === 0) continue;

      const expectedTax = roundTo2(totals.netAmount * rate);
      const diff = Math.abs(expectedTax - totals.taxAmount);

      expect(diff).toBeLessThanOrEqual(0.01);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 4: Adding an item never decreases the total
// ---------------------------------------------------------------------------

describe("PBT: Monotonicity — adding items increases total", () => {
  it("total with N+1 items >= total with N items (no discount)", () => {
    for (let i = 0; i < 100; i++) {
      const baseItems = randomCart(5);
      const extraItem = randomLineItem();

      const baseTotals = calculateCartTotals({
        items: baseItems,
        cartDiscount: 0,
        vatRate: DEFAULT_VAT_RATE,
      });

      const extendedTotals = calculateCartTotals({
        items: [...baseItems, extraItem],
        cartDiscount: 0,
        vatRate: DEFAULT_VAT_RATE,
      });

      expect(extendedTotals.total).toBeGreaterThanOrEqual(baseTotals.total);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 5: Change calculation correctness
// ---------------------------------------------------------------------------

describe("PBT: Change calculation", () => {
  it("change = tendered - total when tendered >= total", () => {
    for (let i = 0; i < 100; i++) {
      const total = roundTo2(Math.random() * 1000 + 1);
      const tendered = roundTo2(total + Math.random() * 500);

      const change = calculateChange(total, tendered);
      const expected = roundTo2(tendered - total);

      expect(change).toBe(expected);
    }
  });

  it("isPaymentSufficient is consistent with change calculation", () => {
    for (let i = 0; i < 100; i++) {
      const total = roundTo2(Math.random() * 1000 + 1);
      const tendered = roundTo2(Math.random() * 2000);

      const sufficient = isPaymentSufficient(total, tendered);
      const change = calculateChange(total, tendered);

      if (sufficient) {
        expect(change).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
