/**
 * This file defines the TypeScript interfaces and types for the Layby Management feature.
 * These types align with the backend API schemas to ensure type safety across the frontend.
 */

/**
 * Valid statuses for a Layby.
 * These match the LaybyStatus enum in the backend.
 */
export type LaybyStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE' | 'READY_FOR_COLLECTION';

/**
 * Represents a single item in a Layby order.
 */
export interface LaybyItem {
  /** Unique identifier for the layby item */
  id: string;
  /** Unique identifier for the product */
  product_id: string;
  /** Name of the product at the time of order */
  product_name: string;
  /** Stock keeping unit of the product */
  product_sku?: string;
  /** Quantity of the product reserved */
  quantity: number;
  /** Unit price of the product at the time of order */
  unit_price: number;
  /** Total discount applied to this item */
  discount_amount: number;
  /** Total tax amount for this item */
  tax_amount: number;
  /** Final total amount for this item (qty * price + tax - discount) */
  total_amount: number;
}

/**
 * Represents a payment record for a Layby.
 */
export interface LaybyPayment {
  /** Unique identifier for the payment */
  id: string;
  /** Payment amount */
  amount: number;
  /** Payment method (cash, card, eft) */
  payment_method: string;
  /** Payment type (deposit, installment, etc.) */
  payment_type: string;
  /** Payment status */
  status: string;
  /** Optional payment reference */
  payment_reference?: string;
  /** Refund amount if applicable */
  refund_amount?: number;
  /** Reason for refund if applicable */
  refund_reason?: string;
  /** When the refund was processed */
  refunded_at?: string;
  /** Optional notes */
  notes?: string;
  /** When the payment was created */
  created_at: string;
}

/**
 * Represents a payment schedule entry for a Layby.
 */
export interface LaybySchedule {
  /** Unique identifier for the schedule entry */
  id: string;
  /** Installment number */
  installment_number: number;
  /** Due date for this installment */
  due_date: string;
  /** Amount due for this installment */
  amount_due: number;
  /** Amount paid for this installment */
  amount_paid: number;
  /** Status of this installment */
  status: string;
}

/**
 * Represents a Layby order in the system.
 */
export interface Layby {
  /** Unique identifier for the layby */
  id: string;
  /** Human-readable reference number (e.g., LB-1001) */
  reference_number: string;
  /** Unique identifier for the customer */
  customer_id: string;
  /** Full name of the customer for display purposes */
  customer_name?: string;
  /** Current lifecycle status of the layby */
  status: LaybyStatus;
  /** Total amount before tax and discounts */
  subtotal: number;
  /** Total tax amount for the entire layby */
  tax_amount: number;
  /** Final total amount the customer must pay */
  total_amount: number;
  /** Initial deposit amount paid by the customer */
  deposit_amount: number;
  /** Total amount paid by the customer to date */
  amount_paid: number;
  /** Outstanding balance remaining to be paid */
  balance_due: number;
  /** How often the customer agreed to make payments (weekly, monthly, etc.) */
  payment_frequency: string;
  /** The date the layby was initiated */
  start_date: string;
  /** The deadline by which the layby must be fully paid */
  end_date: string;
  /** The date the next payment is expected */
  next_payment_date?: string;
  /** The amount expected for the next payment */
  next_payment_amount?: number;
  /** Number of times the end date has been extended */
  extension_count: number;
  /** Optional notes or comments regarding the layby */
  notes?: string;
  /** List of items in this layby */
  items?: LaybyItem[];
  /** Payment schedule for this layby */
  schedules?: LaybySchedule[];
  /** Payment history for this layby */
  payments?: LaybyPayment[];
  /** Timestamp when the layby was created */
  created_at: string;
  /** Timestamp when the layby was last updated */
  updated_at: string;
}

/**
 * Response structure for the paginated layby list endpoint.
 */
export interface LaybyListResponse {
  /** List of layby records for the current page */
  items: Layby[];
  /** Total number of layby records matching the filters */
  total: number;
  /** Current page number */
  page: number;
  /** Number of items per page */
  per_page: number;
  /** Total number of pages available */
  pages: number;
}
