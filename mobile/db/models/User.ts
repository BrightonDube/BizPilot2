/**
 * WatermelonDB User Model
 *
 * POS operators. Includes pin_hash for offline PIN authentication.
 * Users are pulled from the server and cached locally.
 */

import { Model } from "@nozbe/watermelondb";
import { field, text } from "@nozbe/watermelondb/decorators";

export default class User extends Model {
  static table = "users";

  @text("remote_id") remoteId!: string;
  @text("email") email!: string;
  @text("first_name") firstName!: string;
  @text("last_name") lastName!: string;
  @text("pin_hash") pinHash!: string | null;
  @text("role") role!: string;
  @field("is_active") isActive!: boolean;
  @field("created_at") createdAt!: number;
  @field("updated_at") updatedAt!: number;
  @field("synced_at") syncedAt!: number | null;
}
