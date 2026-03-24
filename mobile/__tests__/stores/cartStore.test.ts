/**
 * BizPilot Mobile POS — Cart Store Tests
 */

import { useCartStore } from "@/stores/cartStore";

beforeEach(() => {
  useCartStore.getState().clearCart();
});

describe("CartStore", () => {
  const mockProduct = {
    id: "p1",
    name: "Burger",
    price: 100,
    category_id: "cat1",
    is_available: true,
  } as any;

  it("addItem adds a new product to items array", () => {
    useCartStore.getState().addItem(mockProduct);
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe("p1");
    expect(items[0].quantity).toBe(1);
  });

  it("addItem on existing product increments quantity, does not add new row", () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().addItem(mockProduct);
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it("removeItem removes item with matching id", () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().removeItem("p1");
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("updateQuantity(id, 0) removes item from array", () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().updateQuantity("p1", 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("grandTotal = subtotal + taxAmount - discountAmount", () => {
    useCartStore.getState().addItem(mockProduct); // subtotal 100
    useCartStore.getState().applyDiscount(10);
    // subtotal=100, tax=15, discount=10 => 105
    expect(useCartStore.getState().grandTotal()).toBe(105);
  });

  it("grandTotal recalculates when item quantity changes", () => {
    useCartStore.getState().addItem(mockProduct);
    expect(useCartStore.getState().grandTotal()).toBe(115);
    useCartStore.getState().updateQuantity("p1", 2);
    // subtotal=200, tax=30 => 230
    expect(useCartStore.getState().grandTotal()).toBe(230);
  });

  it("clearCart resets items to empty array", () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("taxAmount = subtotal × taxRate", () => {
    useCartStore.getState().addItem(mockProduct);
    expect(useCartStore.getState().taxAmount()).toBe(15);
  });
});
