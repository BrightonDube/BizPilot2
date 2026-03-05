/**
 * BizPilot Mobile POS — ComboBuilder & ComboSelector Tests
 *
 * Tests for the combo meal builder (management) and selector (ordering) UIs.
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

import ComboBuilder from "../components/menu/ComboBuilder";
import ComboSelector from "../components/menu/ComboSelector";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleComponents = [
  {
    id: "comp1",
    categoryName: "Choose a Burger",
    required: true,
    maxSelections: 1,
    choices: [
      { id: "ch1", name: "Classic Burger", price: 65, isDefault: true },
      { id: "ch2", name: "Chicken Burger", price: 60, isDefault: false },
    ],
  },
  {
    id: "comp2",
    categoryName: "Choose a Side",
    required: false,
    maxSelections: 2,
    choices: [
      { id: "ch3", name: "Fries", price: 25, isDefault: true },
      { id: "ch4", name: "Salad", price: 30, isDefault: false },
    ],
  },
];

function makeBuilderProps(overrides = {}) {
  return {
    comboName: "Family Feast",
    onComboNameChange: jest.fn(),
    comboPrice: 99,
    onComboPriceChange: jest.fn(),
    components: sampleComponents,
    onAddComponent: jest.fn(),
    onRemoveComponent: jest.fn(),
    onUpdateComponent: jest.fn(),
    onAddChoice: jest.fn(),
    onRemoveChoice: jest.fn(),
    onToggleDefault: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
    isSaving: false,
    ...overrides,
  };
}

const sampleSelections = [
  {
    componentId: "comp1",
    categoryName: "Choose a Burger",
    required: true,
    maxSelections: 1,
    choices: [
      { id: "ch1", name: "Classic Burger", priceAdjustment: 0 },
      { id: "ch2", name: "Chicken Burger", priceAdjustment: 5 },
    ],
    selectedChoiceIds: ["ch1"],
  },
  {
    componentId: "comp2",
    categoryName: "Choose a Side",
    required: false,
    maxSelections: 2,
    choices: [
      { id: "ch3", name: "Fries", priceAdjustment: 0 },
      { id: "ch4", name: "Salad", priceAdjustment: 10 },
    ],
    selectedChoiceIds: [],
  },
];

function makeSelectorProps(overrides = {}) {
  return {
    comboName: "Family Feast",
    comboPrice: 99,
    selections: sampleSelections,
    onSelectChoice: jest.fn(),
    onDeselectChoice: jest.fn(),
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    isValid: true,
    ...overrides,
  };
}

// ===========================================================================
// ComboBuilder
// ===========================================================================

describe("ComboBuilder", () => {
  it("renders combo name and price inputs", () => {
    const props = makeBuilderProps();
    const { getByTestId } = render(<ComboBuilder {...props} />);

    expect(getByTestId("combo-name")).toBeTruthy();
    expect(getByTestId("combo-price")).toBeTruthy();
  });

  it("renders component list with choices", () => {
    const props = makeBuilderProps();
    const { getByTestId } = render(<ComboBuilder {...props} />);

    expect(getByTestId("combo-component-comp1")).toBeTruthy();
    expect(getByTestId("combo-component-comp2")).toBeTruthy();
    expect(getByTestId("combo-choice-comp1-ch1")).toBeTruthy();
    expect(getByTestId("combo-choice-comp2-ch3")).toBeTruthy();
  });

  it("calls onAddComponent", () => {
    const props = makeBuilderProps();
    const { getByTestId } = render(<ComboBuilder {...props} />);

    fireEvent.press(getByTestId("combo-add-component"));
    expect(props.onAddComponent).toHaveBeenCalledTimes(1);
  });

  it("calls onSave", () => {
    const props = makeBuilderProps();
    const { getByTestId } = render(<ComboBuilder {...props} />);

    fireEvent.press(getByTestId("combo-save"));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// ComboSelector
// ===========================================================================

describe("ComboSelector", () => {
  it("renders combo name and selections", () => {
    const props = makeSelectorProps();
    const { getByTestId, getByText } = render(<ComboSelector {...props} />);

    expect(getByTestId("combo-selector")).toBeTruthy();
    expect(getByText("Family Feast")).toBeTruthy();
    expect(getByTestId("combo-selector-component-comp1")).toBeTruthy();
    expect(getByTestId("combo-selector-component-comp2")).toBeTruthy();
  });

  it("shows selected choices with blue highlight", () => {
    const props = makeSelectorProps();
    const { getByTestId } = render(<ComboSelector {...props} />);

    const selectedPill = getByTestId("combo-selector-choice-comp1-ch1");
    // Selected pill gets choicePillSelected style (blue background)
    const flatStyle = Array.isArray(selectedPill.props.style)
      ? Object.assign({}, ...selectedPill.props.style.filter(Boolean))
      : selectedPill.props.style;
    expect(flatStyle.backgroundColor).toBe("#3b82f6");
  });

  it("disables confirm when !isValid", () => {
    const props = makeSelectorProps({ isValid: false });
    const { getByTestId } = render(<ComboSelector {...props} />);

    const confirmBtn = getByTestId("combo-selector-confirm");
    expect(
      confirmBtn.props.accessibilityState?.disabled ?? confirmBtn.props.disabled
    ).toBe(true);
  });

  it("calls onConfirm", () => {
    const props = makeSelectorProps({ isValid: true });
    const { getByTestId } = render(<ComboSelector {...props} />);

    fireEvent.press(getByTestId("combo-selector-confirm"));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });
});
