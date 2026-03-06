/**
 * WatermelonDB model for petty cash funds.
 *
 * Stores cash float records locally for offline access.
 * Staff can view fund balances and record expenses even when
 * the network is unavailable. Changes sync on reconnection.
 */

import { Model } from "@nozbe/watermelondb";
import { field, date, readonly, text } from "@nozbe/watermelondb/decorators";

export default class PettyCashFund extends Model {
  static table = "petty_cash_funds";

  @text("remote_id") remoteId!: string;
  @text("business_id") businessId!: string;
  @text("name") name!: string;
  @field("initial_amount") initialAmount!: number;
  @field("current_balance") currentBalance!: number;
  @text("custodian_id") custodianId!: string;
  @text("status") status!: string;
  @readonly @date("created_at") createdAt!: Date;
  @date("updated_at") updatedAt!: Date;
  @field("synced_at") syncedAt!: number | null;
  @field("is_dirty") isDirty!: boolean;
}
