/**
 * WatermelonDB Product Model
 *
 * Represents a product in the local offline database.
 * Includes sync metadata for offline-first operation.
 */

import { Model } from "@nozbe/watermelondb";
import { field, text, date, readonly, nochange } from "@nozbe/watermelondb/decorators";

export default class Product extends Model {
  static table = "products";

  /** Server-side UUID — used to correlate local and remote records */
  @text("remote_id") remoteId!: string;
  @text("name") name!: string;
  @text("sku") sku!: string | null;
  @text("barcode") barcode!: string | null;
  @text("description") description!: string | null;
  @field("price") price!: number;
  @field("cost_price") costPrice!: number | null;
  @text("category_id") categoryId!: string;
  @text("image_url") imageUrl!: string | null;
  @field("is_active") isActive!: boolean;
  @field("track_inventory") trackInventory!: boolean;
  @field("stock_quantity") stockQuantity!: number;
  @field("created_at") createdAt!: number;
  @field("updated_at") updatedAt!: number;
  @field("synced_at") syncedAt!: number | null;
  @field("is_dirty") isDirty!: boolean;
}
