/**
 * Tests for SplitPaymentService — pure function tests for multi-tender logic.
 * (integrated-payments tasks 7.1-7.4)
 */

import {
  SplitPaymentState,
  TenderLine,
  calculateSplitSummary,
  addTender,
  updateTenderAmount,
  updateCashTendered,
  removeTender,
  markTenderProcessed,
  validateSplitPayment,
  TENDER_METHODS,
} from "@/services/payment/SplitPaymentService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(orderTotal: number, tenders: TenderLine[] = []): SplitPaymentState {
  return { orderTotal, tenders };
}

function makeTender(overrides: Partial<TenderLine> = {}): TenderLine {
  return {
    id: "t1",
    method: "cash",
    amount: 100,
    processed: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TENDER_METHODS constants
// ---------------------------------------------------------------------------

describe("TENDER_METHODS", () => {
  it("contains all five payment methods", () => {
    const values = TENDER_METHODS.map((m) => m.value);
    expect(values).toEqual(["cash", "card", "eft", "room_charge", "voucher"]);
  });

  it("each method has a label and icon", () => {
    for (const m of TENDER_METHODS) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.icon.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// calculateSplitSummary
// ---------------------------------------------------------------------------

describe("calculateSplitSummary", () => {
  it("returns full orderTotal as remaining when no tenders", () => {
    const result = calculateSplitSummary(makeState(250));
    expect(result.orderTotal).toBe(250);
    expect(result.totalAllocated).toBe(0);
    expect(result.remainingBalance).toBe(250);
    expect(result.isFullyPaid).toBe(false);
    expect(result.tenderCount).toBe(0);
    expect(result.changeDue).toBe(0);
  });

  it("calculates remaining for a single partial tender", () => {
    const state = makeState(200, [makeTender({ amount: 80 })]);
    const result = calculateSplitSummary(state);
    expect(result.totalAllocated).toBe(80);
    expect(result.remainingBalance).toBe(120);
    expect(result.isFullyPaid).toBe(false);
  });

  it("reports isFullyPaid when tenders match total exactly", () => {
    const state = makeState(200, [
      makeTender({ id: "t1", amount: 120 }),
      makeTender({ id: "t2", method: "card", amount: 80 }),
    ]);
    const result = calculateSplitSummary(state);
    expect(result.remainingBalance).toBe(0);
    expect(result.isFullyPaid).toBe(true);
  });

  it("clamps remaining to 0 when over-allocated", () => {
    const state = makeState(100, [makeTender({ amount: 150 })]);
    const result = calculateSplitSummary(state);
    expect(result.remainingBalance).toBe(0);
    expect(result.totalAllocated).toBe(150);
  });

  it("calculates change due from cash tender", () => {
    const state = makeState(100, [
      makeTender({ amount: 100, cashTendered: 120 }),
    ]);
    const result = calculateSplitSummary(state);
    expect(result.changeDue).toBe(20);
  });

  it("does not count change from non-cash tenders", () => {
    const state = makeState(100, [
      makeTender({ method: "card", amount: 100, cashTendered: 150 }),
    ]);
    const result = calculateSplitSummary(state);
    expect(result.changeDue).toBe(0);
  });

  it("handles floating point correctly (R 33.33 × 3)", () => {
    const state = makeState(100, [
      makeTender({ id: "t1", amount: 33.33 }),
      makeTender({ id: "t2", amount: 33.33 }),
      makeTender({ id: "t3", amount: 33.34 }),
    ]);
    const result = calculateSplitSummary(state);
    expect(result.remainingBalance).toBe(0);
    expect(result.isFullyPaid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// addTender
// ---------------------------------------------------------------------------

describe("addTender", () => {
  it("adds a tender with remaining balance as default amount", () => {
    const state = makeState(250);
    const updated = addTender(state, "cash", "new-1");
    expect(updated.tenders).toHaveLength(1);
    expect(updated.tenders[0].amount).toBe(250);
    expect(updated.tenders[0].method).toBe("cash");
    expect(updated.tenders[0].processed).toBe(false);
  });

  it("second tender defaults to actual remaining", () => {
    const state = makeState(200, [makeTender({ amount: 80 })]);
    const updated = addTender(state, "card", "new-2");
    expect(updated.tenders).toHaveLength(2);
    expect(updated.tenders[1].amount).toBe(120);
  });

  it("defaults to 0 if fully paid", () => {
    const state = makeState(100, [makeTender({ amount: 100 })]);
    const updated = addTender(state, "eft", "new-3");
    expect(updated.tenders[1].amount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// updateTenderAmount
// ---------------------------------------------------------------------------

describe("updateTenderAmount", () => {
  it("updates the specified tender amount", () => {
    const state = makeState(200, [makeTender({ id: "t1", amount: 100 })]);
    const updated = updateTenderAmount(state, "t1", 150);
    expect(updated.tenders[0].amount).toBe(150);
  });

  it("clamps negative amounts to 0", () => {
    const state = makeState(200, [makeTender({ id: "t1", amount: 100 })]);
    const updated = updateTenderAmount(state, "t1", -50);
    expect(updated.tenders[0].amount).toBe(0);
  });

  it("does not modify other tenders", () => {
    const state = makeState(200, [
      makeTender({ id: "t1", amount: 100 }),
      makeTender({ id: "t2", amount: 50 }),
    ]);
    const updated = updateTenderAmount(state, "t1", 75);
    expect(updated.tenders[0].amount).toBe(75);
    expect(updated.tenders[1].amount).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// updateCashTendered
// ---------------------------------------------------------------------------

describe("updateCashTendered", () => {
  it("sets cashTendered on the specified tender", () => {
    const state = makeState(100, [makeTender({ id: "t1", amount: 100 })]);
    const updated = updateCashTendered(state, "t1", 120);
    expect(updated.tenders[0].cashTendered).toBe(120);
  });

  it("clamps negative to 0", () => {
    const state = makeState(100, [makeTender({ id: "t1", amount: 100 })]);
    const updated = updateCashTendered(state, "t1", -10);
    expect(updated.tenders[0].cashTendered).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// removeTender
// ---------------------------------------------------------------------------

describe("removeTender", () => {
  it("removes an unprocessed tender", () => {
    const state = makeState(200, [
      makeTender({ id: "t1", amount: 100 }),
      makeTender({ id: "t2", amount: 100 }),
    ]);
    const updated = removeTender(state, "t1");
    expect(updated.tenders).toHaveLength(1);
    expect(updated.tenders[0].id).toBe("t2");
  });

  it("does NOT remove a processed tender", () => {
    const state = makeState(200, [
      makeTender({ id: "t1", amount: 100, processed: true }),
    ]);
    const updated = removeTender(state, "t1");
    expect(updated.tenders).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// markTenderProcessed
// ---------------------------------------------------------------------------

describe("markTenderProcessed", () => {
  it("marks tender as processed", () => {
    const state = makeState(100, [makeTender({ id: "t1" })]);
    const updated = markTenderProcessed(state, "t1");
    expect(updated.tenders[0].processed).toBe(true);
  });

  it("attaches reference if provided", () => {
    const state = makeState(100, [makeTender({ id: "t1" })]);
    const updated = markTenderProcessed(state, "t1", "REF-123");
    expect(updated.tenders[0].reference).toBe("REF-123");
  });

  it("keeps existing reference if none provided", () => {
    const state = makeState(100, [
      makeTender({ id: "t1", reference: "OLD-REF" }),
    ]);
    const updated = markTenderProcessed(state, "t1");
    expect(updated.tenders[0].reference).toBe("OLD-REF");
  });
});

// ---------------------------------------------------------------------------
// validateSplitPayment
// ---------------------------------------------------------------------------

describe("validateSplitPayment", () => {
  it("returns error when no tenders exist", () => {
    const errors = validateSplitPayment(makeState(100));
    expect(errors).toContain("At least one payment method is required");
  });

  it("returns error when remaining balance > 0", () => {
    const state = makeState(200, [makeTender({ amount: 100 })]);
    const errors = validateSplitPayment(state);
    expect(errors.some((e) => e.includes("remaining"))).toBe(true);
  });

  it("returns error when over-allocated", () => {
    const state = makeState(100, [makeTender({ amount: 150 })]);
    const errors = validateSplitPayment(state);
    expect(errors.some((e) => e.includes("Over-allocated"))).toBe(true);
  });

  it("returns error for cash tender without sufficient cashTendered", () => {
    const state = makeState(100, [
      makeTender({ amount: 100, cashTendered: 50 }),
    ]);
    const errors = validateSplitPayment(state);
    expect(errors.some((e) => e.includes("tendered amount"))).toBe(true);
  });

  it("returns error for zero-amount tender", () => {
    const state = makeState(100, [
      makeTender({ id: "t1", amount: 100, cashTendered: 100 }),
      makeTender({ id: "t2", amount: 0 }),
    ]);
    const errors = validateSplitPayment(state);
    expect(errors.some((e) => e.includes("greater than zero"))).toBe(true);
  });

  it("returns empty array for valid split payment", () => {
    const state = makeState(200, [
      makeTender({ id: "t1", amount: 100, cashTendered: 100 }),
      makeTender({ id: "t2", method: "card", amount: 100 }),
    ]);
    const errors = validateSplitPayment(state);
    expect(errors).toEqual([]);
  });

  it("valid: single card payment covering full amount", () => {
    const state = makeState(350, [
      makeTender({ id: "t1", method: "card", amount: 350 }),
    ]);
    const errors = validateSplitPayment(state);
    expect(errors).toEqual([]);
  });
});
