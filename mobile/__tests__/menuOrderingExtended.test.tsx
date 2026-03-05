import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));
jest.mock("@/utils/haptics", () => ({
  triggerHaptic: jest.fn(),
}));

import ModifierGroupEditor from "../components/menu/ModifierGroupEditor";
import PortionManager from "../components/menu/PortionManager";
import RecipeEditor from "../components/menu/RecipeEditor";
import ModifierSelector from "../components/ordering/ModifierSelector";
import StatusUpdatePanel from "../components/ordering/StatusUpdatePanel";

// =============================================================================
// ModifierGroupEditor
// =============================================================================

describe("ModifierGroupEditor", () => {
  const baseProps = {
    groupName: "Choose your sauce",
    onGroupNameChange: jest.fn(),
    isRequired: true,
    onRequiredChange: jest.fn(),
    minSelections: 1,
    onMinSelectionsChange: jest.fn(),
    maxSelections: 3,
    onMaxSelectionsChange: jest.fn(),
    modifiers: [
      { id: "m1", name: "Ketchup", price: 5, isDefault: true },
      { id: "m2", name: "Mayo", price: 3, isDefault: false },
    ],
    onAddModifier: jest.fn(),
    onRemoveModifier: jest.fn(),
    onUpdateModifier: jest.fn(),
    onToggleDefault: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  it("renders group name and modifier items", () => {
    const { getByTestId } = render(<ModifierGroupEditor {...baseProps} />);
    expect(getByTestId("modifier-group-editor")).toBeTruthy();
    expect(getByTestId("modifier-group-name").props.value).toBe("Choose your sauce");
    expect(getByTestId("modifier-item-m1")).toBeTruthy();
    expect(getByTestId("modifier-item-m2")).toBeTruthy();
  });

  it("calls onAddModifier when add button is pressed", () => {
    const { getByTestId } = render(<ModifierGroupEditor {...baseProps} />);
    fireEvent.press(getByTestId("modifier-add"));
    expect(baseProps.onAddModifier).toHaveBeenCalled();
  });

  it("calls onSave when save button is pressed", () => {
    const { getByTestId } = render(<ModifierGroupEditor {...baseProps} />);
    fireEvent.press(getByTestId("modifier-save"));
    expect(baseProps.onSave).toHaveBeenCalled();
  });
});

// =============================================================================
// PortionManager
// =============================================================================

describe("PortionManager", () => {
  const baseProps = {
    productName: "Cappuccino",
    basePrice: 35,
    portions: [
      { id: "p1", name: "Small", multiplier: 0.8, price: 28, isDefault: false },
      { id: "p2", name: "Large", multiplier: 1.5, price: 52.5, isDefault: true },
    ],
    onAddPortion: jest.fn(),
    onRemovePortion: jest.fn(),
    onUpdatePortion: jest.fn(),
    onSetDefault: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  it("renders portion items with prices", () => {
    const { getByTestId } = render(<PortionManager {...baseProps} />);
    expect(getByTestId("portion-manager")).toBeTruthy();
    expect(getByTestId("portion-item-p1")).toBeTruthy();
    expect(getByTestId("portion-item-p2")).toBeTruthy();
    expect(getByTestId("portion-price-p1").props.value).toBe("28");
    expect(getByTestId("portion-price-p2").props.value).toBe("52.5");
  });

  it("calls onAddPortion when add button is pressed", () => {
    const { getByTestId } = render(<PortionManager {...baseProps} />);
    fireEvent.press(getByTestId("portion-add"));
    expect(baseProps.onAddPortion).toHaveBeenCalled();
  });
});

// =============================================================================
// RecipeEditor
// =============================================================================

describe("RecipeEditor", () => {
  const baseProps = {
    productName: "Margherita Pizza",
    ingredients: [
      { id: "i1", ingredientName: "Flour", quantity: 0.5, unit: "kg", costPerUnit: 12 },
      { id: "i2", ingredientName: "Cheese", quantity: 0.2, unit: "kg", costPerUnit: 80 },
    ],
    onAddIngredient: jest.fn(),
    onRemoveIngredient: jest.fn(),
    onUpdateIngredient: jest.fn(),
    preparationNotes: "Mix dough, add toppings",
    onPreparationNotesChange: jest.fn(),
    yieldQuantity: "4",
    onYieldQuantityChange: jest.fn(),
    yieldUnit: "portions",
    onYieldUnitChange: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  it("renders ingredients list", () => {
    const { getByTestId } = render(<RecipeEditor {...baseProps} />);
    expect(getByTestId("recipe-editor")).toBeTruthy();
    expect(getByTestId("recipe-ingredient-i1")).toBeTruthy();
    expect(getByTestId("recipe-ingredient-i2")).toBeTruthy();
  });

  it("shows total recipe cost", () => {
    // totalCost = (0.5 * 12) + (0.2 * 80) = 6 + 16 = 22
    const { getByTestId } = render(<RecipeEditor {...baseProps} />);
    expect(getByTestId("recipe-total-cost").props.children).toBe("R 22.00");
  });

  it("calls onAddIngredient when add button is pressed", () => {
    const { getByTestId } = render(<RecipeEditor {...baseProps} />);
    fireEvent.press(getByTestId("recipe-add-ingredient"));
    expect(baseProps.onAddIngredient).toHaveBeenCalled();
  });
});

// =============================================================================
// ModifierSelector
// =============================================================================

describe("ModifierSelector", () => {
  const baseProps = {
    productName: "Burger Deluxe",
    basePrice: 89.99,
    modifierGroups: [
      {
        id: "g1",
        name: "Sauces",
        isRequired: true,
        minSelections: 1,
        maxSelections: 2,
        options: [
          { id: "o1", name: "BBQ", price: 5 },
          { id: "o2", name: "Ranch", price: 0 },
        ],
        selectedIds: ["o1"],
      },
    ],
    onSelectModifier: jest.fn(),
    onDeselectModifier: jest.fn(),
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    isValid: true,
    totalPrice: 94.99,
  };

  it("renders modifier groups with options", () => {
    const { getByTestId } = render(<ModifierSelector {...baseProps} />);
    expect(getByTestId("modifier-selector")).toBeTruthy();
    expect(getByTestId("modifier-group-g1")).toBeTruthy();
    expect(getByTestId("modifier-option-g1-o1")).toBeTruthy();
    expect(getByTestId("modifier-option-g1-o2")).toBeTruthy();
  });

  it("shows total price", () => {
    const { getByTestId } = render(<ModifierSelector {...baseProps} />);
    expect(getByTestId("modifier-total").props.children).toBe("R 94.99");
  });
});

// =============================================================================
// StatusUpdatePanel
// =============================================================================

describe("StatusUpdatePanel", () => {
  const baseProps = {
    orderId: "order-1",
    orderNumber: "1042",
    currentStatus: "preparing" as const,
    customerName: "John Doe",
    orderType: "delivery" as const,
    estimatedTime: "25 min",
    onUpdateStatus: jest.fn(),
    onCancel: jest.fn(),
    allowedTransitions: ["ready" as const, "cancelled" as const],
  };

  it("renders current status", () => {
    const { getByTestId, getAllByText } = render(
      <StatusUpdatePanel {...baseProps} />,
    );
    expect(getByTestId("status-update-panel")).toBeTruthy();
    expect(getByTestId("status-current")).toBeTruthy();
    expect(getAllByText("Preparing").length).toBeGreaterThanOrEqual(1);
    expect(getByTestId("status-order-number").props.children).toEqual(["#", "1042"]);
  });

  it("shows allowed transition buttons", () => {
    const { getByTestId } = render(<StatusUpdatePanel {...baseProps} />);
    expect(getByTestId("status-btn-ready")).toBeTruthy();
    expect(getByTestId("status-cancel")).toBeTruthy();
  });
});
