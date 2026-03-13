/**
 * StockLevelService — Pure TypeScript service for POS stock management.
 *
 * Responsibilities:
 *  • Format stock levels for POS display
 *  • Deduct / restore stock on sales and refunds
 *  • Generate low-stock and out-of-stock warnings
 *
 * Every function is pure (no side-effects, no database, no React).
 * Dependencies are injected via arguments so the service is trivially testable.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to 2 decimal places — avoids floating-point dust on currency / qty math. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StockLevel {
  productId: string;
  productName: string;
  currentQuantity: number;
  /** Reorder point — quantities at or below this trigger a low-stock alert. */
  minimumQuantity: number;
  maximumQuantity: number;
  /** Display unit: "each", "kg", "litre", etc. */
  unit: string;
  /** ISO-8601 timestamp of the last stock change. */
  lastUpdated: string;
}

export interface StockAlert {
  productId: string;
  productName: string;
  alertType: 'low_stock' | 'out_of_stock' | 'overstock';
  currentQuantity: number;
  /** The threshold that was breached (min or max quantity). */
  threshold: number;
  message: string;
}

export interface StockAdjustment {
  productId: string;
  /** Negative for sales/wastage, positive for refunds/receipts. */
  quantityChange: number;
  reason: 'sale' | 'refund' | 'adjustment' | 'wastage' | 'receipt';
  /** Linked entity — order ID, refund ID, etc. */
  referenceId: string | null;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

export interface StockDisplayInfo {
  productId: string;
  quantity: number;
  unit: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  /** Hex colour string for the status badge. */
  statusColor: string;
  /** Human-readable label, e.g. "15 in stock", "Low: 3 left", "Out of Stock". */
  displayText: string;
  showWarning: boolean;
}

export interface StockUpdateResult {
  success: boolean;
  newQuantity: number;
  adjustment: StockAdjustment;
  alerts: StockAlert[];
}

export interface SaleItem {
  productId: string;
  quantity: number;
}

// ---------------------------------------------------------------------------
// 1. getStockDisplayInfo
// ---------------------------------------------------------------------------

/**
 * Build a display-ready snapshot of a product's stock for the POS UI.
 *
 * Combines status detection, colour mapping and human-readable text into one
 * call so the UI layer never has to reason about stock thresholds.
 */
export function getStockDisplayInfo(level: StockLevel): StockDisplayInfo {
  const status = getStockStatus(level.currentQuantity, level.minimumQuantity);
  const statusColor = getStatusColor(status);
  const displayText = formatStockDisplayText(level.currentQuantity, level.unit, status);
  const showWarning = status !== 'in_stock';

  return {
    productId: level.productId,
    quantity: round2(level.currentQuantity),
    unit: level.unit,
    status,
    statusColor,
    displayText,
    showWarning,
  };
}

// ---------------------------------------------------------------------------
// 2. getStockStatus
// ---------------------------------------------------------------------------

/**
 * Derive a stock status from current quantity and the minimum (reorder) threshold.
 *
 * Uses <= 0 for out-of-stock rather than === 0 so that negative drift from
 * concurrent sales is still surfaced as "out of stock".
 */
export function getStockStatus(
  current: number,
  minimum: number,
): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (current <= 0) return 'out_of_stock';
  if (current <= minimum) return 'low_stock';
  return 'in_stock';
}

// ---------------------------------------------------------------------------
// 3. getStatusColor
// ---------------------------------------------------------------------------

/** Map a stock status string to a hex colour suitable for badges / indicators. */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'in_stock':
      return '#22c55e'; // green-500
    case 'low_stock':
      return '#f59e0b'; // amber-500
    case 'out_of_stock':
      return '#ef4444'; // red-500
    default:
      return '#6b7280'; // gray-500 — defensive fallback
  }
}

// ---------------------------------------------------------------------------
// 4. formatStockDisplayText
// ---------------------------------------------------------------------------

/**
 * Produce a short, human-readable stock label for the POS tile.
 *
 * Examples:
 *  - "15 each in stock"
 *  - "Low: 3 kg left"
 *  - "Out of Stock"
 */
export function formatStockDisplayText(
  quantity: number,
  unit: string,
  status: string,
): string {
  const rounded = round2(quantity);

  switch (status) {
    case 'out_of_stock':
      return 'Out of Stock';
    case 'low_stock':
      return `Low: ${rounded} ${unit} left`;
    case 'in_stock':
    default:
      return `${rounded} ${unit} in stock`;
  }
}

// ---------------------------------------------------------------------------
// 5. checkStockAlerts
// ---------------------------------------------------------------------------

/** Scan every product and collect any alerts that need attention. */
export function checkStockAlerts(levels: StockLevel[]): StockAlert[] {
  const alerts: StockAlert[] = [];

  for (const level of levels) {
    const alert = checkSingleProductAlert(level);
    if (alert) alerts.push(alert);
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// 6. checkSingleProductAlert
// ---------------------------------------------------------------------------

/**
 * Evaluate a single product's stock and return an alert if a threshold is
 * breached, or `null` when stock is healthy.
 *
 * Checks are ordered from most to least severe so the most critical alert
 * wins when multiple thresholds are crossed simultaneously.
 */
export function checkSingleProductAlert(level: StockLevel): StockAlert | null {
  const { productId, productName, currentQuantity, minimumQuantity, maximumQuantity } = level;

  if (currentQuantity <= 0) {
    return {
      productId,
      productName,
      alertType: 'out_of_stock',
      currentQuantity,
      threshold: 0,
      message: `${productName} is out of stock`,
    };
  }

  if (currentQuantity <= minimumQuantity) {
    return {
      productId,
      productName,
      alertType: 'low_stock',
      currentQuantity,
      threshold: minimumQuantity,
      message: `${productName} is low on stock (${currentQuantity} remaining, minimum is ${minimumQuantity})`,
    };
  }

  if (currentQuantity > maximumQuantity) {
    return {
      productId,
      productName,
      alertType: 'overstock',
      currentQuantity,
      threshold: maximumQuantity,
      message: `${productName} exceeds maximum stock (${currentQuantity} on hand, maximum is ${maximumQuantity})`,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// 7. applyStockSale
// ---------------------------------------------------------------------------

/**
 * Deduct sold quantities from a single product's stock level.
 *
 * Only items matching `level.productId` are applied — the caller is expected
 * to invoke this once per distinct product in the cart.  Quantity is allowed
 * to go negative so the POS never silently blocks a sale; the resulting alert
 * makes the negative balance visible to staff.
 */
export function applyStockSale(
  level: StockLevel,
  saleItems: SaleItem[],
): StockUpdateResult {
  const totalDeducted = saleItems
    .filter((item) => item.productId === level.productId)
    .reduce((sum, item) => sum + item.quantity, 0);

  const adjustment: StockAdjustment = {
    productId: level.productId,
    quantityChange: round2(-totalDeducted),
    reason: 'sale',
    referenceId: null,
    timestamp: new Date().toISOString(),
  };

  return applyStockAdjustment(level, adjustment);
}

// ---------------------------------------------------------------------------
// 8. applyStockRefund
// ---------------------------------------------------------------------------

/**
 * Restore refunded quantities back into stock.
 *
 * Mirror image of `applyStockSale` — the quantity change is positive.
 */
export function applyStockRefund(
  level: StockLevel,
  refundItems: SaleItem[],
): StockUpdateResult {
  const totalAdded = refundItems
    .filter((item) => item.productId === level.productId)
    .reduce((sum, item) => sum + item.quantity, 0);

  const adjustment: StockAdjustment = {
    productId: level.productId,
    quantityChange: round2(totalAdded),
    reason: 'refund',
    referenceId: null,
    timestamp: new Date().toISOString(),
  };

  return applyStockAdjustment(level, adjustment);
}

// ---------------------------------------------------------------------------
// 9. applyStockAdjustment
// ---------------------------------------------------------------------------

/**
 * Generic stock adjustment — the single source of truth for mutating a
 * `StockLevel` value.  Both `applyStockSale` and `applyStockRefund` delegate
 * here so that alert generation is never duplicated.
 */
export function applyStockAdjustment(
  level: StockLevel,
  adjustment: StockAdjustment,
): StockUpdateResult {
  const newQuantity = round2(level.currentQuantity + adjustment.quantityChange);

  // Build a temporary level with the updated quantity so we can re-use the
  // existing alert logic rather than duplicating threshold checks.
  const updatedLevel: StockLevel = {
    ...level,
    currentQuantity: newQuantity,
    lastUpdated: adjustment.timestamp,
  };

  const alert = checkSingleProductAlert(updatedLevel);
  const alerts: StockAlert[] = alert ? [alert] : [];

  return {
    success: true,
    newQuantity,
    adjustment,
    alerts,
  };
}

// ---------------------------------------------------------------------------
// 10. canFulfillOrder
// ---------------------------------------------------------------------------

/**
 * Pre-flight check: can every line item in the order be fulfilled from
 * current stock?
 *
 * Returns a summary so the UI can highlight exactly which products are short.
 */
export function canFulfillOrder(
  levels: StockLevel[],
  items: SaleItem[],
): {
  canFulfill: boolean;
  insufficientItems: Array<{ productId: string; requested: number; available: number }>;
} {
  const levelMap = new Map<string, StockLevel>();
  for (const l of levels) {
    levelMap.set(l.productId, l);
  }

  const insufficientItems: Array<{ productId: string; requested: number; available: number }> = [];

  for (const item of items) {
    const level = levelMap.get(item.productId);
    // Treat unknown products as zero stock — they can't be fulfilled.
    const available = level ? level.currentQuantity : 0;

    if (available < item.quantity) {
      insufficientItems.push({
        productId: item.productId,
        requested: item.quantity,
        available: round2(available),
      });
    }
  }

  return {
    canFulfill: insufficientItems.length === 0,
    insufficientItems,
  };
}

// ---------------------------------------------------------------------------
// 11. getOutOfStockProducts
// ---------------------------------------------------------------------------

/** Return only products whose current quantity is zero or negative. */
export function getOutOfStockProducts(levels: StockLevel[]): StockLevel[] {
  return levels.filter((l) => l.currentQuantity <= 0);
}

// ---------------------------------------------------------------------------
// 12. getLowStockProducts
// ---------------------------------------------------------------------------

/**
 * Return products that are low but not yet out of stock.
 *
 * "Low" means current quantity is positive yet at or below the reorder point.
 */
export function getLowStockProducts(levels: StockLevel[]): StockLevel[] {
  return levels.filter(
    (l) => l.currentQuantity > 0 && l.currentQuantity <= l.minimumQuantity,
  );
}

// ---------------------------------------------------------------------------
// 13. sortByStockUrgency
// ---------------------------------------------------------------------------

/**
 * Sort products so the most urgent stock issues appear first:
 *  1. Out-of-stock  (quantity <= 0)
 *  2. Low-stock     (quantity <= minimum)
 *  3. Normal        (sorted ascending by stock-to-minimum ratio)
 *
 * Within each tier, products are ordered by how close they are to running out
 * (lowest ratio first) so staff can act on the most critical items first.
 */
export function sortByStockUrgency(levels: StockLevel[]): StockLevel[] {
  return [...levels].sort((a, b) => {
    const priorityA = getUrgencyPriority(a);
    const priorityB = getUrgencyPriority(b);

    if (priorityA !== priorityB) return priorityA - priorityB;

    // Within the same tier, sort by ratio of current / minimum so the
    // product closest to depletion surfaces first.
    const ratioA = a.minimumQuantity > 0 ? a.currentQuantity / a.minimumQuantity : a.currentQuantity;
    const ratioB = b.minimumQuantity > 0 ? b.currentQuantity / b.minimumQuantity : b.currentQuantity;

    return ratioA - ratioB;
  });
}

/**
 * Internal helper — maps a stock level to a numeric urgency tier.
 * Lower number = higher urgency.
 */
function getUrgencyPriority(level: StockLevel): number {
  if (level.currentQuantity <= 0) return 0;            // out of stock
  if (level.currentQuantity <= level.minimumQuantity) return 1; // low stock
  return 2;                                             // normal
}
