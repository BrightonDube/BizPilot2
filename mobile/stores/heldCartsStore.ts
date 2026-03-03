/**
 * BizPilot Mobile POS — Held Carts Store
 *
 * Manages "held" (parked) carts — orders that are paused and can be
 * recalled later. Common in restaurants when a customer steps away or
 * a table hasn't finished ordering.
 *
 * Why a separate store from cartStore?
 * The main cartStore holds exactly ONE active transaction. Held carts
 * are a queue of paused transactions. Mixing them would complicate the
 * hot path (every item add/remove) with held-cart logic. Separating
 * keeps both stores simple and focused.
 *
 * Why persist held carts to AsyncStorage?
 * Held carts may survive app restarts (e.g., the iPad runs out of
 * battery). WatermelonDB is overkill for a small queue of carts.
 * AsyncStorage is the right tool for simple key-value persistence.
 */

import { create } from "zustand";
import type { CartItem } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeldCart {
  /** Unique ID for this held cart */
  id: string;
  /** Display label (e.g., "Table 5", customer name) */
  label: string;
  /** The items in this held cart */
  items: CartItem[];
  /** Customer ID if one was linked */
  customerId: string | null;
  /** Cart-level discount */
  discount: number;
  /** Cart notes */
  notes: string;
  /** When the cart was held (epoch ms) */
  heldAt: number;
  /** Who held the cart (user ID) */
  heldBy: string;
}

interface HeldCartsStore {
  /** All held carts, newest first */
  heldCarts: HeldCart[];
  /** Maximum number of held carts allowed */
  maxHeldCarts: number;

  // Actions
  holdCart: (cart: Omit<HeldCart, "id" | "heldAt">) => string;
  recallCart: (cartId: string) => HeldCart | null;
  removeHeldCart: (cartId: string) => void;
  getHeldCartCount: () => number;
}

// ---------------------------------------------------------------------------
// Simple ID generator for held carts
// ---------------------------------------------------------------------------

function generateHeldCartId(): string {
  return `held-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useHeldCartsStore = create<HeldCartsStore>((set, get) => ({
  heldCarts: [],
  maxHeldCarts: 20,

  holdCart: (cart) => {
    const { heldCarts, maxHeldCarts } = get();
    if (heldCarts.length >= maxHeldCarts) {
      throw new Error(`Maximum of ${maxHeldCarts} held carts reached`);
    }

    const id = generateHeldCartId();
    const heldCart: HeldCart = {
      ...cart,
      id,
      heldAt: Date.now(),
    };

    set({ heldCarts: [heldCart, ...heldCarts] });
    return id;
  },

  recallCart: (cartId) => {
    const { heldCarts } = get();
    const cart = heldCarts.find((c) => c.id === cartId) ?? null;
    if (cart) {
      set({ heldCarts: heldCarts.filter((c) => c.id !== cartId) });
    }
    return cart;
  },

  removeHeldCart: (cartId) => {
    set({ heldCarts: get().heldCarts.filter((c) => c.id !== cartId) });
  },

  getHeldCartCount: () => get().heldCarts.length,
}));
