/**
 * Tests for RecipeCostingAlertsService — tasks 5.3, 5.4, 6.2.
 *
 * Coverage:
 * - Price change impact propagation across recipes
 * - Cost alert evaluation (high food cost, margin erosion)
 * - Price change alert evaluation
 * - Waste factor updates and cost impact
 * - Target selling price calculation
 */

import {
  calculatePriceChangeImpact,
  applyPriceChangeToRecipe,
  evaluateCostAlerts,
  evaluatePriceChangeAlerts,
  updateWasteFactor,
  calculateTargetSellingPrice,
  DEFAULT_COST_THRESHOLDS,
} from "../services/recipe/RecipeCostingAlertsService";

import { Recipe } from "../services/recipe/RecipeService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "recipe-1",
    name: "Grilled Chicken",
    ingredients: [
      {
        ingredientId: "chicken",
        name: "Chicken Breast",
        quantity: 300,
        unitCost: 0.12,
        unit: "g",
      },
      {
        ingredientId: "oil",
        name: "Olive Oil",
        quantity: 20,
        unitCost: 0.08,
        unit: "ml",
      },
    ],
    yield: 1,
    wasteFactor: 0.1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Task 5.3: Price change impact
// ---------------------------------------------------------------------------

describe("calculatePriceChangeImpact", () => {
  it("identifies affected recipes", () => {
    const recipes = [
      makeRecipe({ id: "r1" }),
      makeRecipe({
        id: "r2",
        name: "Salad",
        ingredients: [
          {
            ingredientId: "lettuce",
            name: "Lettuce",
            quantity: 100,
            unitCost: 0.05,
            unit: "g",
          },
        ],
      }),
    ];

    const impacts = calculatePriceChangeImpact(
      recipes,
      {
        ingredientId: "chicken",
        ingredientName: "Chicken Breast",
        previousUnitCost: 0.12,
        newUnitCost: 0.15,
        changedAt: "2024-01-15T10:00:00Z",
      },
      new Map([
        ["r1", 100],
        ["r2", 50],
      ])
    );

    // Only r1 uses chicken
    expect(impacts).toHaveLength(1);
    expect(impacts[0].recipeId).toBe("r1");
  });

  it("calculates cost difference correctly", () => {
    const recipe = makeRecipe({ id: "r1", yield: 1, wasteFactor: 0 });
    // Cost = 300*0.12 + 20*0.08 = 36 + 1.6 = 37.6
    // New cost = 300*0.15 + 20*0.08 = 45 + 1.6 = 46.6
    // Difference = 46.6 - 37.6 = 9.0

    const impacts = calculatePriceChangeImpact(
      [recipe],
      {
        ingredientId: "chicken",
        ingredientName: "Chicken Breast",
        previousUnitCost: 0.12,
        newUnitCost: 0.15,
        changedAt: "2024-01-15T10:00:00Z",
      },
      new Map([["r1", 100]])
    );

    expect(impacts[0].previousCost).toBe(37.6);
    expect(impacts[0].newCost).toBe(46.6);
    expect(impacts[0].costDifference).toBe(9);
  });

  it("calculates food cost percentage change", () => {
    const recipe = makeRecipe({ id: "r1", yield: 1, wasteFactor: 0 });

    const impacts = calculatePriceChangeImpact(
      [recipe],
      {
        ingredientId: "chicken",
        ingredientName: "Chicken",
        previousUnitCost: 0.12,
        newUnitCost: 0.15,
        changedAt: "2024-01-15T10:00:00Z",
      },
      new Map([["r1", 100]])
    );

    // Previous: 37.6/100 * 100 = 37.6%
    // New: 46.6/100 * 100 = 46.6%
    expect(impacts[0].previousFoodCostPct).toBe(37.6);
    expect(impacts[0].newFoodCostPct).toBe(46.6);
  });
});

describe("applyPriceChangeToRecipe", () => {
  it("updates the ingredient cost without mutating original", () => {
    const original = makeRecipe();
    const updated = applyPriceChangeToRecipe(original, "chicken", 0.2);

    expect(updated.ingredients[0].unitCost).toBe(0.2);
    // Original unchanged
    expect(original.ingredients[0].unitCost).toBe(0.12);
  });

  it("only changes the targeted ingredient", () => {
    const updated = applyPriceChangeToRecipe(makeRecipe(), "chicken", 0.2);
    expect(updated.ingredients[1].unitCost).toBe(0.08); // oil unchanged
  });
});

// ---------------------------------------------------------------------------
// Task 5.4: Cost alerts
// ---------------------------------------------------------------------------

describe("evaluateCostAlerts", () => {
  it("flags high food cost recipes", () => {
    // Recipe cost per portion (with waste) > 35% of selling price
    const recipe = makeRecipe({ id: "r1", yield: 1, wasteFactor: 0.1 });
    // Cost = (300*0.12 + 20*0.08) * 1.1 = 37.6 * 1.1 = 41.36
    // Selling price of 80 → food cost = 41.36/80 * 100 = 51.7% > 35%
    const alerts = evaluateCostAlerts(
      [recipe],
      new Map([["r1", 80]])
    );

    const highCost = alerts.filter((a) => a.alertType === "high_food_cost");
    expect(highCost.length).toBeGreaterThan(0);
  });

  it("flags margin erosion", () => {
    const recipe = makeRecipe({ id: "r1", yield: 1, wasteFactor: 0.1 });
    // Cost ≈ 41.36, selling price 60 → margin = (60-41.36)/60 = 31% < 50%
    const alerts = evaluateCostAlerts(
      [recipe],
      new Map([["r1", 60]])
    );

    const marginAlerts = alerts.filter((a) => a.alertType === "margin_erosion");
    expect(marginAlerts.length).toBeGreaterThan(0);
  });

  it("returns no alerts for healthy recipes", () => {
    const recipe = makeRecipe({ id: "r1", yield: 1, wasteFactor: 0 });
    // Cost = 37.6, selling price 200 → food cost = 18.8%, margin = 81.2%
    const alerts = evaluateCostAlerts(
      [recipe],
      new Map([["r1", 200]])
    );
    expect(alerts).toHaveLength(0);
  });

  it("skips recipes with no selling price", () => {
    const alerts = evaluateCostAlerts(
      [makeRecipe({ id: "r1" })],
      new Map() // no selling prices
    );
    expect(alerts).toHaveLength(0);
  });
});

describe("evaluatePriceChangeAlerts", () => {
  it("flags significant cost increases", () => {
    const impacts = [
      {
        recipeId: "r1",
        recipeName: "Chicken",
        previousCost: 40,
        newCost: 50,
        costDifference: 10,
        percentageChange: 25, // > 10% threshold
        previousFoodCostPct: 30,
        newFoodCostPct: 37.5,
        sellingPrice: 100,
      },
    ];

    const alerts = evaluatePriceChangeAlerts(impacts);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertType).toBe("cost_increase");
  });

  it("ignores small cost increases", () => {
    const impacts = [
      {
        recipeId: "r1",
        recipeName: "Chicken",
        previousCost: 40,
        newCost: 41,
        costDifference: 1,
        percentageChange: 2.5, // < 10% threshold
        previousFoodCostPct: 30,
        newFoodCostPct: 30.75,
        sellingPrice: 100,
      },
    ];

    const alerts = evaluatePriceChangeAlerts(impacts);
    expect(alerts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Task 6.2: Waste factors
// ---------------------------------------------------------------------------

describe("updateWasteFactor", () => {
  it("calculates cost impact of waste factor change", () => {
    const recipe = makeRecipe({ wasteFactor: 0.1 });
    const result = updateWasteFactor(recipe, 0.2);

    expect(result.previousWasteFactor).toBe(0.1);
    expect(result.newWasteFactor).toBe(0.2);
    expect(result.newCost).toBeGreaterThan(result.previousCost);
  });

  it("throws for invalid waste factor", () => {
    expect(() => updateWasteFactor(makeRecipe(), -0.1)).toThrow();
    expect(() => updateWasteFactor(makeRecipe(), 1.5)).toThrow();
  });

  it("correctly calculates cost difference", () => {
    const recipe = makeRecipe({ yield: 1 });
    // Raw cost = 300*0.12 + 20*0.08 = 37.6
    // At 0.1 waste: 37.6 * 1.1 = 41.36
    // At 0.2 waste: 37.6 * 1.2 = 45.12
    // Difference = 45.12 - 41.36 = 3.76
    const result = updateWasteFactor(recipe, 0.2);
    expect(result.costDifference).toBe(3.76);
  });
});

describe("calculateTargetSellingPrice", () => {
  it("calculates price for target food cost %", () => {
    const recipe = makeRecipe({ yield: 1, wasteFactor: 0 });
    // Cost per portion = 37.6
    // Target 30% → price = 37.6 / 0.3 = 125.33
    const price = calculateTargetSellingPrice(recipe, 30);
    expect(price).toBe(125.33);
  });

  it("throws for invalid target percentage", () => {
    expect(() => calculateTargetSellingPrice(makeRecipe(), 0)).toThrow();
    expect(() => calculateTargetSellingPrice(makeRecipe(), 100)).toThrow();
  });
});
