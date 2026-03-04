/**
 * CustomerService unit tests (crm-core task 2.5)
 *
 * Tests cover:
 * 1. calculateVisitCount — distinct order counting
 * 2. calculateTotalSpent — completed-only sum with rounding
 * 3. calculateCustomerStats — aggregate stats
 * 4. evaluateSegmentRule — each operator
 * 5. isInSegment — AND logic, empty rules, mixed rules
 * 6. searchCustomers — name, email, phone search
 */

import {
  calculateVisitCount,
  calculateTotalSpent,
  calculateCustomerStats,
  evaluateSegmentRule,
  isInSegment,
  searchCustomers,
  type SegmentRule,
} from "@/services/CustomerService";
import type { MobileCustomer, MobileOrder } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOrder(
  overrides: Partial<MobileOrder> = {}
): MobileOrder {
  return {
    id: `order-${Math.random().toString(36).slice(2)}`,
    orderNumber: "ORD-001",
    customerId: "cust-1",
    status: "completed",
    subtotal: 100,
    taxAmount: 15,
    discountAmount: 0,
    total: 115,
    paymentMethod: "cash",
    paymentStatus: "paid",
    notes: null,
    createdBy: "user-1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    remoteId: null,
    syncedAt: null,
    isDirty: false,
    ...overrides,
  };
}

function makeCustomer(
  overrides: Partial<MobileCustomer> = {}
): MobileCustomer {
  return {
    id: "cust-1",
    name: "Test Customer",
    email: "test@example.com",
    phone: "+27 82 000 0000",
    address: null,
    notes: null,
    loyaltyPoints: 0,
    totalSpent: 0,
    visitCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    remoteId: null,
    syncedAt: null,
    isDirty: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateVisitCount
// ---------------------------------------------------------------------------

describe("calculateVisitCount", () => {
  it("returns 0 for empty order list", () => {
    expect(calculateVisitCount([])).toBe(0);
  });

  it("counts 3 distinct orders as 3", () => {
    const orders = [
      makeOrder({ id: "o1" }),
      makeOrder({ id: "o2" }),
      makeOrder({ id: "o3" }),
    ];
    expect(calculateVisitCount(orders)).toBe(3);
  });

  it("deduplicates orders with the same id", () => {
    const orders = [
      makeOrder({ id: "o1" }),
      makeOrder({ id: "o1" }), // duplicate
      makeOrder({ id: "o2" }),
    ];
    expect(calculateVisitCount(orders)).toBe(2);
  });

  it("counts regardless of order status", () => {
    const orders = [
      makeOrder({ id: "o1", status: "completed" }),
      makeOrder({ id: "o2", status: "pending" }),
      makeOrder({ id: "o3", status: "voided" }),
    ];
    expect(calculateVisitCount(orders)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// calculateTotalSpent
// ---------------------------------------------------------------------------

describe("calculateTotalSpent", () => {
  it("returns 0 for empty order list", () => {
    expect(calculateTotalSpent([])).toBe(0);
  });

  it("sums totals of completed orders", () => {
    const orders = [
      makeOrder({ id: "o1", status: "completed", total: 100 }),
      makeOrder({ id: "o2", status: "completed", total: 50.50 }),
    ];
    expect(calculateTotalSpent(orders)).toBe(150.50);
  });

  it("excludes pending orders from total", () => {
    const orders = [
      makeOrder({ id: "o1", status: "completed", total: 200 }),
      makeOrder({ id: "o2", status: "pending", total: 500 }),
    ];
    expect(calculateTotalSpent(orders)).toBe(200);
  });

  it("excludes voided orders from total", () => {
    const orders = [
      makeOrder({ id: "o1", status: "completed", total: 300 }),
      makeOrder({ id: "o2", status: "voided", total: 1000 }),
    ];
    expect(calculateTotalSpent(orders)).toBe(300);
  });

  it("includes partial status in total", () => {
    const orders = [
      makeOrder({ id: "o1", status: "partial", total: 150 }),
      makeOrder({ id: "o2", status: "completed", total: 100 }),
    ];
    expect(calculateTotalSpent(orders)).toBe(250);
  });

  it("rounds result to 2 decimal places", () => {
    const orders = [
      makeOrder({ id: "o1", status: "completed", total: 0.1 }),
      makeOrder({ id: "o2", status: "completed", total: 0.2 }),
    ];
    // 0.1 + 0.2 = 0.30000000000000004 in JS — should round to 0.30
    expect(calculateTotalSpent(orders)).toBe(0.30);
  });
});

// ---------------------------------------------------------------------------
// calculateCustomerStats
// ---------------------------------------------------------------------------

describe("calculateCustomerStats", () => {
  it("returns zeros/null for empty orders", () => {
    const stats = calculateCustomerStats([]);
    expect(stats.visitCount).toBe(0);
    expect(stats.totalSpent).toBe(0);
    expect(stats.averageOrderValue).toBe(0);
    expect(stats.lastVisitAt).toBeNull();
  });

  it("calculates average order value correctly", () => {
    const orders = [
      makeOrder({ id: "o1", status: "completed", total: 100, createdAt: 1000 }),
      makeOrder({ id: "o2", status: "completed", total: 200, createdAt: 2000 }),
    ];
    const stats = calculateCustomerStats(orders);
    expect(stats.averageOrderValue).toBe(150);
  });

  it("lastVisitAt is the most recent completed order timestamp", () => {
    const orders = [
      makeOrder({ id: "o1", status: "completed", total: 100, createdAt: 1000 }),
      makeOrder({ id: "o2", status: "completed", total: 200, createdAt: 5000 }),
      makeOrder({ id: "o3", status: "completed", total: 50,  createdAt: 3000 }),
    ];
    const stats = calculateCustomerStats(orders);
    expect(stats.lastVisitAt).toBe(5000);
  });

  it("lastVisitAt is null if no completed orders", () => {
    const orders = [makeOrder({ id: "o1", status: "pending", total: 100 })];
    expect(calculateCustomerStats(orders).lastVisitAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluateSegmentRule
// ---------------------------------------------------------------------------

describe("evaluateSegmentRule", () => {
  const customer = makeCustomer({ totalSpent: 1000, visitCount: 5, loyaltyPoints: 200 });

  const cases: [SegmentRule, boolean][] = [
    [{ field: "totalSpent",  operator: "gt",  value: 999  }, true],
    [{ field: "totalSpent",  operator: "gt",  value: 1000 }, false],
    [{ field: "totalSpent",  operator: "gte", value: 1000 }, true],
    [{ field: "totalSpent",  operator: "lt",  value: 1001 }, true],
    [{ field: "totalSpent",  operator: "lt",  value: 1000 }, false],
    [{ field: "totalSpent",  operator: "lte", value: 1000 }, true],
    [{ field: "visitCount",  operator: "eq",  value: 5    }, true],
    [{ field: "visitCount",  operator: "eq",  value: 4    }, false],
    [{ field: "loyaltyPoints", operator: "gte", value: 100 }, true],
  ];

  it.each(cases)(
    "rule %j → %s",
    (rule, expected) => {
      expect(evaluateSegmentRule(customer, rule)).toBe(expected);
    }
  );
});

// ---------------------------------------------------------------------------
// isInSegment
// ---------------------------------------------------------------------------

describe("isInSegment", () => {
  const customer = makeCustomer({ totalSpent: 5000, visitCount: 20 });

  it("empty rules → all customers qualify (true)", () => {
    expect(isInSegment(customer, [])).toBe(true);
  });

  it("all rules satisfied → true", () => {
    const rules: SegmentRule[] = [
      { field: "totalSpent", operator: "gte", value: 1000 },
      { field: "visitCount", operator: "gte", value: 10 },
    ];
    expect(isInSegment(customer, rules)).toBe(true);
  });

  it("one rule fails → false", () => {
    const rules: SegmentRule[] = [
      { field: "totalSpent", operator: "gte", value: 1000 },
      { field: "visitCount", operator: "gte", value: 100 }, // fails — only 20 visits
    ];
    expect(isInSegment(customer, rules)).toBe(false);
  });

  it("all rules fail → false", () => {
    const rules: SegmentRule[] = [
      { field: "totalSpent", operator: "gt", value: 99999 },
    ];
    expect(isInSegment(customer, rules)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// searchCustomers
// ---------------------------------------------------------------------------

describe("searchCustomers", () => {
  const customers = [
    makeCustomer({ id: "c1", name: "John Smith",    email: "john@example.com",  phone: "+27821234567" }),
    makeCustomer({ id: "c2", name: "Jane Doe",      email: "jane@work.com",     phone: "+27839876543" }),
    makeCustomer({ id: "c3", name: "Alice Mokoena", email: null,                phone: "+27845555555" }),
  ];

  it("empty query returns all customers", () => {
    expect(searchCustomers(customers, "")).toHaveLength(3);
    expect(searchCustomers(customers, "  ")).toHaveLength(3);
  });

  it("matches by name (case-insensitive)", () => {
    const result = searchCustomers(customers, "john");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1");
  });

  it("matches by email", () => {
    const result = searchCustomers(customers, "work.com");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c2");
  });

  it("matches by phone", () => {
    const result = searchCustomers(customers, "5555555");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c3");
  });

  it("returns empty array when no match", () => {
    expect(searchCustomers(customers, "zzznomatch")).toHaveLength(0);
  });

  it("handles customers with null email gracefully", () => {
    expect(() => searchCustomers(customers, "anything")).not.toThrow();
  });
});
