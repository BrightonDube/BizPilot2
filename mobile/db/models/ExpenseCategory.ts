/**
 * WatermelonDB model for expense categories.
 *
 * Categories classify petty cash expenses (e.g. "Office Supplies",
 * "Cleaning", "Transport"). Synced from the server and cached
 * locally so staff can select a category when recording expenses offline.
 */

import { Model } from "@nozbe/watermelondb";
import { field, date, readonly, text } from "@nozbe/watermelondb/decorators";

export default class ExpenseCategory extends Model {
  static table = "expense_categories";

  @text("remote_id") remoteId!: string;
  @text("business_id") businessId!: string;
  @text("name") name!: string;
  @text("description") description!: string | null;
  @text("gl_account_code") glAccountCode!: string | null;
  @field("is_active") isActive!: boolean;
  @readonly @date("created_at") createdAt!: Date;
  @date("updated_at") updatedAt!: Date;
  @field("synced_at") syncedAt!: number | null;
  @field("is_dirty") isDirty!: boolean;
}
