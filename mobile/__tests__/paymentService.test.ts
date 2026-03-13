/**
 * PaymentService unit tests (task 1.5)
 *
 * Tests verify:
 * 1. processPayment validates amount > 0
 * 2. processPayment validates cashTendered for cash payments
 * 3. processPayment writes to database and returns paymentId
 * 4. processPayment calculates changeDue correctly for cash
 * 5. processPayment handles database errors gracefully
 * 6. processSplitPayment validates that lines sum to totalDue
 * 7. processSplitPayment processes all lines on success
 * 8. calculateChange returns correct change amounts
 * 9. calculateChange returns 0 when cashTendered < amountDue
 */

// ---------------------------------------------------------------------------
// Mocks — self-contained factories
// ---------------------------------------------------------------------------

jest.mock("@/db", () => {
  const mockCollection = {
    query: jest.fn(() => ({
      fetch: jest.fn(async () => []),
    })),
    create: jest.fn(async (builder: (r: Record<string, unknown>) => void) => {
      const rec: Record<string, unknown> = {};
      builder(rec);
      return { id: "mock-payment-id", ...rec };
    }),
  };

  return {
    database: {
      write: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      get: jest.fn(() => mockCollection),
    },
    __mockCollection: mockCollection,
  };
});

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  processPayment,
  processSplitPayment,
  calculateChange,
  getTotalPaidForOrder,
} from "@/services/PaymentService";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PaymentService", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { database, __mockCollection } = require("@/db");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Task 1.5: Payment service unit tests
  // -------------------------------------------------------------------------

  describe("processPayment", () => {
    it("returns an error when amount is zero", async () => {
      const result = await processPayment({
        orderId: "order-1",
        method: "cash",
        amount: 0,
        cashTendered: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/greater than zero/i);
      expect(database.write).not.toHaveBeenCalled();
    });

    it("returns an error when amount is negative", async () => {
      const result = await processPayment({
        orderId: "order-1",
        method: "cash",
        amount: -10,
        cashTendered: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/greater than zero/i);
    });

    it("returns an error for cash when cashTendered is missing", async () => {
      const result = await processPayment({
        orderId: "order-1",
        method: "cash",
        amount: 100,
        // cashTendered not provided
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/cash tendered/i);
    });

    it("returns an error when cashTendered is less than amount", async () => {
      const result = await processPayment({
        orderId: "order-1",
        method: "cash",
        amount: 100,
        cashTendered: 50,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/less than amount due/i);
    });

    it("writes to database and returns paymentId on success (cash)", async () => {
      const result = await processPayment({
        orderId: "order-1",
        method: "cash",
        amount: 100,
        cashTendered: 150,
      });

      expect(result.success).toBe(true);
      expect(result.paymentId).toBe("mock-payment-id");
      expect(database.write).toHaveBeenCalledTimes(1);
    });

    it("returns correct changeDue for cash payment", async () => {
      const result = await processPayment({
        orderId: "order-1",
        method: "cash",
        amount: 79.50,
        cashTendered: 100,
      });

      expect(result.success).toBe(true);
      expect(result.changeDue).toBeCloseTo(20.50, 2);
    });

    it("returns undefined changeDue for card payment (no cash involved)", async () => {
      const result = await processPayment({
        orderId: "order-1",
        method: "card",
        amount: 100,
      });

      expect(result.success).toBe(true);
      expect(result.changeDue).toBeUndefined();
    });

    it("marks the payment record as is_dirty=true for later sync", async () => {
      await processPayment({
        orderId: "order-1",
        method: "eft",
        amount: 50,
      });

      const createArg = __mockCollection.create.mock.calls[0][0];
      const rec: Record<string, unknown> = {};
      createArg(rec);
      expect(rec.isDirty).toBe(true);
    });

    it("returns an error when database write throws", async () => {
      database.write.mockRejectedValueOnce(new Error("Disk full"));

      const result = await processPayment({
        orderId: "order-1",
        method: "cash",
        amount: 50,
        cashTendered: 50,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Disk full");
    });
  });

  describe("processSplitPayment", () => {
    it("returns an error when lines do not sum to totalDue", async () => {
      const results = await processSplitPayment({
        orderId: "order-1",
        lines: [
          { method: "cash", amount: 50, cashTendered: 50 },
          { method: "card", amount: 30 },
        ],
        totalDue: 100, // 50 + 30 = 80, not 100
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toMatch(/do not match total due/i);
    });

    it("returns errors when a cash line has insufficient cashTendered", async () => {
      const results = await processSplitPayment({
        orderId: "order-1",
        lines: [
          { method: "cash", amount: 60, cashTendered: 40 }, // under-tendered
          { method: "card", amount: 40 },
        ],
        totalDue: 100,
      });

      expect(results[0].success).toBe(false);
      expect(results[0].error).toMatch(/less than line amount/i);
    });

    it("processes all lines and returns success for each on valid split", async () => {
      const results = await processSplitPayment({
        orderId: "order-1",
        lines: [
          { method: "cash", amount: 60, cashTendered: 60 },
          { method: "card", amount: 40 },
        ],
        totalDue: 100,
      });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe("calculateChange", () => {
    it("returns the correct change amount", () => {
      expect(calculateChange(79.50, 100)).toBeCloseTo(20.50, 2);
      expect(calculateChange(0.01, 1.00)).toBeCloseTo(0.99, 2);
      expect(calculateChange(100, 100)).toBe(0);
    });

    it("returns 0 when cashTendered is less than amountDue", () => {
      // Safety: should never happen (validated upstream), but function is defensive
      expect(calculateChange(100, 50)).toBe(0);
    });

    it("handles floating-point amounts without precision errors", () => {
      // Classic FP gotcha: 0.1 + 0.2 !== 0.3
      const change = calculateChange(0.1 + 0.2, 1.0);
      expect(change).toBeCloseTo(0.7, 2);
    });
  });

  describe("getTotalPaidForOrder", () => {
    it("sums only completed payment records", async () => {
      __mockCollection.query.mockReturnValueOnce({
        fetch: jest.fn(async () => [
          { status: "completed", amount: 50 },
          { status: "refunded", amount: 50 }, // should NOT count
          { status: "completed", amount: 25 },
        ]),
      });

      const total = await getTotalPaidForOrder("order-1");

      expect(total).toBe(75); // 50 + 25, excluding the refunded
    });

    it("returns 0 when there are no completed payments", async () => {
      __mockCollection.query.mockReturnValueOnce({
        fetch: jest.fn(async () => []),
      });

      const total = await getTotalPaidForOrder("order-1");

      expect(total).toBe(0);
    });
  });
});
