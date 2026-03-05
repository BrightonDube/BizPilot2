/**
 * BizPilot Mobile POS — MobileCountEntry Integration Tests
 *
 * Tests verify rendering, search/filter, counting interactions, and edge cases
 * for the stock-count entry component used by warehouse staff.
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

import MobileCountEntry from "../components/stock/MobileCountEntry";

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

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

interface CountSheet {
  id: string;
  name: string;
  date: string;
  status: "draft" | "in_progress" | "completed" | "approved";
  isBlindCount: boolean;
  totalItems: number;
  countedItems: number;
  assignedTo: string;
}

interface CountSheetItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  unit: string;
  expectedQuantity: number | null;
  countedQuantity: number | null;
  variance: number | null;
  costPrice: number;
  notes: string;
}

function createMockCountSheet(overrides: Partial<CountSheet> = {}): CountSheet {
  return {
    id: "cs-1",
    name: "Weekly Stock Count",
    date: "2024-06-01",
    status: "in_progress",
    isBlindCount: false,
    totalItems: 5,
    countedItems: 2,
    assignedTo: "Test User",
    ...overrides,
  };
}

function createMockCountItems(count: number): CountSheetItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    productId: `prod-${i + 1}`,
    productName: `Product ${i + 1}`,
    sku: `SKU-${i + 1}`,
    category: i % 2 === 0 ? "Food" : "Drinks",
    unit: "each",
    expectedQuantity: 10 + i,
    countedQuantity: i < 2 ? 10 + i : null,
    variance: i < 2 ? 0 : null,
    costPrice: 25 + i * 5,
    notes: "",
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noop = jest.fn();

function renderCountEntry(
  overrides: {
    countSheet?: Partial<CountSheet>;
    items?: CountSheetItem[];
    onUpdateCount?: jest.Mock;
    onBarcodeScanned?: jest.Mock;
  } = {},
) {
  const items = overrides.items ?? createMockCountItems(5);
  const sheet = createMockCountSheet({
    totalItems: items.length,
    countedItems: items.filter((i) => i.countedQuantity !== null).length,
    ...overrides.countSheet,
  });

  return render(
    <MobileCountEntry
      countSheet={sheet}
      items={items}
      onUpdateCount={overrides.onUpdateCount ?? noop}
      onComplete={noop}
      onBack={noop}
      onBarcodeScanned={overrides.onBarcodeScanned}
    />,
  );
}

// ===========================================================================
// Tests
// ===========================================================================

describe("MobileCountEntry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  it("renders count sheet with items and progress", () => {
    const { getByTestId, getAllByTestId } = renderCountEntry();

    expect(getByTestId("count-entry-view")).toBeTruthy();
    expect(getByTestId("count-progress-bar")).toBeTruthy();
    // 5 items created by default
    const itemRows = getAllByTestId(/^count-item-/);
    expect(itemRows.length).toBeGreaterThanOrEqual(1);
  });

  it("shows search input and filters", () => {
    const { getByTestId } = renderCountEntry();

    expect(getByTestId("count-search-input")).toBeTruthy();
    expect(getByTestId("count-filter-all")).toBeTruthy();
    expect(getByTestId("count-filter-uncounted")).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // Filtering
  // -----------------------------------------------------------------------

  it("filters items by uncounted when filter pill pressed", () => {
    const items = createMockCountItems(5); // 2 counted, 3 uncounted
    const { getByTestId, getAllByTestId } = renderCountEntry({ items });

    fireEvent.press(getByTestId("count-filter-uncounted"));

    const visibleItems = getAllByTestId(/^count-item-/);
    // Only uncounted items should show (items 3, 4, 5)
    expect(visibleItems.length).toBe(3);
  });

  // -----------------------------------------------------------------------
  // Counting interactions
  // -----------------------------------------------------------------------

  it("increments count when + button pressed", () => {
    const onUpdateCount = jest.fn();
    const items = createMockCountItems(3);
    // First item is counted with quantity 10
    const { getByTestId } = renderCountEntry({ items, onUpdateCount });

    fireEvent.press(getByTestId("count-increment-item-1"));

    expect(onUpdateCount).toHaveBeenCalledWith(
      "item-1",
      expect.any(Number),
      expect.any(String),
    );
  });

  it("decrements count when - button pressed", () => {
    const onUpdateCount = jest.fn();
    const items = createMockCountItems(3);
    const { getByTestId } = renderCountEntry({ items, onUpdateCount });

    fireEvent.press(getByTestId("count-decrement-item-1"));

    expect(onUpdateCount).toHaveBeenCalledWith(
      "item-1",
      expect.any(Number),
      expect.any(String),
    );
  });

  // -----------------------------------------------------------------------
  // Barcode
  // -----------------------------------------------------------------------

  it("shows barcode button and calls onBarcodeScanned", () => {
    const onBarcodeScanned = jest.fn();
    const { getByTestId } = renderCountEntry({ onBarcodeScanned });

    const barcodeBtn = getByTestId("count-barcode-btn");
    expect(barcodeBtn).toBeTruthy();
    fireEvent.press(barcodeBtn);
    // Pressing the barcode button should trigger the barcode flow
    expect(onBarcodeScanned).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Complete button state
  // -----------------------------------------------------------------------

  it("disables complete button when not all items counted", () => {
    const items = createMockCountItems(5); // only 2 of 5 counted
    const { getByTestId } = renderCountEntry({ items });

    const completeBtn = getByTestId("count-complete-btn");
    expect(
      completeBtn.props.accessibilityState?.disabled ??
        completeBtn.props.disabled,
    ).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  it("shows empty state when search has no results", () => {
    const { getByTestId } = renderCountEntry();

    fireEvent.changeText(getByTestId("count-search-input"), "zzzznonexistent");

    expect(getByTestId("count-empty")).toBeTruthy();
  });
});
