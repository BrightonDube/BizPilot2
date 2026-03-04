/**
 * OrderManagementService — pure order status and split logic.
 * (order-management tasks 2.4, 5.4)
 *
 * Properties (from design.md):
 *   Property 2: Order status changes SHALL follow valid transitions.
 *               new → sent → preparing → ready → served → paid
 *               Cancelled is reachable from: new, sent, preparing
 *   Property 3: For any order split, sum(items in resulting orders)
 *               SHALL equal items in the original order.
 *
 * Why a state machine here?
 * A POS order status bug (e.g., jumping from "new" straight to "paid")
 * can invalidate inventory deductions, KDS displays, and reporting.
 * Making the transition graph explicit catches these at the boundary rather
 * than letting corrupt state propagate.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrderStatus =
  | "new"
  | "sent"
  | "preparing"
  | "ready"
  | "served"
  | "paid"
  | "cancelled";

export type OrderType = "dine_in" | "takeaway" | "delivery" | "collection";

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ManagedOrder {
  id: string;
  type: OrderType;
  status: OrderStatus;
  tableId: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface StatusChange {
  from: OrderStatus;
  to: OrderStatus;
  changedAt: string;
  changedBy: string;
}

// ---------------------------------------------------------------------------
// Property 2: Valid status transitions (task 2.4)
// ---------------------------------------------------------------------------

/**
 * Allowed next statuses for each order status.
 *
 * Why this shape?
 * A Map is O(1) lookup and makes the state machine explicit and auditable.
 * New status values must be added here AND to the OrderStatus type — both
 * changes required means it's hard to accidentally add a rogue transition.
 */
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new:        ["sent", "cancelled"],
  sent:       ["preparing", "cancelled"],
  preparing:  ["ready", "cancelled"],
  ready:      ["served"],
  served:     ["paid"],
  paid:       [],        // Terminal state — no further transitions
  cancelled:  [],        // Terminal state
};

/**
 * Check whether transitioning from `from` to `to` is a valid status change.
 */
export function isValidStatusTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get all valid next statuses for the given current status.
 */
export function getNextStatuses(current: OrderStatus): OrderStatus[] {
  return VALID_TRANSITIONS[current] ?? [];
}

/**
 * Apply a status transition to an order, throwing if the transition is invalid.
 *
 * Returns a new order object (immutable update — caller writes to DB).
 */
export function applyStatusTransition(
  order: ManagedOrder,
  to: OrderStatus,
  changedBy: string,
  now: Date = new Date()
): ManagedOrder {
  if (!isValidStatusTransition(order.status, to)) {
    throw new Error(
      `Invalid order status transition: "${order.status}" → "${to}". ` +
      `Valid next statuses: [${getNextStatuses(order.status).join(", ")}]`
    );
  }
  return {
    ...order,
    status: to,
    updatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Property 3: Order split integrity (task 5.4)
// ---------------------------------------------------------------------------

export interface SplitOrderResult {
  partA: ManagedOrder;
  partB: ManagedOrder;
}

/**
 * Split an order into two by assigning items to each part.
 *
 * Property 3: items(partA) + items(partB) = items(original)
 * This is enforced by taking the complement: partB gets all items NOT in
 * itemIdsForPartA, so the union is always the full original set.
 *
 * @param original       - The order to split
 * @param itemIdsForPartA - IDs of order items to assign to the first order
 * @param partAId        - New ID for part A
 * @param partBId        - New ID for part B
 */
export function splitOrder(
  original: ManagedOrder,
  itemIdsForPartA: string[],
  partAId: string,
  partBId: string,
  now: Date = new Date()
): SplitOrderResult {
  if (original.status !== "new") {
    throw new Error(
      `Orders can only be split when status is 'new' — current status: '${original.status}'`
    );
  }

  const partASet = new Set(itemIdsForPartA);
  const partAItems = original.items.filter((item) => partASet.has(item.id));
  const partBItems = original.items.filter((item) => !partASet.has(item.id));

  if (partAItems.length === 0) {
    throw new Error("Part A must contain at least one item");
  }
  if (partBItems.length === 0) {
    throw new Error("Part B must contain at least one item (cannot split all items into one order)");
  }

  const nowIso = now.toISOString();

  const partA: ManagedOrder = {
    ...original,
    id: partAId,
    items: partAItems,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const partB: ManagedOrder = {
    ...original,
    id: partBId,
    items: partBItems,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  return { partA, partB };
}

/**
 * Verify Property 3: items in a split result equals items in the original.
 * Used in assertions and tests.
 */
export function verifySplitIntegrity(
  original: ManagedOrder,
  result: SplitOrderResult
): { valid: boolean; error: string | null } {
  const allSplitIds = [
    ...result.partA.items.map((i) => i.id),
    ...result.partB.items.map((i) => i.id),
  ];
  const originalIds = original.items.map((i) => i.id);

  const missingFromSplit = originalIds.filter(
    (id) => !allSplitIds.includes(id)
  );
  const extraInSplit = allSplitIds.filter(
    (id) => !originalIds.includes(id)
  );

  if (missingFromSplit.length > 0 || extraInSplit.length > 0) {
    return {
      valid: false,
      error:
        `Split integrity violation: ` +
        (missingFromSplit.length > 0
          ? `missing items [${missingFromSplit.join(", ")}] `
          : "") +
        (extraInSplit.length > 0
          ? `extra items [${extraInSplit.join(", ")}]`
          : ""),
    };
  }
  return { valid: true, error: null };
}

/**
 * Calculate the total value of an order.
 */
export function calculateOrderTotal(order: ManagedOrder): number {
  const total = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
  return Math.round(total * 100) / 100;
}
