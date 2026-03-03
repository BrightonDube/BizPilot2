/**
 * WatermelonDB Customer Model
 *
 * Customers with loyalty points and visit tracking.
 */

import { Model } from "@nozbe/watermelondb";
import { field, text } from "@nozbe/watermelondb/decorators";

export default class Customer extends Model {
  static table = "customers";

  @text("remote_id") remoteId!: string;
  @text("name") name!: string;
  @text("email") email!: string | null;
  @text("phone") phone!: string | null;
  @text("address") address!: string | null;
  @text("notes") notes!: string | null;
  @field("loyalty_points") loyaltyPoints!: number;
  @field("total_spent") totalSpent!: number;
  @field("visit_count") visitCount!: number;
  @field("created_at") createdAt!: number;
  @field("updated_at") updatedAt!: number;
  @field("synced_at") syncedAt!: number | null;
  @field("is_dirty") isDirty!: boolean;
}
