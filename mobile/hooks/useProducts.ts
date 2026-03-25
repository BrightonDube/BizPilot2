/**
 * useProducts.ts — Fetch products from API with category filter and debounced search
 */

import { useState, useEffect, useCallback } from "react";
import type { POSProduct } from "@/types/pos";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

interface UseProductsResult {
  products: POSProduct[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetch products with optional category filter and search
 * @param categoryId - Filter by category ID
 * @param search - Search term (debounced 300ms)
 */
export function useProducts(categoryId?: string, search?: string): UseProductsResult {
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (categoryId) params.append("category_id", categoryId);
      if (search) params.append("search", search);
      params.append("per_page", "100");

      const res = await fetch(`${API_BASE}/api/v1/products?${params}`);
      if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);

      const data = await res.json();
      const items = data.items || [];

      const mapped: POSProduct[] = items.map((p: Record<string, unknown>) => ({
        id: p.id as string,
        name: p.name as string,
        sku: (p.sku as string) || "",
        price: Number(p.selling_price) || 0,
        category_id: p.category_id as string | null,
        category_name: null,
        image_url: p.image_url as string | null,
        stock_quantity: (p.quantity as number) || 0,
        is_active: p.status === "ACTIVE",
        is_in_stock: (p.quantity as number) > 0,
      }));

      setProducts(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, search]);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  return { products, isLoading, error };
}
