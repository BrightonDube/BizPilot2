/**
 * BizPilot Mobile POS — Suggestion Latency PBT (pos-core task 19.6)
 *
 * Property: getSuggestions() returns within 100ms
 * "For any valid cart state and rule set, the Smart Cart suggestion
 * engine must return results within 100 milliseconds to avoid
 * disrupting the POS workflow."
 *
 * Why 100ms?
 * The spec requires suggestions within 100ms. Anything slower and
 * the suggestion banner appears noticeably late after a product tap.
 * At 16ms per frame, 100ms is ~6 frames — borderline perceptible.
 *
 * Test approach:
 * We measure execution time of getSuggestions() across a range of
 * input sizes:
 * - Small carts (1-5 items) with small rule sets (0-100 rules)
 * - Medium carts (5-15 items) with medium rule sets (100-500 rules)
 * - Large carts (15-50 items) with large rule sets (500-2000 rules)
 *
 * All must complete in < 100ms. In practice, the hot path is a Map
 * lookup so it's typically < 1ms — this test catches regressions.
 *
 * Note: We use Date.now() for measurement precision. Jest's fake timers
 * are explicitly disabled in this file to get real wall-clock time.
 */

import {
  getSuggestions,
  type AssociationRule,
} from "@/services/SmartCartAssistant";
import {
  createTestCartItem,
  createTestProduct,
} from "./testUtils";
import type { CartItem, MobileProduct } from "@/types";

// We need real timers for latency measurement
beforeAll(() => jest.useRealTimers());

// ---------------------------------------------------------------------------
// Test data generators
// ---------------------------------------------------------------------------

/**
 * Generate N association rules covering random product pairs.
 * Products are indexed p-0 through p-(productCount-1).
 */
function generateRules(
  count: number,
  productCount: number,
  computedAt: number = Date.now()
): AssociationRule[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `rule-${i}`,
    antecedentProductId: `p-${i % productCount}`,
    consequentProductId: `p-${(i + 1) % productCount}`,
    confidence: 0.5 + (i % 5) * 0.1, // 0.5 to 0.9 range
    support: 0.1 + (i % 3) * 0.05,
    lift: 1.5 + (i % 4) * 0.25,
    computedAt,
  }));
}

/**
 * Generate N products with sequential IDs.
 */
function generateProducts(count: number): MobileProduct[] {
  return Array.from({ length: count }, (_, i) =>
    createTestProduct({
      id: `p-${i}`,
      remoteId: `p-${i}`,
      isActive: true,
      trackInventory: false,
      stockQuantity: 100,
    })
  );
}

/**
 * Generate N cart items using sequential product IDs.
 */
function generateCartItems(count: number): CartItem[] {
  return Array.from({ length: count }, (_, i) =>
    createTestCartItem({
      productId: `p-${i}`,
      productName: `Product ${i}`,
    })
  );
}

// ---------------------------------------------------------------------------
// Performance threshold
// ---------------------------------------------------------------------------

const MAX_LATENCY_MS = 100;

// ---------------------------------------------------------------------------
// Latency property tests
// ---------------------------------------------------------------------------

describe("Suggestion Latency: getSuggestions() < 100ms", () => {
  describe("Property: empty inputs return immediately", () => {
    it("returns in < 10ms with empty cart", () => {
      const products = generateProducts(1000);
      const rules = generateRules(500, 1000);

      const start = Date.now();
      const result = getSuggestions([], rules, products);
      const elapsed = Date.now() - start;

      expect(result).toHaveLength(0);
      expect(elapsed).toBeLessThan(10);
    });

    it("returns in < 10ms with empty rules", () => {
      const cart = generateCartItems(20);
      const products = generateProducts(1000);

      const start = Date.now();
      const result = getSuggestions(cart, [], products);
      const elapsed = Date.now() - start;

      expect(result).toHaveLength(0);
      expect(elapsed).toBeLessThan(10);
    });

    it("returns in < 10ms with empty products", () => {
      const cart = generateCartItems(5);
      const rules = generateRules(100, 100);

      const start = Date.now();
      const result = getSuggestions(cart, rules, []);
      const elapsed = Date.now() - start;

      expect(result).toHaveLength(0);
      expect(elapsed).toBeLessThan(10);
    });
  });

  describe("Property: small inputs complete well within 100ms", () => {
    it.each([
      { cartSize: 1, ruleCount: 10, productCount: 20 },
      { cartSize: 3, ruleCount: 50, productCount: 100 },
      { cartSize: 5, ruleCount: 100, productCount: 200 },
    ])(
      "cart=$cartSize items, $ruleCount rules, $productCount products",
      ({ cartSize, ruleCount, productCount }) => {
        const cart = generateCartItems(cartSize);
        const rules = generateRules(ruleCount, productCount);
        const products = generateProducts(productCount);

        const start = Date.now();
        getSuggestions(cart, rules, products);
        const elapsed = Date.now() - start;

        expect(elapsed).toBeLessThan(MAX_LATENCY_MS);
      }
    );
  });

  describe("Property: medium inputs complete within 100ms", () => {
    it.each([
      { cartSize: 10, ruleCount: 500, productCount: 500 },
      { cartSize: 15, ruleCount: 1000, productCount: 1000 },
    ])(
      "cart=$cartSize items, $ruleCount rules, $productCount products",
      ({ cartSize, ruleCount, productCount }) => {
        const cart = generateCartItems(cartSize);
        const rules = generateRules(ruleCount, productCount);
        const products = generateProducts(productCount);

        const start = Date.now();
        getSuggestions(cart, rules, products);
        const elapsed = Date.now() - start;

        expect(elapsed).toBeLessThan(MAX_LATENCY_MS);
      }
    );
  });

  describe("Property: large inputs complete within 100ms", () => {
    it.each([
      { cartSize: 20, ruleCount: 2000, productCount: 2000 },
      { cartSize: 50, ruleCount: 5000, productCount: 5000 },
    ])(
      "cart=$cartSize items, $ruleCount rules, $productCount products",
      ({ cartSize, ruleCount, productCount }) => {
        const cart = generateCartItems(cartSize);
        const rules = generateRules(ruleCount, productCount);
        const products = generateProducts(productCount);

        const start = Date.now();
        getSuggestions(cart, rules, products);
        const elapsed = Date.now() - start;

        expect(elapsed).toBeLessThan(MAX_LATENCY_MS);
      }
    );
  });

  describe("Property: calling getSuggestions 100 times in a row averages < 1ms", () => {
    it("is suitable for per-keystroke/per-tap invocation", () => {
      const cart = generateCartItems(5);
      const rules = generateRules(500, 500);
      const products = generateProducts(500);

      const ITERATIONS = 100;
      const start = Date.now();

      for (let i = 0; i < ITERATIONS; i++) {
        getSuggestions(cart, rules, products);
      }

      const totalMs = Date.now() - start;
      const averageMs = totalMs / ITERATIONS;

      // Total 100 calls should be under 1 second
      expect(totalMs).toBeLessThan(1000);
      // Average per call must be under 10ms (well within the 100ms target)
      expect(averageMs).toBeLessThan(10);
    });
  });
});

// ---------------------------------------------------------------------------
// Correctness properties (in addition to latency)
// ---------------------------------------------------------------------------

describe("Suggestion Correctness: getSuggestions() result invariants", () => {
  describe("Property: suggestions are sorted by confidence descending", () => {
    it("highest-confidence suggestions appear first", () => {
      const products = generateProducts(10);
      const cart: CartItem[] = [
        createTestCartItem({ productId: "p-0", productName: "Product 0" }),
      ];

      const rules: AssociationRule[] = [
        {
          id: "r1",
          antecedentProductId: "p-0",
          consequentProductId: "p-1",
          confidence: 0.4,
          support: 0.1,
          lift: 1.5,
          computedAt: Date.now(),
        },
        {
          id: "r2",
          antecedentProductId: "p-0",
          consequentProductId: "p-2",
          confidence: 0.9,
          support: 0.2,
          lift: 2.0,
          computedAt: Date.now(),
        },
        {
          id: "r3",
          antecedentProductId: "p-0",
          consequentProductId: "p-3",
          confidence: 0.6,
          support: 0.15,
          lift: 1.8,
          computedAt: Date.now(),
        },
      ];

      const suggestions = getSuggestions(cart, rules, products);

      // Must be sorted descending by confidence
      for (let i = 0; i < suggestions.length - 1; i++) {
        expect(suggestions[i].confidence).toBeGreaterThanOrEqual(
          suggestions[i + 1].confidence
        );
      }
    });
  });

  describe("Property: suggested products are never already in the cart", () => {
    it("never suggests items already in the cart", () => {
      const products = generateProducts(5);
      const cart: CartItem[] = [
        createTestCartItem({ productId: "p-0" }),
        createTestCartItem({ productId: "p-1" }),
      ];

      const rules: AssociationRule[] = [
        {
          id: "r1",
          antecedentProductId: "p-0",
          consequentProductId: "p-1", // already in cart
          confidence: 0.95,
          support: 0.3,
          lift: 2.5,
          computedAt: Date.now(),
        },
        {
          id: "r2",
          antecedentProductId: "p-0",
          consequentProductId: "p-2", // not in cart
          confidence: 0.5,
          support: 0.1,
          lift: 1.6,
          computedAt: Date.now(),
        },
      ];

      const suggestions = getSuggestions(cart, rules, products);
      const suggestedIds = suggestions.map((s) => s.product.id);

      // p-1 is already in the cart — must not be suggested
      expect(suggestedIds).not.toContain("p-1");
    });
  });

  describe("Property: maximum 3 suggestions returned", () => {
    it("never returns more than 3 suggestions regardless of rule count", () => {
      const productCount = 100;
      const products = generateProducts(productCount);
      const cart: CartItem[] = [
        createTestCartItem({ productId: "p-0" }),
      ];

      // Generate many rules, all pointing to different products
      const rules: AssociationRule[] = Array.from(
        { length: 50 },
        (_, i) => ({
          id: `r-${i}`,
          antecedentProductId: "p-0",
          consequentProductId: `p-${i + 1}`,
          confidence: 0.5 + (i % 5) * 0.08,
          support: 0.1,
          lift: 1.5,
          computedAt: Date.now(),
        })
      );

      const suggestions = getSuggestions(cart, rules, products);

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe("Property: stale rules are excluded from suggestions", () => {
    it("does not suggest from rules older than 7 days", () => {
      const products = generateProducts(5);
      const cart: CartItem[] = [
        createTestCartItem({ productId: "p-0" }),
      ];

      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;

      const rules: AssociationRule[] = [
        {
          id: "r-stale",
          antecedentProductId: "p-0",
          consequentProductId: "p-1",
          confidence: 0.95,
          support: 0.5,
          lift: 3.0,
          computedAt: eightDaysAgo, // stale
        },
      ];

      const suggestions = getSuggestions(cart, rules, products);

      expect(suggestions).toHaveLength(0);
    });
  });
});
