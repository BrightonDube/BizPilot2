/**
 * RecipeService unit tests + PBTs
 * (recipe-management task 2.4)
 *
 * PBT Properties:
 *   Property 1: totalCost = sum(qty × unitCost) × (1 + wasteFactor)
 *   Property 2: ingredientDeduction = recipe_qty × soldQuantity for each ingredient
 */

import {
  calculateRecipeCost,
  calculateFoodCostPercentage,
  calculateGrossProfit,
  calculateIngredientDeductions,
  updateIngredientCost,
  type Recipe,
  type RecipeIngredient,
} from "@/services/recipe/RecipeService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIngredient(
  id: string,
  qty: number,
  unitCost: number
): RecipeIngredient {
  return { ingredientId: id, name: `Ing ${id}`, quantity: qty, unitCost, unit: "g" };
}

function makeRecipe(
  ingredients: RecipeIngredient[],
  wasteFactor = 0,
  yieldAmount = 1
): Recipe {
  return {
    id: "recipe-1",
    name: "Test Recipe",
    ingredients,
    yield: yieldAmount,
    wasteFactor,
  };
}

// ---------------------------------------------------------------------------
// Unit tests: calculateRecipeCost
// ---------------------------------------------------------------------------

describe("calculateRecipeCost", () => {
  it("returns zero for empty ingredients", () => {
    const recipe = makeRecipe([]);
    const { totalCost } = calculateRecipeCost(recipe);
    expect(totalCost).toBe(0);
  });

  it("calculates single ingredient cost correctly", () => {
    const recipe = makeRecipe([makeIngredient("i1", 2, 10)], 0);
    const { totalCost, rawIngredientCost } = calculateRecipeCost(recipe);
    expect(rawIngredientCost).toBe(20);
    expect(totalCost).toBe(20); // 0% waste
  });

  it("applies waste factor correctly", () => {
    const recipe = makeRecipe([makeIngredient("i1", 2, 10)], 0.1);
    const { totalCost, wasteAmount } = calculateRecipeCost(recipe);
    // raw = 20, waste = 2, total = 22
    expect(wasteAmount).toBe(2);
    expect(totalCost).toBe(22);
  });

  it("sums multiple ingredients", () => {
    const recipe = makeRecipe([
      makeIngredient("i1", 1, 10),
      makeIngredient("i2", 2, 5),
      makeIngredient("i3", 0.5, 20),
    ], 0);
    const { rawIngredientCost } = calculateRecipeCost(recipe);
    // 10 + 10 + 10 = 30
    expect(rawIngredientCost).toBe(30);
  });

  it("divides cost by yield for costPerPortion", () => {
    const recipe = makeRecipe([makeIngredient("i1", 10, 5)], 0, 2);
    const { costPerPortion } = calculateRecipeCost(recipe);
    // raw = 50, total = 50, yield = 2, per portion = 25
    expect(costPerPortion).toBe(25);
  });

  it("returns zero costPerPortion when yield is 0", () => {
    const recipe = makeRecipe([makeIngredient("i1", 1, 10)], 0, 0);
    const { costPerPortion } = calculateRecipeCost(recipe);
    expect(costPerPortion).toBe(0);
  });

  it("line breakdown sums match rawIngredientCost", () => {
    const recipe = makeRecipe([
      makeIngredient("i1", 3, 7),
      makeIngredient("i2", 1.5, 4),
    ], 0);
    const { lines, rawIngredientCost } = calculateRecipeCost(recipe);
    const lineSum = lines.reduce((s, l) => s + l.lineCost, 0);
    expect(Math.abs(lineSum - rawIngredientCost)).toBeLessThan(0.01);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: calculateFoodCostPercentage
// ---------------------------------------------------------------------------

describe("calculateFoodCostPercentage", () => {
  it("calculates percentage correctly", () => {
    const recipe = makeRecipe([makeIngredient("i1", 1, 25)], 0, 1);
    // costPerPortion = 25, sellingPrice = 100 → 25%
    const pct = calculateFoodCostPercentage(recipe, 100);
    expect(pct).toBe(25);
  });

  it("returns 0 for zero selling price", () => {
    const recipe = makeRecipe([makeIngredient("i1", 1, 10)], 0);
    expect(calculateFoodCostPercentage(recipe, 0)).toBe(0);
  });

  it("handles > 100% food cost", () => {
    const recipe = makeRecipe([makeIngredient("i1", 1, 200)], 0);
    const pct = calculateFoodCostPercentage(recipe, 100);
    expect(pct).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: calculateGrossProfit
// ---------------------------------------------------------------------------

describe("calculateGrossProfit", () => {
  it("calculates profit correctly", () => {
    const recipe = makeRecipe([makeIngredient("i1", 1, 25)], 0, 1);
    const profit = calculateGrossProfit(recipe, 100);
    expect(profit).toBe(75);
  });

  it("profit is negative when sellingPrice < costPerPortion", () => {
    const recipe = makeRecipe([makeIngredient("i1", 1, 200)], 0, 1);
    const profit = calculateGrossProfit(recipe, 100);
    expect(profit).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: calculateIngredientDeductions (Property 2 basic)
// ---------------------------------------------------------------------------

describe("calculateIngredientDeductions", () => {
  it("returns empty array for zero sold", () => {
    const recipe = makeRecipe([makeIngredient("i1", 2, 10)]);
    expect(calculateIngredientDeductions(recipe, 0)).toHaveLength(0);
  });

  it("deducts correct quantity for each ingredient", () => {
    const recipe = makeRecipe([
      makeIngredient("i1", 2, 10),
      makeIngredient("i2", 0.5, 20),
    ]);
    const deductions = calculateIngredientDeductions(recipe, 3);
    const d1 = deductions.find((d) => d.ingredientId === "i1")!;
    const d2 = deductions.find((d) => d.ingredientId === "i2")!;
    expect(d1.deductQuantity).toBe(6);       // 2 × 3
    expect(d2.deductQuantity).toBe(1.5);     // 0.5 × 3
  });

  it("returns one deduction per ingredient", () => {
    const recipe = makeRecipe([
      makeIngredient("i1", 1, 5),
      makeIngredient("i2", 1, 5),
      makeIngredient("i3", 1, 5),
    ]);
    expect(calculateIngredientDeductions(recipe, 2)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: updateIngredientCost
// ---------------------------------------------------------------------------

describe("updateIngredientCost", () => {
  it("updates only the specified ingredient", () => {
    const recipe = makeRecipe([
      makeIngredient("i1", 1, 10),
      makeIngredient("i2", 1, 20),
    ]);
    const { recipe: updated } = updateIngredientCost(recipe, "i1", 50);
    const ing = updated.ingredients.find((i) => i.ingredientId === "i1")!;
    expect(ing.unitCost).toBe(50);
    const other = updated.ingredients.find((i) => i.ingredientId === "i2")!;
    expect(other.unitCost).toBe(20); // unchanged
  });

  it("recalculates cost breakdown after update", () => {
    const recipe = makeRecipe([makeIngredient("i1", 1, 10)]);
    const { costBreakdown } = updateIngredientCost(recipe, "i1", 100);
    expect(costBreakdown.rawIngredientCost).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// PBT: Property 1 — Cost formula invariant (task 2.4)
// ---------------------------------------------------------------------------

describe("PBT Property 1: totalCost = sum(qty × unitCost) × (1 + wasteFactor) (task 2.4)", () => {
  it("Property 1 holds for any ingredient list and waste factor — 500 runs", () => {
    for (let i = 0; i < 500; i++) {
      const n = Math.floor(Math.random() * 10) + 1;
      const ingredients: RecipeIngredient[] = Array.from({ length: n }, (_, j) => ({
        ingredientId: `i-${j}`,
        name: `Ing ${j}`,
        quantity: Math.round((Math.random() * 10 + 0.1) * 100) / 100,
        unitCost: Math.round((Math.random() * 100 + 0.5) * 100) / 100,
        unit: "g",
      }));
      const wasteFactor = Math.round(Math.random() * 0.5 * 100) / 100; // 0 to 50%
      const yieldAmount = Math.floor(Math.random() * 5) + 1;

      const recipe: Recipe = {
        id: "r1", name: "Test", ingredients, yield: yieldAmount, wasteFactor,
      };
      const { rawIngredientCost, wasteAmount, totalCost, costPerPortion } =
        calculateRecipeCost(recipe);

      // Property 1a: raw = sum of line costs
      const rawExpected = Math.round(
        ingredients.reduce((s, ing) => s + ing.quantity * ing.unitCost, 0) * 100
      ) / 100;
      expect(Math.abs(rawIngredientCost - rawExpected)).toBeLessThan(0.02);

      // Property 1b: waste = raw × wasteFactor
      const wasteExpected = Math.round(rawExpected * wasteFactor * 100) / 100;
      expect(Math.abs(wasteAmount - wasteExpected)).toBeLessThan(0.02);

      // Property 1c: total = raw + waste
      expect(Math.abs(totalCost - (rawIngredientCost + wasteAmount))).toBeLessThan(0.02);

      // Property 1d: costPerPortion × yield ≈ totalCost
      expect(Math.abs(costPerPortion * yieldAmount - totalCost)).toBeLessThan(0.05);
    }
  });

  it("food cost % × sellingPrice ≈ costPerPortion — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const unitCost = Math.round((Math.random() * 100 + 1) * 100) / 100;
      const recipe = makeRecipe([makeIngredient("i1", 1, unitCost)], 0, 1);
      const sellingPrice = Math.round((Math.random() * 200 + unitCost) * 100) / 100;
      const pct = calculateFoodCostPercentage(recipe, sellingPrice);
      const costPerPortion = calculateRecipeCost(recipe).costPerPortion;
      // (pct / 100) × sellingPrice ≈ costPerPortion
      expect(Math.abs((pct / 100) * sellingPrice - costPerPortion)).toBeLessThan(0.05);
    }
  });
});

// ---------------------------------------------------------------------------
// PBT: Property 2 — Deduction invariant (task 2.4)
// ---------------------------------------------------------------------------

describe("PBT Property 2: deductQuantity = recipe_qty × soldQuantity (task 2.4)", () => {
  it("Property 2 holds for any recipe and sold quantity — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const n = Math.floor(Math.random() * 8) + 1;
      const ingredients: RecipeIngredient[] = Array.from({ length: n }, (_, j) => ({
        ingredientId: `i-${j}`,
        name: `Ing ${j}`,
        quantity: Math.round((Math.random() * 5 + 0.1) * 100) / 100,
        unitCost: 10,
        unit: "g",
      }));
      const soldQty = Math.floor(Math.random() * 20) + 1;
      const recipe: Recipe = {
        id: "r1", name: "R", ingredients, yield: 1, wasteFactor: 0,
      };

      const deductions = calculateIngredientDeductions(recipe, soldQty);
      expect(deductions).toHaveLength(n);

      for (let j = 0; j < n; j++) {
        const expected = Math.round(ingredients[j].quantity * soldQty * 1000) / 1000;
        expect(Math.abs(deductions[j].deductQuantity - expected)).toBeLessThan(0.001);
      }
    }
  });

  it("total deductions scale linearly with sold quantity — 200 runs", () => {
    for (let i = 0; i < 200; i++) {
      const qty1 = Math.floor(Math.random() * 5) + 1;
      const qty2 = Math.floor(Math.random() * 5) + 1;
      const ingredients: RecipeIngredient[] = [
        makeIngredient("i1", 2, 5),
        makeIngredient("i2", 0.5, 20),
      ];
      const recipe = makeRecipe(ingredients);
      const d1 = calculateIngredientDeductions(recipe, qty1);
      const d2 = calculateIngredientDeductions(recipe, qty2);
      const d12 = calculateIngredientDeductions(recipe, qty1 + qty2);

      // Linearity: deduct(qty1 + qty2) = deduct(qty1) + deduct(qty2)
      for (let k = 0; k < d12.length; k++) {
        const combined = d1[k].deductQuantity + d2[k].deductQuantity;
        expect(Math.abs(d12[k].deductQuantity - combined)).toBeLessThan(0.001);
      }
    }
  });
});
