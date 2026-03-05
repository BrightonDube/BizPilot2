/**
 * Tests for IngredientTrackingService — tasks 4.1-4.4.
 *
 * Coverage:
 * - Stock alert level detection (ok, low, critical, out_of_stock)
 * - Stock alerts filtering and deficit calculation
 * - Inventory value calculation
 * - Sale deduction with and without shortages
 * - Pre-sale availability check
 * - Stock health summary
 * - Substitution lookup and feasibility
 * - Substitution application to ingredient lists
 */

import {
  getStockAlertLevel,
  getStockAlerts,
  calculateInventoryValue,
  applyDeductions,
  checkAvailabilityForSale,
  getStockHealthSummary,
  findSubstitutions,
  applySubstitution,
  IngredientStock,
  IngredientSubstitution,
} from "../services/recipe/IngredientTrackingService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStock(overrides: Partial<IngredientStock> = {}): IngredientStock {
  return {
    ingredientId: "ing-1",
    name: "Chicken Breast",
    currentQuantity: 5000,
    unit: "g",
    lowStockThreshold: 2000,
    criticalStockThreshold: 500,
    unitCost: 0.12,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Task 4.1: Stock alert levels
// ---------------------------------------------------------------------------

describe("getStockAlertLevel", () => {
  it("returns 'ok' when above low threshold", () => {
    expect(getStockAlertLevel(makeStock({ currentQuantity: 5000 }))).toBe("ok");
  });

  it("returns 'low' when at low threshold", () => {
    expect(getStockAlertLevel(makeStock({ currentQuantity: 2000 }))).toBe(
      "low"
    );
  });

  it("returns 'low' when between critical and low thresholds", () => {
    expect(getStockAlertLevel(makeStock({ currentQuantity: 1000 }))).toBe(
      "low"
    );
  });

  it("returns 'critical' when at critical threshold", () => {
    expect(getStockAlertLevel(makeStock({ currentQuantity: 500 }))).toBe(
      "critical"
    );
  });

  it("returns 'critical' when below critical but above zero", () => {
    expect(getStockAlertLevel(makeStock({ currentQuantity: 100 }))).toBe(
      "critical"
    );
  });

  it("returns 'out_of_stock' when at zero", () => {
    expect(getStockAlertLevel(makeStock({ currentQuantity: 0 }))).toBe(
      "out_of_stock"
    );
  });

  it("returns 'out_of_stock' when negative", () => {
    expect(getStockAlertLevel(makeStock({ currentQuantity: -10 }))).toBe(
      "out_of_stock"
    );
  });
});

describe("getStockAlerts", () => {
  it("returns empty for all-ok stock", () => {
    const stock = [makeStock({ currentQuantity: 5000 })];
    expect(getStockAlerts(stock)).toHaveLength(0);
  });

  it("returns alerts for low and critical items", () => {
    const stock = [
      makeStock({ ingredientId: "a", currentQuantity: 5000 }),
      makeStock({ ingredientId: "b", name: "Onion", currentQuantity: 1500 }),
      makeStock({ ingredientId: "c", name: "Salt", currentQuantity: 300 }),
      makeStock({ ingredientId: "d", name: "Pepper", currentQuantity: 0 }),
    ];
    const alerts = getStockAlerts(stock);
    expect(alerts).toHaveLength(3);
    expect(alerts[0].level).toBe("low");
    expect(alerts[1].level).toBe("critical");
    expect(alerts[2].level).toBe("out_of_stock");
  });

  it("calculates deficit correctly for low stock", () => {
    const stock = [makeStock({ currentQuantity: 1500 })];
    const alerts = getStockAlerts(stock);
    // Deficit = lowStockThreshold(2000) - currentQuantity(1500) = 500
    expect(alerts[0].deficit).toBe(500);
  });
});

describe("calculateInventoryValue", () => {
  it("calculates total value correctly", () => {
    const stock = [
      makeStock({ currentQuantity: 1000, unitCost: 0.12 }),
      makeStock({
        ingredientId: "b",
        currentQuantity: 500,
        unitCost: 0.05,
      }),
    ];
    // 1000 * 0.12 + 500 * 0.05 = 120 + 25 = 145
    expect(calculateInventoryValue(stock)).toBe(145);
  });

  it("returns 0 for empty stock list", () => {
    expect(calculateInventoryValue([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Task 4.2: Deduct on sale
// ---------------------------------------------------------------------------

describe("applyDeductions", () => {
  it("deducts ingredients correctly", () => {
    const stock = [
      makeStock({ ingredientId: "a", currentQuantity: 1000 }),
      makeStock({ ingredientId: "b", currentQuantity: 500 }),
    ];
    const deductions = [
      { ingredientId: "a", deductQuantity: 200 },
      { ingredientId: "b", deductQuantity: 100 },
    ];
    const result = applyDeductions(stock, deductions);
    expect(result.shortages).toHaveLength(0);
    expect(result.deductions[0].newQuantity).toBe(800);
    expect(result.deductions[1].newQuantity).toBe(400);
  });

  it("reports shortages when insufficient stock", () => {
    const stock = [makeStock({ ingredientId: "a", currentQuantity: 50 })];
    const deductions = [{ ingredientId: "a", deductQuantity: 200 }];
    const result = applyDeductions(stock, deductions);
    expect(result.shortages).toHaveLength(1);
    expect(result.shortages[0].shortfall).toBe(150);
    // Still deducts what's available
    expect(result.deductions[0].newQuantity).toBe(0);
  });

  it("reports shortage for unknown ingredients", () => {
    const result = applyDeductions(
      [],
      [{ ingredientId: "unknown", deductQuantity: 100 }]
    );
    expect(result.shortages).toHaveLength(1);
    expect(result.shortages[0].available).toBe(0);
  });

  it("allows negative stock when allowNegative is true", () => {
    const stock = [makeStock({ ingredientId: "a", currentQuantity: 50 })];
    const deductions = [{ ingredientId: "a", deductQuantity: 200 }];
    const result = applyDeductions(stock, deductions, true);
    expect(result.shortages).toHaveLength(0);
    expect(result.deductions[0].newQuantity).toBe(-150);
  });
});

// ---------------------------------------------------------------------------
// Task 4.3: Pre-sale availability check
// ---------------------------------------------------------------------------

describe("checkAvailabilityForSale", () => {
  it("returns empty when all ingredients available", () => {
    const stock = [makeStock({ ingredientId: "a", currentQuantity: 1000 })];
    const shortages = checkAvailabilityForSale(stock, [
      { ingredientId: "a", deductQuantity: 500 },
    ]);
    expect(shortages).toHaveLength(0);
  });

  it("returns shortages for insufficient stock", () => {
    const stock = [makeStock({ ingredientId: "a", currentQuantity: 100 })];
    const shortages = checkAvailabilityForSale(stock, [
      { ingredientId: "a", deductQuantity: 500 },
    ]);
    expect(shortages).toHaveLength(1);
    expect(shortages[0].shortfall).toBe(400);
  });
});

describe("getStockHealthSummary", () => {
  it("categorises stock correctly", () => {
    const stock = [
      makeStock({ ingredientId: "a", currentQuantity: 5000 }),
      makeStock({ ingredientId: "b", currentQuantity: 1500 }),
      makeStock({ ingredientId: "c", currentQuantity: 300 }),
      makeStock({ ingredientId: "d", currentQuantity: 0 }),
    ];
    const summary = getStockHealthSummary(stock);
    expect(summary.total).toBe(4);
    expect(summary.ok).toBe(1);
    expect(summary.low).toBe(1);
    expect(summary.critical).toBe(1);
    expect(summary.outOfStock).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Task 4.4: Substitutions
// ---------------------------------------------------------------------------

describe("findSubstitutions", () => {
  const substitutions: IngredientSubstitution[] = [
    {
      originalIngredientId: "butter",
      substituteIngredientId: "margarine",
      conversionRatio: 1.0,
      notes: "Use unsalted",
    },
    {
      originalIngredientId: "butter",
      substituteIngredientId: "coconut-oil",
      conversionRatio: 0.8,
    },
  ];

  const stock: IngredientStock[] = [
    makeStock({
      ingredientId: "butter",
      name: "Butter",
      currentQuantity: 0,
    }),
    makeStock({
      ingredientId: "margarine",
      name: "Margarine",
      currentQuantity: 500,
    }),
    makeStock({
      ingredientId: "coconut-oil",
      name: "Coconut Oil",
      currentQuantity: 100,
      unit: "ml",
    }),
  ];

  it("finds applicable substitutions", () => {
    const suggestions = findSubstitutions("butter", 200, substitutions, stock);
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].substitute.name).toBe("Margarine");
    expect(suggestions[1].substitute.name).toBe("Coconut Oil");
  });

  it("marks feasible substitutions correctly", () => {
    const suggestions = findSubstitutions("butter", 200, substitutions, stock);
    // Margarine: need 200 * 1.0 = 200, have 500 → feasible
    expect(suggestions[0].substitute.isFeasible).toBe(true);
    // Coconut Oil: need 200 * 0.8 = 160, have 100 → not feasible
    expect(suggestions[1].substitute.isFeasible).toBe(false);
  });

  it("calculates substitute quantity using conversion ratio", () => {
    const suggestions = findSubstitutions("butter", 200, substitutions, stock);
    expect(suggestions[0].substitute.substituteQuantity).toBe(200);
    expect(suggestions[1].substitute.substituteQuantity).toBe(160);
  });

  it("returns empty for ingredients with no substitutions", () => {
    const suggestions = findSubstitutions("salt", 100, substitutions, stock);
    expect(suggestions).toHaveLength(0);
  });
});

describe("applySubstitution", () => {
  it("replaces the original ingredient with the substitute", () => {
    const ingredients = [
      {
        ingredientId: "butter",
        name: "Butter",
        quantity: 200,
        unitCost: 0.15,
        unit: "g",
      },
      {
        ingredientId: "flour",
        name: "Flour",
        quantity: 500,
        unitCost: 0.02,
        unit: "g",
      },
    ];

    const sub: IngredientSubstitution = {
      originalIngredientId: "butter",
      substituteIngredientId: "margarine",
      conversionRatio: 1.0,
    };

    const subStock = makeStock({
      ingredientId: "margarine",
      name: "Margarine",
      unitCost: 0.1,
      unit: "g",
    });

    const result = applySubstitution(ingredients, "butter", sub, subStock);

    expect(result).toHaveLength(2);
    expect(result[0].ingredientId).toBe("margarine");
    expect(result[0].name).toBe("Margarine");
    expect(result[0].quantity).toBe(200);
    expect(result[0].unitCost).toBe(0.1);
    // Flour unchanged
    expect(result[1].ingredientId).toBe("flour");
  });

  it("applies conversion ratio to quantity", () => {
    const ingredients = [
      {
        ingredientId: "butter",
        name: "Butter",
        quantity: 200,
        unitCost: 0.15,
        unit: "g",
      },
    ];

    const sub: IngredientSubstitution = {
      originalIngredientId: "butter",
      substituteIngredientId: "coconut-oil",
      conversionRatio: 0.8,
    };

    const subStock = makeStock({
      ingredientId: "coconut-oil",
      name: "Coconut Oil",
      unitCost: 0.2,
      unit: "ml",
    });

    const result = applySubstitution(ingredients, "butter", sub, subStock);
    expect(result[0].quantity).toBe(160);
  });
});
