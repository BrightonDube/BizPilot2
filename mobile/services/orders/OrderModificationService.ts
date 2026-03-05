/**
 * OrderModificationService — pure functions for order modification tracking,
 * manager approval, and reprint of modified items.
 * (order-management tasks 9.3-9.5)
 *
 * In a POS system, modifying an order after it has been sent to the kitchen
 * requires audit trail and, for certain actions, manager approval. This
 * service provides the logic layer for those workflows.
 *
 * Why pure functions?
 * Modification validation and tracking must be deterministic for auditing.
 * The UI layer calls these functions and persists the results via hooks.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModificationType =
  | "item_added"
  | "item_removed"
  | "item_quantity_changed"
  | "item_voided"
  | "discount_applied"
  | "discount_removed"
  | "note_changed"
  | "price_override";

/** Whether this modification type requires manager approval. */
const REQUIRES_APPROVAL: Record<ModificationType, boolean> = {
  item_added: false,
  item_removed: true,
  item_quantity_changed: false,
  item_voided: true,
  discount_applied: true,
  discount_removed: false,
  note_changed: false,
  price_override: true,
};

export type ApprovalStatus = "pending" | "approved" | "rejected";

/** A single modification event on an order. */
export interface OrderModification {
  id: string;
  orderId: string;
  type: ModificationType;
  /** Human-readable description of what changed. */
  description: string;
  /** The staff member who made the modification. */
  modifiedByUserId: string;
  modifiedByName: string;
  timestamp: string; // ISO
  /** Items affected by this modification. */
  affectedItemIds: string[];
  /** Previous values (for audit trail). */
  previousValues?: Record<string, unknown>;
  /** New values after modification. */
  newValues?: Record<string, unknown>;
  /** Approval details (null if approval not required). */
  approval: ModificationApproval | null;
  /** Whether the kitchen needs a reprint for this change. */
  requiresReprint: boolean;
  reprinted: boolean;
}

export interface ModificationApproval {
  status: ApprovalStatus;
  approvedByUserId: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  reason: string;
}

/** Labels for display. */
export const MODIFICATION_TYPE_LABELS: Record<ModificationType, string> = {
  item_added: "Item Added",
  item_removed: "Item Removed",
  item_quantity_changed: "Quantity Changed",
  item_voided: "Item Voided",
  discount_applied: "Discount Applied",
  discount_removed: "Discount Removed",
  note_changed: "Note Changed",
  price_override: "Price Override",
};

/** Icon names (Ionicons) for each modification type. */
export const MODIFICATION_TYPE_ICONS: Record<ModificationType, string> = {
  item_added: "add-circle-outline",
  item_removed: "remove-circle-outline",
  item_quantity_changed: "swap-horizontal",
  item_voided: "close-circle-outline",
  discount_applied: "pricetag-outline",
  discount_removed: "pricetag",
  note_changed: "document-text-outline",
  price_override: "cash-outline",
};

// ---------------------------------------------------------------------------
// Task 9.3: Manager approval logic
// ---------------------------------------------------------------------------

/**
 * Check if a modification type requires manager approval.
 */
export function requiresManagerApproval(type: ModificationType): boolean {
  return REQUIRES_APPROVAL[type];
}

/**
 * Create a modification record.
 * If the modification requires approval, it starts in "pending" status.
 */
export function createModification(
  orderId: string,
  type: ModificationType,
  description: string,
  modifiedByUserId: string,
  modifiedByName: string,
  affectedItemIds: string[],
  now: string,
  previousValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): OrderModification {
  const needsApproval = requiresManagerApproval(type);

  // Modifications that change what the kitchen is preparing need a reprint
  const reprintTypes: ModificationType[] = [
    "item_added",
    "item_removed",
    "item_quantity_changed",
    "item_voided",
  ];
  const requiresReprint = reprintTypes.includes(type);

  return {
    id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    orderId,
    type,
    description,
    modifiedByUserId,
    modifiedByName,
    timestamp: now,
    affectedItemIds,
    previousValues,
    newValues,
    approval: needsApproval
      ? {
          status: "pending",
          approvedByUserId: null,
          approvedByName: null,
          approvedAt: null,
          reason: "",
        }
      : null,
    requiresReprint,
    reprinted: false,
  };
}

/**
 * Approve a modification.
 * Returns updated modification or error if already processed.
 */
export function approveModification(
  modification: OrderModification,
  approverUserId: string,
  approverName: string,
  reason: string,
  now: string
): { modification: OrderModification; error: null } | { modification: null; error: string } {
  if (!modification.approval) {
    return { modification: null, error: "This modification does not require approval" };
  }

  if (modification.approval.status !== "pending") {
    return {
      modification: null,
      error: `Modification already ${modification.approval.status}`,
    };
  }

  return {
    modification: {
      ...modification,
      approval: {
        status: "approved",
        approvedByUserId: approverUserId,
        approvedByName: approverName,
        approvedAt: now,
        reason,
      },
    },
    error: null,
  };
}

/**
 * Reject a modification.
 */
export function rejectModification(
  modification: OrderModification,
  approverUserId: string,
  approverName: string,
  reason: string,
  now: string
): { modification: OrderModification; error: null } | { modification: null; error: string } {
  if (!modification.approval) {
    return { modification: null, error: "This modification does not require approval" };
  }

  if (modification.approval.status !== "pending") {
    return {
      modification: null,
      error: `Modification already ${modification.approval.status}`,
    };
  }

  if (!reason.trim()) {
    return { modification: null, error: "Rejection reason is required" };
  }

  return {
    modification: {
      ...modification,
      approval: {
        status: "rejected",
        approvedByUserId: approverUserId,
        approvedByName: approverName,
        approvedAt: now,
        reason,
      },
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Task 9.4: Modification tracking / history
// ---------------------------------------------------------------------------

/**
 * Get modifications for an order, sorted newest first.
 */
export function getOrderModifications(
  allModifications: OrderModification[],
  orderId: string
): OrderModification[] {
  return allModifications
    .filter((m) => m.orderId === orderId)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
}

/**
 * Get pending modifications that still need manager approval.
 */
export function getPendingApprovals(
  modifications: OrderModification[]
): OrderModification[] {
  return modifications.filter(
    (m) => m.approval !== null && m.approval.status === "pending"
  );
}

/**
 * Count modifications by type for an order.
 */
export function countModificationsByType(
  modifications: OrderModification[]
): Record<ModificationType, number> {
  const counts: Record<string, number> = {};
  for (const mod of modifications) {
    counts[mod.type] = (counts[mod.type] ?? 0) + 1;
  }
  return counts as Record<ModificationType, number>;
}

/**
 * Check if an order has been modified (has any modification records).
 */
export function isOrderModified(
  allModifications: OrderModification[],
  orderId: string
): boolean {
  return allModifications.some((m) => m.orderId === orderId);
}

// ---------------------------------------------------------------------------
// Task 9.5: Reprint modified items
// ---------------------------------------------------------------------------

/**
 * Get modifications that need kitchen reprinting (not yet reprinted).
 */
export function getReprintableModifications(
  modifications: OrderModification[]
): OrderModification[] {
  return modifications.filter((m) => {
    if (!m.requiresReprint) return false;
    if (m.reprinted) return false;
    // Only reprint approved or non-approval-required modifications
    if (m.approval && m.approval.status !== "approved") return false;
    return true;
  });
}

/**
 * Mark a modification as reprinted.
 */
export function markAsReprinted(
  modification: OrderModification
): OrderModification {
  return { ...modification, reprinted: true };
}

/**
 * Build a reprint ticket for modified items.
 *
 * Returns a formatted string suitable for kitchen display/printer.
 * Modified items are clearly marked with "** MODIFIED **" prefix.
 */
export function buildReprintTicket(
  orderId: string,
  orderNumber: string,
  modifications: OrderModification[],
  now: string
): string {
  const lines: string[] = [];
  lines.push("==============================");
  lines.push("** MODIFICATION REPRINT **");
  lines.push("==============================");
  lines.push(`Order: #${orderNumber}`);
  lines.push(`Reprinted: ${new Date(now).toLocaleTimeString()}`);
  lines.push("------------------------------");

  for (const mod of modifications) {
    lines.push(`[${MODIFICATION_TYPE_LABELS[mod.type]}]`);
    lines.push(`  ${mod.description}`);
    lines.push(`  By: ${mod.modifiedByName}`);
    if (mod.approval?.approvedByName) {
      lines.push(`  Approved by: ${mod.approval.approvedByName}`);
    }
    lines.push("");
  }

  lines.push("==============================");
  return lines.join("\n");
}
