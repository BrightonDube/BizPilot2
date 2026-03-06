/**
 * WatermelonDB model for tag categories.
 *
 * Tag categories group related tags (e.g. "Dietary" → Vegan, Halal;
 * "Allergens" → Nuts, Dairy). Persisted locally so staff can browse
 * and assign tags to products even when offline.
 */

import { Model } from "@nozbe/watermelondb";
import { field, date, readonly, text } from "@nozbe/watermelondb/decorators";

export default class TagCategory extends Model {
  static table = "tag_categories";

  @text("remote_id") remoteId!: string;
  @text("business_id") businessId!: string;
  @text("name") name!: string;
  @text("slug") slug!: string;
  @text("description") description!: string | null;
  @text("color") color!: string | null;
  @text("icon") icon!: string | null;
  @field("sort_order") sortOrder!: number;
  @field("is_active") isActive!: boolean;
  @readonly @date("created_at") createdAt!: Date;
  @date("updated_at") updatedAt!: Date;
  @field("synced_at") syncedAt!: number | null;
  @field("is_dirty") isDirty!: boolean;
}
