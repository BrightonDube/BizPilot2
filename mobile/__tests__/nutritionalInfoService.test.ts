/**
 * Tests for NutritionalInfoService — tasks 7.1-7.3.
 *
 * Coverage:
 * - Recipe nutrition calculation from ingredients (7.1)
 * - Allergen aggregation and source tracking (7.2)
 * - Allergen filtering for safe recipes (7.2)
 * - Dietary tag derivation from allergens (7.3)
 * - Menu nutrition display formatting (7.3)
 */

import {
  calculateRecipeNutrition,
  buildAllergenSummary,
  recipeContainsAllergen,
  filterAllergenSafeRecipes,
  deriveDietaryTags,
  formatAllergenLabel,
  buildMenuNutritionDisplay,
  IngredientNutrition,
  IngredientAllergenInfo,
  ALL_ALLERGENS,
} from "../services/recipe/NutritionalInfoService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNutrition(
  overrides: Partial<IngredientNutrition> = {}
): IngredientNutrition {
  return {
    ingredientId: "chicken",
    name: "Chicken Breast",
    perQuantity: 100,
    unit: "g",
    calories: 165,
    protein: 31,
    carbohydrates: 0,
    fat: 3.6,
    fiber: 0,
    sodium: 74,
    sugar: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Task 7.1: Nutritional calculation
// ---------------------------------------------------------------------------

describe("calculateRecipeNutrition", () => {
  it("calculates per-portion nutrition from ingredients", () => {
    const ingredients = [
      { ingredientId: "chicken", quantity: 200 },
      { ingredientId: "rice", quantity: 150 },
    ];

    const nutritionData = [
      makeNutrition({
        ingredientId: "chicken",
        perQuantity: 100,
        calories: 165,
        protein: 31,
        carbohydrates: 0,
        fat: 3.6,
        fiber: 0,
        sodium: 74,
        sugar: 0,
      }),
      makeNutrition({
        ingredientId: "rice",
        name: "Rice",
        perQuantity: 100,
        calories: 130,
        protein: 2.7,
        carbohydrates: 28,
        fat: 0.3,
        fiber: 0.4,
        sodium: 1,
        sugar: 0,
      }),
    ];

    const result = calculateRecipeNutrition(
      ingredients,
      nutritionData,
      2, // 2 portions
      "r1",
      "Chicken Rice"
    );

    // Total: chicken 200/100 * 165 = 330 + rice 150/100 * 130 = 195 = 525
    expect(result.totalRecipe.calories).toBe(525);
    expect(result.perPortion.calories).toBe(262.5);
    expect(result.recipeId).toBe("r1");
    expect(result.recipeName).toBe("Chicken Rice");
  });

  it("handles single portion yield", () => {
    const result = calculateRecipeNutrition(
      [{ ingredientId: "chicken", quantity: 100 }],
      [makeNutrition()],
      1
    );

    expect(result.perPortion.calories).toBe(result.totalRecipe.calories);
  });

  it("skips ingredients without nutrition data", () => {
    const result = calculateRecipeNutrition(
      [
        { ingredientId: "chicken", quantity: 100 },
        { ingredientId: "unknown", quantity: 50 },
      ],
      [makeNutrition()],
      1
    );

    // Only chicken contributes
    expect(result.totalRecipe.calories).toBe(165);
  });

  it("handles zero yield gracefully", () => {
    const result = calculateRecipeNutrition(
      [{ ingredientId: "chicken", quantity: 100 }],
      [makeNutrition()],
      0
    );

    // Falls back to yield of 1
    expect(result.perPortion.calories).toBe(165);
  });
});

// ---------------------------------------------------------------------------
// Task 7.2: Allergen tracking
// ---------------------------------------------------------------------------

describe("buildAllergenSummary", () => {
  const allergenData: IngredientAllergenInfo[] = [
    { ingredientId: "flour", name: "Wheat Flour", allergens: ["gluten"] },
    {
      ingredientId: "butter",
      name: "Butter",
      allergens: ["milk"],
    },
    {
      ingredientId: "peanut-sauce",
      name: "Peanut Sauce",
      allergens: ["peanuts", "soybeans"],
    },
  ];

  it("aggregates allergens from all ingredients", () => {
    const summary = buildAllergenSummary(
      [{ ingredientId: "flour" }, { ingredientId: "butter" }],
      allergenData,
      "r1",
      "Pastry"
    );

    expect(summary.allergens).toContain("gluten");
    expect(summary.allergens).toContain("milk");
    expect(summary.allergens).toHaveLength(2);
  });

  it("tracks allergen sources", () => {
    const summary = buildAllergenSummary(
      [{ ingredientId: "flour" }, { ingredientId: "butter" }],
      allergenData
    );

    const glutenSource = summary.allergenSources.find(
      (s) => s.allergen === "gluten"
    );
    expect(glutenSource?.ingredientName).toBe("Wheat Flour");
  });

  it("handles multiple allergens from one ingredient", () => {
    const summary = buildAllergenSummary(
      [{ ingredientId: "peanut-sauce" }],
      allergenData
    );

    expect(summary.allergens).toContain("peanuts");
    expect(summary.allergens).toContain("soybeans");
    expect(summary.allergenSources).toHaveLength(2);
  });

  it("returns empty for allergen-free ingredients", () => {
    const summary = buildAllergenSummary(
      [{ ingredientId: "chicken" }],
      [] // no allergen data for chicken
    );
    expect(summary.allergens).toHaveLength(0);
  });
});

describe("recipeContainsAllergen", () => {
  it("returns true if allergen present", () => {
    const summary = {
      recipeId: "r1",
      recipeName: "Pasta",
      allergens: ["gluten" as const, "milk" as const],
      allergenSources: [],
    };
    expect(recipeContainsAllergen(summary, "gluten")).toBe(true);
  });

  it("returns false if allergen not present", () => {
    const summary = {
      recipeId: "r1",
      recipeName: "Pasta",
      allergens: ["gluten" as const],
      allergenSources: [],
    };
    expect(recipeContainsAllergen(summary, "peanuts")).toBe(false);
  });
});

describe("filterAllergenSafeRecipes", () => {
  it("filters out recipes containing specified allergens", () => {
    const summaries = [
      {
        recipeId: "r1",
        recipeName: "Pasta",
        allergens: ["gluten" as const, "milk" as const],
        allergenSources: [],
      },
      {
        recipeId: "r2",
        recipeName: "Salad",
        allergens: [] as const,
        allergenSources: [],
      },
      {
        recipeId: "r3",
        recipeName: "Stir Fry",
        allergens: ["peanuts" as const],
        allergenSources: [],
      },
    ];

    const safe = filterAllergenSafeRecipes(summaries, ["gluten", "peanuts"]);
    expect(safe).toHaveLength(1);
    expect(safe[0].recipeId).toBe("r2");
  });
});

// ---------------------------------------------------------------------------
// Task 7.3: Menu display
// ---------------------------------------------------------------------------

describe("deriveDietaryTags", () => {
  it("adds gluten_free when no gluten allergen", () => {
    const summary = {
      recipeId: "r1",
      recipeName: "Salad",
      allergens: [] as const,
      allergenSources: [],
    };
    const tags = deriveDietaryTags(summary);
    expect(tags).toContain("gluten_free");
  });

  it("adds dairy_free when no milk allergen", () => {
    const summary = {
      recipeId: "r1",
      recipeName: "Steak",
      allergens: [] as const,
      allergenSources: [],
    };
    const tags = deriveDietaryTags(summary);
    expect(tags).toContain("dairy_free");
  });

  it("adds nut_free when no peanuts or tree_nuts", () => {
    const summary = {
      recipeId: "r1",
      recipeName: "Pasta",
      allergens: ["gluten" as const],
      allergenSources: [],
    };
    const tags = deriveDietaryTags(summary);
    expect(tags).toContain("nut_free");
  });

  it("does NOT add gluten_free when gluten present", () => {
    const summary = {
      recipeId: "r1",
      recipeName: "Bread",
      allergens: ["gluten" as const],
      allergenSources: [],
    };
    const tags = deriveDietaryTags(summary);
    expect(tags).not.toContain("gluten_free");
  });

  it("includes explicit tags from kitchen manager", () => {
    const summary = {
      recipeId: "r1",
      recipeName: "Vegan Bowl",
      allergens: [] as const,
      allergenSources: [],
    };
    const tags = deriveDietaryTags(summary, ["vegan", "halal"]);
    expect(tags).toContain("vegan");
    expect(tags).toContain("halal");
  });
});

describe("formatAllergenLabel", () => {
  it("formats single-word allergens", () => {
    expect(formatAllergenLabel("gluten")).toBe("Gluten");
    expect(formatAllergenLabel("eggs")).toBe("Eggs");
  });

  it("formats multi-word allergens", () => {
    expect(formatAllergenLabel("tree_nuts")).toBe("Tree Nuts");
  });
});

describe("buildMenuNutritionDisplay", () => {
  it("builds display text with calories and allergens", () => {
    const nutrition = {
      recipeId: "r1",
      recipeName: "Pasta Carbonara",
      perPortion: {
        calories: 485.3,
        protein: 25,
        carbohydrates: 50,
        fat: 20,
        fiber: 2,
        sodium: 600,
        sugar: 3,
      },
      totalRecipe: {
        calories: 970.6,
        protein: 50,
        carbohydrates: 100,
        fat: 40,
        fiber: 4,
        sodium: 1200,
        sugar: 6,
      },
    };

    const allergenSummary = {
      recipeId: "r1",
      recipeName: "Pasta Carbonara",
      allergens: ["eggs" as const, "gluten" as const, "milk" as const],
      allergenSources: [],
    };

    const display = buildMenuNutritionDisplay(
      nutrition,
      allergenSummary,
      ["nut_free"]
    );

    expect(display.caloriesPerPortion).toBe(485);
    expect(display.allergens).toHaveLength(3);
    expect(display.dietaryTags).toContain("nut_free");
    expect(display.displayText).toBe(
      "485 cal | Contains: Eggs, Gluten, Milk"
    );
  });

  it("omits allergen text when no allergens", () => {
    const nutrition = {
      recipeId: "r1",
      recipeName: "Fruit Salad",
      perPortion: {
        calories: 120,
        protein: 1,
        carbohydrates: 30,
        fat: 0.5,
        fiber: 3,
        sodium: 5,
        sugar: 25,
      },
      totalRecipe: {
        calories: 120,
        protein: 1,
        carbohydrates: 30,
        fat: 0.5,
        fiber: 3,
        sodium: 5,
        sugar: 25,
      },
    };

    const allergenSummary = {
      recipeId: "r1",
      recipeName: "Fruit Salad",
      allergens: [] as const,
      allergenSources: [],
    };

    const display = buildMenuNutritionDisplay(nutrition, allergenSummary, []);
    expect(display.displayText).toBe("120 cal");
  });
});

describe("ALL_ALLERGENS", () => {
  it("contains 14 EU/SA standard allergens", () => {
    expect(ALL_ALLERGENS).toHaveLength(14);
  });
});
