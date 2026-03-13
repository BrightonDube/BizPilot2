/**
 * BizPilot Mobile POS — Price Calculator
 *
 * Pure, deterministic functions for POS price calculations.
 * Every monetary result is rounded to 2 decimal places to prevent
 * floating-point drift in cumulative totals.
 *
 * Why a standalone module instead of inline math?
 * Price calculations are the most audited part of a POS system.
 * Extracting them into pure functions makes them easy to unit-test,
 * property-based test, and audit. A bug here means incorrect invoices
 * and potential tax compliance issues.
 *
 * Why tax-inclusive as default?
 * South African VAT law requires consumer-facing prices to include VAT.
 * The POS shows "R 100.00" which already includes 15% VAT.
 * We calculate the VAT component as: price / (1 + rate) * rate
 */

import { DEFAULT_VAT_RATE } from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineItem {
  /** Unit price per single item */
  unitPrice: number;
  /** Quantity ordered */
  quantity: number;
  /** Discount on this line (flat amount, not percentage) */
  discount: number;
}

export interface CartTotalsInput {
  /** All line items in the cart */
  items: LineItem[];
  /** Cart-level discount (flat amount applied to entire cart) */
  cartDiscount: number;
  /** VAT rate as decimal (e.g., 0.15 for 15%) */
  vatRate?: number;
  /** Whether prices already include tax (default: true for SA) */
  taxInclusive?: boolean;
}

export interface CartTotals {
  /** Sum of all line totals before cart discount */
  subtotal: number;
  /** Cart-level discount amount */
  discount: number;
  /** VAT amount (extracted from inclusive prices, or added for exclusive) */
  taxAmount: number;
  /** Final total the customer pays */
  total: number;
  /** Net amount excluding VAT (for accounting) */
  netAmount: number;
}

// ---------------------------------------------------------------------------
// Core calculation functions
// ---------------------------------------------------------------------------

/**
 * Round a number to exactly 2 decimal places.
 *
 * Why Math.round instead of toFixed?
 * toFixed returns a string and has known rounding bugs in some JS engines.
 * Math.round(x * 100) / 100 is consistent across all platforms.
 */
export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculate the total for a single line item.
 *
 * Formula: (unitPrice × quantity) − discount
 * Result is floored at 0 — a discount can't make a line negative.
 *
 * @param item - The line item to calculate
 * @returns The line total, rounded to 2 decimal places
 */
export function calculateLineTotal(item: LineItem): number {
  const gross = item.unitPrice * item.quantity;
  const net = gross - item.discount;
  return roundTo2(Math.max(0, net));
}

/**
 * Calculate all cart totals: subtotal, tax, discount, and total.
 *
 * Two tax modes:
 * - Tax-inclusive (default, SA standard): Prices include VAT.
 *   The tax component is extracted as: amount / (1 + rate) * rate
 * - Tax-exclusive: VAT is added on top of prices.
 *   The tax component is: amount * rate
 *
 * @param input - Cart items, discounts, and tax configuration
 * @returns Complete cart totals breakdown
 */
export function calculateCartTotals(input: CartTotalsInput): CartTotals {
  const {
    items,
    cartDiscount,
    vatRate = DEFAULT_VAT_RATE,
    taxInclusive = true,
  } = input;

  // Step 1: Sum all line totals
  const subtotal = roundTo2(
    items.reduce((sum, item) => sum + calculateLineTotal(item), 0)
  );

  // Step 2: Apply cart-level discount
  const effectiveDiscount = roundTo2(Math.min(cartDiscount, subtotal));
  const afterDiscount = roundTo2(subtotal - effectiveDiscount);

  // Step 3: Calculate tax based on mode
  let taxAmount: number;
  let total: number;
  let netAmount: number;

  if (taxInclusive) {
    // Prices already include VAT — extract the tax component
    // Formula: taxAmount = afterDiscount - (afterDiscount / (1 + vatRate))
    taxAmount = roundTo2(afterDiscount - afterDiscount / (1 + vatRate));
    total = afterDiscount; // Total IS the inclusive price
    netAmount = roundTo2(afterDiscount - taxAmount);
  } else {
    // Prices exclude VAT — add tax on top
    taxAmount = roundTo2(afterDiscount * vatRate);
    netAmount = afterDiscount;
    total = roundTo2(afterDiscount + taxAmount);
  }

  return {
    subtotal,
    discount: effectiveDiscount,
    taxAmount,
    total,
    netAmount,
  };
}

/**
 * Calculate change due for a cash payment.
 *
 * @param totalDue - Amount the customer owes
 * @param amountTendered - Cash given by the customer
 * @returns Change to return (0 if not enough tendered)
 */
export function calculateChange(
  totalDue: number,
  amountTendered: number
): number {
  const change = amountTendered - totalDue;
  return roundTo2(Math.max(0, change));
}

/**
 * Check if a payment amount fully covers the total.
 */
export function isPaymentSufficient(
  totalDue: number,
  amountTendered: number
): boolean {
  return amountTendered >= totalDue;
}

/**
 * Generate quick-amount suggestions for cash payment.
 *
 * Why these specific amounts?
 * South African currency has R10, R20, R50, R100, R200 notes.
 * We suggest the exact amount plus the next round-up to each note.
 *
 * @param total - The total amount due
 * @returns Array of suggested payment amounts
 */
export function getQuickAmounts(total: number): number[] {
  const amounts: number[] = [roundTo2(total)]; // Exact amount first
  const roundUps = [10, 20, 50, 100, 200, 500];

  for (const denomination of roundUps) {
    const rounded = Math.ceil(total / denomination) * denomination;
    if (rounded > total && !amounts.includes(rounded)) {
      amounts.push(rounded);
    }
  }

  return amounts.slice(0, 5); // Max 5 suggestions
}
