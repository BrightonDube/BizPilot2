/**
 * WatermelonDB Category Model
 *
 * Product categories shown as filter tabs in the POS grid.
 * Categories support a parent_id for nested hierarchies.
 */

import { Model } from "@nozbe/watermelondb";
import { field, text } from "@nozbe/watermelondb/decorators";

export default class Category extends Model {
  static table = "categories";

  @text("remote_id") remoteId!: string;
  @text("name") name!: string;
  @text("color") color!: string | null;
  @text("icon") icon!: string | null;
  @text("parent_id") parentId!: string | null;
  @field("sort_order") sortOrder!: number;
  @field("is_active") isActive!: boolean;
  @field("created_at") createdAt!: number;
  @field("updated_at") updatedAt!: number;
  @field("synced_at") syncedAt!: number | null;
  @field("is_dirty") isDirty!: boolean;
}
