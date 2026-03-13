/**
 * BizPilot Mobile POS — Order Service Tests
 *
 * Tests order creation, voiding, and validation.
 * These are pure functions, so no mocking needed — just input → output.
 */

import {
  createOrder,
  voidOrder,
  validateOrderInput,
} from "@/services/OrderService";
import type { CartItem } from "@/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_ITEMS: CartItem[] = [
  {
    productId: "p1",
    productName: "Burger",
    unitPrice: 89.99,
    quantity: 2,
    discount: 0,
    notes: null,
  },
  {
    productId: "p2",
    productName: "Coke 330ml",
    unitPrice: 22.0,
    quantity: 3,
    discount: 5,
    notes: "Extra ice",
  },
];

const BASIC_INPUT = {
  items: SAMPLE_ITEMS,
  cartDiscount: 0,
  customerId: null,
  paymentMethod: "cash" as const,
  amountTendered: 300,
  change: 54.02,
  notes: null,
  createdBy: "user-123",
};

// ---------------------------------------------------------------------------
// createOrder
// ---------------------------------------------------------------------------

describe("createOrder", () => {
  it("creates an order with correct structure", () => {
    const result = createOrder(BASIC_INPUT);

    expect(result.order).toBeDefined();
    expect(result.orderItems).toBeDefined();
    expect(result.orderItems).toHaveLength(2);
  });

  it("generates a unique order number", () => {
    const r1 = createOrder(BASIC_INPUT);
    const r2 = createOrder(BASIC_INPUT);
    expect(r1.order.orderNumber).not.toBe(r2.order.orderNumber);
  });

  it("calculates order total correctly", () => {
    const result = createOrder(BASIC_INPUT);
    // Item 1: 89.99 × 2 = 179.98
    // Item 2: 22.00 × 3 - 5 = 61.00
    // Total: 179.98 + 61.00 = 240.98
    expect(result.order.total).toBeCloseTo(240.98, 1);
  });

  it("applies cart-level discount", () => {
    const result = createOrder({ ...BASIC_INPUT, cartDiscount: 20 });
    // Gross total: 240.98 - 20 = 220.98
    expect(result.order.total).toBeCloseTo(220.98, 1);
    expect(result.order.discount).toBe(20);
  });

  it("sets payment method", () => {
    const result = createOrder(BASIC_INPUT);
    expect(result.order.paymentMethod).toBe("cash");
  });

  it("sets customer ID when provided", () => {
    const result = createOrder({ ...BASIC_INPUT, customerId: "cust-1" });
    expect(result.order.customerId).toBe("cust-1");
  });

  it("sets null customer for walk-in", () => {
    const result = createOrder(BASIC_INPUT);
    expect(result.order.customerId).toBeNull();
  });

  it("sets created_by from input", () => {
    const result = createOrder(BASIC_INPUT);
    expect(result.order.createdBy).toBe("user-123");
  });

  it("creates order items with correct product references", () => {
    const result = createOrder(BASIC_INPUT);
    expect(result.orderItems[0].productId).toBe("p1");
    expect(result.orderItems[0].productName).toBe("Burger");
    expect(result.orderItems[1].productId).toBe("p2");
    expect(result.orderItems[1].productName).toBe("Coke 330ml");
  });

  it("creates order items with correct quantities and prices", () => {
    const result = createOrder(BASIC_INPUT);
    expect(result.orderItems[0].quantity).toBe(2);
    expect(result.orderItems[0].unitPrice).toBe(89.99);
    expect(result.orderItems[1].quantity).toBe(3);
    expect(result.orderItems[1].discount).toBe(5);
  });

  it("sets order status to completed", () => {
    const result = createOrder(BASIC_INPUT);
    expect(result.order.status).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// voidOrder
// ---------------------------------------------------------------------------

describe("voidOrder", () => {
  it("returns a voided copy of the order", () => {
    const original = createOrder(BASIC_INPUT).order;
    const voided = voidOrder(original, "Wrong items", "manager-1");
    expect(voided.status).toBe("voided");
  });

  it("preserves original order data", () => {
    const original = createOrder(BASIC_INPUT).order;
    const voided = voidOrder(original, "Wrong items", "manager-1");
    expect(voided.orderNumber).toBe(original.orderNumber);
    expect(voided.total).toBe(original.total);
  });

  it("sets void reason", () => {
    const original = createOrder(BASIC_INPUT).order;
    const voided = voidOrder(original, "Customer changed mind", "manager-1");
    expect(voided.voidReason).toBe("Customer changed mind");
  });

  it("sets voided_by field", () => {
    const original = createOrder(BASIC_INPUT).order;
    const voided = voidOrder(original, "Error", "mgr-42");
    expect(voided.voidedBy).toBe("mgr-42");
  });
});

// ---------------------------------------------------------------------------
// validateOrderInput
// ---------------------------------------------------------------------------

describe("validateOrderInput", () => {
  it("validates a correct order", () => {
    const result = validateOrderInput({
      items: SAMPLE_ITEMS,
      paymentMethod: "cash",
      createdBy: "user-1",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects empty cart", () => {
    const result = validateOrderInput({
      items: [],
      paymentMethod: "cash",
      createdBy: "user-1",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("empty"))).toBe(true);
  });

  it("rejects missing payment method", () => {
    const result = validateOrderInput({
      items: SAMPLE_ITEMS,
      paymentMethod: "" as any,
      createdBy: "user-1",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects missing createdBy", () => {
    const result = validateOrderInput({
      items: SAMPLE_ITEMS,
      paymentMethod: "cash",
      createdBy: "",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects items with zero/negative quantity", () => {
    const badItems: CartItem[] = [
      { productId: "p1", productName: "X", unitPrice: 10, quantity: 0, discount: 0, notes: null },
    ];
    const result = validateOrderInput({
      items: badItems,
      paymentMethod: "cash",
      createdBy: "user-1",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("quantity"))).toBe(true);
  });

  it("rejects items with negative price", () => {
    const badItems: CartItem[] = [
      { productId: "p1", productName: "X", unitPrice: -10, quantity: 1, discount: 0, notes: null },
    ];
    const result = validateOrderInput({
      items: badItems,
      paymentMethod: "cash",
      createdBy: "user-1",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("price"))).toBe(true);
  });
});
