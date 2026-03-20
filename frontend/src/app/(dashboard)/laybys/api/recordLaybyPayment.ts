/**
 * recordLaybyPayment.ts
 * API function for recording a payment against a layby.
 * Calls POST /api/laybys/{laybyId}/payments using the existing apiClient.
 * Separated from the hook so it can be tested independently.
 */

import { apiClient } from '@/lib/api';
import type { RecordLaybyPaymentRequest, RecordLaybyPaymentResponse } from '../types';

/**
 * Records a payment against a layby.
 * 
 * @param laybyId - The unique identifier of the layby
 * @param payload - Payment details (amount, method, notes)
 * @returns The created payment record
 * @throws Error with API error message on failure
 */
export async function recordLaybyPayment(
  laybyId: string,
  payload: RecordLaybyPaymentRequest
): Promise<RecordLaybyPaymentResponse> {
  try {
    const response = await apiClient.post<RecordLaybyPaymentResponse>(
      `/laybys/${laybyId}/payments`,
      payload
    );
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as {
      response?: {
        data?: {
          detail?: string;
        };
      };
      message?: string;
    };
    
    const errorMessage = axiosError.response?.data?.detail || axiosError.message || 'Failed to record payment';
    throw new Error(errorMessage);
  }
}
