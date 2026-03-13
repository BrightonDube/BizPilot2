/**
 * RecipeCostingAlertsService — price change propagation and high-cost alerts.
 *
 * Tasks: 5.3 (update on price changes), 5.4 (alert on high cost),
 *        6.2 (support waste factors)
 *
 * Why separate from RecipeService?
 * RecipeService handles single-recipe cost math. This service handles the
 * cross-cutting concern of propagating an ingredient price change across
 * ALL recipes that use that ingredient, and evaluating alert thresholds.
 * Separation keeps each module small and testable.
 */

import {
  Recipe,
  RecipeCostBreakdown,
  calculateRecipeCost,
  calculateFoodCostPercentage,
} from "./RecipeService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PriceChangeEvent {
  ingredientId: string;
  ingredientName: string;
  previousUnitCost: number;
  newUnitCost: number;
  /** ISO date string */
  changedAt: string;
}

export interface RecipeCostImpact {
  recipeId: string;
  recipeName: string;
  previousCost: number;
  newCost: number;
  costDifference: number;
  /** Percentage change in cost */
  percentageChange: number;
  previousFoodCostPct: number;
  newFoodCostPct: number;
  sellingPrice: number;
}

export interface CostAlert {
  recipeId: string;
  recipeName: string;
  alertType: "high_food_cost" | "cost_increase" | "margin_erosion";
  message: string;
  foodCostPercentage: number;
  sellingPrice: number;
  costPerPortion: number;
}

export interface WasteFactorUpdate {
  recipeId: string;
  previousWasteFactor: number;
  newWasteFactor: number;
  previousCost: number;
  newCost: number;
  costDifference: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Default alert thresholds for food cost monitoring.
 *
 * Why configurable defaults?
 * Different restaurant types have different acceptable food cost ranges.
 * Fine dining might accept 35-40%, fast food targets 25-30%. These defaults
 * are sensible mid-range values that the business can override.
 */
export const DEFAULT_COST_THRESHOLDS = {
  /** Food cost % above this triggers a "high_food_cost" alert */
  highFoodCostPercent: 35,
  /** Cost increase % above this triggers a "cost_increase" alert */
  significantIncreasePercent: 10,
  /** Minimum margin % — below this triggers "margin_erosion" */
  minimumMarginPercent: 50,
} as const;

// ---------------------------------------------------------------------------
// Task 5.3: Update costs on ingredient price changes
// ---------------------------------------------------------------------------

/**
 * Propagate an ingredient price change across all affected recipes.
 *
 * Returns the cost impact for each affected recipe so the UI can display
 * a summary like "Chicken price increase affects 12 recipes, avg +8% cost".
 *
 * @param recipes       - All recipes in the business
 * @param priceChange   - The price change event
 * @param sellingPrices - Map of recipe ID → selling price (for food cost % calc)
 */
export function calculatePriceChangeImpact(
  recipes: Recipe[],
  priceChange: PriceChangeEvent,
  sellingPrices: Map<string, number>
): RecipeCostImpact[] {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const affectedRecipes = recipes.filter((r) =>
    r.ingredients.some((i) => i.ingredientId === priceChange.ingredientId)
  );

  return affectedRecipes.map((recipe) => {
    // Calculate cost with old price
    const previousBreakdown = calculateRecipeCost(recipe);
    const sellingPrice = sellingPrices.get(recipe.id) ?? 0;
    const previousFoodCostPct =
      sellingPrice > 0
        ? calculateFoodCostPercentage(recipe, sellingPrice)
        : 0;

    // Calculate cost with new price
    const updatedIngredients = recipe.ingredients.map((ing) =>
      ing.ingredientId === priceChange.ingredientId
        ? { ...ing, unitCost: priceChange.newUnitCost }
        : ing
    );
    const updatedRecipe: Recipe = { ...recipe, ingredients: updatedIngredients };
    const newBreakdown = calculateRecipeCost(updatedRecipe);
    const newFoodCostPct =
      sellingPrice > 0
        ? calculateFoodCostPercentage(updatedRecipe, sellingPrice)
        : 0;

    const costDifference = round2(
      newBreakdown.costPerPortion - previousBreakdown.costPerPortion
    );
    const percentageChange =
      previousBreakdown.costPerPortion > 0
        ? round2(
            (costDifference / previousBreakdown.costPerPortion) * 100
          )
        : 0;

    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      previousCost: previousBreakdown.costPerPortion,
      newCost: newBreakdown.costPerPortion,
      costDifference,
      percentageChange,
      previousFoodCostPct,
      newFoodCostPct,
      sellingPrice,
    };
  });
}

/**
 * Apply a price change to a recipe's ingredients and return the updated recipe.
 *
 * Why not mutate in place?
 * The POS needs to preview "what if" scenarios before committing. Returning
 * a new object lets the UI show a diff without persisting anything.
 */
export function applyPriceChangeToRecipe(
  recipe: Recipe,
  ingredientId: string,
  newUnitCost: number
): Recipe {
  const updatedIngredients = recipe.ingredients.map((ing) =>
    ing.ingredientId === ingredientId
      ? { ...ing, unitCost: newUnitCost }
      : ing
  );
  return { ...recipe, ingredients: updatedIngredients };
}

// ---------------------------------------------------------------------------
// Task 5.4: Alert on high food cost
// ---------------------------------------------------------------------------

/**
 * Evaluate cost alerts for a set of recipes.
 *
 * Checks three conditions:
 * 1. Food cost % above threshold (high_food_cost)
 * 2. Recent cost increase above threshold (cost_increase)
 * 3. Margin below minimum threshold (margin_erosion)
 */
export function evaluateCostAlerts(
  recipes: Recipe[],
  sellingPrices: Map<string, number>,
  thresholds = DEFAULT_COST_THRESHOLDS
): CostAlert[] {
  const alerts: CostAlert[] = [];

  for (const recipe of recipes) {
    const sellingPrice = sellingPrices.get(recipe.id) ?? 0;
    if (sellingPrice <= 0) continue;

    const breakdown = calculateRecipeCost(recipe);
    const foodCostPct = calculateFoodCostPercentage(recipe, sellingPrice);
    const marginPct =
      Math.round(
        ((sellingPrice - breakdown.costPerPortion) / sellingPrice) * 10000
      ) / 100;

    // High food cost
    if (foodCostPct > thresholds.highFoodCostPercent) {
      alerts.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        alertType: "high_food_cost",
        message: `Food cost ${foodCostPct}% exceeds threshold of ${thresholds.highFoodCostPercent}%`,
        foodCostPercentage: foodCostPct,
        sellingPrice,
        costPerPortion: breakdown.costPerPortion,
      });
    }

    // Margin erosion
    if (marginPct < thresholds.minimumMarginPercent) {
      alerts.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        alertType: "margin_erosion",
        message: `Margin ${marginPct}% is below minimum of ${thresholds.minimumMarginPercent}%`,
        foodCostPercentage: foodCostPct,
        sellingPrice,
        costPerPortion: breakdown.costPerPortion,
      });
    }
  }

  return alerts;
}

/**
 * Evaluate cost increase alerts after a price change.
 */
export function evaluatePriceChangeAlerts(
  impacts: RecipeCostImpact[],
  thresholds = DEFAULT_COST_THRESHOLDS
): CostAlert[] {
  const alerts: CostAlert[] = [];

  for (const impact of impacts) {
    if (impact.percentageChange > thresholds.significantIncreasePercent) {
      alerts.push({
        recipeId: impact.recipeId,
        recipeName: impact.recipeName,
        alertType: "cost_increase",
        message: `Cost increased by ${impact.percentageChange}% (threshold: ${thresholds.significantIncreasePercent}%)`,
        foodCostPercentage: impact.newFoodCostPct,
        sellingPrice: impact.sellingPrice,
        costPerPortion: impact.newCost,
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Task 6.2: Support waste factors
// ---------------------------------------------------------------------------

/**
 * Update the waste factor for a recipe and calculate the cost impact.
 *
 * Why is waste factor a decimal (0.1) not a percentage (10)?
 * Consistency with the recipe model. The waste factor is multiplied
 * directly: totalCost = rawCost × (1 + wasteFactor). Storing as a decimal
 * avoids repeated division by 100 in hot paths.
 */
export function updateWasteFactor(
  recipe: Recipe,
  newWasteFactor: number
): WasteFactorUpdate {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  if (newWasteFactor < 0 || newWasteFactor > 1) {
    throw new Error(
      `Waste factor must be between 0 and 1 (got ${newWasteFactor})`
    );
  }

  const previousBreakdown = calculateRecipeCost(recipe);
  const updatedRecipe: Recipe = { ...recipe, wasteFactor: newWasteFactor };
  const newBreakdown = calculateRecipeCost(updatedRecipe);

  return {
    recipeId: recipe.id,
    previousWasteFactor: recipe.wasteFactor,
    newWasteFactor,
    previousCost: previousBreakdown.costPerPortion,
    newCost: newBreakdown.costPerPortion,
    costDifference: round2(
      newBreakdown.costPerPortion - previousBreakdown.costPerPortion
    ),
  };
}

/**
 * Calculate the optimal selling price to maintain a target food cost %.
 *
 * Used by menu engineering to suggest price adjustments when costs change.
 */
export function calculateTargetSellingPrice(
  recipe: Recipe,
  targetFoodCostPercent: number
): number {
  if (targetFoodCostPercent <= 0 || targetFoodCostPercent >= 100) {
    throw new Error(
      `Target food cost % must be between 0 and 100 (got ${targetFoodCostPercent})`
    );
  }

  const breakdown = calculateRecipeCost(recipe);
  return Math.round((breakdown.costPerPortion / (targetFoodCostPercent / 100)) * 100) / 100;
}
