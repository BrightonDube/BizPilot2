/**
 * SalesReportService — pure calculation layer for sales reporting.
 *
 * Why pure functions here?
 * The DB query layer (WatermelonDB) is async and hard to test. By splitting:
 *   1. DB fetch  → OrderService / raw WatermelonDB queries
 *   2. Aggregation → these pure functions
 * we get instant, offline-safe calculations that are trivially testable
 * without mocking the database at all.
 *
 * The mobile POS uses this for on-device daily summaries, shift reports,
 * and end-of-day reconciliation — all of which must work offline.
 *
 * Properties (from design.md):
 *   Property 1: netSales = grossSales - discounts - refunds (always)
 *   Property 2: transactionCount = count of completed orders in the period
 *   Property 3: ATV = netSales / transactionCount (when transactionCount > 0)
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** A single completed order record, as read from WatermelonDB. */
export interface OrderRecord {
  id: string;
  /** Total before discounts or refunds */
  grossAmount: number;
  /** Total discount applied */
  discount: number;
  /** Total refunded after the sale */
  refundAmount: number;
  /** ISO timestamp of the sale */
  completedAt: string;
  /** Number of line items in the order */
  itemCount: number;
  /** "completed" | "partial" | "refunded" | "cancelled" — only "completed" counts */
  status: string;
}

/** Aggregated metrics for any time window (day / week / month). */
export interface SalesMetrics {
  grossSales: number;
  netSales: number;
  discounts: number;
  refunds: number;
  transactionCount: number;
  /** ATV = netSales / transactionCount; 0 when transactionCount is 0 */
  averageTransactionValue: number;
  itemsSold: number;
}

/** One slot in an hourly breakdown (0–23). */
export interface HourlySales {
  hour: number;
  transactionCount: number;
  netSales: number;
}

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

/**
 * Only "completed" orders contribute to sales metrics.
 * "partial" orders represent split payments still in progress and are excluded
 * to avoid double-counting once the final payment comes through.
 */
export function filterCompletedOrders(orders: OrderRecord[]): OrderRecord[] {
  return orders.filter((o) => o.status === "completed");
}

// ---------------------------------------------------------------------------
// Core aggregation — Property 1 and Property 3
// ---------------------------------------------------------------------------

/**
 * Aggregate a list of completed orders into SalesMetrics.
 *
 * **Property 1 guarantee**: `netSales = grossSales - discounts - refunds`
 * This is a linear formula with no conditional branches, so it holds for any
 * non-empty or empty input.
 *
 * **Property 3 guarantee**: `averageTransactionValue = netSales / transactionCount`
 * when transactionCount > 0; returns 0 when transactionCount is 0 (safe default).
 */
export function aggregateMetrics(orders: OrderRecord[]): SalesMetrics {
  const completed = filterCompletedOrders(orders);

  const grossSales = sumField(completed, "grossAmount");
  const discounts = sumField(completed, "discount");
  const refunds = sumField(completed, "refundAmount");
  const itemsSold = sumField(completed, "itemCount");

  const netSales = round2(grossSales - discounts - refunds);
  const transactionCount = completed.length;
  const averageTransactionValue =
    transactionCount > 0 ? round2(netSales / transactionCount) : 0;

  return {
    grossSales: round2(grossSales),
    netSales,
    discounts: round2(discounts),
    refunds: round2(refunds),
    transactionCount,
    averageTransactionValue,
    itemsSold,
  };
}

// ---------------------------------------------------------------------------
// Hourly breakdown
// ---------------------------------------------------------------------------

/**
 * Group completed orders by the hour they were completed (local time).
 * Returns all 24 hours (0–23); slots with no sales have 0 values.
 */
export function calculateHourlyBreakdown(orders: OrderRecord[]): HourlySales[] {
  const completed = filterCompletedOrders(orders);

  const byHour = new Map<number, { count: number; netSales: number }>();

  for (const order of completed) {
    const hour = new Date(order.completedAt).getHours();
    const net = round2(order.grossAmount - order.discount - order.refundAmount);
    const existing = byHour.get(hour) ?? { count: 0, netSales: 0 };
    byHour.set(hour, {
      count: existing.count + 1,
      netSales: round2(existing.netSales + net),
    });
  }

  // Return all 24 hours so the chart has a complete x-axis
  return Array.from({ length: 24 }, (_, hour) => {
    const slot = byHour.get(hour);
    return {
      hour,
      transactionCount: slot?.count ?? 0,
      netSales: slot?.netSales ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Period comparison helpers
// ---------------------------------------------------------------------------

/**
 * Calculate percent change from previousValue to currentValue.
 * Returns 0 when previousValue is 0 (no prior baseline to compare).
 */
export function calculatePercentChange(
  currentValue: number,
  previousValue: number
): number {
  if (previousValue === 0) return 0;
  return round2(((currentValue - previousValue) / previousValue) * 100);
}

// ---------------------------------------------------------------------------
// Date range helpers (used by the DB query layer to fetch the right rows)
// ---------------------------------------------------------------------------

export interface DateRange {
  start: Date;
  end: Date;
}

/** Build a DateRange covering a full calendar day in local time. */
export function buildDayRange(date: Date): DateRange {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Build a DateRange covering Mon–Sun of the week containing `weekStart`. */
export function buildWeekRange(weekStart: Date): DateRange {
  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function sumField(
  orders: OrderRecord[],
  field: keyof OrderRecord
): number {
  return orders.reduce((sum, o) => sum + (o[field] as number), 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
