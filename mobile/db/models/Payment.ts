/**
 * WatermelonDB Payment Model
 *
 * Records an individual payment line against an order.
 * An order may have multiple Payment records (split payments).
 *
 * Why a separate Payment model rather than embedding in Order?
 * - Supports split payments (cash + card) cleanly
 * - Enables per-payment status tracking (pending, completed, refunded)
 * - Allows multiple payment methods with their own amount and status
 * - Keeps Order model lean; payment detail lives here
 */

import { Model } from "@nozbe/watermelondb";
import { field, text, relation } from "@nozbe/watermelondb/decorators";

export default class Payment extends Model {
  static table = "payments";

  /**
   * Link back to the parent order.
   * Why belongsTo? Watermelon relation gives us order.payments reactivity.
   */
  static associations = {
    orders: { type: "belongs_to" as const, key: "order_id" },
  };

  /** Server UUID — null until synced */
  @text("remote_id") remoteId!: string | null;

  /** The order this payment belongs to (local WatermelonDB ID) */
  @text("order_id") orderId!: string;

  /**
   * Payment method used.
   * Values: "cash" | "card" | "eft" | "room_charge"
   */
  @text("payment_method") paymentMethod!: string;

  /** Amount tendered for this payment line */
  @field("amount") amount!: number;

  /**
   * For cash payments: the amount of cash given by the customer.
   * Change = cashTendered - amount.
   * Null for non-cash methods.
   */
  @field("cash_tendered") cashTendered!: number | null;

  /**
   * Payment status lifecycle:
   * "pending" → "completed" → "refunded"
   */
  @text("status") status!: string;

  /** Optional reference/receipt number from payment terminal */
  @text("reference") reference!: string | null;

  /** ISO timestamp of when this payment was processed */
  @field("processed_at") processedAt!: number | null;

  /** True if local changes are pending sync to server */
  @field("is_dirty") isDirty!: boolean;

  /** When this record was last successfully synced */
  @field("synced_at") syncedAt!: number | null;

  @field("created_at") createdAt!: number;
  @field("updated_at") updatedAt!: number;
}
