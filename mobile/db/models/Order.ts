/**
 * WatermelonDB Order Model
 *
 * Represents a sales transaction. Orders created offline have
 * remote_id = null until synced with the server.
 */

import { Model } from "@nozbe/watermelondb";
import { field, text, children } from "@nozbe/watermelondb/decorators";

export default class Order extends Model {
  static table = "orders";

  // Why children association?
  // Allows order.orderItems to reactively query all items for this order.
  static associations = {
    order_items: { type: "has_many" as const, foreignKey: "order_id" },
  };

  @text("remote_id") remoteId!: string | null;
  @text("order_number") orderNumber!: string;
  @text("customer_id") customerId!: string | null;
  @text("status") status!: string;
  @field("subtotal") subtotal!: number;
  @field("tax_amount") taxAmount!: number;
  @field("discount_amount") discountAmount!: number;
  @field("total") total!: number;
  @text("payment_method") paymentMethod!: string | null;
  @text("payment_status") paymentStatus!: string;
  @text("notes") notes!: string | null;
  @text("created_by") createdBy!: string;
  @field("created_at") createdAt!: number;
  @field("updated_at") updatedAt!: number;
  @field("synced_at") syncedAt!: number | null;
  @field("is_dirty") isDirty!: boolean;

  @children("order_items") orderItems: any;
}
