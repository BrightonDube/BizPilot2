/**
 * WatermelonDB model for petty cash expense records.
 *
 * Supports offline expense creation — staff can record expenses
 * against a fund while offline. The expense syncs to the server
 * when connectivity resumes. Status transitions (pending → approved →
 * disbursed) are tracked locally and reconciled during sync.
 */

import { Model } from "@nozbe/watermelondb";
import { field, date, readonly, text } from "@nozbe/watermelondb/decorators";

export default class PettyCashExpense extends Model {
  static table = "petty_cash_expenses";

  @text("remote_id") remoteId!: string | null;
  @text("fund_id") fundId!: string;
  @text("business_id") businessId!: string;
  @text("category_id") categoryId!: string;
  @text("requested_by_id") requestedById!: string;
  @text("approved_by_id") approvedById!: string | null;
  @field("amount") amount!: number;
  @text("description") description!: string;
  @text("vendor") vendor!: string | null;
  @text("receipt_number") receiptNumber!: string | null;
  @text("receipt_image_url") receiptImageUrl!: string | null;
  @field("expense_date") expenseDate!: number;
  @text("status") status!: string;
  @text("rejection_reason") rejectionReason!: string | null;
  @readonly @date("created_at") createdAt!: Date;
  @date("updated_at") updatedAt!: Date;
  @field("synced_at") syncedAt!: number | null;
  @field("is_dirty") isDirty!: boolean;
}
