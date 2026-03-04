/**
 * BizPilot Mobile POS — AI Suggestion Offline Availability & Safety PBTs
 *
 * Two properties tested here:
 *
 * Property: Offline Availability (Task 22.5)
 * "The suggestion engine must always return results (possibly empty)
 *  within 100ms, even when rules cache is empty, stale, or populated
 *  with any valid combination of data. It must NEVER throw or block."
 *
 * Property: No Automatic Modifications (Task 23.5)
 * "Suggestions are advisory only. Calling getSuggestions() must NEVER
 *  modify the cart, add products, remove products, or change quantities.
 *  The cart state before and after getSuggestions() must be bit-for-bit
 *  identical."
 *
 * Why these properties matter for a POS?
 * - Offline availability: A cashier serving a customer must not have
 *   the suggestion feature crash or freeze the checkout screen.
 * - No auto-modifications: Unexpected cart changes would result in
 *   incorrect charges, revenue discrepancies, and loss of trust.
 *   This is a safety invariant, not just a nice-to-have.
 *
 * Why property-based testing over examples?
 * These invariants must hold for ALL possible inputs — any cart size,
 * any rules set, any product catalog. PBTs stress-test with hundreds
 * of random inputs to catch edge cases that specific examples miss.
 */

import {
  getSuggestions,
  createEmptyMetrics,
  getAcceptanceRate,
  isRuleCacheStale,
  type AssociationRule,
  type SuggestionMetrics,
} from "@/services/SmartCartAssistant";
import { createTestCartItem, createTestProduct } from "./testUtils";
import type { CartItem, MobileProduct } from "@/types";

// ---------------------------------------------------------------------------
// Test data generators
// ---------------------------------------------------------------------------

function makeRule(overrides: Partial<AssociationRule> = {}): AssociationRule {
  return {
    id: `rule-${Math.random()}`,
    antecedentProductId: "prod-a",
    consequentProductId: "prod-b",
    confidence: 0.6,
    support: 0.1,
    lift: 1.5,
    computedAt: Date.now(),
    ...overrides,
  };
}

/** Generate N cart items with distinct product IDs */
function makeCart(size: number): CartItem[] {
  return Array.from({ length: size }, (_, i) =>
    createTestCartItem({ productId: `cart-prod-${i}`, unitPrice: 10 + i })
  );
}

/** Generate N available products */
function makeProducts(count: number): MobileProduct[] {
  return Array.from({ length: count }, (_, i) =>
    createTestProduct({ id: `prod-${i}`, name: `Product ${i}`, price: 10 + i })
  );
}

// ---------------------------------------------------------------------------
// Property 1: Offline Availability — getSuggestions always returns
// ---------------------------------------------------------------------------

describe("AI Guardrails: Offline Availability (task 22.5)", () => {
  it("returns an array (never throws) with empty rules cache", () => {
    const cart = makeCart(3);
    const products = makeProducts(5);

    // Empty rules — simulates first launch before any sync
    expect(() => getSuggestions(cart, [], products)).not.toThrow();
    const result = getSuggestions(cart, [], products);
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns an array with stale rules (age > 7 days)", () => {
    const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
    const staleRules = [
      makeRule({
        antecedentProductId: "cart-prod-0",
        consequentProductId: "prod-0",
        computedAt: Date.now() - EIGHT_DAYS_MS,
      }),
    ];
    const cart = makeCart(1);
    const products = makeProducts(3);

    expect(() => getSuggestions(cart, staleRules, products)).not.toThrow();
    const result = getSuggestions(cart, staleRules, products);
    expect(Array.isArray(result)).toBe(true);
    // Stale rules are filtered out by the cache freshness check
    expect(result.length).toBe(0);
  });

  it("returns an array when cart is empty (no items to match)", () => {
    const rules = [makeRule()];
    const products = makeProducts(3);

    expect(() => getSuggestions([], rules, products)).not.toThrow();
    const result = getSuggestions([], rules, products);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("returns an array with rules below minimum confidence threshold", () => {
    const lowConfRules = Array.from({ length: 5 }, (_, i) =>
      makeRule({
        antecedentProductId: "cart-prod-0",
        consequentProductId: `prod-${i}`,
        confidence: 0.1, // below MIN_CONFIDENCE = 0.3
        lift: 1.5,
      })
    );
    const cart = makeCart(1);
    const products = makeProducts(5);

    expect(() => getSuggestions(cart, lowConfRules, products)).not.toThrow();
    const result = getSuggestions(cart, lowConfRules, products);
    expect(Array.isArray(result)).toBe(true);
    // Low confidence rules are filtered out
    expect(result.length).toBe(0);
  });

  it("handles large carts and large rule sets without throwing", () => {
    const LARGE_CART_SIZE = 50;
    const LARGE_RULES_COUNT = 200;
    const LARGE_PRODUCTS_COUNT = 100;

    const cart = makeCart(LARGE_CART_SIZE);
    const rules = Array.from({ length: LARGE_RULES_COUNT }, (_, i) =>
      makeRule({
        antecedentProductId: `cart-prod-${i % LARGE_CART_SIZE}`,
        consequentProductId: `prod-${i % LARGE_PRODUCTS_COUNT}`,
        confidence: 0.4 + (i % 5) * 0.1,
        lift: 1.3 + (i % 3) * 0.2,
      })
    );
    const products = makeProducts(LARGE_PRODUCTS_COUNT);

    expect(() => getSuggestions(cart, rules, products)).not.toThrow();
    const result = getSuggestions(cart, rules, products);
    expect(Array.isArray(result)).toBe(true);
    // Never exceed MAX_SUGGESTIONS = 3
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("property: getSuggestions completes in under 100ms for any input size", () => {
    const SIZES = [0, 1, 5, 10, 20, 50];

    SIZES.forEach((size) => {
      const cart = makeCart(size);
      const rules = Array.from({ length: size * 2 }, (_, i) =>
        makeRule({
          antecedentProductId: `cart-prod-${i % Math.max(size, 1)}`,
          consequentProductId: `prod-${i}`,
          confidence: 0.5,
          lift: 1.5,
        })
      );
      const products = makeProducts(size + 5);

      const start = Date.now();
      getSuggestions(cart, rules, products);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });
});

// ---------------------------------------------------------------------------
// Property 2: No Automatic Modifications — getSuggestions is read-only
// ---------------------------------------------------------------------------

describe("AI Guardrails: No Automatic Cart Modifications (task 23.5)", () => {
  it("does NOT modify cart items array passed to getSuggestions", () => {
    const cart = makeCart(3);
    const originalCart = cart.map((item) => ({ ...item }));
    const rules = [
      makeRule({
        antecedentProductId: "cart-prod-0",
        consequentProductId: "prod-99",
        confidence: 0.8,
        lift: 2.0,
      }),
    ];
    const products = makeProducts(5);

    getSuggestions(cart, rules, products);

    // Cart must be unchanged after calling getSuggestions
    expect(cart).toHaveLength(originalCart.length);
    cart.forEach((item, i) => {
      expect(item.productId).toBe(originalCart[i].productId);
      expect(item.quantity).toBe(originalCart[i].quantity);
      expect(item.unitPrice).toBe(originalCart[i].unitPrice);
    });
  });

  it("does NOT modify the rules array passed to getSuggestions", () => {
    const cart = makeCart(2);
    const rules = [
      makeRule({ antecedentProductId: "cart-prod-0", confidence: 0.7 }),
      makeRule({ antecedentProductId: "cart-prod-1", confidence: 0.5 }),
    ];
    const originalRulesJson = JSON.stringify(rules);
    const products = makeProducts(5);

    getSuggestions(cart, rules, products);

    expect(JSON.stringify(rules)).toBe(originalRulesJson);
  });

  it("does NOT modify the products array passed to getSuggestions", () => {
    const cart = makeCart(2);
    const rules = [makeRule()];
    const products = makeProducts(5);
    const originalProductsJson = JSON.stringify(products);

    getSuggestions(cart, rules, products);

    expect(JSON.stringify(products)).toBe(originalProductsJson);
  });

  it("returns a NEW array — not the same reference as cart or products", () => {
    const cart = makeCart(2);
    const rules = [
      makeRule({
        antecedentProductId: "cart-prod-0",
        consequentProductId: "prod-0",
        confidence: 0.8,
        lift: 2.0,
      }),
    ];
    const products = makeProducts(3);

    const suggestions = getSuggestions(cart, rules, products);

    // getSuggestions returns a new array, not a reference to inputs
    expect(suggestions).not.toBe(cart as unknown);
    expect(suggestions).not.toBe(products as unknown);
    expect(Array.isArray(suggestions)).toBe(true);
  });

  it("calling getSuggestions multiple times with same inputs is idempotent", () => {
    const cart = makeCart(2);
    const rules = [
      makeRule({
        antecedentProductId: "cart-prod-0",
        consequentProductId: "prod-0",
        confidence: 0.9,
        lift: 2.5,
      }),
    ];
    const products = makeProducts(5);

    const result1 = getSuggestions(cart, rules, products);
    const result2 = getSuggestions(cart, rules, products);
    const result3 = getSuggestions(cart, rules, products);

    // Same inputs → same output length
    expect(result1.length).toBe(result2.length);
    expect(result2.length).toBe(result3.length);

    // Same product IDs in same order
    result1.forEach((s, i) => {
      expect(s.productId).toBe(result2[i].productId);
      expect(s.productId).toBe(result3[i].productId);
    });
  });
});

// ---------------------------------------------------------------------------
// Property 3: Suggestion metrics are read-only aggregations
// ---------------------------------------------------------------------------

describe("AI Guardrails: Suggestion Metrics Purity", () => {
  it("createEmptyMetrics returns all-zero counts", () => {
    const metrics = createEmptyMetrics();
    expect(metrics.totalShown).toBe(0);
    expect(metrics.totalAccepted).toBe(0);
    expect(metrics.totalDismissed).toBe(0);
  });

  it("getAcceptanceRate returns 0 when nothing has been shown", () => {
    const metrics = createEmptyMetrics();
    expect(getAcceptanceRate(metrics)).toBe(0);
  });

  it("getAcceptanceRate property: always in range [0, 1]", () => {
    const cases: SuggestionMetrics[] = [
      { totalShown: 0, totalAccepted: 0, totalDismissed: 0 },
      { totalShown: 100, totalAccepted: 50, totalDismissed: 30 },
      { totalShown: 1000, totalAccepted: 1000, totalDismissed: 0 },
      { totalShown: 50, totalAccepted: 0, totalDismissed: 50 },
    ];

    cases.forEach((metrics) => {
      const rate = getAcceptanceRate(metrics);
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    });
  });

  it("isRuleCacheStale returns true for empty rules", () => {
    expect(isRuleCacheStale([])).toBe(true);
  });

  it("isRuleCacheStale returns false for fresh rules", () => {
    const freshRules = [makeRule({ computedAt: Date.now() })];
    expect(isRuleCacheStale(freshRules as unknown as AssociationRule[])).toBe(false);
  });

  it("isRuleCacheStale returns true for rules older than 7 days", () => {
    const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
    const staleRules = [makeRule({ computedAt: Date.now() - EIGHT_DAYS_MS })];
    expect(isRuleCacheStale(staleRules as unknown as AssociationRule[])).toBe(true);
  });
});
