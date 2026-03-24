/**
 * useStock.ts — Hook for managing inventory and stock adjustments
 */

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { StockItem, StockAdjustment, InventorySummary } from '@/app/(dashboard)/stock/types';

interface FetchInventoryParams {
  search?: string;
  low_stock_only?: boolean;
  page?: number;
  per_page?: number;
}

export function useStock() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInventory = useCallback(async (params?: FetchInventoryParams) => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/inventory', { params });
      setItems(response.data.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await apiClient.get('/inventory/summary');
      setSummary(response.data);
    } catch (err: unknown) {
      console.error('Failed to fetch inventory summary:', err);
    }
  }, []);

  const adjustStock = useCallback(async (itemId: string, adjustment: StockAdjustment) => {
    try {
      setError(null);
      const response = await apiClient.post(`/inventory/${itemId}/adjust`, adjustment);
      // Refresh items after adjustment
      fetchInventory();
      fetchSummary();
      return { success: true, transaction: response.data };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Adjustment failed';
      setError(msg);
      return { success: false, error: msg };
    }
  }, [fetchInventory, fetchSummary]);

  return {
    items,
    summary,
    isLoading,
    error,
    fetchInventory,
    fetchSummary,
    adjustStock,
  };
}
