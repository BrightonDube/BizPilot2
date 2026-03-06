/**
 * WatermelonDB PMS Guest Model
 *
 * Cached guest profile from the hotel PMS. Used for offline
 * guest search — when the PMS connection drops, staff can still
 * look up recently accessed guests from local cache.
 *
 * Entries are TTL-based and refreshed on each PMS fetch.
 */

import { Model } from "@nozbe/watermelondb";
import { field, text } from "@nozbe/watermelondb/decorators";

export default class PMSGuest extends Model {
  static table = "pms_guests";

  @text("remote_id") remoteId!: string;
  @text("name") name!: string;
  @text("room_number") roomNumber!: string;
  @field("check_in_date") checkInDate!: number;
  @field("check_out_date") checkOutDate!: number;
  @text("folio_number") folioNumber!: string;
  @field("vip_level") vipLevel!: number;
  @field("is_active") isActive!: boolean;
  @field("can_charge") canCharge!: boolean;
  @field("daily_charge_limit") dailyChargeLimit!: number | null;
  @field("transaction_charge_limit") transactionChargeLimit!: number | null;
  @text("confirmation_number") confirmationNumber!: string | null;
  @field("fetched_at") fetchedAt!: number;
}
