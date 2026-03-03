/**
 * BizPilot Mobile POS — useOrders Hook
 *
 * Provides order data with status filtering and pagination.
 *
 * Why separate from useProducts?
 * Orders have different access patterns: they're queried by date range,
 * status, and customer. Keeping them in a separate hook allows
 * independent caching and refresh strategies.
 */

import { useState, useMemo, useCallback } from "react";
import type { MobileOrder, OrderStatus } from "@/types";

// ---------------------------------------------------------------------------
// Mock data (replaced by WatermelonDB when connected)
// ---------------------------------------------------------------------------

const MOCK_ORDERS: MobileOrder[] = [
  { id: "o1", orderNumber: "POS-ABC123-XY", customerId: "c1", status: "completed", subtotal: 245.99, taxAmount: 32.09, discountAmount: 0, total: 245.99, paymentMethod: "card", paymentStatus: "paid", notes: null, createdBy: "user1", createdAt: Date.now() - 3600000, updatedAt: Date.now() - 3600000, remoteId: "o1", syncedAt: Date.now(), isDirty: false },
  { id: "o2", orderNumber: "POS-DEF456-AB", customerId: null, status: "completed", subtotal: 89.0, taxAmount: 11.61, discountAmount: 0, total: 89.0, paymentMethod: "cash", paymentStatus: "paid", notes: null, createdBy: "user1", createdAt: Date.now() - 7200000, updatedAt: Date.now() - 7200000, remoteId: "o2", syncedAt: Date.now(), isDirty: false },
  { id: "o3", orderNumber: "POS-GHI789-CD", customerId: "c3", status: "cancelled", subtotal: 55.0, taxAmount: 7.17, discountAmount: 0, total: 55.0, paymentMethod: "cash", paymentStatus: "refunded", notes: "VOIDED: Customer changed mind", createdBy: "user1", createdAt: Date.now() - 10800000, updatedAt: Date.now() - 10800000, remoteId: "o3", syncedAt: Date.now(), isDirty: false },
  { id: "o4", orderNumber: "POS-JKL012-EF", customerId: null, status: "completed", subtotal: 430.0, taxAmount: 56.09, discountAmount: 20, total: 410.0, paymentMethod: "card", paymentStatus: "paid", notes: null, createdBy: "user1", createdAt: Date.now() - 14400000, updatedAt: Date.now() - 14400000, remoteId: "o4", syncedAt: Date.now(), isDirty: false },
  { id: "o5", orderNumber: "POS-MNO345-GH", customerId: "c2", status: "refunded", subtotal: 119.99, taxAmount: 15.65, discountAmount: 0, total: 119.99, paymentMethod: "cash", paymentStatus: "refunded", notes: null, createdBy: "user1", createdAt: Date.now() - 18000000, updatedAt: Date.now() - 18000000, remoteId: "o5", syncedAt: Date.now(), isDirty: false },
];

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

interface UseOrdersOptions {
  /** Filter by order status (null = all) */
  status?: OrderStatus | null;
  /** Filter by customer ID */
  customerId?: string | null;
  /** Number of orders per page */
  limit?: number;
}

interface UseOrdersReturn {
  /** Filtered orders sorted by creation date (newest first) */
  orders: MobileOrder[];
  /** Whether data is loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Reload orders from database */
  refresh: () => void;
  /** Add a newly created order to the local list */
  addOrder: (order: MobileOrder) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOrders(options: UseOrdersOptions = {}): UseOrdersReturn {
  const { status = null, customerId = null, limit = 50 } = options;
  const [loading, setLoading] = useState(false);
  const [error] = useState<string | null>(null);
  const [localOrders, setLocalOrders] = useState<MobileOrder[]>([]);

  const orders = useMemo(() => {
    let result = [...MOCK_ORDERS, ...localOrders];

    if (status) {
      result = result.filter((o) => o.status === status);
    }

    if (customerId) {
      result = result.filter((o) => o.customerId === customerId);
    }

    // Sort by creation date, newest first
    result.sort((a, b) => b.createdAt - a.createdAt);

    return result.slice(0, limit);
  }, [status, customerId, limit, localOrders]);

  const refresh = useCallback(() => {
    setLoading(true);
    setTimeout(() => setLoading(false), 100);
  }, []);

  const addOrder = useCallback((order: MobileOrder) => {
    setLocalOrders((prev) => [order, ...prev]);
  }, []);

  return { orders, loading, error, refresh, addOrder };
}
