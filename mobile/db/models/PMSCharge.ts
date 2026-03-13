/**
 * WatermelonDB PMS Charge Model
 *
 * Represents a room charge posted (or pending) to a hotel PMS.
 * Persists locally for offline resilience — charges survive app
 * restarts and are synced when connectivity resumes.
 */

import { Model } from "@nozbe/watermelondb";
import { field, text, readonly } from "@nozbe/watermelondb/decorators";

export default class PMSCharge extends Model {
  static table = "pms_charges";

  @text("remote_id") remoteId!: string | null;
  @text("guest_id") guestId!: string;
  @text("room_number") roomNumber!: string;
  @text("guest_name") guestName!: string;
  @field("amount") amount!: number;
  @text("description") description!: string;
  @text("terminal_id") terminalId!: string;
  @text("operator_id") operatorId!: string;
  @text("status") status!: string;
  @text("pms_reference") pmsReference!: string | null;
  @text("authorization_type") authorizationType!: string | null;
  @text("signature_data") signatureData!: string | null;
  @text("order_id") orderId!: string | null;
  @field("attempts") attempts!: number;
  @text("last_error") lastError!: string | null;
  @field("posted_at") postedAt!: number | null;
  @field("created_at") createdAt!: number;
  @field("synced_at") syncedAt!: number | null;
}
