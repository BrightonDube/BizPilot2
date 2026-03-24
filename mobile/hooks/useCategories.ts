/**
 * useCategories.ts — Fetch categories from API
 */

import { useState, useEffect } from "react";
import type { POSCategory } from "@/types/pos";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

interface UseCategoriesResult {
  categories: POSCategory[];
  isLoading: boolean;
  error: string | null;
}

/** Fetch all categories for product filtering */
export function useCategories(): UseCategoriesResult {
  const [categories, setCategories] = useState<POSCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/categories?limit=100`);
        if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);

        const data = await res.json();
        const items = data.items || [];

        const mapped: POSCategory[] = items.map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          icon: null,
          color: c.color as string | null,
          sort_order: (c.sort_order as number) || 0,
        }));

        setCategories(mapped);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, isLoading, error };
}
