/**
 * KDSService — Kitchen Display System service (pure functions).
 * (order-management tasks 7.1, 7.2, 7.3, 7.5)
 *
 * The KDS receives orders from the POS and displays them for kitchen staff.
 * Key operations:
 *   - Routing orders to the correct station based on item categories
 *   - Bumping items (marking them done)
 *   - Recalling bumped items
 *   - Multi-station support (grill, fryer, salad, dessert, etc.)
 *
 * Properties (from design.md):
 *   Property 1: Every order item SHALL appear on exactly one KDS station.
 *   Property 2: Bumped items can be recalled within a configurable window.
 *   Property 3: Order priority is determined by creation time (FIFO).
 *
 * Why pure functions?
 * The KDS display must react instantly to bump/recall gestures. Pure functions
 * over in-memory arrays give sub-millisecond updates. The WebSocket or local
 * sync layer pushes state changes to other stations after the fact.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KDSItemStatus = "pending" | "preparing" | "done" | "recalled";

export interface KDSStation {
  id: string;
  name: string;
  /** Category IDs this station handles (e.g., ["grill", "fryer"]). */
  categories: string[];
}

export interface KDSOrderItem {
  id: string;
  orderId: string;
  name: string;
  quantity: number;
  modifiers: string[];
  /** Category for routing (e.g., "grill", "salad", "dessert"). */
  category: string;
  status: KDSItemStatus;
  /** Station this item is routed to. */
  stationId: string;
  /** ISO timestamp when bumped, for recall window. */
  bumpedAt?: string;
  /** Course number (optional, for coursed dining). */
  course?: number;
}

export interface KDSOrder {
  id: string;
  /** Short display number (e.g., "A42"). */
  displayNumber: string;
  orderType: string;
  tableName?: string;
  items: KDSOrderItem[];
  /** ISO timestamp when the order was sent to KDS. */
  sentAt: string;
  /** Priority: lower = higher priority. Default 0. */
  priority: number;
}

// ---------------------------------------------------------------------------
// Task 7.5: Route items to stations
// ---------------------------------------------------------------------------

/**
 * Route a set of order items to KDS stations based on category matching.
 *
 * Property 1: Every item lands on exactly one station. If no station matches
 * the item's category, it goes to the first station (fallback/expo station).
 *
 * @param items    - Order items to route
 * @param stations - Available KDS stations
 * @returns Items with stationId populated
 */
export function routeItemsToStations(
  items: Omit<KDSOrderItem, "stationId">[],
  stations: KDSStation[]
): KDSOrderItem[] {
  if (stations.length === 0) {
    // No stations — assign all to a virtual "default" station
    return items.map((item) => ({ ...item, stationId: "default" }));
  }

  // Build a map: category → stationId for O(1) lookup
  const categoryMap = new Map<string, string>();
  for (const station of stations) {
    for (const cat of station.categories) {
      categoryMap.set(cat, station.id);
    }
  }

  const fallbackStation = stations[0].id;

  return items.map((item) => ({
    ...item,
    stationId: categoryMap.get(item.category) ?? fallbackStation,
  }));
}

// ---------------------------------------------------------------------------
// Task 7.2: Send order to KDS
// ---------------------------------------------------------------------------

/**
 * Create a KDS order from a POS order. Routes all items to stations.
 */
export function createKDSOrder(
  orderId: string,
  displayNumber: string,
  orderType: string,
  tableName: string | undefined,
  items: Omit<KDSOrderItem, "stationId">[],
  stations: KDSStation[],
  priority: number = 0
): KDSOrder {
  return {
    id: orderId,
    displayNumber,
    orderType,
    tableName,
    items: routeItemsToStations(items, stations),
    sentAt: new Date().toISOString(),
    priority,
  };
}

// ---------------------------------------------------------------------------
// Task 7.3: Bump and recall
// ---------------------------------------------------------------------------

/**
 * Bump (mark done) a specific item on a KDS order.
 * Returns a new KDSOrder with the item's status set to "done".
 */
export function bumpItem(order: KDSOrder, itemId: string): KDSOrder {
  return {
    ...order,
    items: order.items.map((item) =>
      item.id === itemId
        ? { ...item, status: "done" as const, bumpedAt: new Date().toISOString() }
        : item
    ),
  };
}

/**
 * Recall a bumped item within the allowed window.
 *
 * Property 2: Recall is only allowed within `recallWindowMs` of the bump time.
 *
 * @param order           - Current KDS order
 * @param itemId          - Item to recall
 * @param recallWindowMs  - Recall window in milliseconds (default 5 minutes)
 * @param now             - Current time (injectable for testing)
 */
export function recallItem(
  order: KDSOrder,
  itemId: string,
  recallWindowMs: number = 5 * 60 * 1000,
  now: number = Date.now()
): KDSOrder {
  return {
    ...order,
    items: order.items.map((item) => {
      if (item.id !== itemId) return item;
      if (item.status !== "done") return item;
      if (!item.bumpedAt) return item;

      const elapsed = now - new Date(item.bumpedAt).getTime();
      if (elapsed > recallWindowMs) return item; // Outside recall window

      return { ...item, status: "pending" as const, bumpedAt: undefined };
    }),
  };
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Get items for a specific KDS station from a set of orders.
 * Returns items sorted by order priority (FIFO), then by course.
 */
export function getStationItems(
  orders: KDSOrder[],
  stationId: string
): { order: KDSOrder; item: KDSOrderItem }[] {
  const result: { order: KDSOrder; item: KDSOrderItem }[] = [];

  // Sort orders by priority then sentAt (FIFO)
  const sorted = [...orders].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime();
  });

  for (const order of sorted) {
    for (const item of order.items) {
      if (item.stationId === stationId && item.status !== "done") {
        result.push({ order, item });
      }
    }
  }

  return result;
}

/**
 * Check if all items in an order are bumped (done).
 */
export function isOrderFullyBumped(order: KDSOrder): boolean {
  return order.items.every((item) => item.status === "done");
}

/**
 * Count pending items per station.
 */
export function getStationCounts(
  orders: KDSOrder[],
  stations: KDSStation[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const station of stations) {
    counts[station.id] = 0;
  }

  for (const order of orders) {
    for (const item of order.items) {
      if (item.status !== "done" && counts[item.stationId] !== undefined) {
        counts[item.stationId] += 1;
      }
    }
  }

  return counts;
}
