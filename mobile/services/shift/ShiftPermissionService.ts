/**
 * ShiftPermissionService — pure functions for shift-level RBAC.
 * (shift-management tasks 12.1-12.3)
 *
 * Enforces who can perform which shift actions and logs overrides.
 *
 * Why a separate service?
 * Permission logic must be testable independently of UI or DB.
 * By keeping it pure, the calling code just checks
 * `canPerformAction(user, action)` and renders accordingly.
 *
 * Permission model:
 *   - Each user has a role (cashier, supervisor, manager, admin)
 *   - Each shift action requires a minimum role
 *   - Managers can override any action and the override is logged
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Roles ordered by privilege level (lowest to highest). */
export type UserRole = "cashier" | "supervisor" | "manager" | "admin";

/** Actions that require permission checks during a shift. */
export type ShiftAction =
  | "open_shift"
  | "close_shift"
  | "cash_drop"
  | "paid_out"
  | "pay_in"
  | "void_order"
  | "refund"
  | "manual_drawer_open"
  | "user_switch"
  | "eod_report"
  | "adjust_float";

export interface ShiftUser {
  id: string;
  name: string;
  role: UserRole;
  pinHash?: string;
}

export interface PermissionOverride {
  id: string;
  action: ShiftAction;
  requestedByUserId: string;
  approvedByUserId: string;
  shiftId: string;
  timestamp: string; // ISO
  reason: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  requiresOverride: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// Task 12.1: Role-based permission definitions
// ---------------------------------------------------------------------------

/**
 * Role privilege levels — higher number = more privilege.
 * Used for comparisons: a user can perform an action if their role level
 * is >= the action's required level.
 */
const ROLE_LEVELS: Record<UserRole, number> = {
  cashier: 1,
  supervisor: 2,
  manager: 3,
  admin: 4,
};

/**
 * Minimum role required for each shift action.
 *
 * Why these specific levels?
 * - Cashiers can do basic ops (open/close their shift, switch user)
 * - Supervisors can handle cash drops, drawer, and float adjustments
 * - Managers are needed for voids, refunds, and EOD reports
 * - Admins can do everything
 */
const ACTION_MIN_ROLE: Record<ShiftAction, UserRole> = {
  open_shift: "cashier",
  close_shift: "cashier",
  cash_drop: "supervisor",
  paid_out: "supervisor",
  pay_in: "supervisor",
  void_order: "manager",
  refund: "manager",
  manual_drawer_open: "cashier",
  user_switch: "cashier",
  eod_report: "manager",
  adjust_float: "supervisor",
};

/** Human-readable labels for each action. */
export const ACTION_LABELS: Record<ShiftAction, string> = {
  open_shift: "Open Shift",
  close_shift: "Close Shift",
  cash_drop: "Cash Drop",
  paid_out: "Paid Out",
  pay_in: "Pay In",
  void_order: "Void Order",
  refund: "Process Refund",
  manual_drawer_open: "Open Drawer",
  user_switch: "Switch User",
  eod_report: "End of Day Report",
  adjust_float: "Adjust Float",
};

/** Human-readable role labels. */
export const ROLE_LABELS: Record<UserRole, string> = {
  cashier: "Cashier",
  supervisor: "Supervisor",
  manager: "Manager",
  admin: "Admin",
};

// ---------------------------------------------------------------------------
// Task 12.2: Permission enforcement
// ---------------------------------------------------------------------------

/**
 * Check if a user has permission to perform an action.
 *
 * Returns:
 * - allowed: true if user's role meets the minimum
 * - requiresOverride: true if user's role is below the minimum (needs manager approval)
 * - reason: human-readable explanation
 */
export function checkPermission(
  user: ShiftUser,
  action: ShiftAction
): PermissionCheckResult {
  const userLevel = ROLE_LEVELS[user.role];
  const requiredRole = ACTION_MIN_ROLE[action];
  const requiredLevel = ROLE_LEVELS[requiredRole];

  if (userLevel >= requiredLevel) {
    return {
      allowed: true,
      requiresOverride: false,
      reason: `${ROLE_LABELS[user.role]} is authorised for ${ACTION_LABELS[action]}`,
    };
  }

  return {
    allowed: false,
    requiresOverride: true,
    reason: `${ACTION_LABELS[action]} requires ${ROLE_LABELS[requiredRole]} or higher. Current role: ${ROLE_LABELS[user.role]}`,
  };
}

/**
 * Check if a user can approve an override for another user's action.
 * Approvers must be manager or above.
 */
export function canApproveOverride(approver: ShiftUser): boolean {
  return ROLE_LEVELS[approver.role] >= ROLE_LEVELS["manager"];
}

/**
 * Get all actions a user can perform without override.
 */
export function getAllowedActions(user: ShiftUser): ShiftAction[] {
  const userLevel = ROLE_LEVELS[user.role];
  const allActions: ShiftAction[] = Object.keys(ACTION_MIN_ROLE) as ShiftAction[];

  return allActions.filter(
    (action) => userLevel >= ROLE_LEVELS[ACTION_MIN_ROLE[action]]
  );
}

/**
 * Get all actions that require override for this user.
 */
export function getRestrictedActions(user: ShiftUser): ShiftAction[] {
  const userLevel = ROLE_LEVELS[user.role];
  const allActions: ShiftAction[] = Object.keys(ACTION_MIN_ROLE) as ShiftAction[];

  return allActions.filter(
    (action) => userLevel < ROLE_LEVELS[ACTION_MIN_ROLE[action]]
  );
}

// ---------------------------------------------------------------------------
// Task 12.3: Permission override logging
// ---------------------------------------------------------------------------

/**
 * Create a permission override log entry.
 *
 * Why log overrides?
 * Audit trail is critical for POS — if a cashier processes a refund with
 * manager approval, both parties are on record.
 */
export function createOverrideLog(
  action: ShiftAction,
  requestedByUserId: string,
  approvedByUserId: string,
  shiftId: string,
  reason: string,
  now: string
): PermissionOverride {
  return {
    id: `override-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    requestedByUserId,
    approvedByUserId,
    shiftId,
    timestamp: now,
    reason,
  };
}

/**
 * Validate an override request.
 * Returns an array of error strings (empty = valid).
 */
export function validateOverride(
  approver: ShiftUser,
  action: ShiftAction,
  reason: string
): string[] {
  const errors: string[] = [];

  if (!canApproveOverride(approver)) {
    errors.push(
      `${ROLE_LABELS[approver.role]} cannot approve overrides. Manager or Admin required.`
    );
  }

  if (!reason.trim()) {
    errors.push("Override reason is required for audit trail");
  }

  return errors;
}

/**
 * Filter override logs by shift, action, or user.
 */
export function filterOverrideLogs(
  logs: PermissionOverride[],
  filters: {
    shiftId?: string;
    action?: ShiftAction;
    requestedByUserId?: string;
    approvedByUserId?: string;
  }
): PermissionOverride[] {
  return logs.filter((log) => {
    if (filters.shiftId && log.shiftId !== filters.shiftId) return false;
    if (filters.action && log.action !== filters.action) return false;
    if (filters.requestedByUserId && log.requestedByUserId !== filters.requestedByUserId) return false;
    if (filters.approvedByUserId && log.approvedByUserId !== filters.approvedByUserId) return false;
    return true;
  });
}
