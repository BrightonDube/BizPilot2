/**
 * BizPilot Mobile POS — InventoryService
 *
 * Handles inventory stock level updates when sales are completed or voided.
 * Designed as pure functions for testability and offline-first operation.
 *
 * Why a separate service instead of inline in OrderService?
 * Inventory logic needs to:
 * 1. Decrement stock on sale completion (immediate local update)
 * 2. Restore stock on void/refund
 * 3. Queue sync entries for the server to reconcile
 * 4. Handle products that don't track inventory (no-op)
 *
 * Keeping this isolated means OrderService stays focused on order state,
 * and InventoryService can be tested independently.
 *
 * Why local-first stock updates?
 * In a POS system, the stock display should update immediately after a sale
 * even if the device is offline. The server reconciles later during sync.
 * This prevents the confusing UX of selling an item and still seeing
 * the old stock count.
 */

import type { CartItem, MobileProduct, SyncQueueEntry, SyncAction } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of an inventory update operation */
export interface InventoryUpdateResult {
  /** Product IDs that were successfully updated */
  updatedProductIds: string[];
  /** Product IDs that were skipped (not tracking inventory) */
  skippedProductIds: string[];
  /** Sync queue entries to be pushed to the server */
  syncEntries: SyncQueueEntry[];
  /** Products that went to zero or negative stock */
  lowStockProductIds: string[];
}

/** A single stock adjustment */
export interface StockAdjustment {
  productId: string;
  /** Positive = add stock, Negative = remove stock */
  quantityChange: number;
  /** Reason for the adjustment (for audit trail) */
  reason: string;
  /** Related order ID */
  orderId: string | null;
}

/** Product stock info needed for inventory checks */
export interface ProductStockInfo {
  id: string;
  trackInventory: boolean;
  stockQuantity: number;
}

// ---------------------------------------------------------------------------
// Inventory update functions
// ---------------------------------------------------------------------------

/**
 * Calculate stock adjustments for a completed sale.
 * Returns negative quantity changes for each cart item.
 *
 * Why return adjustments instead of mutating directly?
 * The caller (order completion flow) applies these adjustments
 * to the local WatermelonDB records. This keeps the function pure
 * and testable without database dependencies.
 */
export function calculateSaleAdjustments(
  cartItems: CartItem[],
  products: ProductStockInfo[],
  orderId: string
): StockAdjustment[] {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const adjustments: StockAdjustment[] = [];

  for (const item of cartItems) {
    const product = productMap.get(item.productId);

    // Skip products that don't track inventory
    if (!product || !product.trackInventory) continue;

    adjustments.push({
      productId: item.productId,
      quantityChange: -item.quantity,
      reason: `Sale: Order #${orderId}`,
      orderId,
    });
  }

  return adjustments;
}

/**
 * Calculate stock adjustments for a voided/refunded order.
 * Returns positive quantity changes to restore stock.
 */
export function calculateVoidAdjustments(
  items: Array<{ productId: string; quantity: number }>,
  products: ProductStockInfo[],
  orderId: string
): StockAdjustment[] {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const adjustments: StockAdjustment[] = [];

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product || !product.trackInventory) continue;

    adjustments.push({
      productId: item.productId,
      quantityChange: item.quantity, // Positive — restoring stock
      reason: `Void: Order #${orderId}`,
      orderId,
    });
  }

  return adjustments;
}

/**
 * Apply stock adjustments and return the update result.
 * This is the main entry point — computes new stock levels,
 * identifies low-stock products, and creates sync queue entries.
 *
 * The caller is responsible for persisting the changes to WatermelonDB.
 * This function only computes what should change.
 */
export function applyStockAdjustments(
  adjustments: StockAdjustment[],
  products: ProductStockInfo[]
): InventoryUpdateResult {
  const productMap = new Map(products.map((p) => [p.id, { ...p }]));
  const updatedProductIds: string[] = [];
  const skippedProductIds: string[] = [];
  const lowStockProductIds: string[] = [];
  const syncEntries: SyncQueueEntry[] = [];

  for (const adj of adjustments) {
    const product = productMap.get(adj.productId);

    if (!product || !product.trackInventory) {
      skippedProductIds.push(adj.productId);
      continue;
    }

    const newQuantity = product.stockQuantity + adj.quantityChange;
    product.stockQuantity = newQuantity;
    updatedProductIds.push(adj.productId);

    // Flag products at zero or negative stock
    if (newQuantity <= 0) {
      lowStockProductIds.push(adj.productId);
    }

    // Create sync queue entry for server reconciliation
    syncEntries.push(createSyncEntry(adj));
  }

  return {
    updatedProductIds,
    skippedProductIds,
    syncEntries,
    lowStockProductIds,
  };
}

/**
 * Check if a cart can be fulfilled with current stock levels.
 * Returns a list of products with insufficient stock.
 *
 * Used before completing a sale to warn staff about stock issues.
 * In hospitality POS, we typically allow overselling (warn, don't block)
 * because the kitchen/bar may have stock not yet entered in the system.
 */
export function checkStockAvailability(
  cartItems: CartItem[],
  products: ProductStockInfo[]
): Array<{
  productId: string;
  productName: string;
  requested: number;
  available: number;
}> {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const insufficientStock: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }> = [];

  for (const item of cartItems) {
    const product = productMap.get(item.productId);

    // Don't check products that don't track inventory
    if (!product || !product.trackInventory) continue;

    if (product.stockQuantity < item.quantity) {
      insufficientStock.push({
        productId: item.productId,
        productName: item.productName,
        requested: item.quantity,
        available: Math.max(0, product.stockQuantity),
      });
    }
  }

  return insufficientStock;
}

/**
 * Compute new stock level after adjustment.
 * Clamps to minimum of 0 by default (no negative stock in display).
 */
export function computeNewStockLevel(
  currentStock: number,
  adjustment: number,
  allowNegative = false
): number {
  const newLevel = currentStock + adjustment;
  return allowNegative ? newLevel : Math.max(0, newLevel);
}

// ---------------------------------------------------------------------------
// Sync queue entry creation
// ---------------------------------------------------------------------------

/**
 * Create a sync queue entry for a stock adjustment.
 * These entries are pushed to the server during the next sync cycle.
 */
function createSyncEntry(adjustment: StockAdjustment): SyncQueueEntry {
  const now = Date.now();
  const id = `inv_${now}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    entityType: "inventory_adjustment",
    entityId: adjustment.productId,
    action: "update" as SyncAction,
    payload: JSON.stringify({
      productId: adjustment.productId,
      quantityChange: adjustment.quantityChange,
      reason: adjustment.reason,
      orderId: adjustment.orderId,
      timestamp: now,
    }),
    attempts: 0,
    lastError: null,
    createdAt: now,
    processedAt: null,
  };
}
