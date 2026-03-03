/**
 * BizPilot Mobile POS — Cart Zustand Store
 *
 * In-memory cart for the current POS transaction.
 * Computes subtotal, tax, and total reactively.
 *
 * Why Zustand with computed getters?
 * The cart is the hottest state in a POS — every product tap,
 * quantity change, and discount triggers a recalculation.
 * Zustand's selector pattern ensures only the Cart component
 * re-renders, not the entire product grid.
 *
 * Why not persist the cart to WatermelonDB?
 * A cart is ephemeral — it exists only until the order is placed.
 * Persisting to SQLite on every item add would be unnecessarily
 * slow. We only persist to DB when the order is finalized.
 */

import { create } from "zustand";
import type { CartItem } from "@/types";
import { DEFAULT_VAT_RATE } from "@/utils/constants";

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface CartStore {
  items: CartItem[];
  customerId: string | null;
  discount: number;
  notes: string;

  // Actions
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  updateItemNotes: (productId: string, notes: string | null) => void;
  updateItemDiscount: (productId: string, discount: number) => void;
  setCustomer: (customerId: string | null) => void;
  applyDiscount: (discount: number) => void;
  setNotes: (notes: string) => void;
  clear: () => void;

  // Computed (recalculated on every access — fast for small carts)
  getSubtotal: () => number;
  getTaxAmount: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  customerId: null,
  discount: 0,
  notes: "",

  addItem: (item) => {
    const { items } = get();
    const existing = items.find((i) => i.productId === item.productId);

    if (existing) {
      // Increment quantity if product already in cart
      set({
        items: items.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
            : i
        ),
      });
    } else {
      // Add new item with default quantity of 1
      set({
        items: [
          ...items,
          {
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice,
            discount: item.discount ?? 0,
            notes: item.notes ?? null,
          },
        ],
      });
    }
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      // Remove item if quantity drops to zero or below
      set({ items: get().items.filter((i) => i.productId !== productId) });
    } else {
      set({
        items: get().items.map((i) =>
          i.productId === productId ? { ...i, quantity } : i
        ),
      });
    }
  },

  removeItem: (productId) => {
    set({ items: get().items.filter((i) => i.productId !== productId) });
  },

  updateItemNotes: (productId, notes) => {
    set({
      items: get().items.map((i) =>
        i.productId === productId ? { ...i, notes } : i
      ),
    });
  },

  updateItemDiscount: (productId, discount) => {
    set({
      items: get().items.map((i) =>
        i.productId === productId ? { ...i, discount: Math.max(0, discount) } : i
      ),
    });
  },

  setCustomer: (customerId) => set({ customerId }),

  applyDiscount: (discount) => set({ discount }),

  setNotes: (notes) => set({ notes }),

  clear: () =>
    set({
      items: [],
      customerId: null,
      discount: 0,
      notes: "",
    }),

  // ---------------------------------------------------------------------------
  // Computed values
  //
  // Why getter functions instead of derived state?
  // Zustand doesn't have built-in computed/derived state like MobX.
  // Getter functions are simple, explicit, and easy to test.
  // For a POS cart with <50 items, the O(n) sum is negligible.
  // ---------------------------------------------------------------------------

  getSubtotal: () => {
    return get().items.reduce((sum, item) => {
      const lineTotal = item.unitPrice * item.quantity - item.discount;
      return sum + Math.max(0, lineTotal);
    }, 0);
  },

  getTaxAmount: () => {
    const subtotal = get().getSubtotal();
    const afterDiscount = subtotal - get().discount;
    // VAT is inclusive in South Africa, but for POS we show it separately
    return Math.round(afterDiscount * DEFAULT_VAT_RATE * 100) / 100;
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const tax = get().getTaxAmount();
    const discount = get().discount;
    return Math.round((subtotal + tax - discount) * 100) / 100;
  },

  getItemCount: () => {
    return get().items.reduce((count, item) => count + item.quantity, 0);
  },
}));
