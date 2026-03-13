/**
 * WatermelonDB Setting Model
 *
 * Key-value pairs for local configuration (e.g., tax rate,
 * receipt header, printer settings). Changes are reactive.
 */

import { Model } from "@nozbe/watermelondb";
import { field, text } from "@nozbe/watermelondb/decorators";

export default class Setting extends Model {
  static table = "settings";

  @text("key") key!: string;
  @text("value") value!: string;
  @field("updated_at") updatedAt!: number;
}
