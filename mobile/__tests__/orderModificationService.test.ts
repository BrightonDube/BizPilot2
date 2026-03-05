/**
 * Tests for OrderModificationService — modification tracking, approval, reprint.
 * (order-management tasks 9.3-9.5)
 */

import {
  requiresManagerApproval,
  createModification,
  approveModification,
  rejectModification,
  getOrderModifications,
  getPendingApprovals,
  countModificationsByType,
  isOrderModified,
  getReprintableModifications,
  markAsReprinted,
  buildReprintTicket,
  OrderModification,
  MODIFICATION_TYPE_LABELS,
  MODIFICATION_TYPE_ICONS,
} from "@/services/orders/OrderModificationService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMod(overrides: Partial<OrderModification> = {}): OrderModification {
  return {
    id: "mod-1",
    orderId: "order-1",
    type: "item_added",
    description: "Added 1x Burger",
    modifiedByUserId: "user-1",
    modifiedByName: "Jane",
    timestamp: "2025-01-15T12:00:00Z",
    affectedItemIds: ["item-1"],
    approval: null,
    requiresReprint: true,
    reprinted: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Constants", () => {
  it("MODIFICATION_TYPE_LABELS covers all types", () => {
    expect(Object.keys(MODIFICATION_TYPE_LABELS).length).toBeGreaterThanOrEqual(8);
  });

  it("MODIFICATION_TYPE_ICONS covers all types", () => {
    expect(Object.keys(MODIFICATION_TYPE_ICONS).length).toBeGreaterThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------
// requiresManagerApproval
// ---------------------------------------------------------------------------

describe("requiresManagerApproval", () => {
  it("item_added does not require approval", () => {
    expect(requiresManagerApproval("item_added")).toBe(false);
  });

  it("item_removed requires approval", () => {
    expect(requiresManagerApproval("item_removed")).toBe(true);
  });

  it("item_voided requires approval", () => {
    expect(requiresManagerApproval("item_voided")).toBe(true);
  });

  it("discount_applied requires approval", () => {
    expect(requiresManagerApproval("discount_applied")).toBe(true);
  });

  it("price_override requires approval", () => {
    expect(requiresManagerApproval("price_override")).toBe(true);
  });

  it("note_changed does not require approval", () => {
    expect(requiresManagerApproval("note_changed")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createModification
// ---------------------------------------------------------------------------

describe("createModification", () => {
  it("creates a modification without approval when not required", () => {
    const mod = createModification(
      "order-1",
      "item_added",
      "Added 1x Burger",
      "user-1",
      "Jane",
      ["item-1"],
      "2025-01-15T12:00:00Z"
    );
    expect(mod.orderId).toBe("order-1");
    expect(mod.type).toBe("item_added");
    expect(mod.approval).toBeNull();
    expect(mod.requiresReprint).toBe(true);
    expect(mod.reprinted).toBe(false);
  });

  it("creates a modification with pending approval when required", () => {
    const mod = createModification(
      "order-1",
      "item_removed",
      "Removed 1x Salad",
      "user-1",
      "Jane",
      ["item-2"],
      "2025-01-15T12:00:00Z"
    );
    expect(mod.approval).not.toBeNull();
    expect(mod.approval!.status).toBe("pending");
    expect(mod.approval!.approvedByUserId).toBeNull();
  });

  it("marks non-kitchen modifications as not requiring reprint", () => {
    const mod = createModification(
      "order-1",
      "discount_applied",
      "10% discount",
      "user-1",
      "Jane",
      ["item-1"],
      "2025-01-15T12:00:00Z"
    );
    expect(mod.requiresReprint).toBe(false);
  });

  it("stores previous and new values", () => {
    const mod = createModification(
      "order-1",
      "item_quantity_changed",
      "Changed qty from 1 to 3",
      "user-1",
      "Jane",
      ["item-1"],
      "2025-01-15T12:00:00Z",
      { quantity: 1 },
      { quantity: 3 }
    );
    expect(mod.previousValues).toEqual({ quantity: 1 });
    expect(mod.newValues).toEqual({ quantity: 3 });
  });
});

// ---------------------------------------------------------------------------
// approveModification
// ---------------------------------------------------------------------------

describe("approveModification", () => {
  it("approves a pending modification", () => {
    const mod = createModification(
      "order-1",
      "item_removed",
      "Removed salad",
      "user-1",
      "Jane",
      ["item-2"],
      "2025-01-15T12:00:00Z"
    );
    const result = approveModification(
      mod,
      "mgr-1",
      "Sara",
      "Customer changed order",
      "2025-01-15T12:01:00Z"
    );
    expect(result.error).toBeNull();
    expect(result.modification!.approval!.status).toBe("approved");
    expect(result.modification!.approval!.approvedByName).toBe("Sara");
  });

  it("rejects approval of non-approval modification", () => {
    const mod = makeMod({ approval: null });
    const result = approveModification(mod, "mgr-1", "Sara", "OK", "2025-01-15T12:01:00Z");
    expect(result.error).toContain("does not require approval");
  });

  it("rejects approval of already approved modification", () => {
    const mod = makeMod({
      approval: {
        status: "approved",
        approvedByUserId: "mgr-1",
        approvedByName: "Sara",
        approvedAt: "2025-01-15T12:01:00Z",
        reason: "OK",
      },
    });
    const result = approveModification(mod, "mgr-2", "Tom", "Also OK", "2025-01-15T12:02:00Z");
    expect(result.error).toContain("already approved");
  });
});

// ---------------------------------------------------------------------------
// rejectModification
// ---------------------------------------------------------------------------

describe("rejectModification", () => {
  it("rejects a pending modification", () => {
    const mod = createModification(
      "order-1",
      "item_voided",
      "Void steak",
      "user-1",
      "Jane",
      ["item-3"],
      "2025-01-15T12:00:00Z"
    );
    const result = rejectModification(
      mod,
      "mgr-1",
      "Sara",
      "Not authorized",
      "2025-01-15T12:01:00Z"
    );
    expect(result.error).toBeNull();
    expect(result.modification!.approval!.status).toBe("rejected");
    expect(result.modification!.approval!.reason).toBe("Not authorized");
  });

  it("requires rejection reason", () => {
    const mod = createModification(
      "order-1",
      "item_voided",
      "Void steak",
      "user-1",
      "Jane",
      ["item-3"],
      "2025-01-15T12:00:00Z"
    );
    const result = rejectModification(mod, "mgr-1", "Sara", "  ", "2025-01-15T12:01:00Z");
    expect(result.error).toContain("reason");
  });
});

// ---------------------------------------------------------------------------
// Modification tracking
// ---------------------------------------------------------------------------

describe("getOrderModifications", () => {
  it("filters by orderId and sorts newest first", () => {
    const mods = [
      makeMod({ id: "m1", orderId: "o1", timestamp: "2025-01-15T10:00:00Z" }),
      makeMod({ id: "m2", orderId: "o2", timestamp: "2025-01-15T11:00:00Z" }),
      makeMod({ id: "m3", orderId: "o1", timestamp: "2025-01-15T12:00:00Z" }),
    ];
    const result = getOrderModifications(mods, "o1");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("m3"); // newest first
    expect(result[1].id).toBe("m1");
  });
});

describe("getPendingApprovals", () => {
  it("returns only pending modifications", () => {
    const mods = [
      makeMod({ id: "m1", approval: { status: "pending", approvedByUserId: null, approvedByName: null, approvedAt: null, reason: "" } }),
      makeMod({ id: "m2", approval: { status: "approved", approvedByUserId: "mgr", approvedByName: "Sara", approvedAt: "2025-01-15T12:00:00Z", reason: "OK" } }),
      makeMod({ id: "m3", approval: null }),
    ];
    expect(getPendingApprovals(mods)).toHaveLength(1);
    expect(getPendingApprovals(mods)[0].id).toBe("m1");
  });
});

describe("countModificationsByType", () => {
  it("counts correctly", () => {
    const mods = [
      makeMod({ type: "item_added" }),
      makeMod({ type: "item_added" }),
      makeMod({ type: "item_removed" }),
    ];
    const counts = countModificationsByType(mods);
    expect(counts.item_added).toBe(2);
    expect(counts.item_removed).toBe(1);
  });
});

describe("isOrderModified", () => {
  it("returns true when modifications exist", () => {
    expect(isOrderModified([makeMod({ orderId: "o1" })], "o1")).toBe(true);
  });

  it("returns false when no modifications", () => {
    expect(isOrderModified([makeMod({ orderId: "o2" })], "o1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reprint
// ---------------------------------------------------------------------------

describe("getReprintableModifications", () => {
  it("returns modifications needing reprint", () => {
    const mods = [
      makeMod({ id: "m1", requiresReprint: true, reprinted: false, approval: null }),
      makeMod({ id: "m2", requiresReprint: true, reprinted: true, approval: null }),
      makeMod({ id: "m3", requiresReprint: false, reprinted: false, approval: null }),
    ];
    const result = getReprintableModifications(mods);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m1");
  });

  it("excludes pending-approval modifications", () => {
    const mods = [
      makeMod({
        id: "m1",
        requiresReprint: true,
        reprinted: false,
        approval: { status: "pending", approvedByUserId: null, approvedByName: null, approvedAt: null, reason: "" },
      }),
    ];
    expect(getReprintableModifications(mods)).toHaveLength(0);
  });

  it("includes approved modifications", () => {
    const mods = [
      makeMod({
        id: "m1",
        requiresReprint: true,
        reprinted: false,
        approval: { status: "approved", approvedByUserId: "mgr", approvedByName: "Sara", approvedAt: "2025-01-15T12:00:00Z", reason: "OK" },
      }),
    ];
    expect(getReprintableModifications(mods)).toHaveLength(1);
  });
});

describe("markAsReprinted", () => {
  it("sets reprinted to true", () => {
    const mod = makeMod({ reprinted: false });
    expect(markAsReprinted(mod).reprinted).toBe(true);
  });

  it("does not mutate original", () => {
    const mod = makeMod({ reprinted: false });
    markAsReprinted(mod);
    expect(mod.reprinted).toBe(false);
  });
});

describe("buildReprintTicket", () => {
  it("produces formatted ticket", () => {
    const mods = [
      makeMod({
        type: "item_added",
        description: "Added 1x Burger",
        modifiedByName: "Jane",
      }),
    ];
    const ticket = buildReprintTicket("order-1", "1001", mods, "2025-01-15T12:00:00Z");
    expect(ticket).toContain("MODIFICATION REPRINT");
    expect(ticket).toContain("#1001");
    expect(ticket).toContain("Item Added");
    expect(ticket).toContain("Added 1x Burger");
    expect(ticket).toContain("Jane");
  });

  it("shows approver when present", () => {
    const mods = [
      makeMod({
        type: "item_removed",
        description: "Removed salad",
        modifiedByName: "Jane",
        approval: {
          status: "approved",
          approvedByUserId: "mgr",
          approvedByName: "Sara",
          approvedAt: "2025-01-15T12:00:00Z",
          reason: "OK",
        },
      }),
    ];
    const ticket = buildReprintTicket("order-1", "1001", mods, "2025-01-15T12:00:00Z");
    expect(ticket).toContain("Approved by: Sara");
  });
});
