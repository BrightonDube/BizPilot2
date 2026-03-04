/**
 * Sales Report Property-Based Tests
 * (sales-reports tasks 2.5 and 10.4)
 *
 * Property 1 (task 2.5): netSales = grossSales - discounts - refunds (always)
 * Property 3 (task 10.4): ATV = netSales / transactionCount (when count > 0)
 *
 * Both properties must hold for ANY collection of completed order records,
 * regardless of size, values, or mix of statuses.
 *
 * Uses manual random loops consistent with the project's PBT style.
 */

import {
  aggregateMetrics,
  type OrderRecord,
} from "@/services/reports/SalesReportService";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const STATUSES = ["completed", "partial", "cancelled", "refunded"] as const;

function randAmount(max = 10000): number {
  return Math.round((Math.random() * max) * 100) / 100;
}

function randOrder(): OrderRecord {
  const grossAmount = randAmount(5000) + 1;
  const discount = randAmount(grossAmount * 0.5);
  const refundAmount = randAmount(grossAmount * 0.3);
  return {
    id: Math.random().toString(36).slice(2),
    grossAmount,
    discount,
    refundAmount,
    completedAt: new Date(
      Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
    ).toISOString(),
    itemCount: Math.floor(Math.random() * 10) + 1,
    status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
  };
}

function randCompletedOrder(): OrderRecord {
  return { ...randOrder(), status: "completed" };
}

function randOrders(n: number): OrderRecord[] {
  return Array.from({ length: n }, randOrder);
}

// ---------------------------------------------------------------------------
// Property 1: netSales = grossSales - discounts - refunds (task 2.5)
// ---------------------------------------------------------------------------

describe("Property 1: netSales = grossSales - discounts - refunds (task 2.5)", () => {
  it("Property 1 holds for empty input", () => {
    const m = aggregateMetrics([]);
    expect(m.netSales).toBeCloseTo(m.grossSales - m.discounts - m.refunds, 2);
  });

  it("Property 1 holds for any mix of statuses — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const n = Math.floor(Math.random() * 20);
      const orders = randOrders(n);
      const m = aggregateMetrics(orders);

      expect(m.netSales).toBeCloseTo(m.grossSales - m.discounts - m.refunds, 2);
    }
  });

  it("Property 1 holds for all-completed orders — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const n = Math.floor(Math.random() * 15) + 1;
      const orders = Array.from({ length: n }, randCompletedOrder);
      const m = aggregateMetrics(orders);

      expect(m.netSales).toBeCloseTo(m.grossSales - m.discounts - m.refunds, 2);
    }
  });

  it("Property 1 holds for single order — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const order = randCompletedOrder();
      const m = aggregateMetrics([order]);

      expect(m.netSales).toBeCloseTo(m.grossSales - m.discounts - m.refunds, 2);
    }
  });

  it("netSales equals grossAmount - discount - refundAmount for a single known order", () => {
    const order: OrderRecord = {
      id: "o1",
      grossAmount: 1000,
      discount: 100,
      refundAmount: 50,
      completedAt: new Date().toISOString(),
      itemCount: 3,
      status: "completed",
    };
    const m = aggregateMetrics([order]);
    expect(m.grossSales).toBe(1000);
    expect(m.discounts).toBe(100);
    expect(m.refunds).toBe(50);
    expect(m.netSales).toBe(850); // 1000 - 100 - 50
  });
});

// ---------------------------------------------------------------------------
// Property 3: ATV = netSales / transactionCount (task 10.4)
// ---------------------------------------------------------------------------

describe("Property 3: ATV = netSales / transactionCount (task 10.4)", () => {
  it("ATV is 0 when transactionCount is 0 — 200 runs", () => {
    for (let i = 0; i < 200; i++) {
      const n = Math.floor(Math.random() * 10);
      // Only non-completed orders
      const orders: OrderRecord[] = Array.from({ length: n }, () => ({
        ...randOrder(),
        status: "cancelled" as const,
      }));
      const m = aggregateMetrics(orders);
      expect(m.averageTransactionValue).toBe(0);
    }
  });

  it("Property 3 holds for all-completed orders — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const n = Math.floor(Math.random() * 15) + 1;
      const orders = Array.from({ length: n }, randCompletedOrder);
      const m = aggregateMetrics(orders);

      if (m.transactionCount > 0) {
        const expectedATV = m.netSales / m.transactionCount;
        expect(Math.abs(m.averageTransactionValue - expectedATV)).toBeLessThan(0.01);
      } else {
        expect(m.averageTransactionValue).toBe(0);
      }
    }
  });

  it("Property 3 holds for mixed status orders — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const n = Math.floor(Math.random() * 20);
      const orders = randOrders(n);
      const m = aggregateMetrics(orders);

      if (m.transactionCount > 0) {
        const expectedATV = m.netSales / m.transactionCount;
        expect(Math.abs(m.averageTransactionValue - expectedATV)).toBeLessThan(0.01);
      } else {
        expect(m.averageTransactionValue).toBe(0);
      }
    }
  });

  it("ATV is monotonically related: adding a higher-value order raises ATV — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const baseOrders = Array.from(
        { length: Math.floor(Math.random() * 5) + 1 },
        randCompletedOrder
      );
      const baseMetics = aggregateMetrics(baseOrders);

      // Add an order whose net value is greater than current ATV
      const currentATV = baseMetics.averageTransactionValue;
      const bigOrder: OrderRecord = {
        ...randCompletedOrder(),
        grossAmount: currentATV * 3 + 100,
        discount: 0,
        refundAmount: 0,
      };

      const newMetrics = aggregateMetrics([...baseOrders, bigOrder]);

      // Adding a bigger order should raise ATV
      expect(newMetrics.averageTransactionValue).toBeGreaterThan(
        baseMetics.averageTransactionValue
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Composite: both properties hold simultaneously
// ---------------------------------------------------------------------------

describe("Properties 1 and 3 hold simultaneously — 300 runs", () => {
  it("netSales formula and ATV formula both correct for same metrics object", () => {
    for (let i = 0; i < 300; i++) {
      const n = Math.floor(Math.random() * 10) + 1;
      const orders = Array.from({ length: n }, randCompletedOrder);
      const m = aggregateMetrics(orders);

      // Property 1
      expect(m.netSales).toBeCloseTo(m.grossSales - m.discounts - m.refunds, 2);

      // Property 3
      if (m.transactionCount > 0) {
        expect(Math.abs(m.averageTransactionValue - m.netSales / m.transactionCount)).toBeLessThan(0.01);
      }
    }
  });
});
