/**
 * BizPilot Mobile POS — Cart Zustand Store
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CartItem, Product, Customer } from "@/types";

interface CartState {
  items: CartItem[];
  customer: Customer | null;
  taxRate: number;
  discountAmount: number;
  notes: string;
  
  // Mandated Actions
  addItem: (product: Product) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  setCustomer: (customer: Customer | null) => void;
  clearCart: () => void;
  applyDiscount: (amount: number) => void;

  // Computed totals
  subtotal: () => number;
  taxAmount: () => number;
  grandTotal: () => number;

  // Compatibility Actions
  clear: () => void;
  getSubtotal: () => number;
  getTaxAmount: () => number;
  getTotal: () => number;
  getItemCount: () => number;
  setNotes: (notes: string) => void;
  updateItemDiscount: (id: string, amount: number) => void;
  updateItemNotes: (id: string, notes: string) => void;
  customerId?: string | null;
  discount?: number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      customer: null,
      taxRate: 0.15,
      discountAmount: 0,
      notes: "",
      customerId: null,
      discount: 0,

      addItem: (product: any) => {
        const { items } = get();
        const productId = product.id || product.productId;
        const productName = product.name || product.productName;
        const unitPrice = product.price || product.unitPrice;

        const existingItem = items.find((i) => i.productId === productId);

        if (existingItem) {
          set({
            items: items.map((i) =>
              i.productId === productId ? { ...i, quantity: i.quantity + (product.quantity || 1) } : i
            ),
          });
        } else {
          set({
            items: [
              ...items,
              {
                id: Math.random().toString(36).substr(2, 9),
                productId,
                productName,
                quantity: product.quantity || 1,
                unitPrice,
                discount: product.discount || 0,
                notes: product.notes || null,
              },
            ],
          });
        }
      },

      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.productId !== id) });
      },

      updateQuantity: (id, qty) => {
        if (qty <= 0) {
          set({ items: get().items.filter((i) => i.productId !== id) });
        } else {
          set({
            items: get().items.map((i) => (i.productId === id ? { ...i, quantity: qty } : i)),
          });
        }
      },

      setCustomer: (customer: any) => set({ 
        customer: typeof customer === "string" ? null : customer,
        customerId: typeof customer === "string" ? customer : customer?.id
      }),

      clearCart: () => set({ items: [], customer: null, customerId: null, discountAmount: 0, discount: 0, notes: "" }),

      applyDiscount: (amount) => set({ discountAmount: amount, discount: amount }),

      setNotes: (notes) => set({ notes }),

      updateItemDiscount: (id, amount) => set((state) => ({
        items: state.items.map((i) => i.productId === id ? { ...i, discount: amount } : i)
      })),

      updateItemNotes: (id, notes) => set((state) => ({
        items: state.items.map((i) => i.productId === id ? { ...i, notes } : i)
      })),

      // Computed totals
      subtotal: () => {
        return get().items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      },

      taxAmount: () => {
        return get().subtotal() * get().taxRate;
      },

      grandTotal: () => {
        return get().subtotal() + get().taxAmount() - get().discountAmount;
      },

      // Compatibility
      clear: () => get().clearCart(),
      getSubtotal: () => get().subtotal(),
      getTaxAmount: () => get().taxAmount(),
      getTotal: () => get().grandTotal(),
      getItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    {
      name: "bizpilot-cart-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
