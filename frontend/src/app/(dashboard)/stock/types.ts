/**
 * types.ts — Stock and Inventory interfaces
 */

export type TransactionType = 'sale' | 'purchase' | 'adjustment' | 'transfer' | 'return' | 'waste';

export interface StockItem {
  id: string;
  business_id: string;
  product_id: string;
  product_name: string | null;
  sku: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_incoming: number;
  quantity_available: number;
  reorder_point: number;
  reorder_quantity: number;
  location: string | null;
  bin_location: string | null;
  average_cost: number;
  last_cost: number;
  is_low_stock: boolean;
  stock_value: number;
  last_counted_at: string | null;
  last_received_at: string | null;
  last_sold_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockTransaction {
  id: string;
  business_id: string;
  product_id: string;
  product_name?: string;
  transaction_type: TransactionType;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost: number;
  total_cost: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  from_location: string | null;
  to_location: string | null;
  user_id: string | null;
  created_at: string;
}

export interface StockAdjustment {
  adjustment_type: 'absolute' | 'relative';
  quantity: number;
  reason: string;
  notes?: string;
  unit_cost?: number;
}

export interface InventorySummary {
  total_items: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
}
