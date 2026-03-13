/**
 * BizPilot Mobile POS — Customers API Module
 *
 * API calls for customer lookup and management.
 */

import apiClient, { withRetry } from "./client";
import type { ApiListResponse } from "@/types";

interface CustomerApiResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  loyalty_points: number;
  total_spent: number;
  visit_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch customers with pagination and search.
 */
export async function fetchCustomers(params: {
  page?: number;
  per_page?: number;
  search?: string;
  since?: string;
}): Promise<ApiListResponse<CustomerApiResponse>> {
  return withRetry(async () => {
    const response = await apiClient.get("/api/customers", { params });
    return response.data;
  });
}

/**
 * Fetch a single customer by ID.
 */
export async function fetchCustomer(
  id: string
): Promise<CustomerApiResponse> {
  return withRetry(async () => {
    const response = await apiClient.get(`/api/customers/${id}`);
    return response.data;
  });
}
