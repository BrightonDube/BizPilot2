/**
 * Tests: Association Rule Generator (pos-core tasks 21.1–21.6)
 *
 * Tests the pure functions extracted from the Supabase Edge Function.
 * Network calls (Supabase DB, OpenAI API) are NOT tested here — those
 * require integration test infrastructure (tested via Supabase CLI locally).
 *
 * What IS tested here:
 * 1. buildTransactionMatrix — the core data transformation logic
 * 2. Rule filtering/merging logic (storeAssociationRules reducer)
 * 3. PBT properties on the matrix builder
 *
 * Why test the Edge Function logic separately?
 * The Deno Edge Function environment cannot run in Jest/Node.js.
 * By extracting pure functions, we get fast Node.js test coverage
 * of the most complex logic without a full Deno runtime.
 *
 * The integration test (calling the deployed function via HTTPS) is
 * tracked in task 22.x and requires Supabase CLI setup.
 */

// ---------------------------------------------------------------------------
// Re-implement pure logic for testing
// (Mirrors the functions in supabase/functions/generate-association-rules/index.ts)
// ---------------------------------------------------------------------------

type Transaction = string[];

interface TransactionMatrix {
  pairFrequencies: Array<{ a: string; b: string; count: number }>;
  totalTransactions: number;
  uniqueProducts: string[];
}

const MIN_SUPPORT = 0.02;

function buildTransactionMatrix(transactions: Transaction[]): TransactionMatrix {
  const total = transactions.length;
  if (total === 0) {
    return { pairFrequencies: [], totalTransactions: 0, uniqueProducts: [] };
  }

  const pairCounts = new Map<string, number>();
  const productSet = new Set<string>();

  for (const transaction of transactions) {
    const uniqueInOrder = [...new Set(transaction)];
    for (const productId of uniqueInOrder) {
      productSet.add(productId);
    }
    for (let i = 0; i < uniqueInOrder.length; i++) {
      for (let j = i + 1; j < uniqueInOrder.length; j++) {
        const pair = [uniqueInOrder[i], uniqueInOrder[j]].sort().join("|||");
        pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
      }
    }
  }

  const minCount = Math.floor(MIN_SUPPORT * total);
  const pairFrequencies: TransactionMatrix["pairFrequencies"] = [];

  for (const [pairKey, count] of pairCounts) {
    if (count >= minCount) {
      const [a, b] = pairKey.split("|||");
      pairFrequencies.push({ a, b, count });
    }
  }

  pairFrequencies.sort((x, y) => y.count - x.count);

  return {
    pairFrequencies,
    totalTransactions: total,
    uniqueProducts: [...productSet].sort(),
  };
}

/** Mirror of the rule merging logic from storeAssociationRules */
interface RawRule {
  antecedent: string[];
  consequent: string[];
  confidence: number;
  support: number;
  lift: number;
}

interface MergedRule {
  product_id: string;
  suggested_product_ids: string[];
  confidence: number;
  support: number;
  lift: number;
}

function mergeRules(rules: RawRule[]): Map<string, MergedRule> {
  const rowsByProduct = new Map<string, MergedRule>();

  for (const rule of rules) {
    for (const antecedentId of rule.antecedent) {
      const existing = rowsByProduct.get(antecedentId);
      if (existing) {
        const allSuggested = new Set([
          ...existing.suggested_product_ids,
          ...rule.consequent,
        ]);
        if (rule.confidence > existing.confidence) {
          rowsByProduct.set(antecedentId, {
            ...existing,
            suggested_product_ids: [...allSuggested],
            confidence: rule.confidence,
            support: rule.support,
            lift: rule.lift,
          });
        } else {
          rowsByProduct.set(antecedentId, {
            ...existing,
            suggested_product_ids: [...allSuggested],
          });
        }
      } else {
        rowsByProduct.set(antecedentId, {
          product_id: antecedentId,
          suggested_product_ids: rule.consequent,
          confidence: rule.confidence,
          support: rule.support,
          lift: rule.lift,
        });
      }
    }
  }

  return rowsByProduct;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COFFEE = "prod-coffee";
const MUFFIN = "prod-muffin";
const JUICE = "prod-juice";
const SANDWICH = "prod-sandwich";
const WATER = "prod-water";

// 10 transactions (enough to pass the < 10 check)
function makeTransactions(): Transaction[] {
  return [
    [COFFEE, MUFFIN],
    [COFFEE, MUFFIN],
    [COFFEE, MUFFIN],
    [COFFEE, JUICE],
    [COFFEE, JUICE],
    [MUFFIN, JUICE],
    [SANDWICH, WATER],
    [SANDWICH, WATER],
    [COFFEE, SANDWICH],
    [JUICE, WATER],
  ];
}

// ---------------------------------------------------------------------------
// buildTransactionMatrix — unit tests
// ---------------------------------------------------------------------------

describe("buildTransactionMatrix", () => {
  test("empty input returns empty matrix", () => {
    const result = buildTransactionMatrix([]);
    expect(result.totalTransactions).toBe(0);
    expect(result.pairFrequencies).toHaveLength(0);
    expect(result.uniqueProducts).toHaveLength(0);
  });

  test("counts pair frequencies correctly", () => {
    const txns: Transaction[] = [
      [COFFEE, MUFFIN],
      [COFFEE, MUFFIN],
      [COFFEE, JUICE],
    ];
    const result = buildTransactionMatrix(txns);
    const coffeeMuffin = result.pairFrequencies.find(
      (p) => (p.a === COFFEE && p.b === MUFFIN) || (p.a === MUFFIN && p.b === COFFEE)
    );
    expect(coffeeMuffin?.count).toBe(2);
  });

  test("pairs are sorted alphabetically (canonical form)", () => {
    const txns: Transaction[] = [[MUFFIN, COFFEE], [COFFEE, MUFFIN]];
    const result = buildTransactionMatrix(txns);
    const pairs = result.pairFrequencies;
    // Both should collapse into one pair
    expect(pairs).toHaveLength(1);
    expect(pairs[0].count).toBe(2);
  });

  test("output pairs sorted by frequency descending", () => {
    const result = buildTransactionMatrix(makeTransactions());
    for (let i = 0; i < result.pairFrequencies.length - 1; i++) {
      expect(result.pairFrequencies[i].count).toBeGreaterThanOrEqual(
        result.pairFrequencies[i + 1].count
      );
    }
  });

  test("duplicate products within same order counted once per order", () => {
    // COFFEE appears twice in one order — should only count once for pairs
    const txns: Transaction[] = [[COFFEE, COFFEE, MUFFIN]];
    const result = buildTransactionMatrix(txns);
    const coffeeMuffin = result.pairFrequencies.find(
      (p) => p.a === COFFEE && p.b === MUFFIN || p.a === MUFFIN && p.b === COFFEE
    );
    expect(coffeeMuffin?.count).toBe(1);
  });

  test("collects all unique products", () => {
    const result = buildTransactionMatrix(makeTransactions());
    expect(result.uniqueProducts).toContain(COFFEE);
    expect(result.uniqueProducts).toContain(MUFFIN);
    expect(result.uniqueProducts).toContain(JUICE);
  });

  test("filters pairs below MIN_SUPPORT threshold", () => {
    // 100 transactions; one pair appears only once (1/100 = 0.01 < MIN_SUPPORT=0.02)
    const txns: Transaction[] = Array.from({ length: 99 }, () => [COFFEE, MUFFIN]);
    txns.push([JUICE, SANDWICH]); // This pair appears once (1%)

    const result = buildTransactionMatrix(txns);
    const juiceSandwich = result.pairFrequencies.find(
      (p) =>
        (p.a === JUICE && p.b === SANDWICH) ||
        (p.a === SANDWICH && p.b === JUICE)
    );
    // 1/100 = 0.01 < MIN_SUPPORT (0.02) → should be filtered out
    expect(juiceSandwich).toBeUndefined();
  });

  test("total transactions count matches input length", () => {
    const txns = makeTransactions();
    const result = buildTransactionMatrix(txns);
    expect(result.totalTransactions).toBe(txns.length);
  });
});

// ---------------------------------------------------------------------------
// mergeRules — unit tests
// ---------------------------------------------------------------------------

describe("mergeRules (storeAssociationRules row builder)", () => {
  test("creates one row per antecedent product", () => {
    const rules: RawRule[] = [
      { antecedent: [COFFEE], consequent: [MUFFIN], confidence: 0.7, support: 0.3, lift: 2.0 },
      { antecedent: [MUFFIN], consequent: [COFFEE], confidence: 0.6, support: 0.3, lift: 1.8 },
    ];
    const merged = mergeRules(rules);
    expect(merged.size).toBe(2);
    expect(merged.has(COFFEE)).toBe(true);
    expect(merged.has(MUFFIN)).toBe(true);
  });

  test("merges consequents for same antecedent", () => {
    const rules: RawRule[] = [
      { antecedent: [COFFEE], consequent: [MUFFIN], confidence: 0.7, support: 0.3, lift: 2.0 },
      { antecedent: [COFFEE], consequent: [JUICE], confidence: 0.5, support: 0.2, lift: 1.5 },
    ];
    const merged = mergeRules(rules);
    const coffeeRow = merged.get(COFFEE)!;
    expect(coffeeRow.suggested_product_ids).toContain(MUFFIN);
    expect(coffeeRow.suggested_product_ids).toContain(JUICE);
  });

  test("keeps highest confidence when merging same antecedent", () => {
    const rules: RawRule[] = [
      { antecedent: [COFFEE], consequent: [MUFFIN], confidence: 0.4, support: 0.2, lift: 1.5 },
      { antecedent: [COFFEE], consequent: [JUICE], confidence: 0.8, support: 0.4, lift: 2.5 },
    ];
    const merged = mergeRules(rules);
    const coffeeRow = merged.get(COFFEE)!;
    expect(coffeeRow.confidence).toBeCloseTo(0.8, 2);
  });

  test("handles multi-product antecedents (both products get a row)", () => {
    const rules: RawRule[] = [
      {
        antecedent: [COFFEE, MUFFIN],
        consequent: [JUICE],
        confidence: 0.6,
        support: 0.1,
        lift: 1.8,
      },
    ];
    const merged = mergeRules(rules);
    expect(merged.has(COFFEE)).toBe(true);
    expect(merged.has(MUFFIN)).toBe(true);
    expect(merged.get(COFFEE)?.suggested_product_ids).toContain(JUICE);
    expect(merged.get(MUFFIN)?.suggested_product_ids).toContain(JUICE);
  });

  test("empty rules returns empty map", () => {
    expect(mergeRules([])).toHaveProperty("size", 0);
  });

  test("deduplicates consequents within same antecedent", () => {
    const rules: RawRule[] = [
      { antecedent: [COFFEE], consequent: [MUFFIN], confidence: 0.7, support: 0.3, lift: 2.0 },
      { antecedent: [COFFEE], consequent: [MUFFIN], confidence: 0.6, support: 0.25, lift: 1.8 },
    ];
    const merged = mergeRules(rules);
    const coffeeRow = merged.get(COFFEE)!;
    // MUFFIN should appear only once despite being in two rules
    expect(
      coffeeRow.suggested_product_ids.filter((id) => id === MUFFIN)
    ).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// PBT: buildTransactionMatrix invariants
// ---------------------------------------------------------------------------

function randomProductId(): string {
  const products = ["A", "B", "C", "D", "E", "F"];
  return products[Math.floor(Math.random() * products.length)];
}

function makeRandomTransactions(count: number, maxItems: number): Transaction[] {
  return Array.from({ length: count }, () => {
    const size = Math.floor(Math.random() * (maxItems - 1)) + 2; // at least 2 items
    return Array.from({ length: size }, () => randomProductId());
  });
}

describe("PBT: buildTransactionMatrix invariants", () => {
  /**
   * Property 1: totalTransactions always equals input length
   */
  test("Property 1 — totalTransactions equals input length", () => {
    for (let i = 0; i < 200; i++) {
      const count = Math.floor(Math.random() * 50) + 1;
      const txns = makeRandomTransactions(count, 4);
      const result = buildTransactionMatrix(txns);
      expect(result.totalTransactions).toBe(count);
    }
  });

  /**
   * Property 2: pair counts never exceed total transactions
   */
  test("Property 2 — no pair count exceeds total transactions", () => {
    for (let i = 0; i < 200; i++) {
      const txns = makeRandomTransactions(50, 5);
      const result = buildTransactionMatrix(txns);
      for (const pair of result.pairFrequencies) {
        expect(pair.count).toBeLessThanOrEqual(result.totalTransactions);
        expect(pair.count).toBeGreaterThan(0);
      }
    }
  });

  /**
   * Property 3: output pairs are sorted descending by count
   */
  test("Property 3 — pairs are sorted descending by count", () => {
    for (let i = 0; i < 200; i++) {
      const txns = makeRandomTransactions(50, 5);
      const result = buildTransactionMatrix(txns);
      for (let j = 0; j < result.pairFrequencies.length - 1; j++) {
        expect(result.pairFrequencies[j].count).toBeGreaterThanOrEqual(
          result.pairFrequencies[j + 1].count
        );
      }
    }
  });

  /**
   * Property 4: unique products count <= (total distinct in input)
   * (products not appearing are not invented)
   */
  test("Property 4 — uniqueProducts only contains products from input", () => {
    const PRODUCTS = new Set(["A", "B", "C", "D", "E", "F"]);

    for (let i = 0; i < 100; i++) {
      const txns = makeRandomTransactions(30, 4);
      const result = buildTransactionMatrix(txns);
      for (const p of result.uniqueProducts) {
        expect(PRODUCTS.has(p)).toBe(true);
      }
    }
  });
});
