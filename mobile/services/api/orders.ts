/**
 * BizPilot Mobile POS — Orders API Module
 *
 * API calls for order management and sync.
 */

import apiClient, { withRetry } from "./client";
import type { ApiListResponse } from "@/types";

interface OrderApiResponse {
  id: string;
  order_number: string;
  customer_id: string | null;
  status: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  payment_method: string | null;
  payment_status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    discount: number;
    total: number;
  }>;
}

interface CreateOrderRequest {
  customer_id?: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    discount?: number;
    notes?: string;
  }>;
  discount_amount?: number;
  notes?: string;
  payment_method?: string;
}

/**
 * Fetch orders with pagination.
 */
export async function fetchOrders(params: {
  page?: number;
  per_page?: number;
  status?: string;
  since?: string;
}): Promise<ApiListResponse<OrderApiResponse>> {
  return withRetry(async () => {
    const response = await apiClient.get("/api/orders", { params });
    return response.data;
  });
}

/**
 * Create a new order on the server.
 * Used during sync to push locally-created orders.
 */
export async function createOrderApi(
  order: CreateOrderRequest
): Promise<OrderApiResponse> {
  return withRetry(async () => {
    const response = await apiClient.post("/api/orders", order);
    return response.data;
  });
}

/**
 * Fetch a single order by ID.
 */
export async function fetchOrder(id: string): Promise<OrderApiResponse> {
  return withRetry(async () => {
    const response = await apiClient.get(`/api/orders/${id}`);
    return response.data;
  });
}
