/**
 * TableService + OrderManagementService unit tests + PBTs
 * (order-management tasks 2.4, 3.1-3.4, 5.4)
 *
 * PBT Properties tested:
 *   Property 1 (task 3.4): occupied tables have exactly one open order
 *   Property 2 (task 2.4): order status transitions follow valid progression
 *   Property 3 (task 5.4): split order items sum equals original items
 */

import {
  createTableRecord,
  occupyTable,
  vacateTable,
  markTableAvailable,
  reserveTable,
  validateTableOrderConsistency,
  filterTablesByStatus,
  getTableSummaries,
  type TableRecord,
} from "@/services/order/TableService";

import {
  isValidStatusTransition,
  getNextStatuses,
  applyStatusTransition,
  splitOrder,
  verifySplitIntegrity,
  calculateOrderTotal,
  VALID_TRANSITIONS,
  type ManagedOrder,
  type OrderStatus,
  type OrderItem,
} from "@/services/order/OrderManagementService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOrder(
  id: string,
  itemIds: string[],
  status: OrderStatus = "new"
): ManagedOrder {
  const items: OrderItem[] = itemIds.map((itemId, idx) => ({
    id: itemId,
    productId: `prod-${idx}`,
    name: `Item ${idx}`,
    quantity: 1,
    unitPrice: 50,
  }));
  return {
    id,
    type: "dine_in",
    status,
    tableId: null,
    items,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeTable(
  id: string,
  status: TableRecord["status"] = "available",
  activeOrderId: string | null = null
): TableRecord {
  return {
    id,
    name: `Table ${id}`,
    capacity: 4,
    status,
    activeOrderId,
    statusChangedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// TableService unit tests (tasks 3.1-3.3)
// ---------------------------------------------------------------------------

describe("createTableRecord", () => {
  it("creates available table with correct fields", () => {
    const t = createTableRecord("t1", "Table 1", 4);
    expect(t.status).toBe("available");
    expect(t.capacity).toBe(4);
    expect(t.activeOrderId).toBeNull();
  });

  it("throws for zero capacity", () => {
    expect(() => createTableRecord("t1", "Table 1", 0)).toThrow();
  });

  it("throws for empty name", () => {
    expect(() => createTableRecord("t1", "", 4)).toThrow();
  });
});

describe("occupyTable", () => {
  it("transitions available table to occupied", () => {
    const t = makeTable("t1", "available");
    const occupied = occupyTable(t, "order-1");
    expect(occupied.status).toBe("occupied");
    expect(occupied.activeOrderId).toBe("order-1");
  });

  it("transitions reserved table to occupied", () => {
    const t = makeTable("t1", "reserved");
    const occupied = occupyTable(t, "order-1");
    expect(occupied.status).toBe("occupied");
  });

  it("throws when table is already occupied", () => {
    const t = makeTable("t1", "occupied", "existing-order");
    expect(() => occupyTable(t, "new-order")).toThrow();
  });

  it("throws when table is dirty", () => {
    const t = makeTable("t1", "dirty");
    expect(() => occupyTable(t, "order-1")).toThrow();
  });
});

describe("vacateTable", () => {
  it("transitions occupied table to dirty", () => {
    const t = makeTable("t1", "occupied", "order-1");
    const vacated = vacateTable(t);
    expect(vacated.status).toBe("dirty");
    expect(vacated.activeOrderId).toBeNull();
  });
});

describe("markTableAvailable", () => {
  it("cleans dirty table to available", () => {
    const t = makeTable("t1", "dirty");
    const clean = markTableAvailable(t);
    expect(clean.status).toBe("available");
  });

  it("throws when table is occupied", () => {
    const t = makeTable("t1", "occupied", "order-1");
    expect(() => markTableAvailable(t)).toThrow();
  });
});

describe("reserveTable", () => {
  it("reserves available table", () => {
    const t = makeTable("t1", "available");
    expect(reserveTable(t).status).toBe("reserved");
  });

  it("throws when table is not available", () => {
    expect(() => reserveTable(makeTable("t1", "occupied", "o1"))).toThrow();
  });
});

describe("filterTablesByStatus", () => {
  const tables = [
    makeTable("t1", "available"),
    makeTable("t2", "occupied", "o1"),
    makeTable("t3", "dirty"),
    makeTable("t4", "available"),
  ];

  it("filters by status", () => {
    expect(filterTablesByStatus(tables, "available")).toHaveLength(2);
    expect(filterTablesByStatus(tables, "occupied")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// PBT: Property 1 — Table-order consistency (task 3.4)
// ---------------------------------------------------------------------------

describe("PBT Property 1: occupied tables have exactly one open order (task 3.4)", () => {
  it("validateTableOrderConsistency passes for valid state — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const numTables = Math.floor(Math.random() * 8) + 1;
      const tables: TableRecord[] = [];
      const openOrderIds = new Set<string>();

      for (let j = 0; j < numTables; j++) {
        const statuses: TableRecord["status"][] = ["available", "occupied", "dirty", "reserved"];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        let activeOrderId: string | null = null;

        if (status === "occupied") {
          activeOrderId = `order-${j}`;
          openOrderIds.add(activeOrderId);
        }

        tables.push({
          id: `t-${j}`,
          name: `Table ${j}`,
          capacity: 4,
          status,
          activeOrderId,
          statusChangedAt: new Date().toISOString(),
        });
      }

      const result = validateTableOrderConsistency(tables, openOrderIds);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    }
  });

  it("detects occupied table with no order", () => {
    const table: TableRecord = {
      id: "t1", name: "Table 1", capacity: 4,
      status: "occupied", activeOrderId: null,
      statusChangedAt: new Date().toISOString(),
    };
    const result = validateTableOrderConsistency([table], new Set());
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// OrderManagementService unit tests
// ---------------------------------------------------------------------------

describe("isValidStatusTransition", () => {
  it("allows valid forward transitions", () => {
    expect(isValidStatusTransition("new", "sent")).toBe(true);
    expect(isValidStatusTransition("sent", "preparing")).toBe(true);
    expect(isValidStatusTransition("preparing", "ready")).toBe(true);
    expect(isValidStatusTransition("ready", "served")).toBe(true);
    expect(isValidStatusTransition("served", "paid")).toBe(true);
  });

  it("allows cancellation from early stages", () => {
    expect(isValidStatusTransition("new", "cancelled")).toBe(true);
    expect(isValidStatusTransition("sent", "cancelled")).toBe(true);
    expect(isValidStatusTransition("preparing", "cancelled")).toBe(true);
  });

  it("blocks invalid transitions", () => {
    expect(isValidStatusTransition("new", "paid")).toBe(false);
    expect(isValidStatusTransition("new", "ready")).toBe(false);
    expect(isValidStatusTransition("paid", "new")).toBe(false);
    expect(isValidStatusTransition("cancelled", "new")).toBe(false);
  });

  it("terminal states have no valid next transitions", () => {
    expect(getNextStatuses("paid")).toHaveLength(0);
    expect(getNextStatuses("cancelled")).toHaveLength(0);
  });
});

describe("applyStatusTransition", () => {
  it("applies valid transition and updates status", () => {
    const order = makeOrder("o1", ["i1", "i2"]);
    const updated = applyStatusTransition(order, "sent", "staff-1");
    expect(updated.status).toBe("sent");
  });

  it("throws for invalid transition", () => {
    const order = makeOrder("o1", ["i1"]);
    expect(() => applyStatusTransition(order, "paid", "staff-1")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// PBT: Property 2 — Status progression (task 2.4)
// ---------------------------------------------------------------------------

describe("PBT Property 2: status transitions follow valid progression (task 2.4)", () => {
  const ALL_STATUSES = Object.keys(VALID_TRANSITIONS) as OrderStatus[];

  it("isValidStatusTransition is consistent with VALID_TRANSITIONS map — exhaustive", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const expected = (VALID_TRANSITIONS[from] ?? []).includes(to);
        expect(isValidStatusTransition(from, to)).toBe(expected);
      }
    }
  });

  it("any path from 'new' reaches a terminal state without revisiting — 200 runs", () => {
    for (let i = 0; i < 200; i++) {
      let current: OrderStatus = "new";
      const visited = new Set<OrderStatus>([current]);

      // Walk randomly until we hit a terminal state (no valid next statuses)
      while (getNextStatuses(current).length > 0) {
        const nexts = getNextStatuses(current);
        const next = nexts[Math.floor(Math.random() * nexts.length)];
        expect(visited.has(next)).toBe(false); // No cycles allowed
        visited.add(next);
        current = next;
      }

      // Must end in paid or cancelled
      expect(["paid", "cancelled"]).toContain(current);
    }
  });
});

// ---------------------------------------------------------------------------
// splitOrder unit tests + PBT: Property 3 (task 5.4)
// ---------------------------------------------------------------------------

describe("splitOrder", () => {
  it("splits order into two non-empty parts", () => {
    const order = makeOrder("o1", ["i1", "i2", "i3", "i4"]);
    const result = splitOrder(order, ["i1", "i2"], "o-a", "o-b");
    expect(result.partA.items).toHaveLength(2);
    expect(result.partB.items).toHaveLength(2);
  });

  it("throws when splitting a non-new order", () => {
    const order = makeOrder("o1", ["i1", "i2"], "sent");
    expect(() => splitOrder(order, ["i1"], "a", "b")).toThrow();
  });

  it("throws when all items go to part A", () => {
    const order = makeOrder("o1", ["i1", "i2"]);
    expect(() => splitOrder(order, ["i1", "i2"], "a", "b")).toThrow();
  });

  it("throws when part A is empty", () => {
    const order = makeOrder("o1", ["i1", "i2"]);
    expect(() => splitOrder(order, [], "a", "b")).toThrow();
  });
});

describe("verifySplitIntegrity", () => {
  it("reports valid for correct split", () => {
    const order = makeOrder("o1", ["i1", "i2", "i3"]);
    const result = splitOrder(order, ["i1"], "a", "b");
    const check = verifySplitIntegrity(order, result);
    expect(check.valid).toBe(true);
  });
});

describe("PBT Property 3: split order items sum equals original (task 5.4)", () => {
  it("Property 3 holds for any valid split — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      // Generate an order with 2-10 items
      const n = Math.floor(Math.random() * 9) + 2;
      const itemIds = Array.from({ length: n }, (_, j) => `item-${j}`);
      const order = makeOrder("o1", itemIds);

      // Random split: give at least 1 item to each side
      const splitCount = Math.floor(Math.random() * (n - 1)) + 1;
      const shuffled = [...itemIds].sort(() => Math.random() - 0.5);
      const partAIds = shuffled.slice(0, splitCount);

      const result = splitOrder(order, partAIds, "part-a", "part-b");
      const integrity = verifySplitIntegrity(order, result);

      expect(integrity.valid).toBe(true);
      // Total items in split = total in original
      expect(result.partA.items.length + result.partB.items.length).toBe(n);
    }
  });
});

describe("calculateOrderTotal", () => {
  it("sums unit prices × quantities", () => {
    const order: ManagedOrder = {
      id: "o1", type: "takeaway", status: "new", tableId: null,
      items: [
        { id: "i1", productId: "p1", name: "A", quantity: 2, unitPrice: 50 },
        { id: "i2", productId: "p2", name: "B", quantity: 1, unitPrice: 30 },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(calculateOrderTotal(order)).toBe(130);
  });
});
