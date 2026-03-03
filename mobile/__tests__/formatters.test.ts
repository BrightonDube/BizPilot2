/**
 * BizPilot Mobile POS — Formatter Tests
 *
 * Tests currency, date, and number formatting functions.
 * Critical for POS — incorrect prices or totals = lost revenue.
 */

import {
  formatCurrency,
  formatQuantity,
  generateOrderNumber,
} from "@/utils/formatters";

describe("formatCurrency", () => {
  it("formats a whole number with two decimals", () => {
    const result = formatCurrency(100);
    // Should contain "100" and some currency indicator
    expect(result).toContain("100");
    expect(result).toMatch(/[.,]00/);
  });

  it("formats cents correctly", () => {
    const result = formatCurrency(89.99);
    expect(result).toContain("89");
    expect(result).toMatch(/99/);
  });

  it("formats zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
  });

  it("formats large numbers with thousands grouping", () => {
    const result = formatCurrency(1234567.89);
    // Should have some form of grouping (space, comma, or period)
    expect(result).toMatch(/1[\s,.]?234[\s,.]?567/);
  });
});

describe("formatQuantity", () => {
  it("formats whole numbers without decimals", () => {
    expect(formatQuantity(5)).toBe("5");
  });

  it("formats fractional numbers with 2 decimals", () => {
    expect(formatQuantity(2.5)).toBe("2.50");
  });

  it("formats zero", () => {
    expect(formatQuantity(0)).toBe("0");
  });
});

describe("generateOrderNumber", () => {
  it("generates a string starting with POS-", () => {
    const orderNum = generateOrderNumber();
    expect(orderNum).toMatch(/^POS-/);
  });

  it("generates unique order numbers", () => {
    const nums = new Set<string>();
    for (let i = 0; i < 100; i++) {
      nums.add(generateOrderNumber());
    }
    // All 100 should be unique (probabilistically guaranteed)
    expect(nums.size).toBe(100);
  });

  it("contains only uppercase alphanumeric and dashes", () => {
    const orderNum = generateOrderNumber();
    expect(orderNum).toMatch(/^[A-Z0-9-]+$/);
  });
});
