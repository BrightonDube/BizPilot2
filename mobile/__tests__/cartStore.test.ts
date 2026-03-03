/**
 * BizPilot Mobile POS — Cart Store Tests
 *
 * Tests the Zustand cart store which is the hottest state in the POS.
 * Covers: add, remove, quantity, discounts, computed totals.
 */

import { useCartStore } from "@/stores/cartStore";

// Reset store between tests so they don't leak state
beforeEach(() => {
  useCartStore.getState().clear();
});

describe("CartStore", () => {
  // -----------------------------------------------------------------------
  // Adding items
  // -----------------------------------------------------------------------

  describe("addItem", () => {
    it("adds a new item with default quantity of 1", () => {
      useCartStore.getState().addItem({
        productId: "p1",
        productName: "Burger",
        unitPrice: 89.99,
        discount: 0,
        notes: null,
      });

      const items = useCartStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe("p1");
      expect(items[0].quantity).toBe(1);
    });

    it("increments quantity when adding an existing product", () => {
      const { addItem } = useCartStore.getState();

      addItem({
        productId: "p1",
        productName: "Burger",
        unitPrice: 89.99,
        discount: 0,
        notes: null,
      });
      addItem({
        productId: "p1",
        productName: "Burger",
        unitPrice: 89.99,
        discount: 0,
        notes: null,
      });

      const items = useCartStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(2);
    });

    it("adds multiple different products as separate items", () => {
      const { addItem } = useCartStore.getState();

      addItem({ productId: "p1", productName: "Burger", unitPrice: 89.99, discount: 0, notes: null });
      addItem({ productId: "p2", productName: "Chips", unitPrice: 35.0, discount: 0, notes: null });

      expect(useCartStore.getState().items).toHaveLength(2);
    });

    it("accepts a custom quantity on add", () => {
      useCartStore.getState().addItem({
        productId: "p1",
        productName: "Burger",
        unitPrice: 89.99,
        discount: 0,
        notes: null,
        quantity: 5,
      });

      expect(useCartStore.getState().items[0].quantity).toBe(5);
    });
  });

  // -----------------------------------------------------------------------
  // Updating quantity
  // -----------------------------------------------------------------------

  describe("updateQuantity", () => {
    it("updates the quantity of an existing item", () => {
      useCartStore.getState().addItem({
        productId: "p1",
        productName: "Burger",
        unitPrice: 89.99,
        discount: 0,
        notes: null,
      });

      useCartStore.getState().updateQuantity("p1", 3);
      expect(useCartStore.getState().items[0].quantity).toBe(3);
    });

    it("removes the item when quantity drops to zero", () => {
      useCartStore.getState().addItem({
        productId: "p1",
        productName: "Burger",
        unitPrice: 89.99,
        discount: 0,
        notes: null,
      });

      useCartStore.getState().updateQuantity("p1", 0);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("removes the item when quantity is negative", () => {
      useCartStore.getState().addItem({
        productId: "p1",
        productName: "Burger",
        unitPrice: 89.99,
        discount: 0,
        notes: null,
      });

      useCartStore.getState().updateQuantity("p1", -1);
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Removing items
  // -----------------------------------------------------------------------

  describe("removeItem", () => {
    it("removes the specified product from the cart", () => {
      const { addItem } = useCartStore.getState();
      addItem({ productId: "p1", productName: "Burger", unitPrice: 89.99, discount: 0, notes: null });
      addItem({ productId: "p2", productName: "Chips", unitPrice: 35.0, discount: 0, notes: null });

      useCartStore.getState().removeItem("p1");

      const items = useCartStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe("p2");
    });

    it("does nothing when removing a non-existent product", () => {
      useCartStore.getState().addItem({
        productId: "p1",
        productName: "Burger",
        unitPrice: 89.99,
        discount: 0,
        notes: null,
      });

      useCartStore.getState().removeItem("non-existent");
      expect(useCartStore.getState().items).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // Computed totals
  // -----------------------------------------------------------------------

  describe("computed totals", () => {
    it("calculates subtotal correctly", () => {
      const { addItem } = useCartStore.getState();
      addItem({ productId: "p1", productName: "Burger", unitPrice: 100, discount: 0, notes: null });
      addItem({ productId: "p2", productName: "Chips", unitPrice: 50, discount: 0, notes: null });

      // 100 + 50 = 150
      expect(useCartStore.getState().getSubtotal()).toBe(150);
    });

    it("calculates subtotal with item discounts", () => {
      useCartStore.getState().addItem({
        productId: "p1",
        productName: "Burger",
        unitPrice: 100,
        discount: 10,
        notes: null,
        quantity: 2,
      });

      // (100 * 2) - 10 = 190
      expect(useCartStore.getState().getSubtotal()).toBe(190);
    });

    it("calculates tax at 15% VAT rate", () => {
      useCartStore.getState().addItem({
        productId: "p1",
        productName: "Burger",
        unitPrice: 100,
        discount: 0,
        notes: null,
      });

      // 100 * 0.15 = 15
      expect(useCartStore.getState().getTaxAmount()).toBe(15);
    });

    it("calculates total as subtotal + tax - cart discount", () => {
      useCartStore.getState().addItem({
        productId: "p1",
        productName: "Burger",
        unitPrice: 100,
        discount: 0,
        notes: null,
      });

      // subtotal=100, tax=15, discount=0 → total=115
      expect(useCartStore.getState().getTotal()).toBe(115);
    });

    it("counts total items including quantities", () => {
      const { addItem } = useCartStore.getState();
      addItem({ productId: "p1", productName: "Burger", unitPrice: 100, discount: 0, notes: null, quantity: 2 });
      addItem({ productId: "p2", productName: "Chips", unitPrice: 50, discount: 0, notes: null, quantity: 3 });

      // 2 + 3 = 5
      expect(useCartStore.getState().getItemCount()).toBe(5);
    });

    it("returns zero for empty cart", () => {
      expect(useCartStore.getState().getSubtotal()).toBe(0);
      expect(useCartStore.getState().getTaxAmount()).toBe(0);
      expect(useCartStore.getState().getTotal()).toBe(0);
      expect(useCartStore.getState().getItemCount()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Clear cart
  // -----------------------------------------------------------------------

  describe("clear", () => {
    it("empties the cart completely", () => {
      const { addItem, setCustomer, applyDiscount, setNotes } =
        useCartStore.getState();

      addItem({ productId: "p1", productName: "Burger", unitPrice: 89.99, discount: 0, notes: null });
      setCustomer("c1");
      applyDiscount(10);
      setNotes("Rush order");

      useCartStore.getState().clear();

      const state = useCartStore.getState();
      expect(state.items).toHaveLength(0);
      expect(state.customerId).toBeNull();
      expect(state.discount).toBe(0);
      expect(state.notes).toBe("");
    });
  });
});
