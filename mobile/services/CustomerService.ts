/**
 * CustomerService — pure CRM calculation functions for the mobile POS.
 *
 * Addresses crm-core tasks 2.x (service) and 4.x (purchase history stats).
 *
 * Why pure functions instead of a class with DB access?
 * The core business logic (visit counting, total spent, segment evaluation)
 * is deterministic math that should be fast, testable without a database,
 * and safe to call repeatedly for UI previews.  The WatermelonDB hooks
 * (useCustomers, useOrders) own the data fetching; this module owns the
 * calculations.
 *
 * This also makes property-based testing trivial — generators just need to
 * produce arrays of orders or segment rules, no database mocking needed.
 */

import type { MobileCustomer, MobileOrder } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single rule in a customer segment definition.
 *
 * Supported operators:
 *   gt  / gte — greater than / greater than or equal
 *   lt  / lte — less than / less than or equal
 *   eq        — equal
 *
 * Example rule: customer's totalSpent >= 5000
 * { field: "totalSpent", operator: "gte", value: 5000 }
 */
export type SegmentOperator = "gt" | "gte" | "lt" | "lte" | "eq";

export interface SegmentRule {
  /** The field on MobileCustomer to evaluate */
  field: keyof Pick<
    MobileCustomer,
    "totalSpent" | "visitCount" | "loyaltyPoints"
  >;
  operator: SegmentOperator;
  /** Numeric threshold */
  value: number;
}

export interface CustomerStats {
  visitCount: number;
  totalSpent: number;
  /** Average order value across all completed orders */
  averageOrderValue: number;
  /** Most recent completed order timestamp (epoch ms), or null */
  lastVisitAt: number | null;
}

// ---------------------------------------------------------------------------
// Visit count (Property 1)
// ---------------------------------------------------------------------------

/**
 * Count the number of distinct orders linked to a customer.
 *
 * Property 1: visit_count == count of distinct orders for this customer.
 *
 * Why count distinct? In theory each order is already distinct (unique id),
 * but guard against accidental duplicates in the local DB by using a Set.
 *
 * @param orders - All orders associated with the customer (pre-filtered)
 */
export function calculateVisitCount(orders: MobileOrder[]): number {
  const uniqueIds = new Set(orders.map((o) => o.id));
  return uniqueIds.size;
}

// ---------------------------------------------------------------------------
// Total spent (Property 2)
// ---------------------------------------------------------------------------

/** Status values that count toward "spent" (voided / pending don't count) */
const COMPLETED_STATUSES = new Set<MobileOrder["status"]>([
  "completed",
  "partial",
]);

/**
 * Sum the totals of all completed orders for a customer.
 *
 * Property 2: total_spent == sum of completed order totals.
 *
 * Why exclude pending/voided?
 * A pending order hasn't been paid; a voided order was cancelled.
 * Including them would overstate the customer's lifetime value.
 *
 * @param orders - All orders associated with the customer (pre-filtered)
 */
export function calculateTotalSpent(orders: MobileOrder[]): number {
  const sum = orders
    .filter((o) => COMPLETED_STATUSES.has(o.status))
    .reduce((acc, o) => acc + o.total, 0);

  // Round to 2 decimal places to avoid floating-point drift
  return Math.round(sum * 100) / 100;
}

// ---------------------------------------------------------------------------
// Customer statistics (convenience aggregate)
// ---------------------------------------------------------------------------

/**
 * Calculate all CRM statistics for a customer given their order list.
 *
 * @param orders - All orders associated with the customer (pre-filtered by customerId)
 */
export function calculateCustomerStats(orders: MobileOrder[]): CustomerStats {
  const completed = orders.filter((o) => COMPLETED_STATUSES.has(o.status));

  const visitCount = calculateVisitCount(orders);
  const totalSpent = calculateTotalSpent(orders);
  const averageOrderValue =
    completed.length > 0
      ? Math.round((totalSpent / completed.length) * 100) / 100
      : 0;

  const lastVisitAt =
    completed.length > 0
      ? Math.max(...completed.map((o) => o.createdAt))
      : null;

  return { visitCount, totalSpent, averageOrderValue, lastVisitAt };
}

// ---------------------------------------------------------------------------
// Segment evaluation (Property 3)
// ---------------------------------------------------------------------------

/**
 * Evaluate a single segment rule against a customer.
 *
 * @returns true if the customer satisfies the rule
 */
export function evaluateSegmentRule(
  customer: MobileCustomer,
  rule: SegmentRule
): boolean {
  const fieldValue = customer[rule.field] as number;

  switch (rule.operator) {
    case "gt":  return fieldValue > rule.value;
    case "gte": return fieldValue >= rule.value;
    case "lt":  return fieldValue < rule.value;
    case "lte": return fieldValue <= rule.value;
    case "eq":  return fieldValue === rule.value;
    default:    return false;
  }
}

/**
 * Determine if a customer belongs to a segment.
 *
 * Property 3: a customer is in the segment if and only if they satisfy
 * ALL segment rules (logical AND of all rules).
 *
 * Why AND instead of OR?
 * Segments define a cohort — "high-value, frequent buyer" means BOTH
 * conditions must be true.  OR would produce overlapping, ambiguous segments.
 *
 * @param customer  - The customer to evaluate
 * @param rules     - All rules for the segment (empty → all customers qualify)
 * @returns true if the customer satisfies every rule
 */
export function isInSegment(
  customer: MobileCustomer,
  rules: SegmentRule[]
): boolean {
  if (rules.length === 0) return true; // empty ruleset = everyone qualifies
  return rules.every((rule) => evaluateSegmentRule(customer, rule));
}

// ---------------------------------------------------------------------------
// Customer search
// ---------------------------------------------------------------------------

/**
 * Filter customers by a free-text query against name, email, and phone.
 * Case-insensitive, trims whitespace.
 *
 * @param customers - Full customer list to search
 * @param query     - Search string (empty → return all)
 */
export function searchCustomers(
  customers: MobileCustomer[],
  query: string
): MobileCustomer[] {
  const q = query.toLowerCase().trim();
  if (!q) return customers;
  return customers.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.email?.toLowerCase().includes(q) ?? false) ||
      (c.phone?.includes(q) ?? false)
  );
}
