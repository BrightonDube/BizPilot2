/**
 * TableService — Pure functions for restaurant table/floor plan management.
 *
 * Why pure functions? Keeps business logic testable and framework-agnostic.
 * The caller (component or store) handles persistence and side-effects.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Visual status of a restaurant table. */
export type TableStatus =
  | "available"
  | "occupied"
  | "reserved"
  | "cleaning"
  | "blocked";

/** Physical shape determines how the table renders on the floor plan. */
export type TableShape = "square" | "rectangle" | "round" | "bar";

/** Position on the floor plan canvas as a percentage (0-100). */
export interface TablePosition {
  /** Horizontal offset from the left edge (0–100 %). */
  x: number;
  /** Vertical offset from the top edge (0–100 %). */
  y: number;
}

/** A single restaurant table with its current runtime state. */
export interface RestaurantTable {
  id: string;
  number: number;
  name: string;
  seats: number;
  shape: TableShape;
  status: TableStatus;
  position: TablePosition;
  /** Active order linked to this table, if any. */
  currentOrderId: string | null;
  currentOrderTotal: number;
  /** ISO-8601 timestamp when the table became occupied. */
  occupiedSince: string | null;
  /** Guest name for upcoming reservation. */
  reservedFor: string | null;
  /** ISO-8601 timestamp of the reservation. */
  reservationTime: string | null;
  /** Logical grouping (e.g. "Main Floor", "Patio"). */
  section: string;
  /** Name of the waiter currently assigned. */
  serverName: string | null;
}

/** A named floor plan containing positioned tables. */
export interface FloorPlan {
  id: string;
  name: string;
  tables: RestaurantTable[];
}

/** Aggregated snapshot of floor plan metrics. */
export interface TableSummary {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  cleaning: number;
  blocked: number;
  /** Percentage of tables that are occupied (0-100). */
  occupancyRate: number;
  /** Total seated guests across all occupied tables. */
  totalCovers: number;
  /** Mean order value across occupied tables with orders. */
  averageOrderValue: number;
}

// ─── Status → colour mapping ────────────────────────────────────────────────

/**
 * Maps kept in sync with the app-wide dark-theme palette.
 * Why a plain object? Faster than a switch and trivially extensible.
 */
const STATUS_COLORS: Record<TableStatus, string> = {
  available: "#22c55e",
  occupied: "#ef4444",
  reserved: "#fbbf24",
  cleaning: "#8b5cf6",
  blocked: "#6b7280",
};

// ─── Pure functions ─────────────────────────────────────────────────────────

/**
 * Build a high-level summary of every table on the floor plan.
 *
 * Why compute totalCovers and averageOrderValue here? The summary bar and
 * management dashboards both need these numbers, so we centralise the logic.
 */
export function calculateTableSummary(tables: RestaurantTable[]): TableSummary {
  const total = tables.length;
  let available = 0;
  let occupied = 0;
  let reserved = 0;
  let cleaning = 0;
  let blocked = 0;
  let totalCovers = 0;
  let orderSum = 0;
  let orderCount = 0;

  for (const t of tables) {
    switch (t.status) {
      case "available":
        available++;
        break;
      case "occupied":
        occupied++;
        totalCovers += t.seats;
        if (t.currentOrderTotal > 0) {
          orderSum += t.currentOrderTotal;
          orderCount++;
        }
        break;
      case "reserved":
        reserved++;
        break;
      case "cleaning":
        cleaning++;
        break;
      case "blocked":
        blocked++;
        break;
    }
  }

  return {
    total,
    available,
    occupied,
    reserved,
    cleaning,
    blocked,
    occupancyRate: total > 0 ? Math.round((occupied / total) * 100) : 0,
    totalCovers,
    averageOrderValue: orderCount > 0 ? Math.round((orderSum / orderCount) * 100) / 100 : 0,
  };
}

/**
 * Return the hex colour string associated with a table status.
 *
 * @example
 * getStatusColor('available') // '#22c55e'
 */
export function getStatusColor(status: TableStatus): string {
  return STATUS_COLORS[status] ?? "#6b7280";
}

/**
 * Filter tables to only those whose status is in the provided list.
 *
 * Why accept an array of statuses? The floor plan legend lets staff toggle
 * multiple statuses simultaneously (e.g. show "available" + "reserved").
 */
export function filterTablesByStatus(
  tables: RestaurantTable[],
  statuses: TableStatus[],
): RestaurantTable[] {
  // Set lookup is O(1) per check — worthwhile once we have more than a handful of statuses.
  const allowed = new Set(statuses);
  return tables.filter((t) => allowed.has(t.status));
}

/**
 * Filter tables belonging to a specific floor-plan section.
 *
 * @param section — Case-insensitive match against `table.section`.
 */
export function filterTablesBySection(
  tables: RestaurantTable[],
  section: string,
): RestaurantTable[] {
  const lower = section.toLowerCase();
  return tables.filter((t) => t.section.toLowerCase() === lower);
}

/**
 * Find the first available table that can seat at least `minSeats` guests.
 *
 * Why sort by seats ascending? We prefer the smallest table that fits the
 * party so larger tables stay free for bigger groups.
 */
export function findAvailableTable(
  tables: RestaurantTable[],
  minSeats: number,
): RestaurantTable | null {
  const candidates = tables
    .filter((t) => t.status === "available" && t.seats >= minSeats)
    .sort((a, b) => a.seats - b.seats);

  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Calculate how many minutes a table has been occupied.
 *
 * @param occupiedSince — ISO-8601 timestamp.
 * @param now — Current date, injected for testability.
 * @returns Duration in whole minutes (floored).
 */
export function getOccupiedDuration(occupiedSince: string, now: Date): number {
  const start = new Date(occupiedSince);
  const diffMs = now.getTime() - start.getTime();
  // Guard against future timestamps (clock skew) returning negative values.
  return Math.max(0, Math.floor(diffMs / 60_000));
}

/**
 * Check whether a table has exceeded the expected dining duration.
 *
 * Why a separate predicate? Components highlight long-occupied tables with a
 * warning badge — keeping the threshold check here avoids duplicating the
 * comparison across multiple UI files.
 */
export function isLongOccupied(
  occupiedSince: string,
  thresholdMinutes: number,
  now: Date,
): boolean {
  return getOccupiedDuration(occupiedSince, now) >= thresholdMinutes;
}

/**
 * Return tables sorted by their display number (ascending).
 *
 * Non-destructive — returns a new array.
 */
export function sortTablesByNumber(
  tables: RestaurantTable[],
): RestaurantTable[] {
  return [...tables].sort((a, b) => a.number - b.number);
}

/**
 * Occupancy rate as a percentage (0–100).
 *
 * Extracted as a standalone helper so widgets that only need this single
 * metric don't have to call the heavier `calculateTableSummary`.
 */
export function calculateOccupancyRate(tables: RestaurantTable[]): number {
  if (tables.length === 0) return 0;
  const occupied = tables.filter((t) => t.status === "occupied").length;
  return Math.round((occupied / tables.length) * 100);
}

/**
 * Return tables with a reservation starting within the next N minutes.
 *
 * Why `withinMinutes`? Hosts need a heads-up list of arrivals — the threshold
 * is configurable so different venues can tune the look-ahead window.
 *
 * @param withinMinutes — Look-ahead window from `now`.
 * @param now — Current date, injected for testability.
 */
export function getUpcomingReservations(
  tables: RestaurantTable[],
  withinMinutes: number,
  now: Date,
): RestaurantTable[] {
  const windowEnd = new Date(now.getTime() + withinMinutes * 60_000);

  return tables.filter((t) => {
    if (t.status !== "reserved" || !t.reservationTime) return false;

    const resTime = new Date(t.reservationTime);
    // Reservation must be in the future *and* within the look-ahead window.
    return resTime >= now && resTime <= windowEnd;
  });
}
