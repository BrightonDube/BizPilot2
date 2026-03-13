/**
 * WatermelonDB OrderItem Model
 *
 * A line item within an order. Stores denormalized product_name
 * so orders remain readable even if the product is later deleted.
 */

import { Model } from "@nozbe/watermelondb";
import { field, text, relation } from "@nozbe/watermelondb/decorators";

export default class OrderItem extends Model {
  static table = "order_items";

  static associations = {
    orders: { type: "belongs_to" as const, key: "order_id" },
  };

  @text("remote_id") remoteId!: string | null;
  @text("order_id") orderId!: string;
  @text("product_id") productId!: string;
  @text("product_name") productName!: string;
  @field("quantity") quantity!: number;
  @field("unit_price") unitPrice!: number;
  @field("discount") discount!: number;
  @field("total") total!: number;
  @text("notes") notes!: string | null;
  @field("created_at") createdAt!: number;
  @field("synced_at") syncedAt!: number | null;
  @field("is_dirty") isDirty!: boolean;

  @relation("orders", "order_id") order: any;
}
