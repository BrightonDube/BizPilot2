/**
 * BizPilot Mobile POS — HeldCartsStore Tests
 *
 * Tests for hold/recall cart functionality.
 */

import { useHeldCartsStore } from "@/stores/heldCartsStore";
import type { CartItem } from "@/types";

// Reset store between tests
beforeEach(() => {
  useHeldCartsStore.setState({ heldCarts: [] });
});

const MOCK_ITEMS: CartItem[] = [
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
    productName: "Coke",
    unitPrice: 22,
    quantity: 1,
    discount: 0,
    notes: "No ice",
  },
];

describe("heldCartsStore", () => {
  describe("holdCart", () => {
    it("adds a cart to the held list", () => {
      const { holdCart, heldCarts } = useHeldCartsStore.getState();
      const id = holdCart({
        label: "Table 5",
        items: MOCK_ITEMS,
        customerId: null,
        discount: 0,
        notes: "",
        heldBy: "user-1",
      });

      const state = useHeldCartsStore.getState();
      expect(state.heldCarts).toHaveLength(1);
      expect(state.heldCarts[0].id).toBe(id);
      expect(state.heldCarts[0].label).toBe("Table 5");
      expect(state.heldCarts[0].items).toEqual(MOCK_ITEMS);
      expect(state.heldCarts[0].heldAt).toBeTruthy();
    });

    it("adds newest cart to the front", () => {
      const { holdCart } = useHeldCartsStore.getState();
      holdCart({
        label: "Table 1",
        items: MOCK_ITEMS,
        customerId: null,
        discount: 0,
        notes: "",
        heldBy: "user-1",
      });
      holdCart({
        label: "Table 2",
        items: MOCK_ITEMS,
        customerId: null,
        discount: 0,
        notes: "",
        heldBy: "user-1",
      });

      const state = useHeldCartsStore.getState();
      expect(state.heldCarts).toHaveLength(2);
      expect(state.heldCarts[0].label).toBe("Table 2");
      expect(state.heldCarts[1].label).toBe("Table 1");
    });

    it("returns a unique ID for each held cart", () => {
      const { holdCart } = useHeldCartsStore.getState();
      const id1 = holdCart({
        label: "A",
        items: [],
        customerId: null,
        discount: 0,
        notes: "",
        heldBy: "u1",
      });
      const id2 = holdCart({
        label: "B",
        items: [],
        customerId: null,
        discount: 0,
        notes: "",
        heldBy: "u1",
      });
      expect(id1).not.toBe(id2);
    });

    it("throws when max held carts reached", () => {
      const store = useHeldCartsStore.getState();
      // Override max for test
      useHeldCartsStore.setState({ maxHeldCarts: 2 });

      store.holdCart({
        label: "A",
        items: [],
        customerId: null,
        discount: 0,
        notes: "",
        heldBy: "u1",
      });
      store.holdCart({
        label: "B",
        items: [],
        customerId: null,
        discount: 0,
        notes: "",
        heldBy: "u1",
      });

      expect(() =>
        useHeldCartsStore.getState().holdCart({
          label: "C",
          items: [],
          customerId: null,
          discount: 0,
          notes: "",
          heldBy: "u1",
        })
      ).toThrow("Maximum of 2 held carts reached");
    });
  });

  describe("recallCart", () => {
    it("returns the cart and removes it from the list", () => {
      const { holdCart } = useHeldCartsStore.getState();
      const id = holdCart({
        label: "Table 5",
        items: MOCK_ITEMS,
        customerId: "c1",
        discount: 10,
        notes: "Rush order",
        heldBy: "user-1",
      });

      const recalled = useHeldCartsStore.getState().recallCart(id);
      expect(recalled).not.toBeNull();
      expect(recalled!.label).toBe("Table 5");
      expect(recalled!.items).toEqual(MOCK_ITEMS);
      expect(recalled!.customerId).toBe("c1");
      expect(recalled!.discount).toBe(10);
      expect(recalled!.notes).toBe("Rush order");

      expect(useHeldCartsStore.getState().heldCarts).toHaveLength(0);
    });

    it("returns null for non-existent cart", () => {
      const recalled =
        useHeldCartsStore.getState().recallCart("non-existent");
      expect(recalled).toBeNull();
    });
  });

  describe("removeHeldCart", () => {
    it("removes the specified cart", () => {
      const { holdCart } = useHeldCartsStore.getState();
      const id1 = holdCart({
        label: "A",
        items: [],
        customerId: null,
        discount: 0,
        notes: "",
        heldBy: "u1",
      });
      holdCart({
        label: "B",
        items: [],
        customerId: null,
        discount: 0,
        notes: "",
        heldBy: "u1",
      });

      useHeldCartsStore.getState().removeHeldCart(id1);
      const state = useHeldCartsStore.getState();
      expect(state.heldCarts).toHaveLength(1);
      expect(state.heldCarts[0].label).toBe("B");
    });
  });

  describe("getHeldCartCount", () => {
    it("returns correct count", () => {
      expect(useHeldCartsStore.getState().getHeldCartCount()).toBe(0);

      useHeldCartsStore.getState().holdCart({
        label: "A",
        items: [],
        customerId: null,
        discount: 0,
        notes: "",
        heldBy: "u1",
      });

      expect(useHeldCartsStore.getState().getHeldCartCount()).toBe(1);
    });
  });
});
