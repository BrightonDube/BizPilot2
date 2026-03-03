/**
 * BizPilot Mobile POS — OrderService
 *
 * Handles order creation, number generation, and sync queue integration.
 * This is the bridge between the in-memory cart and persistent storage.
 *
 * Why a service class instead of a hook?
 * Order creation involves multiple side effects: writing to the database,
 * updating inventory, queuing for sync, and clearing the cart.
 * A service class keeps this logic testable and decoupled from React's
 * render cycle. Hooks consume the service; they don't replace it.
 *
 * Why generate order numbers locally?
 * Offline devices can't ask the server for the next number. We use a
 * timestamp + random suffix pattern that's unique enough for local use
 * and gets reconciled with server IDs during sync.
 */

import { generateOrderNumber } from "@/utils/formatters";
import {
  calculateCartTotals,
  calculateLineTotal,
} from "@/utils/priceCalculator";
import { DEFAULT_VAT_RATE } from "@/utils/constants";
import type {
  CartItem,
  MobileOrder,
  MobileOrderItem,
  OrderStatus,
  PaymentStatus,
} from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateOrderInput {
  /** Cart items to include in the order */
  items: CartItem[];
  /** Cart-level discount amount */
  cartDiscount: number;
  /** Associated customer ID (null for walk-in) */
  customerId: string | null;
  /** Payment method used (e.g., "cash", "card", "eft") */
  paymentMethod: string;
  /** Amount the customer tendered */
  amountTendered: number;
  /** Change given back to the customer */
  change: number;
  /** Order notes */
  notes: string;
  /** ID of the user (cashier) creating the order */
  createdBy: string;
  /** VAT rate override (defaults to SA 15%) */
  vatRate?: number;
  /** Whether prices are tax-inclusive (default: true) */
  taxInclusive?: boolean;
}

export interface CreateOrderResult {
  /** The created order */
  order: MobileOrder;
  /** The created order items */
  orderItems: MobileOrderItem[];
  /** Whether the order was successfully queued for sync */
  syncQueued: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Create a new order from cart items.
 *
 * This is a pure function that builds the order and order item objects.
 * The caller is responsible for persisting to WatermelonDB and the sync queue.
 *
 * Why pure instead of writing to DB directly?
 * It makes the function testable without mocking the database.
 * The calling code (hook or screen) handles persistence.
 */
export function createOrder(input: CreateOrderInput): CreateOrderResult {
  const {
    items,
    cartDiscount,
    customerId,
    paymentMethod,
    notes,
    createdBy,
    vatRate = DEFAULT_VAT_RATE,
    taxInclusive = true,
  } = input;

  const now = Date.now();
  const orderNumber = generateOrderNumber();
  const orderId = `local-${orderNumber}`; // Local ID until synced

  // Calculate totals
  const totals = calculateCartTotals({
    items: items.map((i) => ({
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      discount: i.discount,
    })),
    cartDiscount,
    vatRate,
    taxInclusive,
  });

  // Build order items
  const orderItems: MobileOrderItem[] = items.map((item, index) => {
    const lineTotal = calculateLineTotal({
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      discount: item.discount,
    });

    return {
      id: `${orderId}-item-${index}`,
      remoteId: null,
      orderId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      total: lineTotal,
      notes: item.notes,
      createdAt: now,
      syncedAt: null,
      isDirty: true,
    };
  });

  // Build order
  const order: MobileOrder = {
    id: orderId,
    remoteId: null,
    orderNumber,
    customerId,
    status: "completed" as OrderStatus,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    discountAmount: totals.discount,
    total: totals.total,
    paymentMethod,
    paymentStatus: "paid" as PaymentStatus,
    notes: notes || null,
    createdBy,
    createdAt: now,
    updatedAt: now,
    syncedAt: null,
    isDirty: true,
  };

  return {
    order,
    orderItems,
    syncQueued: true, // Caller should queue to sync
  };
}

/**
 * Create a void/cancelled version of an existing order.
 *
 * Why void instead of delete?
 * In accounting, you never delete a transaction — you create a reversal.
 * A void order preserves the audit trail for tax compliance.
 */
export function voidOrder(
  order: MobileOrder,
  reason: string,
  voidedBy: string
): MobileOrder {
  return {
    ...order,
    status: "cancelled" as OrderStatus,
    paymentStatus: "refunded" as PaymentStatus,
    notes: `VOIDED: ${reason} (by ${voidedBy})${
      order.notes ? ` | Original notes: ${order.notes}` : ""
    }`,
    updatedAt: Date.now(),
    isDirty: true,
    syncedAt: null,
  };
}

/**
 * Validate that a cart has enough items to create an order.
 */
export function validateOrderInput(
  input: Pick<CreateOrderInput, "items" | "paymentMethod" | "createdBy">
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (input.items.length === 0) {
    errors.push("Cart is empty — add at least one item");
  }

  if (!input.paymentMethod) {
    errors.push("Payment method is required");
  }

  if (!input.createdBy) {
    errors.push("User ID is required");
  }

  // Validate each item
  for (const item of input.items) {
    if (item.quantity <= 0) {
      errors.push(`Invalid quantity for ${item.productName}`);
    }
    if (item.unitPrice < 0) {
      errors.push(`Invalid price for ${item.productName}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
