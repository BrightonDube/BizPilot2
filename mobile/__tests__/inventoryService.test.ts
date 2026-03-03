/**
 * BizPilot Mobile POS — InventoryService Tests
 *
 * Tests for stock level management during sales and voids.
 * Verifies the pure functions that compute stock adjustments.
 */

import {
  calculateSaleAdjustments,
  calculateVoidAdjustments,
  applyStockAdjustments,
  checkStockAvailability,
  computeNewStockLevel,
} from "@/services/InventoryService";
import type { CartItem } from "@/types";
import type { ProductStockInfo } from "@/services/InventoryService";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const PRODUCT_BURGER: ProductStockInfo = {
  id: "prod-burger",
  trackInventory: true,
  stockQuantity: 50,
};

const PRODUCT_FRIES: ProductStockInfo = {
  id: "prod-fries",
  trackInventory: true,
  stockQuantity: 100,
};

const PRODUCT_DRINK: ProductStockInfo = {
  id: "prod-drink",
  trackInventory: false, // Not tracking inventory (e.g., service items)
  stockQuantity: 0,
};

const PRODUCT_LOW_STOCK: ProductStockInfo = {
  id: "prod-low",
  trackInventory: true,
  stockQuantity: 2,
};

const ALL_PRODUCTS = [PRODUCT_BURGER, PRODUCT_FRIES, PRODUCT_DRINK, PRODUCT_LOW_STOCK];

const CART_ITEMS: CartItem[] = [
  {
    productId: "prod-burger",
    productName: "Burger",
    quantity: 3,
    unitPrice: 89.99,
    discount: 0,
    notes: null,
  },
  {
    productId: "prod-fries",
    productName: "Fries",
    quantity: 2,
    unitPrice: 35.0,
    discount: 0,
    notes: null,
  },
  {
    productId: "prod-drink",
    productName: "Drink",
    quantity: 1,
    unitPrice: 25.0,
    discount: 0,
    notes: null,
  },
];

// ---------------------------------------------------------------------------
// Tests: calculateSaleAdjustments
// ---------------------------------------------------------------------------

describe("calculateSaleAdjustments", () => {
  it("creates negative adjustments for tracked products", () => {
    const adjustments = calculateSaleAdjustments(CART_ITEMS, ALL_PRODUCTS, "order-001");
    
    // Should have 2 adjustments (burger and fries — drink is not tracked)
    expect(adjustments).toHaveLength(2);
    
    const burgerAdj = adjustments.find((a) => a.productId === "prod-burger");
    expect(burgerAdj).toBeDefined();
    expect(burgerAdj!.quantityChange).toBe(-3);
    expect(burgerAdj!.orderId).toBe("order-001");
    
    const friesAdj = adjustments.find((a) => a.productId === "prod-fries");
    expect(friesAdj).toBeDefined();
    expect(friesAdj!.quantityChange).toBe(-2);
  });

  it("skips products that don't track inventory", () => {
    const adjustments = calculateSaleAdjustments(CART_ITEMS, ALL_PRODUCTS, "order-001");
    
    const drinkAdj = adjustments.find((a) => a.productId === "prod-drink");
    expect(drinkAdj).toBeUndefined();
  });

  it("returns empty array for empty cart", () => {
    const adjustments = calculateSaleAdjustments([], ALL_PRODUCTS, "order-001");
    expect(adjustments).toHaveLength(0);
  });

  it("returns empty array for unknown products", () => {
    const unknownItems: CartItem[] = [
      {
        productId: "unknown-id",
        productName: "Unknown",
        quantity: 1,
        unitPrice: 10,
        discount: 0,
        notes: null,
      },
    ];
    const adjustments = calculateSaleAdjustments(unknownItems, ALL_PRODUCTS, "order-001");
    expect(adjustments).toHaveLength(0);
  });

  it("includes reason with order number", () => {
    const adjustments = calculateSaleAdjustments(CART_ITEMS, ALL_PRODUCTS, "ORD-123");
    expect(adjustments[0].reason).toContain("ORD-123");
  });
});

// ---------------------------------------------------------------------------
// Tests: calculateVoidAdjustments
// ---------------------------------------------------------------------------

describe("calculateVoidAdjustments", () => {
  it("creates positive adjustments to restore stock", () => {
    const items = [
      { productId: "prod-burger", quantity: 3 },
      { productId: "prod-fries", quantity: 2 },
    ];
    const adjustments = calculateVoidAdjustments(items, ALL_PRODUCTS, "order-001");

    expect(adjustments).toHaveLength(2);
    expect(adjustments[0].quantityChange).toBe(3); // Positive — restoring stock
    expect(adjustments[1].quantityChange).toBe(2);
  });

  it("includes void reason", () => {
    const items = [{ productId: "prod-burger", quantity: 1 }];
    const adjustments = calculateVoidAdjustments(items, ALL_PRODUCTS, "ORD-456");
    expect(adjustments[0].reason).toContain("Void");
    expect(adjustments[0].reason).toContain("ORD-456");
  });
});

// ---------------------------------------------------------------------------
// Tests: applyStockAdjustments
// ---------------------------------------------------------------------------

describe("applyStockAdjustments", () => {
  it("returns updated product IDs", () => {
    const adjustments = calculateSaleAdjustments(CART_ITEMS, ALL_PRODUCTS, "order-001");
    const result = applyStockAdjustments(adjustments, ALL_PRODUCTS);

    expect(result.updatedProductIds).toContain("prod-burger");
    expect(result.updatedProductIds).toContain("prod-fries");
    expect(result.updatedProductIds).not.toContain("prod-drink");
  });

  it("creates sync queue entries for each adjustment", () => {
    const adjustments = calculateSaleAdjustments(CART_ITEMS, ALL_PRODUCTS, "order-001");
    const result = applyStockAdjustments(adjustments, ALL_PRODUCTS);

    expect(result.syncEntries).toHaveLength(2);
    expect(result.syncEntries[0].entityType).toBe("inventory_adjustment");
    expect(result.syncEntries[0].action).toBe("update");
  });

  it("identifies low stock products", () => {
    const lowStockCart: CartItem[] = [
      {
        productId: "prod-low",
        productName: "Low Stock Item",
        quantity: 3, // More than available (2)
        unitPrice: 10,
        discount: 0,
        notes: null,
      },
    ];
    const adjustments = calculateSaleAdjustments(lowStockCart, ALL_PRODUCTS, "order-001");
    const result = applyStockAdjustments(adjustments, ALL_PRODUCTS);

    expect(result.lowStockProductIds).toContain("prod-low");
  });
});

// ---------------------------------------------------------------------------
// Tests: checkStockAvailability
// ---------------------------------------------------------------------------

describe("checkStockAvailability", () => {
  it("returns empty array when all stock is sufficient", () => {
    const result = checkStockAvailability(CART_ITEMS, ALL_PRODUCTS);
    expect(result).toHaveLength(0);
  });

  it("identifies products with insufficient stock", () => {
    const largeOrder: CartItem[] = [
      {
        productId: "prod-low",
        productName: "Low Stock Item",
        quantity: 5, // Only 2 in stock
        unitPrice: 10,
        discount: 0,
        notes: null,
      },
    ];
    const result = checkStockAvailability(largeOrder, ALL_PRODUCTS);

    expect(result).toHaveLength(1);
    expect(result[0].productId).toBe("prod-low");
    expect(result[0].requested).toBe(5);
    expect(result[0].available).toBe(2);
  });

  it("skips non-tracked products", () => {
    const items: CartItem[] = [
      {
        productId: "prod-drink",
        productName: "Drink",
        quantity: 999,
        unitPrice: 25,
        discount: 0,
        notes: null,
      },
    ];
    const result = checkStockAvailability(items, ALL_PRODUCTS);
    expect(result).toHaveLength(0); // Not tracked, so no warning
  });
});

// ---------------------------------------------------------------------------
// Tests: computeNewStockLevel
// ---------------------------------------------------------------------------

describe("computeNewStockLevel", () => {
  it("decrements stock correctly", () => {
    expect(computeNewStockLevel(50, -3)).toBe(47);
  });

  it("increments stock correctly", () => {
    expect(computeNewStockLevel(50, 5)).toBe(55);
  });

  it("clamps to zero by default", () => {
    expect(computeNewStockLevel(2, -5)).toBe(0);
  });

  it("allows negative when specified", () => {
    expect(computeNewStockLevel(2, -5, true)).toBe(-3);
  });

  it("handles zero stock", () => {
    expect(computeNewStockLevel(0, -1)).toBe(0);
    expect(computeNewStockLevel(0, 1)).toBe(1);
  });
});
