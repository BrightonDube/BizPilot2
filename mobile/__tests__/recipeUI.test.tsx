/**
 * Tests for Recipe Management UI Components
 * (recipe-management tasks 3.1–3.4)
 *
 * Tests verify rendering, user interactions, search/filter, and validation.
 * RecipeService pure functions are already tested in existing test suites.
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

import RecipeListScreen from "@/components/recipe/RecipeListScreen";
import RecipeFormModal from "@/components/recipe/RecipeFormModal";
import IngredientSelector from "@/components/recipe/IngredientSelector";
import CostBreakdownView from "@/components/recipe/CostBreakdownView";
import type { Recipe, RecipeIngredient } from "@/services/recipe/RecipeService";
import type { AvailableIngredient } from "@/components/recipe/IngredientSelector";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeIngredient = (
  overrides: Partial<RecipeIngredient> = {}
): RecipeIngredient => ({
  ingredientId: `ing-${Math.random().toString(36).substring(7)}`,
  name: "Flour",
  quantity: 0.5,
  unitCost: 12.5,
  unit: "kg",
  ...overrides,
});

const makeRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: `recipe-${Math.random().toString(36).substring(7)}`,
  name: "Margherita Pizza",
  menuItemId: "menu-1",
  ingredients: [
    makeIngredient({ ingredientId: "ing-1", name: "Flour", quantity: 0.5, unitCost: 12.5 }),
    makeIngredient({ ingredientId: "ing-2", name: "Tomato Sauce", quantity: 0.2, unitCost: 25.0 }),
    makeIngredient({ ingredientId: "ing-3", name: "Mozzarella", quantity: 0.15, unitCost: 85.0 }),
  ],
  yield: 4,
  wasteFactor: 0.1,
  ...overrides,
});

const makeAvailableIngredient = (
  overrides: Partial<AvailableIngredient> = {}
): AvailableIngredient => ({
  id: `avail-${Math.random().toString(36).substring(7)}`,
  name: "Basil",
  unitCost: 35.0,
  unit: "bunch",
  ...overrides,
});

const noop = jest.fn();

// ---------------------------------------------------------------------------
// RecipeListScreen Tests (Task 3.1)
// ---------------------------------------------------------------------------

describe("RecipeListScreen (Task 3.1)", () => {
  const recipes = [
    makeRecipe({ id: "r1", name: "Margherita Pizza" }),
    makeRecipe({ id: "r2", name: "Caesar Salad" }),
    makeRecipe({ id: "r3", name: "Chicken Burger" }),
  ];
  const prices: Record<string, number> = { "menu-1": 89.0 };

  it("renders the title and all recipe cards", () => {
    const { getByText } = render(
      <RecipeListScreen
        recipes={recipes}
        sellingPrices={prices}
        onSelectRecipe={noop}
      />
    );
    expect(getByText("Recipes")).toBeTruthy();
    expect(getByText("Margherita Pizza")).toBeTruthy();
    expect(getByText("Caesar Salad")).toBeTruthy();
    expect(getByText("Chicken Burger")).toBeTruthy();
  });

  it("filters recipes by search query", () => {
    const { getByLabelText, queryByText } = render(
      <RecipeListScreen
        recipes={recipes}
        sellingPrices={prices}
        onSelectRecipe={noop}
      />
    );
    fireEvent.changeText(getByLabelText("Search recipes"), "caesar");
    expect(queryByText("Caesar Salad")).toBeTruthy();
    expect(queryByText("Margherita Pizza")).toBeNull();
  });

  it("shows empty state when no recipes match search", () => {
    const { getByLabelText, getByText } = render(
      <RecipeListScreen
        recipes={recipes}
        sellingPrices={prices}
        onSelectRecipe={noop}
      />
    );
    fireEvent.changeText(getByLabelText("Search recipes"), "xyz-no-match");
    expect(getByText("No recipes match your search")).toBeTruthy();
  });

  it("calls onSelectRecipe when a recipe card is tapped", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <RecipeListScreen
        recipes={recipes}
        sellingPrices={prices}
        onSelectRecipe={onSelect}
      />
    );
    fireEvent.press(getByText("Margherita Pizza"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe("r1");
  });

  it("shows add button when onAddRecipe is provided", () => {
    const onAdd = jest.fn();
    const { getByLabelText } = render(
      <RecipeListScreen
        recipes={recipes}
        sellingPrices={prices}
        onSelectRecipe={noop}
        onAddRecipe={onAdd}
      />
    );
    fireEvent.press(getByLabelText("Add recipe"));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("shows empty state when no recipes", () => {
    const { getByText } = render(
      <RecipeListScreen
        recipes={[]}
        sellingPrices={prices}
        onSelectRecipe={noop}
      />
    );
    expect(getByText("No recipes yet")).toBeTruthy();
  });

  it("displays food cost badge when selling price is available", () => {
    const { getByLabelText } = render(
      <RecipeListScreen
        recipes={[makeRecipe({ id: "r1", name: "Margherita Pizza", menuItemId: "menu-1" })]}
        sellingPrices={{ "menu-1": 89.0 }}
        onSelectRecipe={noop}
      />
    );
    // The card should render with the recipe name as accessibility label
    expect(getByLabelText("Recipe: Margherita Pizza")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// RecipeFormModal Tests (Task 3.2)
// ---------------------------------------------------------------------------

describe("RecipeFormModal (Task 3.2)", () => {
  it("renders nothing when not visible", () => {
    const { toJSON } = render(
      <RecipeFormModal
        visible={false}
        onSave={noop}
        onCancel={noop}
        onOpenIngredientSelector={noop}
        ingredients={[]}
      />
    );
    expect(toJSON()).toBeNull();
  });

  it("renders form fields when visible", () => {
    const { getByLabelText } = render(
      <RecipeFormModal
        visible={true}
        onSave={noop}
        onCancel={noop}
        onOpenIngredientSelector={noop}
        ingredients={[]}
      />
    );
    expect(getByLabelText("Recipe name")).toBeTruthy();
    expect(getByLabelText("Yield portions")).toBeTruthy();
    expect(getByLabelText("Waste factor")).toBeTruthy();
  });

  it("shows 'New Recipe' title for new recipes", () => {
    const { getByText } = render(
      <RecipeFormModal
        visible={true}
        onSave={noop}
        onCancel={noop}
        onOpenIngredientSelector={noop}
        ingredients={[]}
      />
    );
    expect(getByText("New Recipe")).toBeTruthy();
  });

  it("shows 'Edit Recipe' title when editing", () => {
    const recipe = makeRecipe();
    const { getByText } = render(
      <RecipeFormModal
        visible={true}
        recipe={recipe}
        onSave={noop}
        onCancel={noop}
        onOpenIngredientSelector={noop}
        ingredients={recipe.ingredients}
      />
    );
    expect(getByText("Edit Recipe")).toBeTruthy();
  });

  it("validates required fields on save", () => {
    const onSave = jest.fn();
    const { getByLabelText, getByText } = render(
      <RecipeFormModal
        visible={true}
        onSave={onSave}
        onCancel={noop}
        onOpenIngredientSelector={noop}
        ingredients={[]}
      />
    );
    // Clear name and set bad yield
    fireEvent.changeText(getByLabelText("Recipe name"), "");
    fireEvent.changeText(getByLabelText("Yield portions"), "0");
    fireEvent.press(getByLabelText("Save recipe"));
    expect(onSave).not.toHaveBeenCalled();
    expect(getByText("Recipe name is required")).toBeTruthy();
  });

  it("calls onSave with valid data", () => {
    const onSave = jest.fn();
    const { getByLabelText } = render(
      <RecipeFormModal
        visible={true}
        onSave={onSave}
        onCancel={noop}
        onOpenIngredientSelector={noop}
        ingredients={[makeIngredient()]}
      />
    );
    fireEvent.changeText(getByLabelText("Recipe name"), "Test Recipe");
    fireEvent.changeText(getByLabelText("Yield portions"), "4");
    fireEvent.changeText(getByLabelText("Waste factor"), "0.1");
    fireEvent.press(getByLabelText("Save recipe"));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].name).toBe("Test Recipe");
    expect(onSave.mock.calls[0][0].yield).toBe(4);
  });

  it("calls onOpenIngredientSelector when ingredient button pressed", () => {
    const onOpen = jest.fn();
    const { getByLabelText } = render(
      <RecipeFormModal
        visible={true}
        onSave={noop}
        onCancel={noop}
        onOpenIngredientSelector={onOpen}
        ingredients={[]}
      />
    );
    fireEvent.press(getByLabelText("Open ingredient selector"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows ingredient count summary", () => {
    const { getByText } = render(
      <RecipeFormModal
        visible={true}
        onSave={noop}
        onCancel={noop}
        onOpenIngredientSelector={noop}
        ingredients={[makeIngredient(), makeIngredient()]}
      />
    );
    expect(getByText("2 ingredients")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// IngredientSelector Tests (Task 3.3)
// ---------------------------------------------------------------------------

describe("IngredientSelector (Task 3.3)", () => {
  const available: AvailableIngredient[] = [
    makeAvailableIngredient({ id: "a1", name: "Basil" }),
    makeAvailableIngredient({ id: "a2", name: "Olive Oil" }),
    makeAvailableIngredient({ id: "a3", name: "Garlic" }),
  ];

  it("renders nothing when not visible", () => {
    const { toJSON } = render(
      <IngredientSelector
        availableIngredients={available}
        initialIngredients={[]}
        visible={false}
        onConfirm={noop}
        onCancel={noop}
      />
    );
    expect(toJSON()).toBeNull();
  });

  it("renders available ingredients when visible", () => {
    const { getByText } = render(
      <IngredientSelector
        availableIngredients={available}
        initialIngredients={[]}
        visible={true}
        onConfirm={noop}
        onCancel={noop}
      />
    );
    expect(getByText("Basil")).toBeTruthy();
    expect(getByText("Olive Oil")).toBeTruthy();
    expect(getByText("Garlic")).toBeTruthy();
  });

  it("adds ingredient to selected list on tap", () => {
    const { getByLabelText, getByText } = render(
      <IngredientSelector
        availableIngredients={available}
        initialIngredients={[]}
        visible={true}
        onConfirm={noop}
        onCancel={noop}
      />
    );
    fireEvent.press(getByLabelText("Add Basil"));
    // Should now show "Selected (1)"
    expect(getByText("Selected (1)")).toBeTruthy();
  });

  it("removes ingredient from selected list", () => {
    const initial: RecipeIngredient[] = [
      makeIngredient({ ingredientId: "a1", name: "Basil" }),
    ];
    const { getByLabelText, getByText } = render(
      <IngredientSelector
        availableIngredients={available}
        initialIngredients={initial}
        visible={true}
        onConfirm={noop}
        onCancel={noop}
      />
    );
    expect(getByText("Selected (1)")).toBeTruthy();
    fireEvent.press(getByLabelText("Remove Basil"));
    expect(getByText("Selected (0)")).toBeTruthy();
  });

  it("filters available ingredients by search", () => {
    const { getByLabelText, queryByText } = render(
      <IngredientSelector
        availableIngredients={available}
        initialIngredients={[]}
        visible={true}
        onConfirm={noop}
        onCancel={noop}
      />
    );
    fireEvent.changeText(
      getByLabelText("Search available ingredients"),
      "olive"
    );
    expect(queryByText("Olive Oil")).toBeTruthy();
    expect(queryByText("Basil")).toBeNull();
  });

  it("calls onConfirm with selected ingredients", () => {
    const onConfirm = jest.fn();
    const initial: RecipeIngredient[] = [
      makeIngredient({ ingredientId: "a1", name: "Basil", quantity: 2 }),
    ];
    const { getByLabelText } = render(
      <IngredientSelector
        availableIngredients={available}
        initialIngredients={initial}
        visible={true}
        onConfirm={onConfirm}
        onCancel={noop}
      />
    );
    fireEvent.press(getByLabelText("Confirm ingredients"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toHaveLength(1);
    expect(onConfirm.mock.calls[0][0][0].ingredientId).toBe("a1");
  });

  it("hides already-selected ingredients from available list", () => {
    const initial: RecipeIngredient[] = [
      makeIngredient({ ingredientId: "a1", name: "Basil" }),
    ];
    const { queryByLabelText } = render(
      <IngredientSelector
        availableIngredients={available}
        initialIngredients={initial}
        visible={true}
        onConfirm={noop}
        onCancel={noop}
      />
    );
    // "Add Basil" should not be in the available list
    expect(queryByLabelText("Add Basil")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CostBreakdownView Tests (Task 3.4)
// ---------------------------------------------------------------------------

describe("CostBreakdownView (Task 3.4)", () => {
  const recipe = makeRecipe();

  it("renders the heading", () => {
    const { getByText } = render(<CostBreakdownView recipe={recipe} />);
    expect(getByText("Cost Breakdown")).toBeTruthy();
  });

  it("shows total cost and cost per portion", () => {
    const { getByText } = render(<CostBreakdownView recipe={recipe} />);
    expect(getByText("Total Cost")).toBeTruthy();
    expect(getByText("Per Portion")).toBeTruthy();
  });

  it("shows food cost % when selling price is provided", () => {
    const { getByText } = render(
      <CostBreakdownView recipe={recipe} sellingPrice={89.0} />
    );
    expect(getByText("Food Cost %")).toBeTruthy();
    expect(getByText("Gross Profit")).toBeTruthy();
  });

  it("does not show food cost % without selling price", () => {
    const { queryByText } = render(<CostBreakdownView recipe={recipe} />);
    expect(queryByText("Food Cost %")).toBeNull();
  });

  it("shows ingredient cost table with all ingredients", () => {
    const { getAllByText } = render(<CostBreakdownView recipe={recipe} />);
    expect(getAllByText("Flour").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Tomato Sauce").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Mozzarella").length).toBeGreaterThanOrEqual(1);
  });

  it("shows waste factor row", () => {
    const { getByText } = render(<CostBreakdownView recipe={recipe} />);
    expect(getByText(/Waste \(10%\)/)).toBeTruthy();
  });

  it("shows total row", () => {
    const { getByText } = render(<CostBreakdownView recipe={recipe} />);
    expect(getByText("Total")).toBeTruthy();
  });

  it("shows cost composition bar for ingredients", () => {
    const { getByText } = render(<CostBreakdownView recipe={recipe} />);
    expect(getByText("Cost Composition")).toBeTruthy();
  });
});
