/**
 * WatermelonDB SuggestionMetric Model (Task 24.1)
 *
 * Persists per-business AI suggestion metrics to the local database.
 * Each row represents one suggestion event — either shown, accepted,
 * or dismissed. Aggregating these rows gives the acceptance rate.
 *
 * Why event-sourced rows instead of a single running counter?
 * - Individual events can be re-aggregated (e.g., "last 30 days")
 * - Easy to sync to the server for analytics dashboards
 * - Counters can drift on crash; events are append-only and safe
 * - Aligns with the POS "audit trail" philosophy
 *
 * Why not just use the Zustand store?
 * Zustand state is ephemeral across app reinstalls. Metrics need to
 * survive reinstalls so the acceptance rate report is accurate over time.
 *
 * Table: suggestion_metrics (added in schema version 3)
 */

import { Model } from "@nozbe/watermelondb";
import { text, field, readonly } from "@nozbe/watermelondb/decorators";

export type SuggestionEventType = "shown" | "accepted" | "dismissed";

export default class SuggestionMetric extends Model {
  static table = "suggestion_metrics";

  /** Business this event belongs to */
  @text("business_id") businessId!: string;

  /**
   * The product that was suggested.
   * Null if the suggestion was a bundle (multi-product) suggestion.
   */
  @text("suggested_product_id") suggestedProductId!: string | null;

  /** The product(s) that triggered the suggestion (antecedent) */
  @text("trigger_product_ids") triggerProductIds!: string;

  /**
   * Type of event:
   * - "shown"     → suggestion appeared in the banner
   * - "accepted"  → staff tapped "Add" and product was added to cart
   * - "dismissed" → staff tapped "×" to dismiss the suggestion
   */
  @text("event_type") eventType!: SuggestionEventType;

  /** Confidence score of the association rule that generated this suggestion */
  @field("confidence") confidence!: number;

  /** Unix timestamp (ms) of when this event occurred */
  @field("occurred_at") occurredAt!: number;

  /**
   * Whether this event has been synced to the server.
   * Used by the sync engine to prioritize metric uploads.
   */
  @field("synced_at") syncedAt!: number | null;
}
