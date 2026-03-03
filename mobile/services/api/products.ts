/**
 * BizPilot Mobile POS — Products API Module
 *
 * API calls for product catalog operations.
 */

import apiClient, { withRetry } from "./client";
import type { ApiListResponse } from "@/types";

interface ProductApiResponse {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  selling_price: number;
  cost_price: number | null;
  category_id: string | null;
  image_url: string | null;
  is_active: boolean;
  track_inventory: boolean;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch products with pagination and optional search.
 * Uses retry logic for resilience during poor connectivity.
 */
export async function fetchProducts(params: {
  page?: number;
  per_page?: number;
  search?: string;
  category_id?: string;
  since?: string;
}): Promise<ApiListResponse<ProductApiResponse>> {
  return withRetry(async () => {
    const response = await apiClient.get("/api/products", { params });
    return response.data;
  });
}

/**
 * Fetch a single product by ID.
 */
export async function fetchProduct(id: string): Promise<ProductApiResponse> {
  return withRetry(async () => {
    const response = await apiClient.get(`/api/products/${id}`);
    return response.data;
  });
}
