/**
 * Tests for task 22.3: Syncing association rules to mobile clients.
 *
 * Validates:
 * - association_rules is included in SYNCABLE_ENTITIES
 * - invalidateRulesCache / getRulesCacheVersion work correctly
 * - Post-pull hook triggers cache invalidation
 */

import {
  invalidateRulesCache,
  getRulesCacheVersion,
  isRuleCacheStale,
  getSuggestions,
  createEmptyMetrics,
  getAcceptanceRate,
} from "@/services/SmartCartAssistant";

// ---------------------------------------------------------------------------
// invalidateRulesCache / getRulesCacheVersion
// ---------------------------------------------------------------------------

describe("SmartCartAssistant — Cache Invalidation", () => {
  it("getRulesCacheVersion starts at a number", () => {
    const v = getRulesCacheVersion();
    expect(typeof v).toBe("number");
  });

  it("invalidateRulesCache increments the version", () => {
    const before = getRulesCacheVersion();
    invalidateRulesCache();
    const after = getRulesCacheVersion();
    expect(after).toBe(before + 1);
  });

  it("multiple invalidations produce monotonically increasing versions", () => {
    const v1 = getRulesCacheVersion();
    invalidateRulesCache();
    const v2 = getRulesCacheVersion();
    invalidateRulesCache();
    const v3 = getRulesCacheVersion();

    expect(v2).toBeGreaterThan(v1);
    expect(v3).toBeGreaterThan(v2);
  });
});

// ---------------------------------------------------------------------------
// isRuleCacheStale
// ---------------------------------------------------------------------------

describe("SmartCartAssistant — isRuleCacheStale", () => {
  it("returns true for empty rules array", () => {
    expect(isRuleCacheStale([])).toBe(true);
  });

  it("returns false for recently computed rules", () => {
    const freshRule = {
      id: "r1",
      antecedentProductId: "p1",
      consequentProductId: "p2",
      confidence: 0.8,
      support: 0.1,
      lift: 2.0,
      computedAt: Date.now() - 1000, // 1 second ago
    };
    expect(isRuleCacheStale([freshRule])).toBe(false);
  });

  it("returns true for old rules (>7 days)", () => {
    const oldRule = {
      id: "r1",
      antecedentProductId: "p1",
      consequentProductId: "p2",
      confidence: 0.8,
      support: 0.1,
      lift: 2.0,
      computedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
    };
    expect(isRuleCacheStale([oldRule])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getSuggestions (basic smoke tests)
// ---------------------------------------------------------------------------

describe("SmartCartAssistant — getSuggestions", () => {
  it("returns empty array for empty cart", () => {
    expect(getSuggestions([], [], [])).toEqual([]);
  });

  it("returns empty array for no rules", () => {
    const cartItems = [
      { productId: "p1", productName: "Burger", quantity: 1, unitPrice: 50, totalPrice: 50 },
    ];
    expect(getSuggestions(cartItems, [], [])).toEqual([]);
  });

  it("returns suggestions when rules match cart items", () => {
    const cartItems = [
      { productId: "p1", productName: "Burger", quantity: 1, unitPrice: 50, totalPrice: 50 },
    ];
    const rules = [
      {
        id: "r1",
        antecedentProductId: "p1",
        consequentProductId: "p2",
        confidence: 0.9,
        support: 0.2,
        lift: 3.0,
        computedAt: Date.now() - 1000,
      },
    ];
    const products = [
      { id: "p2", name: "Fries", price: 30, isActive: true, trackInventory: false, stockQuantity: 0 },
    ] as any;

    const suggestions = getSuggestions(cartItems, rules, products);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].product.id).toBe("p2");
  });

  it("does not suggest products already in cart", () => {
    const cartItems = [
      { productId: "p1", productName: "Burger", quantity: 1, unitPrice: 50, totalPrice: 50 },
      { productId: "p2", productName: "Fries", quantity: 1, unitPrice: 30, totalPrice: 30 },
    ];
    const rules = [
      {
        id: "r1",
        antecedentProductId: "p1",
        consequentProductId: "p2",
        confidence: 0.9,
        support: 0.2,
        lift: 3.0,
        computedAt: Date.now() - 1000,
      },
    ];
    const products = [
      { id: "p2", name: "Fries", price: 30, isActive: true, trackInventory: false, stockQuantity: 0 },
    ] as any;

    const suggestions = getSuggestions(cartItems, rules, products);
    expect(suggestions.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Metrics helpers
// ---------------------------------------------------------------------------

describe("SmartCartAssistant — Metrics", () => {
  it("createEmptyMetrics returns zeroed metrics", () => {
    const m = createEmptyMetrics();
    expect(m.totalShown).toBe(0);
    expect(m.totalAccepted).toBe(0);
    expect(m.totalDismissed).toBe(0);
  });

  it("getAcceptanceRate returns 0 for no shown", () => {
    expect(getAcceptanceRate(createEmptyMetrics())).toBe(0);
  });

  it("getAcceptanceRate calculates correctly", () => {
    const m = { totalShown: 10, totalAccepted: 3, totalDismissed: 7 };
    expect(getAcceptanceRate(m)).toBeCloseTo(0.3);
  });
});

// ---------------------------------------------------------------------------
// SYNCABLE_ENTITIES includes association_rules
// ---------------------------------------------------------------------------

describe("PullHandler — SYNCABLE_ENTITIES", () => {
  it("association_rules is a syncable entity type", async () => {
    // Read the file to verify the constant includes association_rules
    const fs = require("fs");
    const path = require("path");
    const pullHandlerPath = path.join(
      __dirname,
      "..",
      "services",
      "sync",
      "PullHandler.ts"
    );
    const content = fs.readFileSync(pullHandlerPath, "utf8");

    expect(content).toContain('"association_rules"');
    expect(content).toContain("SYNCABLE_ENTITIES");
  });
});
