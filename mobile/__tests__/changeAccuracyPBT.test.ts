/**
 * Payment change accuracy Property-Based Tests (task 2.4)
 *
 * Property 3: Change accuracy invariant
 * For any valid cash payment: change = cashTendered - amountDue (± 1 cent FP tolerance)
 *
 * Why PBT for change calculation?
 * Change errors in a POS are a direct financial loss. Floating-point arithmetic
 * can produce subtle errors (e.g., 1.00 - 0.30 = 0.7000000000000001). We use
 * PBT to verify the invariant holds across thousands of random currency amounts.
 *
 * This tests the calculateChange utility in PaymentService which is the
 * single source of truth for change calculation across the mobile app.
 */

// No DB calls needed for pure calculateChange tests
jest.mock("@/db", () => ({
  database: {
    write: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    get: jest.fn(() => ({ query: jest.fn(), create: jest.fn() })),
  },
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { calculateChange } from "@/services/PaymentService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a random currency amount between min and max (inclusive),
 * rounded to 2 decimal places (simulates ZAR amounts).
 */
function randomAmount(min: number, max: number): number {
  const raw = min + Math.random() * (max - min);
  return Math.round(raw * 100) / 100;
}

const ITERATIONS = 500;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Change accuracy PBT (Property 3)", () => {
  // -------------------------------------------------------------------------
  // Task 2.4: PBT for change accuracy
  // -------------------------------------------------------------------------

  it("Property: change + amountDue always equals cashTendered (within 1 cent)", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const amountDue = randomAmount(0.01, 10_000);
      // cashTendered is always >= amountDue
      const cashTendered = amountDue + randomAmount(0, 500);

      const change = calculateChange(amountDue, cashTendered);

      // Core invariant: change + amountDue = cashTendered
      expect(Math.abs(change + amountDue - cashTendered)).toBeLessThanOrEqual(0.01);
    }
  });

  it("Property: change is always non-negative", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const amountDue = randomAmount(0.01, 10_000);
      const cashTendered = amountDue + randomAmount(0, 1000);

      const change = calculateChange(amountDue, cashTendered);

      expect(change).toBeGreaterThanOrEqual(0);
    }
  });

  it("Property: exact tender always yields exactly 0 change", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const amountDue = randomAmount(0.01, 10_000);

      const change = calculateChange(amountDue, amountDue);

      expect(change).toBe(0);
    }
  });

  it("Property: change is 0 when cashTendered is less than amountDue (defensive)", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const amountDue = randomAmount(1, 10_000);
      const cashTendered = randomAmount(0.01, amountDue - 0.01);

      const change = calculateChange(amountDue, cashTendered);

      expect(change).toBe(0);
    }
  });

  it("Property: change has at most 2 decimal places (no extra precision)", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const amountDue = randomAmount(0.01, 1000);
      const cashTendered = amountDue + randomAmount(0, 100);

      const change = calculateChange(amountDue, cashTendered);

      // Check that change has at most 2 decimal places
      const asString = change.toString();
      const decimalIndex = asString.indexOf(".");
      if (decimalIndex !== -1) {
        const decimals = asString.length - decimalIndex - 1;
        expect(decimals).toBeLessThanOrEqual(2);
      }
    }
  });

  // -------------------------------------------------------------------------
  // Specific regression cases
  // -------------------------------------------------------------------------

  it("handles classic floating-point pitfall: 1.00 - 0.30", () => {
    // Without rounding: 1.00 - 0.30 = 0.7000000000000001
    const change = calculateChange(0.30, 1.00);
    expect(change).toBe(0.70);
  });

  it("handles amount ending in .99 (common pricing)", () => {
    const change = calculateChange(9.99, 10.00);
    expect(change).toBe(0.01);
  });

  it("handles large amounts accurately", () => {
    const change = calculateChange(9999.99, 10000.00);
    expect(change).toBeCloseTo(0.01, 2);
  });
});
