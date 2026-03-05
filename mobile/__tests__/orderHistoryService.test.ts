/**
 * Tests for OrderHistoryService — pure function tests for search,
 * filter, sort, pagination, and display helpers.
 * (order-management tasks 13.1-13.4)
 */

import {
  HistoricalOrder,
  OrderHistoryFilters,
  ORDER_STATUS_OPTIONS,
  ORDER_TYPE_OPTIONS,
  STATUS_COLORS,
  searchOrders,
  filterOrders,
  sortOrders,
  paginateOrders,
  calculateOrderDuration,
  formatOrderDate,
} from "@/services/orders/OrderHistoryService";

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeOrder(overrides: Partial<HistoricalOrder> = {}): HistoricalOrder {
  return {
    id: "o1",
    orderNumber: "1001",
    status: "completed",
    orderType: "dine_in",
    items: [
      { id: "i1", name: "Burger", quantity: 2, unitPrice: 75, total: 150 },
    ],
    subtotal: 150,
    tax: 22.5,
    total: 172.5,
    createdAt: "2025-01-15T12:00:00Z",
    staffName: "Jane",
    ...overrides,
  };
}

const sampleOrders: HistoricalOrder[] = [
  makeOrder({ id: "o1", orderNumber: "1001", total: 172.5, status: "completed", orderType: "dine_in", createdAt: "2025-01-15T12:00:00Z", staffName: "Jane", customerName: "Alice" }),
  makeOrder({ id: "o2", orderNumber: "1002", total: 95, status: "cancelled", orderType: "takeaway", createdAt: "2025-01-15T14:00:00Z", staffName: "Bob" }),
  makeOrder({ id: "o3", orderNumber: "1003", total: 300, status: "refunded", orderType: "delivery", createdAt: "2025-01-14T10:00:00Z", staffName: "Jane", items: [{ id: "i2", name: "Pizza", quantity: 3, unitPrice: 100, total: 300 }] }),
  makeOrder({ id: "o4", orderNumber: "1004", total: 50, status: "completed", orderType: "tab", createdAt: "2025-01-16T08:00:00Z", staffName: "Charlie" }),
  makeOrder({ id: "o5", orderNumber: "1005", total: 200, status: "pending", orderType: "dine_in", createdAt: "2025-01-16T09:00:00Z", staffName: "Bob", tableName: "Table 5" }),
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Constants", () => {
  it("ORDER_STATUS_OPTIONS contains all statuses + all", () => {
    expect(ORDER_STATUS_OPTIONS.length).toBe(8);
    expect(ORDER_STATUS_OPTIONS[0].value).toBe("all");
  });

  it("ORDER_TYPE_OPTIONS contains all types + all", () => {
    expect(ORDER_TYPE_OPTIONS.length).toBe(5);
    expect(ORDER_TYPE_OPTIONS[0].value).toBe("all");
  });

  it("STATUS_COLORS has a colour for every status", () => {
    const statuses = ["pending", "in_progress", "ready", "served", "completed", "cancelled", "refunded"];
    for (const s of statuses) {
      expect(STATUS_COLORS[s as keyof typeof STATUS_COLORS]).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// searchOrders
// ---------------------------------------------------------------------------

describe("searchOrders", () => {
  it("returns all orders when query is empty", () => {
    expect(searchOrders(sampleOrders, "")).toHaveLength(5);
    expect(searchOrders(sampleOrders, "  ")).toHaveLength(5);
  });

  it("searches by order number", () => {
    const result = searchOrders(sampleOrders, "1003");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("o3");
  });

  it("searches by customer name", () => {
    const result = searchOrders(sampleOrders, "alice");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("o1");
  });

  it("searches by item name", () => {
    const result = searchOrders(sampleOrders, "pizza");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("o3");
  });

  it("searches by staff name", () => {
    const result = searchOrders(sampleOrders, "bob");
    expect(result).toHaveLength(2);
  });

  it("searches by table name", () => {
    const result = searchOrders(sampleOrders, "Table 5");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("o5");
  });

  it("is case-insensitive", () => {
    expect(searchOrders(sampleOrders, "BURGER")).toHaveLength(4); // o1,o2,o4,o5 have Burger
  });
});

// ---------------------------------------------------------------------------
// filterOrders
// ---------------------------------------------------------------------------

describe("filterOrders", () => {
  const baseFilters: OrderHistoryFilters = {
    searchQuery: "",
    status: "all",
    orderType: "all",
  };

  it("returns all when no filters applied", () => {
    expect(filterOrders(sampleOrders, baseFilters)).toHaveLength(5);
  });

  it("filters by status", () => {
    const result = filterOrders(sampleOrders, { ...baseFilters, status: "completed" });
    expect(result).toHaveLength(2);
  });

  it("filters by order type", () => {
    const result = filterOrders(sampleOrders, { ...baseFilters, orderType: "takeaway" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("o2");
  });

  it("filters by dateFrom", () => {
    const result = filterOrders(sampleOrders, { ...baseFilters, dateFrom: "2025-01-15" });
    expect(result).toHaveLength(4); // o1, o2, o4, o5
  });

  it("filters by dateTo", () => {
    const result = filterOrders(sampleOrders, { ...baseFilters, dateTo: "2025-01-14" });
    expect(result).toHaveLength(1); // o3
  });

  it("filters by staff name", () => {
    const result = filterOrders(sampleOrders, { ...baseFilters, staffName: "Jane" });
    expect(result).toHaveLength(2);
  });

  it("combines multiple filters", () => {
    const result = filterOrders(sampleOrders, {
      ...baseFilters,
      status: "completed",
      orderType: "dine_in",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("o1");
  });
});

// ---------------------------------------------------------------------------
// sortOrders
// ---------------------------------------------------------------------------

describe("sortOrders", () => {
  it("sorts by date descending", () => {
    const sorted = sortOrders(sampleOrders, "date_desc");
    expect(sorted[0].id).toBe("o5"); // Jan 16 09:00
    expect(sorted[4].id).toBe("o3"); // Jan 14
  });

  it("sorts by date ascending", () => {
    const sorted = sortOrders(sampleOrders, "date_asc");
    expect(sorted[0].id).toBe("o3"); // Jan 14
  });

  it("sorts by total descending", () => {
    const sorted = sortOrders(sampleOrders, "total_desc");
    expect(sorted[0].total).toBe(300);
    expect(sorted[4].total).toBe(50);
  });

  it("sorts by total ascending", () => {
    const sorted = sortOrders(sampleOrders, "total_asc");
    expect(sorted[0].total).toBe(50);
  });

  it("does not mutate original array", () => {
    const original = [...sampleOrders];
    sortOrders(sampleOrders, "total_desc");
    expect(sampleOrders.map((o) => o.id)).toEqual(original.map((o) => o.id));
  });
});

// ---------------------------------------------------------------------------
// paginateOrders
// ---------------------------------------------------------------------------

describe("paginateOrders", () => {
  it("returns correct page slice", () => {
    const result = paginateOrders(sampleOrders, 1, 2);
    expect(result.orders).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.totalCount).toBe(5);
    expect(result.totalPages).toBe(3);
  });

  it("returns last page with remainder", () => {
    const result = paginateOrders(sampleOrders, 3, 2);
    expect(result.orders).toHaveLength(1);
    expect(result.page).toBe(3);
  });

  it("clamps page to valid range", () => {
    const result = paginateOrders(sampleOrders, 99, 2);
    expect(result.page).toBe(3);
  });

  it("clamps page below 1 to 1", () => {
    const result = paginateOrders(sampleOrders, 0, 2);
    expect(result.page).toBe(1);
  });

  it("handles empty list", () => {
    const result = paginateOrders([], 1, 10);
    expect(result.orders).toHaveLength(0);
    expect(result.totalPages).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calculateOrderDuration
// ---------------------------------------------------------------------------

describe("calculateOrderDuration", () => {
  it("returns null when no completedAt", () => {
    expect(calculateOrderDuration(makeOrder())).toBeNull();
  });

  it("calculates minutes for short orders", () => {
    const order = makeOrder({
      createdAt: "2025-01-15T12:00:00Z",
      completedAt: "2025-01-15T12:25:00Z",
    });
    expect(calculateOrderDuration(order)).toBe("25m");
  });

  it("calculates hours and minutes for long orders", () => {
    const order = makeOrder({
      createdAt: "2025-01-15T12:00:00Z",
      completedAt: "2025-01-15T13:30:00Z",
    });
    expect(calculateOrderDuration(order)).toBe("1h 30m");
  });

  it("returns null for negative duration", () => {
    const order = makeOrder({
      createdAt: "2025-01-15T14:00:00Z",
      completedAt: "2025-01-15T12:00:00Z",
    });
    expect(calculateOrderDuration(order)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatOrderDate
// ---------------------------------------------------------------------------

describe("formatOrderDate", () => {
  it("returns a string with time", () => {
    const result = formatOrderDate("2025-01-15T12:00:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats today as 'Today HH:MM'", () => {
    const now = new Date();
    now.setHours(14, 30, 0, 0);
    const result = formatOrderDate(now.toISOString());
    expect(result).toMatch(/^Today/);
  });

  it("formats yesterday as 'Yesterday HH:MM'", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(10, 0, 0, 0);
    const result = formatOrderDate(yesterday.toISOString());
    expect(result).toMatch(/^Yesterday/);
  });
});
