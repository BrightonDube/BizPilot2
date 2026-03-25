/**
 * BizPilot Mobile POS — SmartCartAssistant Service
 *
 * Provides product pairing suggestions based on association rules.
 * These rules are generated server-side (via GPT-4o-mini analysis of
 * historical order data) and cached locally in WatermelonDB.
 *
 * Why association rules instead of real-time ML?
 * 1. POS latency requirement: suggestions must appear in <100ms
 * 2. Offline-first: rules work without network connectivity
 * 3. Privacy: no customer data leaves the device for inference
 * 4. Cost: association rules are computed once daily, not per-request
 *
 * Architecture:
 * - Server generates association rules daily from order history
 * - Rules sync to device via standard sync pipeline
 * - This service loads rules from local cache (WatermelonDB)
 * - When cart changes, getSuggestions() returns relevant products
 * - UI shows a non-intrusive SuggestionBanner at bottom of cart
 *
 * The service is read-only — it NEVER auto-adds items to the cart.
 * This is a safety constraint: POS accuracy is more important than upselling.
 */

import type { CartItem, MobileProduct } from "@/types";
import type { Database } from "@nozbe/watermelondb";
import { Q } from "@nozbe/watermelondb";
import type AssociationRuleModel from "@/db/models/AssociationRule";
import type SuggestionMetricModel from "@/db/models/SuggestionMetric";
import type { SuggestionEventType } from "@/db/models/SuggestionMetric";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A product association rule (e.g., "customers who buy X also buy Y") */
export interface AssociationRule {
  /** Unique rule ID */
  id: string;
  /** Product ID that triggers the suggestion */
  antecedentProductId: string;
  /** Product ID being suggested */
  consequentProductId: string;
  /** Confidence score (0.0–1.0) — how often the pair appears together */
  confidence: number;
  /** Support score (0.0–1.0) — how frequently the antecedent appears */
  support: number;
  /** Lift score — how much more likely the pair is vs random chance */
  lift: number;
  /** When the rule was last computed */
  computedAt: number;
}

/** A suggestion to display to the user */
export interface ProductSuggestion {
  /** The suggested product */
  product: MobileProduct;
  /** Why this product is suggested (human-readable) */
  reason: string;
  /** Confidence score for sorting */
  confidence: number;
  /** The cart item that triggered this suggestion */
  triggeredBy: string;
  /** Compatibility fields */
  productId?: string;
  productName?: string;
}

/** Suggestion metrics for tracking acceptance rate */
export interface SuggestionMetrics {
  /** Total suggestions shown */
  totalShown: number;
  /** Suggestions that were accepted (added to cart) */
  totalAccepted: number;
  /** Suggestions that were dismissed */
  totalDismissed: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Minimum confidence threshold for showing a suggestion */
const MIN_CONFIDENCE = 0.3;

/** Minimum lift threshold (must be > 1.0 to be meaningful) */
const MIN_LIFT = 1.2;

/** Maximum number of suggestions to show at once */
const MAX_SUGGESTIONS = 3;

/** Maximum age of rules before they're considered stale (7 days) */
const MAX_RULE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Smart Cart Assistant
// ---------------------------------------------------------------------------

/**
 * Get product suggestions based on current cart contents.
 *
 * Performance target: <100ms on device.
 * This is achieved by:
 * 1. Pre-loading rules from WatermelonDB into a Map (O(1) lookup)
 * 2. Iterating only over cart items (usually <20)
 * 3. No network calls — all data is local
 *
 * @param cartItems - Current items in the cart
 * @param rules - Association rules loaded from local cache
 * @param availableProducts - Products that can be suggested (in-stock, active)
 * @returns Sorted list of product suggestions (highest confidence first)
 */
export function getSuggestions(
  cartItems: CartItem[],
  rules: AssociationRule[],
  availableProducts: MobileProduct[]
): ProductSuggestion[] {
  if (cartItems.length === 0 || rules.length === 0) return [];

  const now = Date.now();
  const cartProductIds = new Set(cartItems.map((item) => item.productId));
  const productMap = new Map(availableProducts.map((p) => [p.id, p]));

  // Build a lookup: antecedent product ID → rules
  const rulesByAntecedent = new Map<string, AssociationRule[]>();
  for (const rule of rules) {
    // Skip stale rules
    if (now - rule.computedAt > MAX_RULE_AGE_MS) continue;
    // Skip low-quality rules
    if (rule.confidence < MIN_CONFIDENCE || rule.lift < MIN_LIFT) continue;

    const existing = rulesByAntecedent.get(rule.antecedentProductId) ?? [];
    existing.push(rule);
    rulesByAntecedent.set(rule.antecedentProductId, existing);
  }

  // Collect suggestions — deduplicate by consequent product
  const suggestionMap = new Map<string, ProductSuggestion>();

  for (const item of cartItems) {
    const matchingRules = rulesByAntecedent.get(item.productId);
    if (!matchingRules) continue;

    for (const rule of matchingRules) {
      // Don't suggest products already in the cart
      if (cartProductIds.has(rule.consequentProductId)) continue;

      // Don't suggest products that aren't available
      const product = productMap.get(rule.consequentProductId);
      if (!product || !product.isActive) continue;

      // Don't suggest out-of-stock products (if tracking inventory)
      if (product.trackInventory && product.stockQuantity <= 0) continue;

      // Keep the highest-confidence suggestion for each product
      const existing = suggestionMap.get(rule.consequentProductId);
      if (!existing || rule.confidence > existing.confidence) {
        suggestionMap.set(rule.consequentProductId, {
          product,
          reason: `Often ordered with ${item.productName}`,
          confidence: rule.confidence,
          triggeredBy: item.productName,
        });
      }
    }
  }

  // Sort by confidence (highest first) and limit
  return Array.from(suggestionMap.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_SUGGESTIONS);
}

/**
 * Load cached association rules from WatermelonDB for a given business.
 *
 * Queries the local association_rules table — no network call.
 * Runs in O(n_rules) time, typically < 5ms for a few thousand rules.
 *
 * @param database - The WatermelonDB database instance
 * @param businessId - The business to load rules for
 * @returns Array of AssociationRule plain objects, ready for getSuggestions()
 */
export async function loadCachedRules(
  database: Database,
  businessId: string
): Promise<AssociationRule[]> {
  try {
    const records = await database
      .get<AssociationRuleModel>("association_rules")
      .query(Q.where("business_id", businessId))
      .fetch();

    return records.map((record) => ({
      id: record.id,
      antecedentProductId: record.antecedentProductId,
      consequentProductId: record.consequentProductId,
      confidence: record.confidence,
      support: record.support,
      lift: record.lift,
      computedAt: record.computedAt,
    }));
  } catch (error) {
    // Graceful fallback: if the table doesn't exist yet (pre-migration)
    // or any other error, return empty — no suggestions shown.
    console.warn("[SmartCartAssistant] Failed to load cached rules:", error);
    return [];
  }
}

/**
 * Update local rules cache with new rules from the server.
 * Called during sync when new rules are available.
 *
 * Uses WatermelonDB batch write for performance.
 * Deletes old rules for the business and replaces with fresh ones.
 *
 * @param database - The WatermelonDB database instance
 * @param businessId - The business whose rules are being updated
 * @param rules - New rules from the server
 */
export async function updateRulesCache(
  database: Database,
  businessId: string,
  rules: AssociationRule[]
): Promise<void> {
  try {
    const rulesCollection =
      database.get<AssociationRuleModel>("association_rules");

    // Fetch existing rules for this business to delete them
    const existingRules = await rulesCollection
      .query(Q.where("business_id", businessId))
      .fetch();

    const now = Date.now();

    await database.write(async () => {
      const deletes = existingRules.map((r) => r.prepareDestroyPermanently());

      const creates = rules.map((rule) =>
        rulesCollection.prepareCreate((record) => {
          record._raw.id = rule.id;
          record.remoteId = rule.id;
          record.businessId = businessId;
          record.antecedentProductId = rule.antecedentProductId;
          record.consequentProductId = rule.consequentProductId;
          record.confidence = rule.confidence;
          record.support = rule.support;
          record.lift = rule.lift;
          record.computedAt = rule.computedAt;
          record.syncedAt = now;
        })
      );

      await database.batch(...deletes, ...creates);
    });
  } catch (error) {
    console.error("[SmartCartAssistant] Failed to update rules cache:", error);
    // Don't rethrow — a failed cache update is not fatal.
    // Old rules remain; suggestions just won't reflect the latest data.
  }
}

/**
 * Check if the rules cache is stale (older than MAX_RULE_AGE_MS).
 * Used to determine if a sync should prioritize rule updates.
 */
export function isRuleCacheStale(rules: AssociationRule[]): boolean {
  if (rules.length === 0) return true;

  const now = Date.now();
  const newestRule = Math.max(...rules.map((r) => r.computedAt));
  return now - newestRule > MAX_RULE_AGE_MS;
}

// ---------------------------------------------------------------------------
// Cache invalidation (Task 22.3 — sync rules to mobile)
// ---------------------------------------------------------------------------

/**
 * Monotonically increasing version counter for cache invalidation.
 *
 * Why a version counter instead of an EventEmitter?
 * React hooks can cheaply compare `rulesCacheVersion !== lastVersion`
 * on each render to decide whether to reload rules from WatermelonDB.
 * This avoids the complexity of subscription management while keeping
 * the SmartCartAssistant service free of React dependencies.
 */
let _rulesCacheVersion = 0;

/**
 * Signal that the local association rules have been updated during sync.
 *
 * Call this after the pull handler applies new association_rules records.
 * Consumers (e.g., useSuggestions hook) check `getRulesCacheVersion()` and
 * reload from WatermelonDB when it changes.
 */
export function invalidateRulesCache(): void {
  _rulesCacheVersion++;
}

/**
 * Get the current rules cache version.
 * Consumers compare this against their last-loaded version to decide
 * whether to call `loadCachedRules()` again.
 */
export function getRulesCacheVersion(): number {
  return _rulesCacheVersion;
}

// ---------------------------------------------------------------------------
// Metrics tracking
// ---------------------------------------------------------------------------

/**
 * Create initial metrics state.
 */
export function createEmptyMetrics(): SuggestionMetrics {
  return { totalShown: 0, totalAccepted: 0, totalDismissed: 0 };
}

/**
 * Calculate the acceptance rate from metrics.
 * Returns 0 if no suggestions have been shown.
 */
export function getAcceptanceRate(metrics: SuggestionMetrics): number {
  if (metrics.totalShown === 0) return 0;
  return metrics.totalAccepted / metrics.totalShown;
}

// ---------------------------------------------------------------------------
// Suggestion event tracking (Task 24.2–24.3)
// ---------------------------------------------------------------------------

/**
 * Record a suggestion event to the local database.
 *
 * Why append-only event rows instead of updating a counter?
 * Event sourcing is safer in a POS: there are no race conditions,
 * crashes can't corrupt aggregate counts, and we can re-derive
 * metrics for any time window (e.g., "acceptance rate last 7 days").
 *
 * @param database - WatermelonDB instance
 * @param businessId - Current business ID
 * @param eventType - "shown" | "accepted" | "dismissed"
 * @param suggestedProductId - The product ID that was suggested
 * @param triggerProductIds - Comma-separated IDs of cart items that triggered the suggestion
 * @param confidence - The confidence score of the association rule used
 */
export async function trackSuggestionEvent(
  database: Database,
  businessId: string,
  eventType: SuggestionEventType,
  suggestedProductId: string | null,
  triggerProductIds: string[],
  confidence: number
): Promise<void> {
  try {
    await database.write(async () => {
      await database
        .get<SuggestionMetricModel>("suggestion_metrics")
        .create((record) => {
          record.businessId = businessId;
          record.suggestedProductId = suggestedProductId;
          record.triggerProductIds = triggerProductIds.join(",");
          record.eventType = eventType;
          record.confidence = confidence;
          record.occurredAt = Date.now();
          record.syncedAt = null;
        });
    });
  } catch (error) {
    // Non-critical — metrics tracking failure must never disrupt a sale
    console.warn("[SmartCartAssistant] Failed to track suggestion event:", error);
  }
}

/**
 * Get suggestion metrics aggregated for a business.
 *
 * Returns counts for shown/accepted/dismissed events.
 * For large datasets, pass a `sinceMs` timestamp to limit the query.
 *
 * @param database - WatermelonDB instance
 * @param businessId - Business to aggregate for
 * @param sinceMs - Optional: only include events after this timestamp
 */
export async function getAggregatedMetrics(
  database: Database,
  businessId: string,
  sinceMs?: number
): Promise<SuggestionMetrics> {
  try {
    const conditions = [Q.where("business_id", businessId)];
    if (sinceMs !== undefined) {
      conditions.push(Q.where("occurred_at", Q.gte(sinceMs)));
    }

    const events = await database
      .get<SuggestionMetricModel>("suggestion_metrics")
      .query(...conditions)
      .fetch();

    return events.reduce(
      (acc, event) => {
        if (event.eventType === "shown") acc.totalShown += 1;
        else if (event.eventType === "accepted") acc.totalAccepted += 1;
        else if (event.eventType === "dismissed") acc.totalDismissed += 1;
        return acc;
      },
      createEmptyMetrics()
    );
  } catch {
    // Graceful fallback — return empty metrics rather than crashing
    return createEmptyMetrics();
  }
}
