/**
 * BizPilot Mobile POS — TagSearchFilter & TagManager Integration Tests
 *
 * Tests verify rendering, user interactions, search/filter, and CRUD modals
 * for the tag management UI components.
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

import TagSearchFilter from "../components/tags/TagSearchFilter";
import TagManager from "../components/tags/TagManager";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

interface Tag {
  id: string;
  name: string;
  color: string;
  category: "product" | "customer" | "order";
  count: number;
  createdAt?: string;
}

function createMockTags(count: number): Tag[] {
  const categories: Array<"product" | "customer" | "order"> = [
    "product",
    "customer",
    "order",
  ];
  const colors = ["#3b82f6", "#22c55e", "#ef4444", "#fbbf24"];

  return Array.from({ length: count }, (_, i) => ({
    id: `tag-${i + 1}`,
    name: `Tag ${i + 1}`,
    color: colors[i % colors.length],
    category: categories[i % categories.length],
    count: (i + 1) * 3,
    createdAt: new Date().toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noop = jest.fn();

// ===========================================================================
// TagSearchFilter
// ===========================================================================

describe("TagSearchFilter", () => {
  const tags = createMockTags(6);

  function renderFilter(overrides: Partial<React.ComponentProps<typeof TagSearchFilter>> = {}) {
    return render(
      <TagSearchFilter
        tags={tags}
        selectedTagIds={[]}
        onTagToggle={noop}
        onClearAll={noop}
        searchMode="OR"
        onSearchModeToggle={noop}
        onSearch={noop}
        {...overrides}
      />,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  it("renders search input and tag cloud", () => {
    const { getByTestId, getAllByTestId } = renderFilter();

    expect(getByTestId("tag-search-input")).toBeTruthy();
    // Tag pills should be rendered for each tag
    const pills = getAllByTestId(/^tag-pill-/);
    expect(pills.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // Tag selection
  // -----------------------------------------------------------------------

  it("toggles tag selection when pill pressed", () => {
    const onTagToggle = jest.fn();
    const { getByTestId } = renderFilter({ onTagToggle });

    fireEvent.press(getByTestId("tag-pill-tag-1"));

    expect(onTagToggle).toHaveBeenCalledWith("tag-1");
  });

  it("shows selected tags bar with clear all", () => {
    const onClearAll = jest.fn();
    const { getByTestId } = renderFilter({
      selectedTagIds: ["tag-1", "tag-2"],
      onClearAll,
    });

    // Selected tags should be visible
    expect(getByTestId("tag-selected-tag-1")).toBeTruthy();
    expect(getByTestId("tag-selected-tag-2")).toBeTruthy();

    // Clear all button
    const clearBtn = getByTestId("tag-clear-all");
    expect(clearBtn).toBeTruthy();
    fireEvent.press(clearBtn);
    expect(onClearAll).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // AND / OR toggle
  // -----------------------------------------------------------------------

  it("toggles AND/OR search mode", () => {
    const onSearchModeToggle = jest.fn();
    const { getByTestId } = renderFilter({ onSearchModeToggle });

    fireEvent.press(getByTestId("tag-mode-toggle"));

    expect(onSearchModeToggle).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Category filter
  // -----------------------------------------------------------------------

  it("filters by category when tab pressed", () => {
    const { getByTestId, getAllByTestId } = renderFilter();

    // Press the "Product" category tab
    fireEvent.press(getByTestId("tag-category-product"));

    // Only product-category tags should show
    const pills = getAllByTestId(/^tag-pill-/);
    expect(pills.length).toBeLessThan(tags.length);
  });

  // -----------------------------------------------------------------------
  // Search callback
  // -----------------------------------------------------------------------

  it("calls onSearch with query, tags, and mode", async () => {
    const onSearch = jest.fn();
    const { getByTestId } = renderFilter({
      selectedTagIds: ["tag-1"],
      searchMode: "AND",
      onSearch,
    });

    fireEvent.press(getByTestId("tag-search-btn"));

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["tag-1"]),
        "AND",
      );
    });
  });
});

// ===========================================================================
// TagManager
// ===========================================================================

describe("TagManager", () => {
  const tags = createMockTags(6);

  function renderManager(overrides: Partial<React.ComponentProps<typeof TagManager>> = {}) {
    return render(
      <TagManager
        tags={tags}
        onCreateTag={noop}
        onDeleteTag={noop}
        onEditTag={noop}
        onBack={noop}
        {...overrides}
      />,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  it("renders tag list grouped by category", () => {
    const { getByTestId, getAllByTestId } = renderManager();

    expect(getByTestId("tag-manager")).toBeTruthy();
    expect(getByTestId("tag-manager-list")).toBeTruthy();
    // Each tag should have a row
    const rows = getAllByTestId(/^tag-row-/);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("shows loading state", () => {
    const { getByTestId } = renderManager({ isLoading: true });

    expect(getByTestId("tag-manager-loading")).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // Create flow
  // -----------------------------------------------------------------------

  it("opens create modal when new tag button pressed", () => {
    const { getByTestId } = renderManager();

    fireEvent.press(getByTestId("tag-manager-new"));

    expect(getByTestId("tag-create-modal")).toBeTruthy();
    expect(getByTestId("tag-create-name")).toBeTruthy();
  });

  it("calls onCreateTag when save pressed in modal", () => {
    const onCreateTag = jest.fn();
    const { getByTestId } = renderManager({ onCreateTag });

    // Open modal
    fireEvent.press(getByTestId("tag-manager-new"));

    // Fill name
    fireEvent.changeText(getByTestId("tag-create-name"), "New Tag");

    // Save
    fireEvent.press(getByTestId("tag-create-save"));

    expect(onCreateTag).toHaveBeenCalledWith(
      "New Tag",
      expect.any(String), // color
      expect.any(String), // category
    );
  });

  // -----------------------------------------------------------------------
  // Delete flow
  // -----------------------------------------------------------------------

  it("opens delete confirmation when delete pressed", () => {
    const { getByTestId } = renderManager();

    fireEvent.press(getByTestId("tag-delete-tag-1"));

    expect(getByTestId("tag-delete-modal")).toBeTruthy();
  });

  it("calls onDeleteTag when confirmed", () => {
    const onDeleteTag = jest.fn();
    const { getByTestId } = renderManager({ onDeleteTag });

    // Press delete on first tag
    fireEvent.press(getByTestId("tag-delete-tag-1"));

    // Confirm deletion
    fireEvent.press(getByTestId("tag-delete-confirm"));

    expect(onDeleteTag).toHaveBeenCalledWith("tag-1");
  });
});
