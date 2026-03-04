/**
 * SalesReportService unit tests (sales-reports task 1.4)
 *
 * Tests the pure aggregation functions without any database access.
 */

import {
  aggregateMetrics,
  filterCompletedOrders,
  calculateHourlyBreakdown,
  calculatePercentChange,
  buildDayRange,
  buildWeekRange,
  type OrderRecord,
} from "@/services/reports/SalesReportService";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: "order-1",
    grossAmount: 100,
    discount: 0,
    refundAmount: 0,
    completedAt: "2024-01-15T10:30:00.000Z",
    itemCount: 2,
    status: "completed",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// filterCompletedOrders
// ---------------------------------------------------------------------------

describe("filterCompletedOrders", () => {
  it("keeps only completed orders", () => {
    const orders: OrderRecord[] = [
      makeOrder({ id: "1", status: "completed" }),
      makeOrder({ id: "2", status: "partial" }),
      makeOrder({ id: "3", status: "cancelled" }),
      makeOrder({ id: "4", status: "refunded" }),
    ];
    const result = filterCompletedOrders(orders);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("returns empty array for empty input", () => {
    expect(filterCompletedOrders([])).toEqual([]);
  });

  it("returns all orders if all completed", () => {
    const orders = [
      makeOrder({ id: "1" }),
      makeOrder({ id: "2" }),
    ];
    expect(filterCompletedOrders(orders)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// aggregateMetrics
// ---------------------------------------------------------------------------

describe("aggregateMetrics", () => {
  it("returns zeroed metrics for empty input", () => {
    const m = aggregateMetrics([]);
    expect(m.grossSales).toBe(0);
    expect(m.netSales).toBe(0);
    expect(m.transactionCount).toBe(0);
    expect(m.averageTransactionValue).toBe(0);
  });

  it("excludes non-completed orders", () => {
    const orders = [
      makeOrder({ grossAmount: 200, status: "completed" }),
      makeOrder({ grossAmount: 999, status: "cancelled" }),
    ];
    const m = aggregateMetrics(orders);
    expect(m.grossSales).toBe(200);
    expect(m.transactionCount).toBe(1);
  });

  it("Property 1: netSales = grossSales - discounts - refunds", () => {
    const orders = [
      makeOrder({ grossAmount: 500, discount: 50, refundAmount: 0 }),
      makeOrder({ grossAmount: 300, discount: 0, refundAmount: 30 }),
    ];
    const m = aggregateMetrics(orders);
    expect(m.netSales).toBe(m.grossSales - m.discounts - m.refunds);
  });

  it("ATV is netSales / transactionCount", () => {
    const orders = [
      makeOrder({ grossAmount: 100, discount: 0, refundAmount: 0 }),
      makeOrder({ grossAmount: 200, discount: 0, refundAmount: 0 }),
    ];
    const m = aggregateMetrics(orders);
    expect(m.averageTransactionValue).toBeCloseTo(150, 2);
  });

  it("ATV is 0 when transactionCount is 0", () => {
    const m = aggregateMetrics([makeOrder({ status: "cancelled" })]);
    expect(m.averageTransactionValue).toBe(0);
  });

  it("counts itemsSold across all completed orders", () => {
    const orders = [
      makeOrder({ itemCount: 3 }),
      makeOrder({ itemCount: 5 }),
    ];
    expect(aggregateMetrics(orders).itemsSold).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// calculateHourlyBreakdown
// ---------------------------------------------------------------------------

describe("calculateHourlyBreakdown", () => {
  it("returns exactly 24 slots", () => {
    expect(calculateHourlyBreakdown([])).toHaveLength(24);
  });

  it("all slots are zero for empty input", () => {
    const slots = calculateHourlyBreakdown([]);
    expect(slots.every((s) => s.transactionCount === 0)).toBe(true);
    expect(slots.every((s) => s.netSales === 0)).toBe(true);
  });

  it("slots are indexed 0–23", () => {
    const slots = calculateHourlyBreakdown([]);
    slots.forEach((slot, i) => expect(slot.hour).toBe(i));
  });

  it("places order in correct hour bucket", () => {
    // 10:00 UTC → hour 10 (UTC is fine for unit tests)
    const order = makeOrder({ completedAt: "2024-01-15T10:30:00.000Z" });
    const slots = calculateHourlyBreakdown([order]);
    const hour10 = slots[new Date("2024-01-15T10:30:00.000Z").getHours()];
    expect(hour10.transactionCount).toBe(1);
    expect(hour10.netSales).toBe(100); // grossAmount 100, no discount/refund
  });

  it("aggregates multiple orders in the same hour", () => {
    const orders = [
      makeOrder({ id: "a", grossAmount: 100, completedAt: "2024-01-15T10:00:00.000Z" }),
      makeOrder({ id: "b", grossAmount: 200, completedAt: "2024-01-15T10:45:00.000Z" }),
    ];
    const hour = new Date("2024-01-15T10:00:00.000Z").getHours();
    const slots = calculateHourlyBreakdown(orders);
    expect(slots[hour].transactionCount).toBe(2);
    expect(slots[hour].netSales).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// calculatePercentChange
// ---------------------------------------------------------------------------

describe("calculatePercentChange", () => {
  it("calculates positive growth correctly", () => {
    expect(calculatePercentChange(110, 100)).toBeCloseTo(10, 2);
  });

  it("calculates negative growth correctly", () => {
    expect(calculatePercentChange(90, 100)).toBeCloseTo(-10, 2);
  });

  it("returns 0 when previous is 0 (no baseline)", () => {
    expect(calculatePercentChange(100, 0)).toBe(0);
  });

  it("returns 0 for no change", () => {
    expect(calculatePercentChange(100, 100)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildDayRange
// ---------------------------------------------------------------------------

describe("buildDayRange", () => {
  it("start is midnight of the given date", () => {
    const date = new Date("2024-01-15T14:30:00");
    const { start } = buildDayRange(date);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
  });

  it("end is 23:59:59.999 of the given date", () => {
    const date = new Date("2024-01-15T14:30:00");
    const { end } = buildDayRange(date);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });
});

// ---------------------------------------------------------------------------
// buildWeekRange
// ---------------------------------------------------------------------------

describe("buildWeekRange", () => {
  it("span is 7 days", () => {
    const start = new Date("2024-01-15");
    const { start: s, end: e } = buildWeekRange(start);
    const diffDays = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24);
    expect(Math.round(diffDays)).toBe(7);
  });
});
