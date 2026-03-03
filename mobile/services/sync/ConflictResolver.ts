/**
 * BizPilot Mobile POS — Conflict Resolver
 *
 * Resolves conflicts when local and remote records diverge.
 *
 * Strategy selection is per-entity-type because different data
 * has different conflict semantics:
 * - Orders/Inventory: server-wins (financial data is authoritative)
 * - Customers/Drafts: client-wins (local edits take precedence)
 * - Products/Settings: last-write-wins (most recent change wins)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConflictStrategy = "server-wins" | "client-wins" | "last-write-wins";

export interface ConflictRecord {
  entityType: string;
  entityId: string;
  localVersion: Record<string, unknown>;
  serverVersion: Record<string, unknown>;
  localUpdatedAt: number;
  serverUpdatedAt: number;
}

export interface ResolvedConflict {
  entityId: string;
  winner: "local" | "server";
  resolvedData: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Default strategies per entity type
//
// Why these defaults?
// Financial records (orders, inventory) must match the server
// to prevent accounting discrepancies. Customer records favor
// the local device because the cashier is editing them in
// real-time. Everything else uses last-write-wins as a fair default.
// ---------------------------------------------------------------------------

const ENTITY_STRATEGIES: Record<string, ConflictStrategy> = {
  orders: "server-wins",
  order_items: "server-wins",
  products: "last-write-wins",
  categories: "last-write-wins",
  customers: "client-wins",
  users: "server-wins",
  settings: "last-write-wins",
};

const DEFAULT_STRATEGY: ConflictStrategy = "last-write-wins";

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a single conflict between local and remote versions.
 */
export function resolveConflict(conflict: ConflictRecord): ResolvedConflict {
  const strategy =
    ENTITY_STRATEGIES[conflict.entityType] ?? DEFAULT_STRATEGY;

  switch (strategy) {
    case "server-wins":
      return {
        entityId: conflict.entityId,
        winner: "server",
        resolvedData: conflict.serverVersion,
      };

    case "client-wins":
      return {
        entityId: conflict.entityId,
        winner: "local",
        resolvedData: conflict.localVersion,
      };

    case "last-write-wins":
      if (conflict.localUpdatedAt >= conflict.serverUpdatedAt) {
        return {
          entityId: conflict.entityId,
          winner: "local",
          resolvedData: conflict.localVersion,
        };
      }
      return {
        entityId: conflict.entityId,
        winner: "server",
        resolvedData: conflict.serverVersion,
      };

    default:
      // Defensive: unknown strategy falls back to server-wins
      return {
        entityId: conflict.entityId,
        winner: "server",
        resolvedData: conflict.serverVersion,
      };
  }
}

/**
 * Resolve a batch of conflicts.
 */
export function resolveConflicts(
  conflicts: ConflictRecord[]
): ResolvedConflict[] {
  return conflicts.map(resolveConflict);
}
