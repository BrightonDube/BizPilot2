/**
 * Refund Limit Property-Based Tests (integrated-payments task 8.5)
 *
 * Property 2: A refund amount SHALL NOT exceed the total paid for the order.
 *
 * The tested invariant: validateRefundAmount(amount, totalPaid, alreadyRefunded).valid
 * is true if and only if 0 < amount <= (totalPaid - alreadyRefunded).
 *
 * Uses manual random loops consistent with the project's PBT style.
 */

// PaymentService transitively imports @/db (WatermelonDB) which fails in Jest
// because it tries to initialize native SQLite. Mock it here.
jest.mock("@/db", () => ({
  database: {
    write: jest.fn(async (cb: () => Promise<unknown>) => cb()),
    get: jest.fn(() => ({
      create: jest.fn(async () => ({})),
      query: jest.fn(() => ({ fetch: jest.fn(async () => []) })),
    })),
  },
}));

jest.mock("@/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { validateRefundAmount } from "@/services/PaymentService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function randAmount(max = 10000): number {
  return roundTo2(Math.random() * max + 0.01);
}

// ---------------------------------------------------------------------------
// Property 2 tests (task 8.5)
// ---------------------------------------------------------------------------

describe("Property 2: refund amount must not exceed totalPaid (task 8.5)", () => {
  it("valid when refund equals exactly the remaining refundable amount — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const totalPaid = randAmount();
      const alreadyRefunded = roundTo2(Math.random() * (totalPaid - 0.01));
      const remaining = roundTo2(totalPaid - alreadyRefunded);

      if (remaining <= 0) continue;

      const result = validateRefundAmount(remaining, totalPaid, alreadyRefunded);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    }
  });

  it("valid when refund is any amount <= remaining — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const totalPaid = randAmount();
      const alreadyRefunded = roundTo2(Math.random() * (totalPaid * 0.5));
      const remaining = roundTo2(totalPaid - alreadyRefunded);

      if (remaining < 0.01) continue;

      // Pick any amount up to remaining (biased toward valid range)
      const refundAmount = roundTo2(Math.random() * (remaining - 0.01) + 0.01);

      const result = validateRefundAmount(refundAmount, totalPaid, alreadyRefunded);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    }
  });

  it("invalid when refund exceeds totalPaid — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const totalPaid = randAmount();
      // Refund is always more than totalPaid
      const refundAmount = roundTo2(totalPaid + Math.random() * 100 + 0.01);

      const result = validateRefundAmount(refundAmount, totalPaid);
      expect(result.valid).toBe(false);
      expect(result.error).not.toBeNull();
    }
  });

  it("invalid when refund exceeds remaining after partial refunds — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const totalPaid = randAmount();
      // Already refunded more than half, and try to refund more than what's left
      const alreadyRefunded = roundTo2(totalPaid * (0.5 + Math.random() * 0.49));
      const remaining = roundTo2(totalPaid - alreadyRefunded);

      if (remaining <= 0) continue;

      // Ask for slightly more than remaining
      const refundAmount = roundTo2(remaining + Math.random() * 10 + 0.01);

      const result = validateRefundAmount(refundAmount, totalPaid, alreadyRefunded);
      expect(result.valid).toBe(false);
      expect(result.error).not.toBeNull();
    }
  });

  it("invalid when refundAmount is zero or negative — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const totalPaid = randAmount();
      // Zero or negative amount
      const refundAmount = -(Math.random() * 1000);

      const result = validateRefundAmount(refundAmount, totalPaid);
      expect(result.valid).toBe(false);
      expect(result.error).not.toBeNull();
    }
    // Edge: exactly zero
    const result = validateRefundAmount(0, 100);
    expect(result.valid).toBe(false);
  });

  it("maxRefund in result always equals totalPaid - alreadyRefunded — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const totalPaid = randAmount();
      const alreadyRefunded = roundTo2(Math.random() * totalPaid);
      const expectedMax = roundTo2(totalPaid - alreadyRefunded);
      const refundAmount = randAmount(totalPaid); // any amount

      const result = validateRefundAmount(refundAmount, totalPaid, alreadyRefunded);
      expect(result.maxRefund).toBeCloseTo(expectedMax, 2);
    }
  });

  it("zero alreadyRefunded means maxRefund === totalPaid — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const totalPaid = randAmount();
      const refundAmount = randAmount(totalPaid);

      const result = validateRefundAmount(refundAmount, totalPaid, 0);
      expect(result.maxRefund).toBeCloseTo(totalPaid, 2);
    }
  });
});
