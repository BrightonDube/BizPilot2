/**
 * WatermelonDB AssociationRule Model
 *
 * Represents a product association rule cached locally for offline-first
 * smart cart suggestions. Rules are generated server-side (GPT-4o-mini
 * analysis of historical order data) and synced to the device daily.
 *
 * Why a dedicated WatermelonDB table for association rules?
 * - Rules need to survive app restarts (offline-first)
 * - WatermelonDB reactive queries let the UI update when new rules arrive
 * - Keeps suggestion logic O(1) lookup from a Map, not a network call
 * - Aligns with the "local cache, sync on connect" architecture
 *
 * Table: association_rules (added in schema version 2)
 */

import { Model } from "@nozbe/watermelondb";
import { text, field, readonly } from "@nozbe/watermelondb/decorators";

export default class AssociationRule extends Model {
  static table = "association_rules";

  /** Server-side UUID for syncing */
  @text("remote_id") remoteId!: string;

  /** Business this rule belongs to — rules are per-business */
  @text("business_id") businessId!: string;

  /** Product ID that triggers the suggestion (the "if you buy X..." part) */
  @text("antecedent_product_id") antecedentProductId!: string;

  /** Product ID to suggest (the "...also buy Y" part) */
  @text("consequent_product_id") consequentProductId!: string;

  /**
   * Confidence: probability of buying Y given X is in the cart.
   * Range: 0.0–1.0. We only show suggestions above MIN_CONFIDENCE (0.3).
   */
  @field("confidence") confidence!: number;

  /**
   * Support: how frequently the pair appears in all transactions.
   * Range: 0.0–1.0. Low support means the rule has a thin evidence base.
   */
  @field("support") support!: number;

  /**
   * Lift: how much more likely the pair is compared to random chance.
   * Values > 1.0 indicate a genuine association. We require lift > 1.2.
   */
  @field("lift") lift!: number;

  /** Unix timestamp (ms) when the server last computed this rule */
  @field("computed_at") computedAt!: number;

  /** Unix timestamp (ms) when this record was last synced from the server */
  @field("synced_at") syncedAt!: number | null;
}
