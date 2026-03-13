/**
 * OnlineOrderPOSService
 *
 * Pure TypeScript service for integrating online orders with the POS system.
 * Handles pushing online orders to POS, syncing status from POS back to
 * the online ordering platform, and inventory sync.
 *
 * All functions are pure (no side effects) with injectable dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrderChannel = 'pos' | 'online_web' | 'online_app' | 'third_party';

export type OnlineOrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

export type POSOrderStatus = 'new' | 'in_progress' | 'completed' | 'voided';

export interface OnlineOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  modifiers: Array<{ name: string; price: number }>;
  specialInstructions: string | null;
}

export interface OnlineOrder {
  id: string;
  /** ID from the online platform */
  externalId: string;
  channel: OrderChannel;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  items: OnlineOrderItem[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  total: number;
  paymentStatus: 'paid' | 'pending' | 'failed';
  orderStatus: OnlineOrderStatus;
  deliveryAddress: string | null;
  isDelivery: boolean;
  /** Estimated preparation time in minutes */
  estimatedPrepTime: number | null;
  /** ISO timestamp */
  placedAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  notes: string | null;
}

export interface POSOrder {
  id: string;
  orderNumber: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
    notes: string | null;
  }>;
  subtotal: number;
  total: number;
  status: POSOrderStatus;
  channel: OrderChannel;
  externalOrderId: string | null;
}

export interface StatusSyncResult {
  onlineOrderId: string;
  previousStatus: OnlineOrderStatus;
  newStatus: OnlineOrderStatus;
  syncedAt: string;
  success: boolean;
  error: string | null;
}

export interface OrderPushResult {
  success: boolean;
  posOrder: POSOrder | null;
  error: string | null;
  validationErrors: string[];
}

export interface InventorySyncItem {
  productId: string;
  isAvailable: boolean;
  currentStock: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to 2 decimal places — avoids floating-point drift on currency values. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Transform an online order into the POS order format.
 *
 * Modifier prices are folded into each line-item total so the POS only sees
 * a flat list of items with a single unit price + notes string.
 */
export function convertOnlineOrderToPOS(
  onlineOrder: OnlineOrder,
  orderNumber: string,
): POSOrder {
  const items = onlineOrder.items.map((item) => {
    const modifierTotal = item.modifiers.reduce((sum, m) => sum + m.price, 0);
    const effectiveUnitPrice = round2(item.unitPrice + modifierTotal);
    const lineTotal = round2(effectiveUnitPrice * item.quantity);

    // Combine modifier names and special instructions into a single notes
    // field so POS staff see everything in one place.
    const modifierNotes = item.modifiers.map((m) => m.name).join(', ');
    const parts = [modifierNotes, item.specialInstructions].filter(Boolean);
    const notes = parts.length > 0 ? parts.join(' | ') : null;

    return {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: effectiveUnitPrice,
      total: lineTotal,
      notes,
    };
  });

  const subtotal = round2(items.reduce((sum, i) => sum + i.total, 0));

  return {
    id: onlineOrder.id,
    orderNumber,
    items,
    subtotal,
    total: round2(
      subtotal +
        onlineOrder.deliveryFee +
        onlineOrder.serviceFee -
        onlineOrder.discount,
    ),
    status: 'new' as POSOrderStatus,
    channel: onlineOrder.channel,
    externalOrderId: onlineOrder.externalId,
  };
}

/**
 * Validate that an online order is well-formed before it is pushed to POS.
 *
 * We intentionally keep validation synchronous and side-effect-free so
 * callers can collect all errors in one pass rather than failing fast.
 */
export function validateOnlineOrder(
  order: OnlineOrder,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!order.items || order.items.length === 0) {
    errors.push('Order must contain at least one item');
  }

  if (order.total <= 0) {
    errors.push('Order total must be positive');
  }

  if (order.subtotal < 0) {
    errors.push('Subtotal cannot be negative');
  }

  // Each item should have valid quantity and price.
  order.items.forEach((item, index) => {
    if (item.quantity <= 0) {
      errors.push(`Item at index ${index} has invalid quantity`);
    }
    if (item.unitPrice < 0) {
      errors.push(`Item at index ${index} has negative unit price`);
    }
  });

  const validStatuses: OnlineOrderStatus[] = [
    'pending',
    'accepted',
    'preparing',
    'ready',
    'dispatched',
    'delivered',
    'cancelled',
    'rejected',
  ];
  if (!validStatuses.includes(order.orderStatus)) {
    errors.push(`Invalid order status: ${order.orderStatus}`);
  }

  if (!order.customerName || order.customerName.trim().length === 0) {
    errors.push('Customer name is required');
  }

  if (order.isDelivery && !order.deliveryAddress) {
    errors.push('Delivery address is required for delivery orders');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Orchestrator: validate an online order then convert it for POS.
 *
 * Separating validation from conversion lets callers decide whether to
 * surface validation errors in the UI before attempting the push.
 */
export function pushOrderToPOS(
  order: OnlineOrder,
  orderNumber: string,
): OrderPushResult {
  const { isValid, errors } = validateOnlineOrder(order);

  if (!isValid) {
    return {
      success: false,
      posOrder: null,
      error: 'Order validation failed',
      validationErrors: errors,
    };
  }

  try {
    const posOrder = convertOnlineOrderToPOS(order, orderNumber);
    return {
      success: true,
      posOrder,
      error: null,
      validationErrors: [],
    };
  } catch (err) {
    return {
      success: false,
      posOrder: null,
      error: err instanceof Error ? err.message : 'Unknown error during conversion',
      validationErrors: [],
    };
  }
}

/**
 * Map a POS status to the closest online order status.
 *
 * The POS lifecycle is simpler than the online one, so some online statuses
 * (dispatched, delivered) have no POS equivalent — we only map what the POS
 * can tell us.
 */
export function mapPOSStatusToOnlineStatus(
  posStatus: POSOrderStatus,
): OnlineOrderStatus {
  const mapping: Record<POSOrderStatus, OnlineOrderStatus> = {
    new: 'accepted',
    in_progress: 'preparing',
    completed: 'ready',
    voided: 'cancelled',
  };
  return mapping[posStatus];
}

/**
 * Map an online order status to the closest POS status.
 *
 * Several online statuses collapse into the same POS status because the POS
 * does not distinguish between e.g. "dispatched" and "delivered".
 */
export function mapOnlineStatusToPOSStatus(
  onlineStatus: OnlineOrderStatus,
): POSOrderStatus {
  const mapping: Record<OnlineOrderStatus, POSOrderStatus> = {
    pending: 'new',
    accepted: 'new',
    preparing: 'in_progress',
    ready: 'completed',
    dispatched: 'completed',
    delivered: 'completed',
    cancelled: 'voided',
    rejected: 'voided',
  };
  return mapping[onlineStatus];
}

/**
 * Produce a status-sync result after the POS reports a new status.
 *
 * The caller supplies `now` so this remains a pure function that is easy to
 * test without mocking Date.
 */
export function syncStatusFromPOS(
  onlineOrder: OnlineOrder,
  posStatus: POSOrderStatus,
  now: Date,
): StatusSyncResult {
  const newStatus = mapPOSStatusToOnlineStatus(posStatus);

  // Guard against no-op syncs — they would create misleading audit entries.
  if (newStatus === onlineOrder.orderStatus) {
    return {
      onlineOrderId: onlineOrder.id,
      previousStatus: onlineOrder.orderStatus,
      newStatus,
      syncedAt: now.toISOString(),
      success: true,
      error: null,
    };
  }

  return {
    onlineOrderId: onlineOrder.id,
    previousStatus: onlineOrder.orderStatus,
    newStatus,
    syncedAt: now.toISOString(),
    success: true,
    error: null,
  };
}

/**
 * Recalculate the order total from its constituent parts.
 *
 * Useful when the UI lets a customer edit their cart and we need to
 * recompute the total before submitting.
 */
export function calculateOnlineOrderTotal(
  items: OnlineOrderItem[],
  deliveryFee: number,
  serviceFee: number,
  discount: number,
): number {
  const itemsTotal = items.reduce((sum, item) => {
    const modifierTotal = item.modifiers.reduce((s, m) => s + m.price, 0);
    return sum + (item.unitPrice + modifierTotal) * item.quantity;
  }, 0);

  return round2(itemsTotal + deliveryFee + serviceFee - discount);
}

/**
 * Estimate preparation time based on item count.
 *
 * Uses a simple linear model: 5-minute base plus 2 minutes per item.
 * This is intentionally naive — real implementations should pull per-product
 * prep times from a database.
 */
export function getEstimatedPrepTime(items: OnlineOrderItem[]): number {
  const BASE_MINUTES = 5;
  const PER_ITEM_MINUTES = 2;
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  return BASE_MINUTES + totalItems * PER_ITEM_MINUTES;
}

/**
 * Filter orders to only those originating from a specific channel.
 */
export function filterOrdersByChannel(
  orders: OnlineOrder[],
  channel: OrderChannel,
): OnlineOrder[] {
  return orders.filter((order) => order.channel === channel);
}

/**
 * Filter orders whose status is one of the supplied statuses.
 *
 * Accepts an array so callers can easily select e.g. all "active" orders
 * with `['pending', 'accepted', 'preparing']`.
 */
export function filterOrdersByStatus(
  orders: OnlineOrder[],
  statuses: OnlineOrderStatus[],
): OnlineOrder[] {
  return orders.filter((order) => statuses.includes(order.orderStatus));
}

/**
 * Sort orders by urgency so kitchen / dispatch staff see the most pressing
 * orders first.
 *
 * Priority rules:
 * 1. Pending orders come before all others (they need immediate attention).
 * 2. Within the same status group, older orders (earlier `placedAt`) come first.
 */
export function sortOrdersByPriority(orders: OnlineOrder[]): OnlineOrder[] {
  return [...orders].sort((a, b) => {
    const aIsPending = a.orderStatus === 'pending' ? 0 : 1;
    const bIsPending = b.orderStatus === 'pending' ? 0 : 1;

    if (aIsPending !== bIsPending) {
      return aIsPending - bIsPending;
    }

    // Oldest first within the same priority group.
    return new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime();
  });
}

/**
 * Build an inventory-sync payload from a product list.
 *
 * The online platform needs to know which products are still orderable so
 * it can grey-out or hide unavailable items in real time.
 */
export function buildInventorySync(
  products: Array<{ id: string; isAvailable: boolean; stock: number | null }>,
): InventorySyncItem[] {
  return products.map((product) => ({
    productId: product.id,
    isAvailable: product.isAvailable,
    currentStock: product.stock,
  }));
}
