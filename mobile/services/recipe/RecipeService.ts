/**
 * RecipeService — pure recipe costing and ingredient deduction.
 * (recipe-management task 2.4)
 *
 * Properties (from design.md):
 *   Property 1: cost = sum(ingredient_qty × ingredient_cost) × wasteFactor
 *   Property 2: For any sale of quantity q, ingredients are deducted by
 *               (recipe_qty × q) for each ingredient.
 *
 * Why pure functions?
 * Recipe costing must be available offline (e.g., to show food cost % on
 * the POS before placing an order). Pure functions also make the menu
 * engineering screen reactive: updating a single ingredient price instantly
 * recalculates all affected recipe costs via useMemo.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecipeIngredient {
  ingredientId: string;
  name: string;
  /** Quantity required per recipe yield */
  quantity: number;
  /** Unit cost per unit of the ingredient */
  unitCost: number;
  /** Unit of measure (g, ml, each, etc.) */
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  menuItemId?: string;
  ingredients: RecipeIngredient[];
  /** Number of portions this recipe yields */
  yield: number;
  /** Waste factor as a decimal (e.g., 0.1 = 10% waste, so cost × 1.1) */
  wasteFactor: number;
  instructions?: string;
}

export interface RecipeCostBreakdown {
  /** Total raw cost of all ingredients (before waste) */
  rawIngredientCost: number;
  /** Additional cost due to waste */
  wasteAmount: number;
  /** Total cost including waste = rawIngredientCost × (1 + wasteFactor) */
  totalCost: number;
  /** Cost per portion = totalCost / yield */
  costPerPortion: number;
  /** Line-by-line breakdown */
  lines: Array<{
    ingredientId: string;
    name: string;
    quantity: number;
    unitCost: number;
    lineCost: number;
  }>;
}

export interface IngredientDeduction {
  ingredientId: string;
  deductQuantity: number;
}

// ---------------------------------------------------------------------------
// Property 1: Recipe cost calculation (task 2.4)
// ---------------------------------------------------------------------------

/**
 * Calculate the full cost breakdown for a recipe.
 *
 * Property 1: totalCost = sum(qty × unitCost) × (1 + wasteFactor)
 *
 * @param recipe - The recipe with its ingredients
 */
export function calculateRecipeCost(recipe: Recipe): RecipeCostBreakdown {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const lines = recipe.ingredients.map((ing) => ({
    ingredientId: ing.ingredientId,
    name: ing.name,
    quantity: ing.quantity,
    unitCost: ing.unitCost,
    lineCost: round2(ing.quantity * ing.unitCost),
  }));

  const rawIngredientCost = round2(lines.reduce((s, l) => s + l.lineCost, 0));
  const wasteAmount = round2(rawIngredientCost * recipe.wasteFactor);
  const totalCost = round2(rawIngredientCost + wasteAmount);
  const costPerPortion = recipe.yield > 0
    ? round2(totalCost / recipe.yield)
    : 0;

  return {
    rawIngredientCost,
    wasteAmount,
    totalCost,
    costPerPortion,
    lines,
  };
}

/**
 * Calculate the food cost percentage for a menu item.
 *
 * Food cost % = (costPerPortion / sellingPrice) × 100
 * Industry target is typically 25-35%.
 *
 * @param recipe       - Recipe to cost
 * @param sellingPrice - Current menu price
 */
export function calculateFoodCostPercentage(
  recipe: Recipe,
  sellingPrice: number
): number {
  if (sellingPrice <= 0) return 0;
  const { costPerPortion } = calculateRecipeCost(recipe);
  return Math.round((costPerPortion / sellingPrice) * 10000) / 100;
}

/**
 * Calculate the gross profit for a single sale of a recipe item.
 */
export function calculateGrossProfit(
  recipe: Recipe,
  sellingPrice: number
): number {
  const { costPerPortion } = calculateRecipeCost(recipe);
  return Math.round((sellingPrice - costPerPortion) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Property 2: Ingredient deduction on sale (task 2.4)
// ---------------------------------------------------------------------------

/**
 * Calculate the ingredient deductions for selling `soldQuantity` of a recipe.
 *
 * Property 2: deductQuantity = recipe_ingredient_qty × soldQuantity
 *
 * Returns a list of deductions to apply to the inventory.
 * The caller (OrderService) applies these deductions to the WatermelonDB
 * ingredient records inside a single database.write() transaction.
 */
export function calculateIngredientDeductions(
  recipe: Recipe,
  soldQuantity: number
): IngredientDeduction[] {
  if (soldQuantity <= 0) return [];

  return recipe.ingredients.map((ing) => ({
    ingredientId: ing.ingredientId,
    deductQuantity:
      Math.round(ing.quantity * soldQuantity * 1000) / 1000, // 3dp for weight/volume
  }));
}

/**
 * Update a recipe's ingredient costs and return the new cost breakdown.
 * Used when a supplier changes the price of an ingredient.
 *
 * @param recipe          - Original recipe
 * @param ingredientId    - Ingredient whose cost changed
 * @param newUnitCost     - New cost per unit
 */
export function updateIngredientCost(
  recipe: Recipe,
  ingredientId: string,
  newUnitCost: number
): { recipe: Recipe; costBreakdown: RecipeCostBreakdown } {
  const updatedIngredients = recipe.ingredients.map((ing) =>
    ing.ingredientId === ingredientId
      ? { ...ing, unitCost: newUnitCost }
      : ing
  );
  const updatedRecipe = { ...recipe, ingredients: updatedIngredients };
  return {
    recipe: updatedRecipe,
    costBreakdown: calculateRecipeCost(updatedRecipe),
  };
}
