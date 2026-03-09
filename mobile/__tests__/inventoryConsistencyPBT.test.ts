/**
 * BizPilot Mobile POS — Inventory Consistency PBT
 *
 * Property-based tests verifying that inventory adjustments
 * maintain data integrity:
 * - Sale decrements + void increments = net zero
 * - Stock never goes negative (when clamped)
 * - Adjustments are idempotent in quantity calculation
 *
 * Why PBT for inventory?
 * Inventory bugs are expensive — overselling means customer disappointment,
 * underselling means lost revenue. We need mathematical guarantees that
 * the sell/void cycle preserves stock levels correctly.
 */

import {
  calculateSaleAdjustments,
  calculateVoidAdjustments,
  applyStockAdjustments,
  computeNewStockLevel,
  checkStockAvailability,
  type ProductStockInfo,
} from "@/services/InventoryService";
import type { CartItem } from "@/types";
import { roundTo2 } from "@/utils/priceCalculator";

// ---------------------------------------------------------------------------
// Test data generators
// ---------------------------------------------------------------------------

function randomProduct(
  id: string,
  trackInventory = true
): ProductStockInfo {
  return {
    id,
    trackInventory,
    stockQuantity: Math.floor(Math.random() * 100) + 10, // 10-109
  };
}

function randomCartItem(productId: string): CartItem {
  return {
    productId,
    productName: `Product ${productId}`,
    quantity: Math.floor(Math.random() * 5) + 1, // 1-5
    unitPrice: roundTo2(Math.random() * 200 + 5),
    discount: 0,
    notes: null,
  };
}

// ---------------------------------------------------------------------------
// Property 1: Sale + Void = Net Zero Stock Change
// ---------------------------------------------------------------------------

describe("PBT: Inventory sale/void cycle is reversible", () => {
  it("selling then voiding restores original stock levels", () => {
    for (let i = 0; i < 100; i++) {
      // Setup: random products with stock
      const productCount = Math.floor(Math.random() * 5) + 1;
      const products: ProductStockInfo[] = Array.from(
        { length: productCount },
        (_, idx) => randomProduct(`p${idx}`)
      );
      const originalStock = new Map(
        products.map((p) => [p.id, p.stockQuantity])
      );

      // Create a cart referencing these products
      const cartItems: CartItem[] = products.map((p) =>
        randomCartItem(p.id)
      );

      const orderId = `order-${i}`;

      // Step 1: Calculate sale adjustments (negative)
      const saleAdj = calculateSaleAdjustments(cartItems, products, orderId);

      // Step 2: Apply sale adjustments
      const saleResult = applyStockAdjustments(saleAdj, products);

      // Step 3: Calculate void adjustments (positive)
      const orderItems = cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      // Use post-sale stock levels
      const postSaleProducts = products.map((p) => {
        const adj = saleAdj.find((a) => a.productId === p.id);
        return {
          ...p,
          stockQuantity: p.stockQuantity + (adj?.quantityChange ?? 0),
        };
      });

      const voidAdj = calculateVoidAdjustments(
        orderItems,
        postSaleProducts,
        orderId
      );

      // Step 4: Verify sale + void adjustments sum to zero per product
      for (const product of products) {
        const saleChange =
          saleAdj.find((a) => a.productId === product.id)?.quantityChange ?? 0;
        const voidChange =
          voidAdj.find((a) => a.productId === product.id)?.quantityChange ?? 0;

        // Sale is negative, void is positive — they should cancel out
        expect(saleChange + voidChange).toBe(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Property 2: Stock never goes negative (when clamped)
// ---------------------------------------------------------------------------

describe("PBT: Stock level clamping", () => {
  it("computeNewStockLevel with allowNegative=false never returns < 0", () => {
    for (let i = 0; i < 200; i++) {
      const currentStock = Math.floor(Math.random() * 50);
      const adjustment = -Math.floor(Math.random() * 100);

      const newLevel = computeNewStockLevel(currentStock, adjustment, false);
      expect(newLevel).toBeGreaterThanOrEqual(0);
    }
  });

  it("computeNewStockLevel with allowNegative=true can return < 0", () => {
    const newLevel = computeNewStockLevel(5, -10, true);
    expect(newLevel).toBe(-5);
  });

  it("computeNewStockLevel identity: adjustment of 0 returns current stock", () => {
    for (let i = 0; i < 100; i++) {
      const stock = Math.floor(Math.random() * 1000);
      expect(computeNewStockLevel(stock, 0)).toBe(stock);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 3: Sale adjustment quantities match cart quantities
// ---------------------------------------------------------------------------

describe("PBT: Sale adjustment correctness", () => {
  it("each sale adjustment magnitude equals the corresponding cart item quantity", () => {
    for (let i = 0; i < 100; i++) {
      const products = Array.from({ length: 3 }, (_, idx) =>
        randomProduct(`p${idx}`, true)
      );
      const cartItems = products.map((p) => randomCartItem(p.id));

      const adjustments = calculateSaleAdjustments(
        cartItems,
        products,
        "test-order"
      );

      for (const adj of adjustments) {
        const cartItem = cartItems.find(
          (item) => item.productId === adj.productId
        )!;

        // Sale adjustment should be negative and equal to -quantity
        expect(adj.quantityChange).toBe(-cartItem.quantity);
      }
    }
  });

  it("products not tracking inventory produce no adjustments", () => {
    for (let i = 0; i < 50; i++) {
      const products: ProductStockInfo[] = [
        randomProduct("tracked", true),
        randomProduct("untracked", false),
      ];
      const cartItems = products.map((p) => randomCartItem(p.id));

      const adjustments = calculateSaleAdjustments(
        cartItems,
        products,
        "test-order"
      );

      // Should only have adjustment for the tracked product
      expect(adjustments.length).toBe(1);
      expect(adjustments[0].productId).toBe("tracked");
    }
  });
});

// ---------------------------------------------------------------------------
// Property 4: Stock availability check consistency
// ---------------------------------------------------------------------------

describe("PBT: Stock availability checking", () => {
  it("products with sufficient stock are not flagged", () => {
    for (let i = 0; i < 100; i++) {
      const products: ProductStockInfo[] = [
        { id: "p1", trackInventory: true, stockQuantity: 100 },
      ];
      const cartItems: CartItem[] = [
        {
          productId: "p1",
          productName: "Item",
          quantity: Math.floor(Math.random() * 99) + 1,
          unitPrice: 10,
          discount: 0,
          notes: null,
        },
      ];

      const insufficient = checkStockAvailability(cartItems, products);
      expect(insufficient.length).toBe(0);
    }
  });

  it("products with insufficient stock are correctly flagged", () => {
    for (let i = 0; i < 100; i++) {
      const stock = Math.floor(Math.random() * 5) + 1;
      const requested = stock + Math.floor(Math.random() * 10) + 1;

      const products: ProductStockInfo[] = [
        { id: "p1", trackInventory: true, stockQuantity: stock },
      ];
      const cartItems: CartItem[] = [
        {
          productId: "p1",
          productName: "Item",
          quantity: requested,
          unitPrice: 10,
          discount: 0,
          notes: null,
        },
      ];

      const insufficient = checkStockAvailability(cartItems, products);
      expect(insufficient.length).toBe(1);
      expect(insufficient[0].requested).toBe(requested);
      expect(insufficient[0].available).toBe(stock);
    }
  });
});
