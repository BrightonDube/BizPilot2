/**
 * WatermelonDB model for product–tag associations.
 *
 * Represents the many-to-many link between products and tags.
 * assignment_source tracks how the tag was applied:
 * "manual" | "import" | "auto_rule" | "ai_suggestion"
 *
 * This is critical for the offline POS because staff tagging products
 * (e.g. marking a dish as "Vegan") during stock intake must work
 * without network access.
 */

import { Model } from "@nozbe/watermelondb";
import { field, date, readonly, text } from "@nozbe/watermelondb/decorators";

export default class ProductTag extends Model {
  static table = "product_tags";

  @text("remote_id") remoteId!: string | null;
  @text("product_id") productId!: string;
  @text("tag_id") tagId!: string;
  @text("assigned_by") assignedBy!: string;
  @field("assigned_at") assignedAt!: number;
  @text("assignment_source") assignmentSource!: string;
  @field("synced_at") syncedAt!: number | null;
  @field("is_dirty") isDirty!: boolean;
}
