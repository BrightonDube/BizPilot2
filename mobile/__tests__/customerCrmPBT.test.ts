/**
 * CRM Property-Based Tests (crm-core tasks 4.5, 4.6, 10.5)
 *
 * Property 1 (task 4.5): visit_count == count of distinct orders
 * Property 2 (task 4.6): total_spent == sum of completed order totals
 * Property 3 (task 10.5): customer is in segment ↔ all segment rules satisfied
 *
 * Why PBT for these properties?
 * Example-based tests verify specific inputs; PBT verifies the invariant
 * holds for ANY valid combination.  These properties are the mathematical
 * definition of correctness — a PBT is the most direct way to encode that.
 *
 * Random generation pattern: manual Math.random() loops (consistent with
 * the project's existing PBT style — no external fast-check dependency).
 */

import {
  calculateVisitCount,
  calculateTotalSpent,
  isInSegment,
  type SegmentRule,
} from "@/services/CustomerService";
import type { MobileCustomer, MobileOrder } from "@/types";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const STATUSES: MobileOrder["status"][] = [
  "completed",
  "pending",
  "partial",
  "voided",
  "refunded",
];

const COMPLETED_STATUSES = new Set(["completed", "partial"]);

function randId(): string {
  return Math.random().toString(36).slice(2);
}

function genOrder(overrides: Partial<MobileOrder> = {}): MobileOrder {
  const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
  return {
    id: randId(),
    orderNumber: `ORD-${randId()}`,
    customerId: "cust-1",
    status,
    subtotal: Math.round(Math.random() * 10000) / 100,
    taxAmount: Math.round(Math.random() * 1500) / 100,
    discountAmount: 0,
    total: Math.round(Math.random() * 10000) / 100,
    paymentMethod: "cash",
    paymentStatus: "paid",
    notes: null,
    createdBy: "user-1",
    createdAt: Date.now() - Math.floor(Math.random() * 1e9),
    updatedAt: Date.now(),
    remoteId: null,
    syncedAt: null,
    isDirty: false,
    ...overrides,
  };
}

function genCustomer(overrides: Partial<MobileCustomer> = {}): MobileCustomer {
  return {
    id: randId(),
    name: `Customer ${randId()}`,
    email: null,
    phone: null,
    address: null,
    notes: null,
    loyaltyPoints: Math.floor(Math.random() * 5000),
    totalSpent: Math.round(Math.random() * 50000) / 100,
    visitCount: Math.floor(Math.random() * 100),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    remoteId: null,
    syncedAt: null,
    isDirty: false,
    ...overrides,
  };
}

const OPERATORS: SegmentRule["operator"][] = ["gt", "gte", "lt", "lte", "eq"];
const FIELDS: SegmentRule["field"][] = ["totalSpent", "visitCount", "loyaltyPoints"];

function genRule(): SegmentRule {
  return {
    field: FIELDS[Math.floor(Math.random() * FIELDS.length)],
    operator: OPERATORS[Math.floor(Math.random() * OPERATORS.length)],
    value: Math.floor(Math.random() * 10000),
  };
}

// ---------------------------------------------------------------------------
// Property 1: visit_count == count of distinct orders (task 4.5)
// ---------------------------------------------------------------------------

describe("Property 1: calculateVisitCount — distinct order count invariant", () => {
  it("visit count equals the number of unique order IDs — 500 random batches", () => {
    for (let i = 0; i < 500; i++) {
      const size = Math.floor(Math.random() * 20);
      const orders = Array.from({ length: size }, () => genOrder());
      const expected = new Set(orders.map((o) => o.id)).size;
      expect(calculateVisitCount(orders)).toBe(expected);
    }
  });

  it("adding a duplicate order never increases the count — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const orders = Array.from({ length: Math.floor(Math.random() * 10) + 1 }, () => genOrder());
      const countBefore = calculateVisitCount(orders);

      // Add a duplicate of the first order
      const withDuplicate = [...orders, { ...orders[0] }];
      const countAfter = calculateVisitCount(withDuplicate);

      expect(countAfter).toBe(countBefore);
    }
  });

  it("count is always non-negative — 500 runs", () => {
    for (let i = 0; i < 500; i++) {
      const orders = Array.from({ length: Math.floor(Math.random() * 15) }, () => genOrder());
      expect(calculateVisitCount(orders)).toBeGreaterThanOrEqual(0);
    }
  });

  it("adding a new unique order always increases count by exactly 1 — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const orders = Array.from({ length: Math.floor(Math.random() * 10) }, () => genOrder());
      const countBefore = calculateVisitCount(orders);

      // Add a guaranteed-unique order
      const newOrder = genOrder({ id: `unique-${randId()}` });
      const countAfter = calculateVisitCount([...orders, newOrder]);

      expect(countAfter).toBe(countBefore + 1);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 2: total_spent == sum of completed order totals (task 4.6)
// ---------------------------------------------------------------------------

describe("Property 2: calculateTotalSpent — completed-order sum invariant", () => {
  it("total_spent equals manual sum of completed+partial totals — 500 runs", () => {
    for (let i = 0; i < 500; i++) {
      const orders = Array.from({ length: Math.floor(Math.random() * 20) }, () => genOrder());

      const expected =
        Math.round(
          orders
            .filter((o) => COMPLETED_STATUSES.has(o.status))
            .reduce((sum, o) => sum + o.total, 0) * 100
        ) / 100;

      expect(calculateTotalSpent(orders)).toBe(expected);
    }
  });

  it("total_spent is always non-negative for non-negative order totals — 500 runs", () => {
    for (let i = 0; i < 500; i++) {
      const orders = Array.from({ length: Math.floor(Math.random() * 20) }, () =>
        genOrder({ total: Math.abs(Math.random() * 1000) })
      );
      expect(calculateTotalSpent(orders)).toBeGreaterThanOrEqual(0);
    }
  });

  it("adding a non-completed order never changes total_spent — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const orders = Array.from({ length: Math.floor(Math.random() * 10) }, () =>
        genOrder({ status: "completed" })
      );
      const totalBefore = calculateTotalSpent(orders);

      // Add a pending order
      const pending = genOrder({ status: "pending", total: Math.random() * 1000 + 1 });
      const totalAfter = calculateTotalSpent([...orders, pending]);

      expect(totalAfter).toBe(totalBefore);
    }
  });

  it("adding a completed order increases total_spent by exactly that order's total — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const orders = Array.from({ length: Math.floor(Math.random() * 10) }, () =>
        genOrder({ status: "completed" })
      );
      const totalBefore = calculateTotalSpent(orders);

      const newOrder = genOrder({ status: "completed", total: 99.99 });
      const totalAfter = calculateTotalSpent([...orders, newOrder]);

      // Allow ±0.01 tolerance for floating-point rounding
      expect(Math.abs(totalAfter - (totalBefore + 99.99))).toBeLessThanOrEqual(0.01);
    }
  });

  it("result has at most 2 decimal places — 500 runs", () => {
    for (let i = 0; i < 500; i++) {
      const orders = Array.from({ length: Math.floor(Math.random() * 15) }, () => genOrder());
      const total = calculateTotalSpent(orders);
      const decimalPlaces = (total.toString().split(".")[1] ?? "").length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 3: segment membership ↔ all rules satisfied (task 10.5)
// ---------------------------------------------------------------------------

describe("Property 3: isInSegment — all-rules-AND membership invariant", () => {
  it("customer is in segment ↔ every rule evaluates to true — 500 runs", () => {
    for (let i = 0; i < 500; i++) {
      const customer = genCustomer();
      const rules = Array.from({ length: Math.floor(Math.random() * 4) }, genRule);

      const inSegment = isInSegment(customer, rules);

      // Verify by manually applying all rules
      const allSatisfied = rules.every((rule) => {
        const val = customer[rule.field] as number;
        switch (rule.operator) {
          case "gt":  return val > rule.value;
          case "gte": return val >= rule.value;
          case "lt":  return val < rule.value;
          case "lte": return val <= rule.value;
          case "eq":  return val === rule.value;
          default:    return false;
        }
      });

      expect(inSegment).toBe(allSatisfied);
    }
  });

  it("empty ruleset → every customer is in the segment — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const customer = genCustomer();
      expect(isInSegment(customer, [])).toBe(true);
    }
  });

  it("single failing rule excludes the customer — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const customer = genCustomer({ totalSpent: 100 });
      // Rule that the customer definitely fails
      const failRule: SegmentRule = { field: "totalSpent", operator: "gt", value: 99999 };
      expect(isInSegment(customer, [failRule])).toBe(false);
    }
  });

  it("adding a passing rule never changes the result from true to false — 200 runs", () => {
    for (let i = 0; i < 200; i++) {
      const customer = genCustomer({ visitCount: 50 });
      // Start with rules the customer satisfies
      const passingRules: SegmentRule[] = [
        { field: "visitCount", operator: "gte", value: 1 },
      ];
      expect(isInSegment(customer, passingRules)).toBe(true);

      // Add another passing rule
      const morePassingRules = [
        ...passingRules,
        { field: "visitCount" as const, operator: "lte" as const, value: 100 },
      ];
      expect(isInSegment(customer, morePassingRules)).toBe(true);
    }
  });
});
