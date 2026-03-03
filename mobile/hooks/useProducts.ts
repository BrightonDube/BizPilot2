/**
 * BizPilot Mobile POS — useProducts Hook
 *
 * Provides product data to components with search and category filtering.
 *
 * Why this abstraction over raw WatermelonDB queries?
 * 1. Components stay decoupled from the data layer
 * 2. We can swap WatermelonDB for mock data during development
 * 3. Filtering, sorting, and pagination logic lives in one place
 * 4. Easy to add caching or optimistic updates later
 *
 * Current implementation uses mock data. When WatermelonDB is connected,
 * replace the mock data source with database.get('products').query(...).
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import type { MobileProduct } from "@/types";

// ---------------------------------------------------------------------------
// Mock data (replaced by WatermelonDB when connected)
// ---------------------------------------------------------------------------

const MOCK_PRODUCTS: MobileProduct[] = [
  { id: "p1", name: "Burger", sku: "BRG-001", barcode: null, description: null, price: 89.99, costPrice: 35, categoryId: "food", imageUrl: null, isActive: true, trackInventory: true, stockQuantity: 50, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "p1", syncedAt: Date.now(), isDirty: false },
  { id: "p2", name: "Chips", sku: "CHP-001", barcode: null, description: null, price: 35.0, costPrice: 12, categoryId: "food", imageUrl: null, isActive: true, trackInventory: true, stockQuantity: 100, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "p2", syncedAt: Date.now(), isDirty: false },
  { id: "p3", name: "Coke 330ml", sku: "COK-330", barcode: "6001134000019", description: null, price: 22.0, costPrice: 10, categoryId: "drinks", imageUrl: null, isActive: true, trackInventory: true, stockQuantity: 200, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "p3", syncedAt: Date.now(), isDirty: false },
  { id: "p4", name: "Fanta 330ml", sku: "FNT-330", barcode: null, description: null, price: 22.0, costPrice: 10, categoryId: "drinks", imageUrl: null, isActive: true, trackInventory: true, stockQuantity: 180, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "p4", syncedAt: Date.now(), isDirty: false },
  { id: "p5", name: "Water 500ml", sku: "WTR-500", barcode: null, description: null, price: 15.0, costPrice: 5, categoryId: "drinks", imageUrl: null, isActive: true, trackInventory: true, stockQuantity: 150, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "p5", syncedAt: Date.now(), isDirty: false },
  { id: "p6", name: "Cheesecake", sku: "CHK-001", barcode: null, description: null, price: 55.0, costPrice: 25, categoryId: "desserts", imageUrl: null, isActive: true, trackInventory: true, stockQuantity: 20, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "p6", syncedAt: Date.now(), isDirty: false },
  { id: "p7", name: "Ice Cream", sku: "ICE-001", barcode: null, description: null, price: 40.0, costPrice: 15, categoryId: "desserts", imageUrl: null, isActive: true, trackInventory: true, stockQuantity: 0, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "p7", syncedAt: Date.now(), isDirty: false },
  { id: "p8", name: "Combo Meal", sku: "CMB-001", barcode: null, description: null, price: 119.99, costPrice: 55, categoryId: "specials", imageUrl: null, isActive: true, trackInventory: false, stockQuantity: 0, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "p8", syncedAt: Date.now(), isDirty: false },
  { id: "p9", name: "Steak 300g", sku: "STK-300", barcode: null, description: null, price: 169.0, costPrice: 80, categoryId: "food", imageUrl: null, isActive: true, trackInventory: true, stockQuantity: 30, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "p9", syncedAt: Date.now(), isDirty: false },
  { id: "p10", name: "Coffee", sku: "COF-001", barcode: null, description: null, price: 32.0, costPrice: 8, categoryId: "drinks", imageUrl: null, isActive: true, trackInventory: false, stockQuantity: 0, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "p10", syncedAt: Date.now(), isDirty: false },
  { id: "p11", name: "Milkshake", sku: "MLK-001", barcode: null, description: null, price: 45.0, costPrice: 18, categoryId: "drinks", imageUrl: null, isActive: true, trackInventory: true, stockQuantity: 80, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "p11", syncedAt: Date.now(), isDirty: false },
  { id: "p12", name: "Salad Bowl", sku: "SLD-001", barcode: null, description: null, price: 75.0, costPrice: 30, categoryId: "food", imageUrl: null, isActive: true, trackInventory: true, stockQuantity: 40, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "p12", syncedAt: Date.now(), isDirty: false },
];

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

interface UseProductsOptions {
  /** Filter by category ID (null = all categories) */
  categoryId?: string | null;
  /** Search query (searches name, SKU, barcode) */
  searchQuery?: string;
  /** Only include active products (default: true) */
  activeOnly?: boolean;
}

interface UseProductsReturn {
  /** Filtered and sorted products */
  products: MobileProduct[];
  /** Whether data is loading */
  loading: boolean;
  /** Error message if data fetch failed */
  error: string | null;
  /** Reload products from database */
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProducts(options: UseProductsOptions = {}): UseProductsReturn {
  const { categoryId = null, searchQuery = "", activeOnly = true } = options;
  const [loading, setLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const products = useMemo(() => {
    let result = MOCK_PRODUCTS;

    // Filter active only
    if (activeOnly) {
      result = result.filter((p) => p.isActive);
    }

    // Filter by category
    if (categoryId && categoryId !== "all") {
      result = result.filter((p) => p.categoryId === categoryId);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.includes(q))
      );
    }

    return result;
  }, [categoryId, searchQuery, activeOnly]);

  const refresh = useCallback(() => {
    // TODO: Reload from WatermelonDB
    setLoading(true);
    setTimeout(() => setLoading(false), 100);
  }, []);

  return { products, loading, error, refresh };
}
