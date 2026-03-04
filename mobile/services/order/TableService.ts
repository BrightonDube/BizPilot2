/**
 * TableService — pure table state management for the POS floor plan.
 * (order-management tasks 3.1-3.4)
 *
 * Properties (from design.md):
 *   Property 1: For any table with status 'occupied', there SHALL be exactly
 *               one open order assigned to that table.
 *
 * Why pure functions?
 * The floor plan screen needs to render instantly on every tap. Pure functions
 * over an in-memory array of tables can be called synchronously in useMemo
 * without any async DB overhead. The DB writes happen separately after state
 * validation passes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TableStatus = "available" | "occupied" | "reserved" | "dirty";

export interface TableRecord {
  id: string;
  name: string;
  /** Capacity in seats */
  capacity: number;
  status: TableStatus;
  /** ID of the active order at this table, or null */
  activeOrderId: string | null;
  /** ISO timestamp of last status change */
  statusChangedAt: string;
}

export interface TableSummary {
  tableId: string;
  tableName: string;
  status: TableStatus;
  capacity: number;
  activeOrderId: string | null;
}

// ---------------------------------------------------------------------------
// Task 3.1: Table CRUD helpers
// ---------------------------------------------------------------------------

/**
 * Create a new table record with default 'available' status.
 */
export function createTableRecord(
  id: string,
  name: string,
  capacity: number,
  now: Date = new Date()
): TableRecord {
  if (capacity <= 0) throw new Error("Table capacity must be > 0");
  if (!name.trim()) throw new Error("Table name is required");

  return {
    id,
    name: name.trim(),
    capacity,
    status: "available",
    activeOrderId: null,
    statusChangedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Task 3.2: Status management (task 3.3)
// ---------------------------------------------------------------------------

/**
 * Transition a table to 'occupied' when an order is opened.
 *
 * Enforces Property 1: a table can only be occupied by one order at a time.
 */
export function occupyTable(
  table: TableRecord,
  orderId: string,
  now: Date = new Date()
): TableRecord {
  if (table.status === "occupied") {
    throw new Error(
      `Table "${table.name}" is already occupied by order ${table.activeOrderId}`
    );
  }
  if (table.status === "reserved") {
    // Reservations can be converted to occupied when the party arrives
  } else if (table.status !== "available") {
    throw new Error(
      `Cannot occupy table "${table.name}" with status "${table.status}" — must be available or reserved`
    );
  }
  return {
    ...table,
    status: "occupied",
    activeOrderId: orderId,
    statusChangedAt: now.toISOString(),
  };
}

/**
 * Transition a table to 'dirty' when an order is paid/closed.
 * Dirty means the table needs cleaning before it can be occupied again.
 */
export function vacateTable(
  table: TableRecord,
  now: Date = new Date()
): TableRecord {
  return {
    ...table,
    status: "dirty",
    activeOrderId: null,
    statusChangedAt: now.toISOString(),
  };
}

/**
 * Mark a table as 'available' after cleaning.
 */
export function markTableAvailable(
  table: TableRecord,
  now: Date = new Date()
): TableRecord {
  if (table.status === "occupied") {
    throw new Error(`Cannot mark occupied table "${table.name}" as available — vacate it first`);
  }
  return {
    ...table,
    status: "available",
    activeOrderId: null,
    statusChangedAt: now.toISOString(),
  };
}

/**
 * Reserve a table for an upcoming booking.
 */
export function reserveTable(
  table: TableRecord,
  now: Date = new Date()
): TableRecord {
  if (table.status !== "available") {
    throw new Error(`Cannot reserve table "${table.name}" with status "${table.status}"`);
  }
  return { ...table, status: "reserved", statusChangedAt: now.toISOString() };
}

// ---------------------------------------------------------------------------
// Task 3.4: Property 1 — Table-order consistency validation
// ---------------------------------------------------------------------------

/**
 * Verify Property 1: every occupied table has exactly one open order.
 *
 * @param tables       - All table records
 * @param openOrderIds - Set of IDs of currently-open orders
 */
export function validateTableOrderConsistency(
  tables: TableRecord[],
  openOrderIds: Set<string>
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const table of tables) {
    if (table.status === "occupied") {
      if (!table.activeOrderId) {
        violations.push(
          `Table "${table.name}" is occupied but has no activeOrderId`
        );
      } else if (!openOrderIds.has(table.activeOrderId)) {
        violations.push(
          `Table "${table.name}" references closed/missing order ${table.activeOrderId}`
        );
      }
    }
    if (table.status !== "occupied" && table.activeOrderId !== null) {
      violations.push(
        `Table "${table.name}" has status "${table.status}" but still has activeOrderId set`
      );
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Get a summary of all tables suitable for the floor-plan screen.
 */
export function getTableSummaries(tables: TableRecord[]): TableSummary[] {
  return tables.map((t) => ({
    tableId: t.id,
    tableName: t.name,
    status: t.status,
    capacity: t.capacity,
    activeOrderId: t.activeOrderId,
  }));
}

/**
 * Filter tables by status.
 */
export function filterTablesByStatus(
  tables: TableRecord[],
  status: TableStatus
): TableRecord[] {
  return tables.filter((t) => t.status === status);
}
