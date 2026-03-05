/**
 * NutritionalInfoService — calorie calculation, allergen tracking,
 * dietary tags, and menu display formatting.
 *
 * Tasks: 7.1 (add nutritional fields), 7.2 (track allergens),
 *        7.3 (display on menu)
 *
 * Why a separate service from RecipeService?
 * Nutritional data is optional metadata that not all businesses need.
 * Keeping it in its own module means the core recipe costing path
 * stays lean, and businesses that don't track nutrition don't pay
 * the bundle size cost.
 *
 * Why pure functions?
 * Nutritional calculations (summing per-ingredient values scaled by
 * quantity) run on the POS for instant menu display. No server
 * round-trip needed — the ingredient nutritional data syncs with
 * the regular offline sync engine.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Standard nutritional values per base unit of an ingredient */
export interface IngredientNutrition {
  ingredientId: string;
  name: string;
  /** Nutritional values are per this many units (e.g., per 100g) */
  perQuantity: number;
  unit: string;
  calories: number;
  protein: number; // grams
  carbohydrates: number; // grams
  fat: number; // grams
  fiber: number; // grams
  sodium: number; // milligrams
  sugar: number; // grams
}

/**
 * Common food allergens per EU/SA regulations.
 *
 * Why an enum not free-text?
 * Allergen information is safety-critical. Free-text would lead to
 * inconsistencies ("milk" vs "Milk" vs "dairy"). A fixed set ensures
 * the POS can reliably filter and display warnings.
 */
export type Allergen =
  | "gluten"
  | "crustaceans"
  | "eggs"
  | "fish"
  | "peanuts"
  | "soybeans"
  | "milk"
  | "tree_nuts"
  | "celery"
  | "mustard"
  | "sesame"
  | "sulphites"
  | "lupin"
  | "molluscs";

/** All allergens for validation and iteration */
export const ALL_ALLERGENS: Allergen[] = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soybeans",
  "milk",
  "tree_nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
];

/** Dietary classification tags */
export type DietaryTag =
  | "vegetarian"
  | "vegan"
  | "gluten_free"
  | "dairy_free"
  | "nut_free"
  | "halal"
  | "kosher"
  | "low_carb"
  | "keto"
  | "sugar_free";

export interface IngredientAllergenInfo {
  ingredientId: string;
  name: string;
  allergens: Allergen[];
}

export interface RecipeNutrition {
  recipeId: string;
  recipeName: string;
  /** Nutritional values per single portion */
  perPortion: {
    calories: number;
    protein: number;
    carbohydrates: number;
    fat: number;
    fiber: number;
    sodium: number;
    sugar: number;
  };
  /** Total for the full recipe yield */
  totalRecipe: {
    calories: number;
    protein: number;
    carbohydrates: number;
    fat: number;
    fiber: number;
    sodium: number;
    sugar: number;
  };
}

export interface RecipeAllergenSummary {
  recipeId: string;
  recipeName: string;
  /** All allergens present in any ingredient */
  allergens: Allergen[];
  /** Which ingredient contributes which allergen */
  allergenSources: Array<{
    allergen: Allergen;
    ingredientId: string;
    ingredientName: string;
  }>;
}

export interface MenuItemNutritionDisplay {
  recipeId: string;
  recipeName: string;
  caloriesPerPortion: number;
  allergens: Allergen[];
  dietaryTags: DietaryTag[];
  /** Short formatted string for menu display, e.g., "485 cal | Contains: Gluten, Milk" */
  displayText: string;
}

// ---------------------------------------------------------------------------
// Task 7.1: Add nutritional fields / calculate calories
// ---------------------------------------------------------------------------

/**
 * Calculate nutritional values for a recipe by summing ingredient contributions.
 *
 * Each ingredient's nutrition is specified "per X units" (e.g., per 100g).
 * We scale by the actual quantity used in the recipe.
 *
 * @param recipeIngredients - Ingredients with quantities used in the recipe
 * @param nutritionData     - Nutritional values per ingredient
 * @param recipeYield       - Number of portions the recipe makes
 */
export function calculateRecipeNutrition(
  recipeIngredients: Array<{
    ingredientId: string;
    quantity: number;
  }>,
  nutritionData: IngredientNutrition[],
  recipeYield: number,
  recipeId: string = "",
  recipeName: string = ""
): RecipeNutrition {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const nutritionMap = new Map<string, IngredientNutrition>();
  for (const n of nutritionData) {
    nutritionMap.set(n.ingredientId, n);
  }

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;
  let totalSodium = 0;
  let totalSugar = 0;

  for (const ing of recipeIngredients) {
    const nutr = nutritionMap.get(ing.ingredientId);
    if (!nutr || nutr.perQuantity <= 0) continue;

    const ratio = ing.quantity / nutr.perQuantity;
    totalCalories += nutr.calories * ratio;
    totalProtein += nutr.protein * ratio;
    totalCarbs += nutr.carbohydrates * ratio;
    totalFat += nutr.fat * ratio;
    totalFiber += nutr.fiber * ratio;
    totalSodium += nutr.sodium * ratio;
    totalSugar += nutr.sugar * ratio;
  }

  const safeYield = recipeYield > 0 ? recipeYield : 1;

  return {
    recipeId,
    recipeName,
    perPortion: {
      calories: round1(totalCalories / safeYield),
      protein: round1(totalProtein / safeYield),
      carbohydrates: round1(totalCarbs / safeYield),
      fat: round1(totalFat / safeYield),
      fiber: round1(totalFiber / safeYield),
      sodium: round1(totalSodium / safeYield),
      sugar: round1(totalSugar / safeYield),
    },
    totalRecipe: {
      calories: round1(totalCalories),
      protein: round1(totalProtein),
      carbohydrates: round1(totalCarbs),
      fat: round1(totalFat),
      fiber: round1(totalFiber),
      sodium: round1(totalSodium),
      sugar: round1(totalSugar),
    },
  };
}

// ---------------------------------------------------------------------------
// Task 7.2: Track allergens
// ---------------------------------------------------------------------------

/**
 * Build an allergen summary for a recipe.
 *
 * Aggregates allergens from all ingredients and tracks which ingredient
 * is the source of each allergen. This is critical for customer safety —
 * the POS must be able to answer "which ingredient contains gluten?".
 */
export function buildAllergenSummary(
  recipeIngredients: Array<{ ingredientId: string }>,
  allergenData: IngredientAllergenInfo[],
  recipeId: string = "",
  recipeName: string = ""
): RecipeAllergenSummary {
  const allergenMap = new Map<string, IngredientAllergenInfo>();
  for (const a of allergenData) {
    allergenMap.set(a.ingredientId, a);
  }

  const allergenSet = new Set<Allergen>();
  const sources: RecipeAllergenSummary["allergenSources"] = [];

  for (const ing of recipeIngredients) {
    const info = allergenMap.get(ing.ingredientId);
    if (!info) continue;

    for (const allergen of info.allergens) {
      allergenSet.add(allergen);
      sources.push({
        allergen,
        ingredientId: info.ingredientId,
        ingredientName: info.name,
      });
    }
  }

  return {
    recipeId,
    recipeName,
    allergens: Array.from(allergenSet).sort(),
    allergenSources: sources,
  };
}

/**
 * Check if a recipe contains a specific allergen.
 */
export function recipeContainsAllergen(
  summary: RecipeAllergenSummary,
  allergen: Allergen
): boolean {
  return summary.allergens.includes(allergen);
}

/**
 * Filter recipes that are safe for a given set of allergens to avoid.
 */
export function filterAllergenSafeRecipes(
  summaries: RecipeAllergenSummary[],
  allergensToAvoid: Allergen[]
): RecipeAllergenSummary[] {
  return summaries.filter(
    (summary) =>
      !summary.allergens.some((a) => allergensToAvoid.includes(a))
  );
}

// ---------------------------------------------------------------------------
// Task 7.3: Display on menu
// ---------------------------------------------------------------------------

/**
 * Determine dietary tags for a recipe based on its allergens and ingredients.
 *
 * Why rule-based instead of ingredient tags?
 * A recipe is "gluten_free" only if ALL ingredients are gluten-free.
 * We derive this from allergen data rather than trusting per-ingredient
 * dietary tags, which could be stale or incorrectly set.
 */
export function deriveDietaryTags(
  allergenSummary: RecipeAllergenSummary,
  /** Optional explicit tags set by the kitchen manager */
  explicitTags: DietaryTag[] = []
): DietaryTag[] {
  const tags = new Set<DietaryTag>(explicitTags);

  // Auto-derive tags from allergen absence
  if (!allergenSummary.allergens.includes("gluten")) {
    tags.add("gluten_free");
  }
  if (!allergenSummary.allergens.includes("milk")) {
    tags.add("dairy_free");
  }
  if (
    !allergenSummary.allergens.includes("peanuts") &&
    !allergenSummary.allergens.includes("tree_nuts")
  ) {
    tags.add("nut_free");
  }

  return Array.from(tags).sort();
}

/**
 * Format the allergen label for display.
 * Converts "tree_nuts" → "Tree Nuts", "gluten" → "Gluten", etc.
 */
export function formatAllergenLabel(allergen: Allergen): string {
  return allergen
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Build menu-ready nutrition display data for a recipe.
 *
 * Combines nutrition, allergens, and dietary tags into a single object
 * optimised for rendering on the customer-facing display or menu.
 */
export function buildMenuNutritionDisplay(
  nutrition: RecipeNutrition,
  allergenSummary: RecipeAllergenSummary,
  dietaryTags: DietaryTag[]
): MenuItemNutritionDisplay {
  const allergenLabels = allergenSummary.allergens
    .map(formatAllergenLabel)
    .join(", ");

  const parts: string[] = [`${Math.round(nutrition.perPortion.calories)} cal`];
  if (allergenSummary.allergens.length > 0) {
    parts.push(`Contains: ${allergenLabels}`);
  }

  return {
    recipeId: nutrition.recipeId,
    recipeName: nutrition.recipeName,
    caloriesPerPortion: Math.round(nutrition.perPortion.calories),
    allergens: allergenSummary.allergens,
    dietaryTags,
    displayText: parts.join(" | "),
  };
}
