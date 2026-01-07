/**
 * Payment API client for subscription checkout.
 */

import { apiClient } from './api';

export interface InitiateCheckoutResponse {
  reference: string;
  authorization_url: string;
  access_code: string;
}

export interface VerifyPaymentResponse {
  status: 'success' | 'failed' | 'pending';
  message: string;
  tier?: string;
}

export const paymentApi = {
  // Initiate checkout for a paid tier
  async initiateCheckout(
    tierId: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<InitiateCheckoutResponse> {
    const { data } = await apiClient.post('/payments/checkout/initiate', {
      tier_id: tierId,
      billing_cycle: billingCycle,
    });
    return data;
  },

  // Verify payment after callback
  async verifyPayment(reference: string): Promise<VerifyPaymentResponse> {
    const { data } = await apiClient.post('/payments/checkout/verify', {
      reference,
    });
    return data;
  },
};

export default paymentApi;
