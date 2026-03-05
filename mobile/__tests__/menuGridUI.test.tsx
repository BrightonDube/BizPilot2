/**
 * Integration tests for the MenuGrid POS component.
 */

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));
jest.mock("expo-image", () => ({
  Image: "Image",
}));

import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import MenuGrid from "../components/pos/MenuGrid";

// ---------------------------------------------------------------------------
// Types (matching MenuGrid.tsx exports)
// ---------------------------------------------------------------------------

interface MenuCategory {
  id: string;
  name: string;
  parentId: string | null;
  imageUrl: string | null;
  iconName: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

interface Modifier {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  modifiers: Modifier[];
}

interface Portion {
  id: string;
  name: string;
  priceMultiplier: number;
  priceOverride: number | null;
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  basePrice: number;
  pluCode: string | null;
  categoryId: string;
  isAvailable: boolean;
  modifierGroups: ModifierGroup[];
  portions: Portion[];
  tags: string[];
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function createTestCategory(overrides?: Partial<MenuCategory>): MenuCategory {
  return {
    id: "cat-1",
    name: "Mains",
    parentId: null,
    imageUrl: null,
    iconName: "restaurant-outline",
    color: "#3b82f6",
    sortOrder: 1,
    isActive: true,
    ...overrides,
  };
}

function createTestMenuItem(overrides?: Partial<MenuItem>): MenuItem {
  return {
    id: "item-1",
    name: "Chicken Burger",
    description: "Grilled chicken with lettuce",
    imageUrl: null,
    basePrice: 89.9,
    pluCode: "1001",
    categoryId: "cat-1",
    isAvailable: true,
    modifierGroups: [],
    portions: [
      {
        id: "portion-reg",
        name: "Regular",
        priceMultiplier: 1.0,
        priceOverride: null,
      },
    ],
    tags: ["chicken", "burger"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultCategories: MenuCategory[] = [
  createTestCategory({ id: "cat-1", name: "Mains", sortOrder: 1 }),
  createTestCategory({ id: "cat-2", name: "Drinks", sortOrder: 2, color: "#22c55e" }),
];

const defaultItems: MenuItem[] = [
  createTestMenuItem({ id: "item-1", name: "Chicken Burger", categoryId: "cat-1", pluCode: "1001" }),
  createTestMenuItem({ id: "item-2", name: "Beef Steak", categoryId: "cat-1", pluCode: "2002", basePrice: 149.9 }),
  createTestMenuItem({ id: "item-3", name: "Cola", categoryId: "cat-2", pluCode: "3003", basePrice: 25 }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MenuGrid", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders menu grid with items", () => {
    const onItemSelect = jest.fn();
    const { getByTestId, getAllByTestId } = render(
      <MenuGrid
        categories={defaultCategories}
        items={defaultItems}
        onItemSelect={onItemSelect}
      />,
    );

    expect(getByTestId("menu-grid")).toBeTruthy();
    expect(getByTestId("menu-items-grid")).toBeTruthy();
  });

  it("shows loading state when isLoading=true", () => {
    const { getByTestId, queryByTestId } = render(
      <MenuGrid
        categories={defaultCategories}
        items={defaultItems}
        onItemSelect={jest.fn()}
        isLoading
      />,
    );

    expect(getByTestId("menu-loading")).toBeTruthy();
    expect(queryByTestId("menu-items-grid")).toBeNull();
  });

  it("shows empty state when no items", () => {
    const { getByTestId } = render(
      <MenuGrid
        categories={defaultCategories}
        items={[]}
        onItemSelect={jest.fn()}
      />,
    );

    expect(getByTestId("menu-empty")).toBeTruthy();
  });

  it("filters items by category when tab pressed", async () => {
    const onItemSelect = jest.fn();
    const { getByText, queryByTestId } = render(
      <MenuGrid
        categories={defaultCategories}
        items={defaultItems}
        onItemSelect={onItemSelect}
      />,
    );

    // Press the "Drinks" category tab
    await act(async () => {
      fireEvent.press(getByText("Drinks"));
    });

    // Cola (cat-2) should be visible, Chicken Burger (cat-1) should not
    expect(queryByTestId("menu-item-item-3")).toBeTruthy();
    expect(queryByTestId("menu-item-item-1")).toBeNull();
  });

  it("searches items by text input", async () => {
    const { getByTestId, queryByTestId } = render(
      <MenuGrid
        categories={defaultCategories}
        items={defaultItems}
        onItemSelect={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.changeText(getByTestId("text-search-input"), "Cola");
    });

    // Advance past the 300ms debounce in a separate act so the state update flushes
    act(() => {
      jest.advanceTimersByTime(350);
    });

    expect(queryByTestId("menu-item-item-3")).toBeTruthy();
    expect(queryByTestId("menu-item-item-1")).toBeNull();
  });

  it("handles PLU search — found (calls onItemSelect)", async () => {
    const onItemSelect = jest.fn();
    const { getByTestId } = render(
      <MenuGrid
        categories={defaultCategories}
        items={defaultItems}
        onItemSelect={onItemSelect}
      />,
    );

    await act(async () => {
      fireEvent.changeText(getByTestId("plu-search-input"), "1001");
    });

    await act(async () => {
      fireEvent(getByTestId("plu-search-input"), "submitEditing");
    });

    expect(onItemSelect).toHaveBeenCalledTimes(1);
    expect(onItemSelect.mock.calls[0][0].id).toBe("item-1");
  });

  it("handles PLU search — not found (shows feedback)", async () => {
    const { getByTestId, getByText } = render(
      <MenuGrid
        categories={defaultCategories}
        items={defaultItems}
        onItemSelect={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.changeText(getByTestId("plu-search-input"), "9999");
    });

    await act(async () => {
      fireEvent(getByTestId("plu-search-input"), "submitEditing");
    });

    expect(getByText('PLU "9999" not found')).toBeTruthy();
  });

  it("shows unavailable overlay on unavailable items", () => {
    const items = [
      createTestMenuItem({ id: "unavail-1", isAvailable: false }),
    ];
    const { getByTestId } = render(
      <MenuGrid
        categories={defaultCategories}
        items={items}
        onItemSelect={jest.fn()}
      />,
    );

    expect(getByTestId("unavailable-badge-unavail-1")).toBeTruthy();
  });

  it("opens portion modal when item with multiple portions is tapped", async () => {
    const items = [
      createTestMenuItem({
        id: "multi-portion",
        portions: [
          { id: "p-reg", name: "Regular", priceMultiplier: 1.0, priceOverride: null },
          { id: "p-lg", name: "Large", priceMultiplier: 1.5, priceOverride: null },
        ],
      }),
    ];
    const { getByTestId } = render(
      <MenuGrid
        categories={defaultCategories}
        items={items}
        onItemSelect={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("menu-item-multi-portion"));
    });

    expect(getByTestId("portion-option-p-reg")).toBeTruthy();
    expect(getByTestId("portion-option-p-lg")).toBeTruthy();
  });

  it("opens modifier modal after portion selection", async () => {
    const items = [
      createTestMenuItem({
        id: "full-flow",
        portions: [
          { id: "p-reg", name: "Regular", priceMultiplier: 1.0, priceOverride: null },
          { id: "p-lg", name: "Large", priceMultiplier: 1.5, priceOverride: null },
        ],
        modifierGroups: [
          {
            id: "mg-sauce",
            name: "Sauce",
            required: true,
            minSelections: 1,
            maxSelections: 1,
            modifiers: [
              { id: "mod-ketchup", name: "Ketchup", price: 0, isDefault: true },
              { id: "mod-mayo", name: "Mayo", price: 0, isDefault: false },
            ],
          },
        ],
      }),
    ];

    const { getByTestId } = render(
      <MenuGrid
        categories={defaultCategories}
        items={items}
        onItemSelect={jest.fn()}
      />,
    );

    // Tap item → portion modal
    await act(async () => {
      fireEvent.press(getByTestId("menu-item-full-flow"));
    });

    // Select portion → modifier modal opens
    await act(async () => {
      fireEvent.press(getByTestId("portion-option-p-reg"));
    });

    expect(getByTestId("modifier-option-mod-ketchup")).toBeTruthy();
    expect(getByTestId("modifier-option-mod-mayo")).toBeTruthy();
  });

  it("calls onItemSelect with correct item, portion, modifiers when add to cart pressed", async () => {
    const onItemSelect = jest.fn();
    const items = [
      createTestMenuItem({
        id: "cart-item",
        basePrice: 100,
        portions: [
          { id: "p-reg", name: "Regular", priceMultiplier: 1.0, priceOverride: null },
          { id: "p-lg", name: "Large", priceMultiplier: 1.5, priceOverride: null },
        ],
        modifierGroups: [
          {
            id: "mg-extras",
            name: "Extras",
            required: true,
            minSelections: 1,
            maxSelections: 2,
            modifiers: [
              { id: "mod-cheese", name: "Cheese", price: 10, isDefault: false },
              { id: "mod-bacon", name: "Bacon", price: 15, isDefault: false },
            ],
          },
        ],
      }),
    ];

    const { getByTestId } = render(
      <MenuGrid
        categories={defaultCategories}
        items={items}
        onItemSelect={onItemSelect}
      />,
    );

    // Tap item → portion modal
    await act(async () => {
      fireEvent.press(getByTestId("menu-item-cart-item"));
    });

    // Select "Large" portion → modifier modal
    await act(async () => {
      fireEvent.press(getByTestId("portion-option-p-lg"));
    });

    // Select a modifier to satisfy the required group
    await act(async () => {
      fireEvent.press(getByTestId("modifier-option-mod-cheese"));
    });

    // Press "Add to Cart"
    await act(async () => {
      fireEvent.press(getByTestId("add-to-cart-btn"));
    });

    expect(onItemSelect).toHaveBeenCalledTimes(1);
    const [calledItem, calledPortion, calledModifiers] =
      onItemSelect.mock.calls[0];
    expect(calledItem.id).toBe("cart-item");
    expect(calledPortion.id).toBe("p-lg");
    expect(calledModifiers).toHaveLength(1);
    expect(calledModifiers[0].id).toBe("mod-cheese");
  });
});
