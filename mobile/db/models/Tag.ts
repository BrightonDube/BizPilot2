/**
 * WatermelonDB model for individual tags.
 *
 * Supports hierarchical tags (parent_tag_id) and auto-apply rules
 * stored as a JSON string in auto_apply_rules. Tags are cached locally
 * to allow instant product tagging on the POS without a round-trip.
 */

import { Model } from "@nozbe/watermelondb";
import { field, date, readonly, text } from "@nozbe/watermelondb/decorators";

export default class Tag extends Model {
  static table = "tags";

  @text("remote_id") remoteId!: string;
  @text("business_id") businessId!: string;
  @text("category_id") categoryId!: string;
  @text("parent_tag_id") parentTagId!: string | null;
  @text("name") name!: string;
  @text("slug") slug!: string;
  @text("description") description!: string | null;
  @text("color") color!: string | null;
  @field("hierarchy_level") hierarchyLevel!: number;
  @text("hierarchy_path") hierarchyPath!: string | null;
  @field("usage_count") usageCount!: number;
  @field("is_system_tag") isSystemTag!: boolean;
  @field("is_active") isActive!: boolean;
  @text("auto_apply_rules") autoApplyRules!: string | null;
  @readonly @date("created_at") createdAt!: Date;
  @date("updated_at") updatedAt!: Date;
  @field("synced_at") syncedAt!: number | null;
  @field("is_dirty") isDirty!: boolean;
}
