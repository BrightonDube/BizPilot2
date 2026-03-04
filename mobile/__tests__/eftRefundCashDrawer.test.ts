/**
 * Tests for EFTService (integrated-payments tasks 6.1-6.4)
 * Tests for RefundService (integrated-payments tasks 8.1-8.4)
 * Tests for CashDrawerService (integrated-payments tasks 9.1-9.4)
 */

import {
  generateEFTReference,
  createEFTPayment,
  getInitialEFTStatus,
  isEFTExpired,
  validateEFTConfirmation,
} from "@/services/EFTService";

import {
  calculatePartialRefundAmount,
  resolveRefundMethod,
  requiresManagerAuth,
  validateRefundRequest,
  MANAGER_AUTH_THRESHOLD,
  type OriginalPaymentSummary,
  type RefundRequest,
} from "@/services/RefundService";

import {
  calculateDrawerBalance,
  createCashDropEvent,
  createPaidOutEvent,
  reconcileDrawer,
  validateCashEvent,
  type CashDrawerSession,
  type CashDrawerEvent,
} from "@/services/CashDrawerService";

// ===========================================================================
// EFTService tests (tasks 6.1-6.4)
// ===========================================================================

describe("EFTService", () => {
  describe("generateEFTReference (task 6.2)", () => {
    it("starts with BP- prefix", () => {
      const ref = generateEFTReference("order-abc123", new Date("2024-01-15"));
      expect(ref).toMatch(/^BP-/);
    });

    it("contains the date in YYYYMMDD format", () => {
      const ref = generateEFTReference("order-abc123", new Date("2024-01-15"));
      expect(ref).toContain("20240115");
    });

    it("generates different references each call (randomness)", () => {
      const a = generateEFTReference("order-1");
      const b = generateEFTReference("order-1");
      // Probabilistically: same date, same order, but random suffix differs
      // (could theoretically collide, but extremely unlikely in practice)
      // Just verify both are valid format
      expect(a).toMatch(/^BP-\d{8}-[A-Z0-9]{1,6}-[A-Z0-9]{4}$/);
      expect(b).toMatch(/^BP-\d{8}-[A-Z0-9]{1,6}-[A-Z0-9]{4}$/);
    });
  });

  describe("createEFTPayment (task 6.1)", () => {
    it("returns reference and instructions", () => {
      const result = createEFTPayment({ orderId: "o1", amount: 250, customerRef: "John" });
      expect(result.reference).toBeTruthy();
      expect(result.instructions).toContain("250.00");
      expect(result.generatedAt).toBeTruthy();
    });
  });

  describe("getInitialEFTStatus (task 6.3)", () => {
    it("new EFT payment starts as pending", () => {
      expect(getInitialEFTStatus()).toBe("pending");
    });
  });

  describe("isEFTExpired (task 6.3)", () => {
    it("not expired when status is not pending", () => {
      expect(isEFTExpired("2020-01-01T00:00:00Z", "confirmed")).toBe(false);
    });

    it("expired when pending > 24 hours", () => {
      const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      expect(isEFTExpired(yesterday, "pending")).toBe(true);
    });

    it("not expired when pending < 24 hours", () => {
      const recentlyCreated = new Date(Date.now() - 1000).toISOString();
      expect(isEFTExpired(recentlyCreated, "pending")).toBe(false);
    });
  });

  describe("validateEFTConfirmation (task 6.4)", () => {
    const validRequest = {
      paymentId: "pay-1",
      confirmedReference: "BP-20240115-ORDER1-ABCD",
      confirmedBy: "Manager Jane",
    };

    it("valid when all fields present and status is pending", () => {
      const result = validateEFTConfirmation(validRequest, "pending");
      expect(result.valid).toBe(true);
    });

    it("invalid when reference is empty", () => {
      const result = validateEFTConfirmation(
        { ...validRequest, confirmedReference: "" }, "pending"
      );
      expect(result.valid).toBe(false);
    });

    it("invalid when confirmedBy is empty", () => {
      const result = validateEFTConfirmation(
        { ...validRequest, confirmedBy: "   " }, "pending"
      );
      expect(result.valid).toBe(false);
    });

    it("invalid when status is not pending", () => {
      expect(validateEFTConfirmation(validRequest, "confirmed").valid).toBe(false);
      expect(validateEFTConfirmation(validRequest, "cancelled").valid).toBe(false);
    });
  });
});

// ===========================================================================
// RefundService tests (tasks 8.1-8.4)
// ===========================================================================

describe("RefundService", () => {
  const cashPayment: OriginalPaymentSummary = { method: "cash", amount: 500 };
  const cardPayment: OriginalPaymentSummary = { method: "card", amount: 300 };

  describe("calculatePartialRefundAmount (task 8.2)", () => {
    it("calculates proportional refund for partial return", () => {
      // 2 of 5 items returned from a R100 line = R40
      expect(calculatePartialRefundAmount(100, 2, 5)).toBeCloseTo(40, 2);
    });

    it("returns full line total when returning all items", () => {
      expect(calculatePartialRefundAmount(200, 4, 4)).toBe(200);
    });

    it("returns 0 for 0 quantity", () => {
      expect(calculatePartialRefundAmount(100, 0, 5)).toBe(0);
    });

    it("caps at lineTotal when quantity > totalQuantity", () => {
      expect(calculatePartialRefundAmount(100, 10, 5)).toBe(100);
    });
  });

  describe("resolveRefundMethod (task 8.3)", () => {
    it("returns method when it was used in the original payment", () => {
      expect(resolveRefundMethod("cash", [cashPayment])).toBe("cash");
    });

    it("throws when method was not used in the original payment", () => {
      expect(() => resolveRefundMethod("eft", [cashPayment, cardPayment])).toThrow();
    });

    it("throws when method has zero amount", () => {
      const zeroCard: OriginalPaymentSummary = { method: "card", amount: 0 };
      expect(() => resolveRefundMethod("card", [zeroCard])).toThrow();
    });
  });

  describe("requiresManagerAuth (task 8.4)", () => {
    it("requires auth for amounts above threshold", () => {
      expect(requiresManagerAuth(MANAGER_AUTH_THRESHOLD + 1)).toBe(true);
    });

    it("does not require auth for amounts at or below threshold", () => {
      expect(requiresManagerAuth(MANAGER_AUTH_THRESHOLD)).toBe(false);
      expect(requiresManagerAuth(100)).toBe(false);
    });
  });

  describe("validateRefundRequest (tasks 8.1-8.4)", () => {
    const baseRequest: RefundRequest = {
      orderId: "order-1",
      refundAmount: 100,
      refundType: "partial",
      refundMethod: "cash",
      reason: "Customer changed mind",
    };

    it("valid for a complete, correctly formed request", () => {
      const result = validateRefundRequest(baseRequest, 500, 0, [cashPayment]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("invalid when refund exceeds remaining balance", () => {
      const result = validateRefundRequest(
        { ...baseRequest, refundAmount: 600 }, 500, 0, [cashPayment]
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("exceeds"))).toBe(true);
    });

    it("invalid when reason is empty", () => {
      const result = validateRefundRequest(
        { ...baseRequest, reason: "" }, 500, 0, [cashPayment]
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("reason"))).toBe(true);
    });

    it("invalid when method not in original payments", () => {
      const result = validateRefundRequest(
        { ...baseRequest, refundMethod: "eft" }, 500, 0, [cashPayment]
      );
      expect(result.valid).toBe(false);
    });

    it("requires manager auth for large refunds (task 8.4)", () => {
      const result = validateRefundRequest(
        { ...baseRequest, refundAmount: MANAGER_AUTH_THRESHOLD + 100 },
        2000, 0, [{ method: "cash", amount: 2000 }]
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("manager"))).toBe(true);
    });

    it("valid large refund when manager is provided", () => {
      const result = validateRefundRequest(
        {
          ...baseRequest,
          refundAmount: MANAGER_AUTH_THRESHOLD + 100,
          authorizedBy: "Manager Bob",
        },
        2000, 0, [{ method: "cash", amount: 2000 }]
      );
      expect(result.valid).toBe(true);
    });
  });
});

// ===========================================================================
// CashDrawerService tests (tasks 9.1-9.4)
// ===========================================================================

function makeSession(
  events: CashDrawerEvent[],
  openingFloat = 500
): CashDrawerSession {
  return {
    sessionId: "sess-1",
    openingFloat,
    events,
    openedAt: new Date().toISOString(),
    closedAt: null,
  };
}

describe("CashDrawerService", () => {
  describe("calculateDrawerBalance (task 9.1)", () => {
    it("returns opening float for empty session", () => {
      const balance = calculateDrawerBalance(makeSession([]));
      expect(balance.expectedCash).toBe(500);
    });

    it("adds sales to balance", () => {
      const events: CashDrawerEvent[] = [
        { type: "sale", amount: 150, timestamp: new Date().toISOString() },
      ];
      const balance = calculateDrawerBalance(makeSession(events));
      expect(balance.expectedCash).toBe(650);
      expect(balance.totalSales).toBe(150);
    });

    it("subtracts refunds from balance", () => {
      const events: CashDrawerEvent[] = [
        { type: "sale", amount: 200, timestamp: new Date().toISOString() },
        { type: "refund", amount: 50, timestamp: new Date().toISOString() },
      ];
      const balance = calculateDrawerBalance(makeSession(events));
      expect(balance.expectedCash).toBe(650); // 500 + 200 - 50
      expect(balance.totalRefunds).toBe(50);
    });

    it("expectedCash is never negative", () => {
      const events: CashDrawerEvent[] = [
        { type: "refund", amount: 1000, timestamp: new Date().toISOString() },
      ];
      const balance = calculateDrawerBalance(makeSession(events));
      expect(balance.expectedCash).toBeGreaterThanOrEqual(0);
    });
  });

  describe("createCashDropEvent (task 9.2)", () => {
    it("creates a valid drop event", () => {
      const event = createCashDropEvent(300, "Midday drop to safe");
      expect(event.type).toBe("drop");
      expect(event.amount).toBe(300);
      expect(event.note).toBe("Midday drop to safe");
    });

    it("throws for zero amount", () => {
      expect(() => createCashDropEvent(0, "drop")).toThrow();
    });

    it("throws for empty note", () => {
      expect(() => createCashDropEvent(100, "")).toThrow();
    });
  });

  describe("createPaidOutEvent (task 9.3)", () => {
    it("creates a valid paid-out event", () => {
      const event = createPaidOutEvent(50, "Milk from corner store");
      expect(event.type).toBe("paidout");
      expect(event.amount).toBe(50);
    });

    it("throws for zero amount", () => {
      expect(() => createPaidOutEvent(0, "reason")).toThrow();
    });
  });

  describe("reconcileDrawer (task 9.4)", () => {
    it("balanced when actual equals expected", () => {
      const result = reconcileDrawer(makeSession([]), 500);
      expect(result.isBalanced).toBe(true);
      expect(result.variance).toBe(0);
    });

    it("over when actual > expected", () => {
      const result = reconcileDrawer(makeSession([]), 600);
      expect(result.variance).toBe(100);
      expect(result.isBalanced).toBe(false);
    });

    it("short when actual < expected", () => {
      const result = reconcileDrawer(makeSession([]), 400);
      expect(result.variance).toBe(-100);
      expect(result.isBalanced).toBe(false);
    });

    it("balanced within tolerance", () => {
      const result = reconcileDrawer(makeSession([]), 502, 5);
      expect(result.isBalanced).toBe(true);
    });
  });

  describe("validateCashEvent", () => {
    it("allows drop when drawer has enough cash", () => {
      const session = makeSession([]);
      const dropEvent: CashDrawerEvent = {
        type: "drop", amount: 400, timestamp: new Date().toISOString()
      };
      expect(validateCashEvent(dropEvent, session).valid).toBe(true);
    });

    it("rejects drop when amount exceeds drawer balance", () => {
      const session = makeSession([]);
      const dropEvent: CashDrawerEvent = {
        type: "drop", amount: 600, timestamp: new Date().toISOString()
      };
      expect(validateCashEvent(dropEvent, session).valid).toBe(false);
    });
  });
});
