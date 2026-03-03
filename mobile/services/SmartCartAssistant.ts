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
 * Load cached association rules.
 *
 * In the real implementation, this queries WatermelonDB.
 * For now, it returns an empty array — rules will populate
 * once the server-side generation pipeline is built.
 *
 * TODO: Replace with WatermelonDB query:
 *   const rules = await database
 *     .get<AssociationRuleModel>('association_rules')
 *     .query(Q.where('business_id', businessId))
 *     .fetch();
 */
export function loadCachedRules(_businessId: string): AssociationRule[] {
  // Placeholder — returns empty until WatermelonDB integration
  return [];
}

/**
 * Update local rules cache with new rules from the server.
 * Called during sync when new rules are available.
 *
 * TODO: Replace with WatermelonDB batch write:
 *   await database.write(async () => {
 *     const rulesCollection = database.get('association_rules');
 *     const batch = rules.map(rule =>
 *       rulesCollection.prepareCreate(record => {
 *         record._raw.id = rule.id;
 *         ...
 *       })
 *     );
 *     await database.batch(...batch);
 *   });
 */
export function updateRulesCache(
  _businessId: string,
  _rules: AssociationRule[]
): void {
  // Placeholder — no-op until WatermelonDB integration
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
