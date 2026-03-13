/**
 * Tests for ShiftPermissionService — role-based permission checks and override logging.
 * (shift-management tasks 12.1-12.3)
 */

import {
  checkPermission,
  canApproveOverride,
  getAllowedActions,
  getRestrictedActions,
  createOverrideLog,
  validateOverride,
  filterOverrideLogs,
  ShiftUser,
  PermissionOverride,
  ACTION_LABELS,
  ROLE_LABELS,
} from "@/services/shift/ShiftPermissionService";

// ---------------------------------------------------------------------------
// Test users
// ---------------------------------------------------------------------------

const cashier: ShiftUser = { id: "u1", name: "Jane", role: "cashier" };
const supervisor: ShiftUser = { id: "u2", name: "Tom", role: "supervisor" };
const manager: ShiftUser = { id: "u3", name: "Sara", role: "manager" };
const admin: ShiftUser = { id: "u4", name: "Admin", role: "admin" };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Constants", () => {
  it("ACTION_LABELS covers all actions", () => {
    expect(Object.keys(ACTION_LABELS).length).toBeGreaterThanOrEqual(10);
  });

  it("ROLE_LABELS covers all roles", () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// checkPermission
// ---------------------------------------------------------------------------

describe("checkPermission", () => {
  it("cashier can open shift", () => {
    const result = checkPermission(cashier, "open_shift");
    expect(result.allowed).toBe(true);
    expect(result.requiresOverride).toBe(false);
  });

  it("cashier can close shift", () => {
    expect(checkPermission(cashier, "close_shift").allowed).toBe(true);
  });

  it("cashier cannot void order", () => {
    const result = checkPermission(cashier, "void_order");
    expect(result.allowed).toBe(false);
    expect(result.requiresOverride).toBe(true);
    expect(result.reason).toContain("Manager");
  });

  it("cashier cannot refund", () => {
    const result = checkPermission(cashier, "refund");
    expect(result.allowed).toBe(false);
    expect(result.requiresOverride).toBe(true);
  });

  it("cashier cannot do cash drop", () => {
    const result = checkPermission(cashier, "cash_drop");
    expect(result.allowed).toBe(false);
    expect(result.requiresOverride).toBe(true);
    expect(result.reason).toContain("Supervisor");
  });

  it("supervisor can do cash drop", () => {
    expect(checkPermission(supervisor, "cash_drop").allowed).toBe(true);
  });

  it("supervisor can adjust float", () => {
    expect(checkPermission(supervisor, "adjust_float").allowed).toBe(true);
  });

  it("supervisor cannot void order", () => {
    expect(checkPermission(supervisor, "void_order").allowed).toBe(false);
  });

  it("manager can void order", () => {
    expect(checkPermission(manager, "void_order").allowed).toBe(true);
  });

  it("manager can refund", () => {
    expect(checkPermission(manager, "refund").allowed).toBe(true);
  });

  it("manager can do EOD report", () => {
    expect(checkPermission(manager, "eod_report").allowed).toBe(true);
  });

  it("admin can do everything", () => {
    expect(checkPermission(admin, "void_order").allowed).toBe(true);
    expect(checkPermission(admin, "refund").allowed).toBe(true);
    expect(checkPermission(admin, "cash_drop").allowed).toBe(true);
    expect(checkPermission(admin, "eod_report").allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canApproveOverride
// ---------------------------------------------------------------------------

describe("canApproveOverride", () => {
  it("cashier cannot approve", () => {
    expect(canApproveOverride(cashier)).toBe(false);
  });

  it("supervisor cannot approve", () => {
    expect(canApproveOverride(supervisor)).toBe(false);
  });

  it("manager can approve", () => {
    expect(canApproveOverride(manager)).toBe(true);
  });

  it("admin can approve", () => {
    expect(canApproveOverride(admin)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAllowedActions / getRestrictedActions
// ---------------------------------------------------------------------------

describe("getAllowedActions", () => {
  it("cashier gets basic actions", () => {
    const actions = getAllowedActions(cashier);
    expect(actions).toContain("open_shift");
    expect(actions).toContain("close_shift");
    expect(actions).toContain("manual_drawer_open");
    expect(actions).toContain("user_switch");
    expect(actions).not.toContain("void_order");
    expect(actions).not.toContain("cash_drop");
  });

  it("admin gets all actions", () => {
    const actions = getAllowedActions(admin);
    expect(actions).toContain("void_order");
    expect(actions).toContain("refund");
    expect(actions).toContain("eod_report");
    expect(actions.length).toBeGreaterThanOrEqual(10);
  });
});

describe("getRestrictedActions", () => {
  it("cashier has many restricted actions", () => {
    const restricted = getRestrictedActions(cashier);
    expect(restricted).toContain("void_order");
    expect(restricted).toContain("cash_drop");
    expect(restricted).toContain("refund");
  });

  it("admin has no restricted actions", () => {
    expect(getRestrictedActions(admin)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// createOverrideLog
// ---------------------------------------------------------------------------

describe("createOverrideLog", () => {
  it("creates a valid override log", () => {
    const log = createOverrideLog(
      "refund",
      "u1",
      "u3",
      "shift-1",
      "Customer complaint",
      "2025-01-15T12:00:00Z"
    );
    expect(log.action).toBe("refund");
    expect(log.requestedByUserId).toBe("u1");
    expect(log.approvedByUserId).toBe("u3");
    expect(log.shiftId).toBe("shift-1");
    expect(log.reason).toBe("Customer complaint");
    expect(log.id).toContain("override-");
  });
});

// ---------------------------------------------------------------------------
// validateOverride
// ---------------------------------------------------------------------------

describe("validateOverride", () => {
  it("valid override by manager", () => {
    expect(validateOverride(manager, "refund", "Customer request")).toEqual([]);
  });

  it("rejects override by cashier", () => {
    const errors = validateOverride(cashier, "refund", "Test");
    expect(errors.some((e) => e.includes("cannot approve"))).toBe(true);
  });

  it("rejects empty reason", () => {
    const errors = validateOverride(manager, "refund", "  ");
    expect(errors.some((e) => e.includes("reason"))).toBe(true);
  });

  it("rejects both invalid approver and empty reason", () => {
    const errors = validateOverride(cashier, "refund", "");
    expect(errors).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// filterOverrideLogs
// ---------------------------------------------------------------------------

describe("filterOverrideLogs", () => {
  const logs: PermissionOverride[] = [
    createOverrideLog("refund", "u1", "u3", "shift-1", "R1", "2025-01-15T12:00:00Z"),
    createOverrideLog("void_order", "u2", "u3", "shift-1", "R2", "2025-01-15T13:00:00Z"),
    createOverrideLog("refund", "u1", "u4", "shift-2", "R3", "2025-01-15T14:00:00Z"),
  ];

  it("returns all when no filters", () => {
    expect(filterOverrideLogs(logs, {})).toHaveLength(3);
  });

  it("filters by shiftId", () => {
    expect(filterOverrideLogs(logs, { shiftId: "shift-1" })).toHaveLength(2);
  });

  it("filters by action", () => {
    expect(filterOverrideLogs(logs, { action: "refund" })).toHaveLength(2);
  });

  it("filters by requestedBy", () => {
    expect(filterOverrideLogs(logs, { requestedByUserId: "u1" })).toHaveLength(2);
  });

  it("combines filters", () => {
    expect(
      filterOverrideLogs(logs, { shiftId: "shift-1", action: "refund" })
    ).toHaveLength(1);
  });
});
