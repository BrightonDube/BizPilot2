/**
 * pos.ts — POS-specific types for mobile app
 * Types for products, categories, and cart items used in the POS selling screen
 */

import type { CartItem } from "./index";

/** Product as shown in POS grid */
export interface POSProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  category_id: string | null;
  category_name: string | null;
  image_url: string | null;
  stock_quantity: number;
  is_active: boolean;
  is_in_stock: boolean;
}

/** Category for filtering products */
export interface POSCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

/** Re-export CartItem from existing types */
export type { CartItem };
