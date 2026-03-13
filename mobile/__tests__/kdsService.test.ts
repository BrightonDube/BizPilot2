/**
 * Tests for KDSService — routing, bump, recall, multi-station.
 * (order-management tasks 7.1-7.3, 7.5)
 */

import {
  routeItemsToStations,
  createKDSOrder,
  bumpItem,
  recallItem,
  getStationItems,
  isOrderFullyBumped,
  getStationCounts,
  type KDSStation,
  type KDSOrderItem,
  type KDSOrder,
} from "@/services/kds/KDSService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeStations = (): KDSStation[] => [
  { id: "grill", name: "Grill", categories: ["grill", "bbq"] },
  { id: "salad", name: "Salad", categories: ["salad", "cold"] },
  { id: "dessert", name: "Dessert", categories: ["dessert"] },
];

const makeItem = (
  overrides: Partial<Omit<KDSOrderItem, "stationId">> = {}
): Omit<KDSOrderItem, "stationId"> => ({
  id: `item-${Math.random().toString(36).substring(7)}`,
  orderId: "order-1",
  name: "Burger",
  quantity: 1,
  modifiers: [],
  category: "grill",
  status: "pending",
  ...overrides,
});

const makeOrder = (overrides: Partial<KDSOrder> = {}): KDSOrder => ({
  id: "order-1",
  displayNumber: "A01",
  orderType: "dine_in",
  tableName: "Table 5",
  items: [
    { ...makeItem({ id: "i1", category: "grill" }), stationId: "grill" },
    { ...makeItem({ id: "i2", name: "Caesar Salad", category: "salad" }), stationId: "salad" },
  ],
  sentAt: "2025-06-15T12:00:00.000Z",
  priority: 0,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Task 7.5: Routing
// ---------------------------------------------------------------------------

describe("routeItemsToStations (Task 7.5)", () => {
  it("routes items to correct stations by category", () => {
    const items = [
      makeItem({ category: "grill" }),
      makeItem({ category: "salad" }),
      makeItem({ category: "dessert" }),
    ];
    const routed = routeItemsToStations(items, makeStations());
    expect(routed[0].stationId).toBe("grill");
    expect(routed[1].stationId).toBe("salad");
    expect(routed[2].stationId).toBe("dessert");
  });

  it("routes unknown categories to fallback (first) station", () => {
    const items = [makeItem({ category: "drinks" })];
    const routed = routeItemsToStations(items, makeStations());
    expect(routed[0].stationId).toBe("grill"); // fallback to first station
  });

  it("handles empty stations by assigning default", () => {
    const items = [makeItem()];
    const routed = routeItemsToStations(items, []);
    expect(routed[0].stationId).toBe("default");
  });
});

// ---------------------------------------------------------------------------
// Task 7.2: Send to KDS
// ---------------------------------------------------------------------------

describe("createKDSOrder (Task 7.2)", () => {
  it("creates a KDS order with routed items", () => {
    const items = [makeItem(), makeItem({ name: "Salad", category: "salad" })];
    const order = createKDSOrder("o1", "B05", "dine_in", "Table 3", items, makeStations());
    expect(order.id).toBe("o1");
    expect(order.displayNumber).toBe("B05");
    expect(order.items).toHaveLength(2);
    expect(order.items[0].stationId).toBe("grill");
    expect(order.items[1].stationId).toBe("salad");
  });

  it("sets priority and sentAt", () => {
    const order = createKDSOrder("o1", "C01", "takeaway", undefined, [], [], 5);
    expect(order.priority).toBe(5);
    expect(order.sentAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Task 7.3: Bump and recall
// ---------------------------------------------------------------------------

describe("bumpItem (Task 7.3)", () => {
  it("marks an item as done with a timestamp", () => {
    const order = makeOrder();
    const bumped = bumpItem(order, "i1");
    expect(bumped.items[0].status).toBe("done");
    expect(bumped.items[0].bumpedAt).toBeTruthy();
  });

  it("does not modify other items", () => {
    const order = makeOrder();
    const bumped = bumpItem(order, "i1");
    expect(bumped.items[1].status).toBe("pending");
  });
});

describe("recallItem (Task 7.3)", () => {
  it("recalls a bumped item within the window", () => {
    const order = makeOrder();
    const bumped = bumpItem(order, "i1");
    const bumpTime = new Date(bumped.items[0].bumpedAt!).getTime();
    // Recall 1 minute later (within 5 min window)
    const recalled = recallItem(bumped, "i1", 5 * 60000, bumpTime + 60000);
    expect(recalled.items[0].status).toBe("pending");
    expect(recalled.items[0].bumpedAt).toBeUndefined();
  });

  it("does NOT recall outside the window", () => {
    const order = makeOrder();
    const bumped = bumpItem(order, "i1");
    const bumpTime = new Date(bumped.items[0].bumpedAt!).getTime();
    // Try recall 10 minutes later (outside 5 min window)
    const recalled = recallItem(bumped, "i1", 5 * 60000, bumpTime + 10 * 60000);
    expect(recalled.items[0].status).toBe("done"); // Still done
  });

  it("does nothing to non-done items", () => {
    const order = makeOrder();
    const recalled = recallItem(order, "i1"); // i1 is "pending", not "done"
    expect(recalled.items[0].status).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

describe("getStationItems", () => {
  it("returns pending items for a specific station", () => {
    const orders = [makeOrder()];
    const items = getStationItems(orders, "grill");
    expect(items).toHaveLength(1);
    expect(items[0].item.name).toBe("Burger");
  });

  it("excludes done items", () => {
    const order = makeOrder();
    const bumped = bumpItem(order, "i1");
    const items = getStationItems([bumped], "grill");
    expect(items).toHaveLength(0);
  });

  it("sorts by priority then sentAt", () => {
    const order1 = makeOrder({ id: "o1", priority: 1, sentAt: "2025-06-15T12:00:00.000Z" });
    const order2 = makeOrder({ id: "o2", priority: 0, sentAt: "2025-06-15T12:05:00.000Z" });
    const items = getStationItems([order1, order2], "grill");
    expect(items[0].order.id).toBe("o2"); // Higher priority (lower number)
  });
});

describe("isOrderFullyBumped", () => {
  it("returns false when items are pending", () => {
    expect(isOrderFullyBumped(makeOrder())).toBe(false);
  });

  it("returns true when all items are done", () => {
    let order = makeOrder();
    order = bumpItem(order, "i1");
    order = bumpItem(order, "i2");
    expect(isOrderFullyBumped(order)).toBe(true);
  });
});

describe("getStationCounts", () => {
  it("counts pending items per station", () => {
    const orders = [makeOrder()];
    const counts = getStationCounts(orders, makeStations());
    expect(counts.grill).toBe(1);
    expect(counts.salad).toBe(1);
    expect(counts.dessert).toBe(0);
  });
});
