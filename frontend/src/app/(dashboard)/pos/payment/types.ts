/**
 * types.ts — Payment interfaces for the POS payment screen
 */

export type PaymentMethodType = 'cash' | 'card' | 'eft' | 'split';

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  icon?: string;
  is_active: boolean;
}

export interface TenderLine {
  id: string;
  method_id: string;
  method_name: string;
  method_type: PaymentMethodType;
  amount: number;
  reference?: string;
}

export interface PaymentState {
  order_id?: string;
  total_due: number;
  total_tendered: number;
  balance_remaining: number;
  change_due: number;
  tender_lines: TenderLine[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface PaymentResult {
  success: boolean;
  transaction_id?: string;
  order_id?: string;
  error?: string;
}
