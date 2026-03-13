/**
 * BizPilot Mobile POS — SmartCartAssistant Tests
 *
 * Tests for product suggestion engine.
 * Verifies rule filtering, scoring, and edge cases.
 */

import {
  getSuggestions,
  isRuleCacheStale,
  createEmptyMetrics,
  getAcceptanceRate,
} from "@/services/SmartCartAssistant";
import type { AssociationRule, SuggestionMetrics } from "@/services/SmartCartAssistant";
import type { CartItem, MobileProduct } from "@/types";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const NOW = Date.now();

function makeProduct(id: string, name: string, overrides?: Partial<MobileProduct>): MobileProduct {
  return {
    id,
    name,
    sku: null,
    barcode: null,
    description: null,
    price: 50,
    costPrice: null,
    categoryId: "cat-1",
    imageUrl: null,
    isActive: true,
    trackInventory: true,
    stockQuantity: 100,
    createdAt: NOW,
    updatedAt: NOW,
    remoteId: id,
    syncedAt: NOW,
    isDirty: false,
    ...overrides,
  };
}

const PRODUCTS: MobileProduct[] = [
  makeProduct("burger", "Burger"),
  makeProduct("fries", "Fries"),
  makeProduct("drink", "Drink"),
  makeProduct("dessert", "Dessert"),
  makeProduct("salad", "Salad"),
  makeProduct("inactive", "Inactive Item", { isActive: false }),
  makeProduct("oos", "Out of Stock", { stockQuantity: 0 }),
];

function makeRule(
  antecedent: string,
  consequent: string,
  confidence: number,
  overrides?: Partial<AssociationRule>
): AssociationRule {
  return {
    id: `rule-${antecedent}-${consequent}`,
    antecedentProductId: antecedent,
    consequentProductId: consequent,
    confidence,
    support: 0.5,
    lift: 2.0,
    computedAt: NOW - 1000, // Recently computed
    ...overrides,
  };
}

const RULES: AssociationRule[] = [
  makeRule("burger", "fries", 0.8),       // High confidence: burger → fries
  makeRule("burger", "drink", 0.6),       // Medium confidence: burger → drink
  makeRule("burger", "dessert", 0.4),     // Lower confidence: burger → dessert
  makeRule("fries", "drink", 0.7),        // fries → drink
  makeRule("drink", "dessert", 0.5),      // drink → dessert
];

const CART_WITH_BURGER: CartItem[] = [
  {
    productId: "burger",
    productName: "Burger",
    quantity: 1,
    unitPrice: 89.99,
    discount: 0,
    notes: null,
  },
];

const CART_WITH_BURGER_AND_FRIES: CartItem[] = [
  ...CART_WITH_BURGER,
  {
    productId: "fries",
    productName: "Fries",
    quantity: 1,
    unitPrice: 35.0,
    discount: 0,
    notes: null,
  },
];

// ---------------------------------------------------------------------------
// Tests: getSuggestions
// ---------------------------------------------------------------------------

describe("getSuggestions", () => {
  it("returns suggestions based on cart contents", () => {
    const suggestions = getSuggestions(CART_WITH_BURGER, RULES, PRODUCTS);
    
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(3); // MAX_SUGGESTIONS
  });

  it("sorts suggestions by confidence (highest first)", () => {
    const suggestions = getSuggestions(CART_WITH_BURGER, RULES, PRODUCTS);
    
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(
        suggestions[i].confidence
      );
    }
  });

  it("does not suggest products already in cart", () => {
    const suggestions = getSuggestions(CART_WITH_BURGER_AND_FRIES, RULES, PRODUCTS);
    
    const suggestedIds = suggestions.map((s) => s.product.id);
    expect(suggestedIds).not.toContain("burger");
    expect(suggestedIds).not.toContain("fries");
  });

  it("returns empty array for empty cart", () => {
    const suggestions = getSuggestions([], RULES, PRODUCTS);
    expect(suggestions).toHaveLength(0);
  });

  it("returns empty array for empty rules", () => {
    const suggestions = getSuggestions(CART_WITH_BURGER, [], PRODUCTS);
    expect(suggestions).toHaveLength(0);
  });

  it("does not suggest inactive products", () => {
    const rulesWithInactive: AssociationRule[] = [
      makeRule("burger", "inactive", 0.9), // High confidence but inactive product
    ];
    const suggestions = getSuggestions(CART_WITH_BURGER, rulesWithInactive, PRODUCTS);
    
    const suggestedIds = suggestions.map((s) => s.product.id);
    expect(suggestedIds).not.toContain("inactive");
  });

  it("does not suggest out-of-stock products", () => {
    const rulesWithOOS: AssociationRule[] = [
      makeRule("burger", "oos", 0.9), // High confidence but out of stock
    ];
    const suggestions = getSuggestions(CART_WITH_BURGER, rulesWithOOS, PRODUCTS);
    
    const suggestedIds = suggestions.map((s) => s.product.id);
    expect(suggestedIds).not.toContain("oos");
  });

  it("skips stale rules (older than 7 days)", () => {
    const staleRules: AssociationRule[] = [
      makeRule("burger", "fries", 0.9, {
        computedAt: NOW - 8 * 24 * 60 * 60 * 1000, // 8 days old
      }),
    ];
    const suggestions = getSuggestions(CART_WITH_BURGER, staleRules, PRODUCTS);
    expect(suggestions).toHaveLength(0);
  });

  it("skips low-confidence rules (below 0.3)", () => {
    const lowConfidenceRules: AssociationRule[] = [
      makeRule("burger", "fries", 0.2), // Below threshold
    ];
    const suggestions = getSuggestions(CART_WITH_BURGER, lowConfidenceRules, PRODUCTS);
    expect(suggestions).toHaveLength(0);
  });

  it("skips low-lift rules (below 1.2)", () => {
    const lowLiftRules: AssociationRule[] = [
      makeRule("burger", "fries", 0.8, { lift: 1.0 }), // Lift too low
    ];
    const suggestions = getSuggestions(CART_WITH_BURGER, lowLiftRules, PRODUCTS);
    expect(suggestions).toHaveLength(0);
  });

  it("includes triggeredBy information", () => {
    const suggestions = getSuggestions(CART_WITH_BURGER, RULES, PRODUCTS);
    
    for (const suggestion of suggestions) {
      expect(suggestion.triggeredBy).toBe("Burger");
    }
  });

  it("includes human-readable reason", () => {
    const suggestions = getSuggestions(CART_WITH_BURGER, RULES, PRODUCTS);
    
    for (const suggestion of suggestions) {
      expect(suggestion.reason).toContain("Often ordered with");
    }
  });

  it("limits to MAX_SUGGESTIONS (3)", () => {
    // Add many rules to exceed limit
    const manyRules: AssociationRule[] = [
      makeRule("burger", "fries", 0.9),
      makeRule("burger", "drink", 0.8),
      makeRule("burger", "dessert", 0.7),
      makeRule("burger", "salad", 0.6),
    ];
    const suggestions = getSuggestions(CART_WITH_BURGER, manyRules, PRODUCTS);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it("keeps highest confidence when multiple rules suggest same product", () => {
    // Two different cart items both suggest "drink"
    const cart: CartItem[] = [
      { productId: "burger", productName: "Burger", quantity: 1, unitPrice: 50, discount: 0, notes: null },
      { productId: "fries", productName: "Fries", quantity: 1, unitPrice: 30, discount: 0, notes: null },
    ];
    const rules: AssociationRule[] = [
      makeRule("burger", "drink", 0.6),
      makeRule("fries", "drink", 0.7),
    ];
    const suggestions = getSuggestions(cart, rules, PRODUCTS);

    const drinkSuggestion = suggestions.find((s) => s.product.id === "drink");
    expect(drinkSuggestion).toBeDefined();
    expect(drinkSuggestion!.confidence).toBe(0.7); // Higher confidence wins
  });
});

// ---------------------------------------------------------------------------
// Tests: isRuleCacheStale
// ---------------------------------------------------------------------------

describe("isRuleCacheStale", () => {
  it("returns true for empty rules", () => {
    expect(isRuleCacheStale([])).toBe(true);
  });

  it("returns false for recent rules", () => {
    const recentRules: AssociationRule[] = [
      makeRule("a", "b", 0.5, { computedAt: NOW - 1000 }),
    ];
    expect(isRuleCacheStale(recentRules)).toBe(false);
  });

  it("returns true for old rules", () => {
    const oldRules: AssociationRule[] = [
      makeRule("a", "b", 0.5, { computedAt: NOW - 8 * 24 * 60 * 60 * 1000 }),
    ];
    expect(isRuleCacheStale(oldRules)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Metrics
// ---------------------------------------------------------------------------

describe("Suggestion metrics", () => {
  it("creates empty metrics", () => {
    const metrics = createEmptyMetrics();
    expect(metrics.totalShown).toBe(0);
    expect(metrics.totalAccepted).toBe(0);
    expect(metrics.totalDismissed).toBe(0);
  });

  it("calculates acceptance rate", () => {
    const metrics: SuggestionMetrics = {
      totalShown: 100,
      totalAccepted: 25,
      totalDismissed: 75,
    };
    expect(getAcceptanceRate(metrics)).toBe(0.25);
  });

  it("returns 0 acceptance rate for no shown suggestions", () => {
    const metrics = createEmptyMetrics();
    expect(getAcceptanceRate(metrics)).toBe(0);
  });
});
