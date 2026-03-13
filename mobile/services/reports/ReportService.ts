/**
 * ReportService — Pure calculation functions for POS extended reports.
 *
 * Every export is a side-effect-free function so the service can be tested
 * without a React runtime and shared between mobile & web in the future.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** ISO date range used by every report query. */
export interface ReportDateRange {
  startDate: string;
  endDate: string;
}

export type ReportPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface InventoryReportItem {
  productId: string;
  productName: string;
  category: string;
  currentStock: number;
  reorderLevel: number;
  unitCost: number;
  totalValue: number;
  turnoverRate: number;
  /** Estimated days of stock remaining at current sell-through. */
  daysOfStock: number;
}

export interface COGSEntry {
  category: string;
  openingStock: number;
  purchases: number;
  closingStock: number;
  cogs: number;
  /** COGS as a percentage of total revenue for the period. */
  cogsPercentage: number;
}

export interface ProfitMarginEntry {
  category: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercentage: number;
  trend: "up" | "down" | "flat";
}

export interface ReportSummary {
  totalValue: number;
  itemCount: number;
  averageValue: number;
  highestItem: { name: string; value: number };
  lowestItem: { name: string; value: number };
}

// ─── Calculations ────────────────────────────────────────────────────────────

/**
 * Sum the `totalValue` of every inventory item.
 *
 * Reduces in a single pass — O(n) with no intermediate arrays.
 */
export function calculateInventoryValue(items: InventoryReportItem[]): number {
  return items.reduce((sum, item) => sum + item.totalValue, 0);
}

/**
 * Standard COGS formula: Opening + Purchases − Closing.
 *
 * Returns 0 when the result would be negative (e.g. data-entry error)
 * so downstream percentage calculations never show impossible values.
 */
export function calculateCOGS(
  openingStock: number,
  purchases: number,
  closingStock: number,
): number {
  const cogs = openingStock + purchases - closingStock;
  return Math.max(0, cogs);
}

/**
 * Derive gross profit and margin % from revenue and COGS.
 *
 * Guards against division-by-zero when revenue is 0.
 */
export function calculateGrossMargin(
  revenue: number,
  cogs: number,
): { grossProfit: number; marginPercentage: number } {
  const grossProfit = revenue - cogs;
  const marginPercentage = revenue === 0 ? 0 : (grossProfit / revenue) * 100;
  return { grossProfit, marginPercentage };
}

/**
 * Products whose estimated remaining stock days exceed the threshold
 * are considered "slow movers" — capital tied up too long.
 */
export function identifySlowMovers(
  items: InventoryReportItem[],
  thresholdDays: number,
): InventoryReportItem[] {
  return items.filter((item) => item.daysOfStock > thresholdDays);
}

/**
 * Items at or below their reorder level need restocking.
 *
 * Uses `<=` so items *exactly* at the reorder point still surface —
 * waiting until they drop below risks stock-outs.
 */
export function identifyLowStock(
  items: InventoryReportItem[],
): InventoryReportItem[] {
  return items.filter((item) => item.currentStock <= item.reorderLevel);
}

/**
 * Inventory turnover = COGS / average inventory value.
 *
 * Higher turnover ⇒ inventory sells faster.
 * Returns 0 when average inventory is zero to avoid Infinity.
 */
export function calculateTurnoverRate(
  cogs: number,
  averageInventory: number,
): number {
  if (averageInventory === 0) return 0;
  return cogs / averageInventory;
}

/**
 * Build a universal summary from parallel `values` and `names` arrays.
 *
 * Keeps the caller's domain labels (product names, categories, etc.)
 * while the maths stays generic.
 */
export function generateReportSummary(
  values: number[],
  names: string[],
): ReportSummary {
  if (values.length === 0) {
    return {
      totalValue: 0,
      itemCount: 0,
      averageValue: 0,
      highestItem: { name: "", value: 0 },
      lowestItem: { name: "", value: 0 },
    };
  }

  const totalValue = values.reduce((sum, v) => sum + v, 0);
  const itemCount = values.length;
  const averageValue = totalValue / itemCount;

  let highIdx = 0;
  let lowIdx = 0;

  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[highIdx]) highIdx = i;
    if (values[i] < values[lowIdx]) lowIdx = i;
  }

  return {
    totalValue,
    itemCount,
    averageValue,
    highestItem: { name: names[highIdx], value: values[highIdx] },
    lowestItem: { name: names[lowIdx], value: values[lowIdx] },
  };
}

/**
 * Generic sort — works on any flat record by dynamic field name.
 *
 * Returns a *new* array (no mutation) so React memoisation stays safe.
 */
export function sortReportItems<T extends Record<string, any>>(
  items: T[],
  field: string,
  direction: "asc" | "desc",
): T[] {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...items].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    // String comparison for non-numeric fields (e.g. category names).
    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal) * multiplier;
    }

    return ((aVal as number) - (bVal as number)) * multiplier;
  });
}

/**
 * Keep only items whose category appears in the allow-list.
 *
 * An empty `categories` array is treated as "show everything" — the most
 * useful default when no filter chips are active.
 */
export function filterByCategory<T extends { category: string }>(
  items: T[],
  categories: string[],
): T[] {
  if (categories.length === 0) return items;
  const set = new Set(categories);
  return items.filter((item) => set.has(item.category));
}

/**
 * Human-readable label for a data point within a period.
 *
 * Uses `Intl.DateTimeFormat` so locale preferences are respected
 * without pulling in a date library.
 */
export function formatPeriodLabel(date: string, period: ReportPeriod): string {
  const d = new Date(date);

  switch (period) {
    case "daily":
      return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
    case "weekly":
      return `Week of ${d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`;
    case "monthly":
      return d.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
    case "quarterly": {
      const quarter = Math.ceil((d.getMonth() + 1) / 3);
      return `Q${quarter} ${d.getFullYear()}`;
    }
    case "yearly":
      return d.getFullYear().toString();
    default:
      return date;
  }
}
