/**
 * Unit tests for MenuService pure functions.
 */

import {
  TimeSlot,
  Schedule,
  MenuCategory,
  MenuItem,
  ModifierGroup,
  Modifier,
  Portion,
  isTimeSlotActive,
  isScheduleActive,
  getActiveCategories,
  buildCategoryTree,
  filterMenuItemsByCategory,
  filterAvailableItems,
  calculateItemPrice,
  validateModifierSelections,
  searchByPLU,
  searchMenuItems,
  calculateFoodCostPercentage,
} from "../services/menu/MenuService";

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function createModifierGroup(
  overrides?: Partial<ModifierGroup>,
): ModifierGroup {
  return {
    id: "mg-1",
    name: "Extras",
    required: false,
    minSelections: 0,
    maxSelections: 3,
    modifiers: [
      { id: "mod-1", name: "Cheese", price: 10, isDefault: false },
      { id: "mod-2", name: "Bacon", price: 15, isDefault: false },
      { id: "mod-3", name: "Avocado", price: 12, isDefault: false },
    ],
    ...overrides,
  };
}

function createPortion(overrides?: Partial<Portion>): Portion {
  return {
    id: "portion-reg",
    name: "Regular",
    priceMultiplier: 1.0,
    priceOverride: null,
    ...overrides,
  };
}

function createMenuCategory(
  overrides?: Partial<MenuCategory>,
): MenuCategory {
  return {
    id: "cat-1",
    name: "Mains",
    parentId: null,
    imageUrl: null,
    iconName: "restaurant-outline",
    color: "#3b82f6",
    sortOrder: 1,
    schedule: null,
    isActive: true,
    ...overrides,
  };
}

function createMenuItem(overrides?: Partial<MenuItem>): MenuItem {
  return {
    id: "item-1",
    name: "Chicken Burger",
    description: "Grilled chicken with lettuce",
    imageUrl: null,
    basePrice: 89.9,
    pluCode: "1001",
    categoryId: "cat-1",
    kitchenStation: "grill",
    isAvailable: true,
    availabilitySchedule: null,
    modifierGroups: [createModifierGroup()],
    portions: [createPortion()],
    recipeId: null,
    foodCostPercentage: null,
    tags: ["chicken", "burger"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isTimeSlotActive
// ---------------------------------------------------------------------------

describe("isTimeSlotActive", () => {
  it("returns true when current time is within slot", () => {
    // Wednesday 12:30
    const now = new Date("2025-01-15T12:30:00");
    const slot: TimeSlot = {
      dayOfWeek: now.getDay(),
      startTime: "11:00",
      endTime: "14:00",
    };
    expect(isTimeSlotActive(slot, now)).toBe(true);
  });

  it("returns false when current time is outside slot", () => {
    // Wednesday 16:00
    const now = new Date("2025-01-15T16:00:00");
    const slot: TimeSlot = {
      dayOfWeek: now.getDay(),
      startTime: "11:00",
      endTime: "14:00",
    };
    expect(isTimeSlotActive(slot, now)).toBe(false);
  });

  it("handles day of week correctly", () => {
    // Wednesday 12:30 — slot is for Thursday
    const now = new Date("2025-01-15T12:30:00");
    const slot: TimeSlot = {
      dayOfWeek: (now.getDay() + 1) % 7,
      startTime: "11:00",
      endTime: "14:00",
    };
    expect(isTimeSlotActive(slot, now)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isScheduleActive
// ---------------------------------------------------------------------------

describe("isScheduleActive", () => {
  it("returns true for always-available schedules", () => {
    const schedule: Schedule = { slots: [], isAlwaysAvailable: true };
    expect(isScheduleActive(schedule, new Date())).toBe(true);
  });

  it("returns true when a slot is active", () => {
    const now = new Date("2025-01-15T12:30:00");
    const schedule: Schedule = {
      isAlwaysAvailable: false,
      slots: [
        { dayOfWeek: now.getDay(), startTime: "11:00", endTime: "14:00" },
      ],
    };
    expect(isScheduleActive(schedule, now)).toBe(true);
  });

  it("returns false when no slots are active", () => {
    const now = new Date("2025-01-15T16:00:00");
    const schedule: Schedule = {
      isAlwaysAvailable: false,
      slots: [
        { dayOfWeek: now.getDay(), startTime: "11:00", endTime: "14:00" },
      ],
    };
    expect(isScheduleActive(schedule, now)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getActiveCategories
// ---------------------------------------------------------------------------

describe("getActiveCategories", () => {
  const now = new Date("2025-01-15T12:30:00");

  it("filters out inactive categories", () => {
    const cats = [
      createMenuCategory({ id: "a", isActive: true, sortOrder: 1 }),
      createMenuCategory({ id: "b", isActive: false, sortOrder: 2 }),
    ];
    const result = getActiveCategories(cats, now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  it("filters out categories outside schedule", () => {
    const cats = [
      createMenuCategory({
        id: "a",
        schedule: {
          isAlwaysAvailable: false,
          slots: [
            { dayOfWeek: now.getDay(), startTime: "18:00", endTime: "22:00" },
          ],
        },
      }),
      createMenuCategory({ id: "b", schedule: null }),
    ];
    const result = getActiveCategories(cats, now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b");
  });

  it("sorts by sortOrder", () => {
    const cats = [
      createMenuCategory({ id: "z", sortOrder: 3 }),
      createMenuCategory({ id: "a", sortOrder: 1 }),
      createMenuCategory({ id: "m", sortOrder: 2 }),
    ];
    const result = getActiveCategories(cats, now);
    expect(result.map((c) => c.id)).toEqual(["a", "m", "z"]);
  });
});

// ---------------------------------------------------------------------------
// buildCategoryTree
// ---------------------------------------------------------------------------

describe("buildCategoryTree", () => {
  it("builds correct parent-child structure", () => {
    const cats = [
      createMenuCategory({ id: "root", parentId: null, sortOrder: 1 }),
      createMenuCategory({ id: "child-1", parentId: "root", sortOrder: 1 }),
      createMenuCategory({ id: "child-2", parentId: "root", sortOrder: 2 }),
    ];
    const tree = buildCategoryTree(cats);
    expect(tree).toHaveLength(1);
    expect(tree[0].category.id).toBe("root");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].category.id).toBe("child-1");
    expect(tree[0].children[1].category.id).toBe("child-2");
  });

  it("handles items with no parent", () => {
    const cats = [
      createMenuCategory({ id: "a", parentId: null, sortOrder: 2 }),
      createMenuCategory({ id: "b", parentId: null, sortOrder: 1 }),
    ];
    const tree = buildCategoryTree(cats);
    expect(tree).toHaveLength(2);
    expect(tree[0].category.id).toBe("b");
    expect(tree[1].category.id).toBe("a");
  });
});

// ---------------------------------------------------------------------------
// filterMenuItemsByCategory
// ---------------------------------------------------------------------------

describe("filterMenuItemsByCategory", () => {
  const items = [
    createMenuItem({ id: "1", categoryId: "cat-a" }),
    createMenuItem({ id: "2", categoryId: "cat-b" }),
    createMenuItem({ id: "3", categoryId: "cat-a" }),
  ];

  it("returns all items when categoryId is null", () => {
    expect(filterMenuItemsByCategory(items, null)).toHaveLength(3);
  });

  it("filters items by categoryId", () => {
    const result = filterMenuItemsByCategory(items, "cat-a");
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.categoryId === "cat-a")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// filterAvailableItems
// ---------------------------------------------------------------------------

describe("filterAvailableItems", () => {
  const now = new Date("2025-01-15T12:30:00");

  it("filters out unavailable items", () => {
    const items = [
      createMenuItem({ id: "1", isAvailable: true }),
      createMenuItem({ id: "2", isAvailable: false }),
    ];
    const result = filterAvailableItems(items, now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters out items outside schedule", () => {
    const items = [
      createMenuItem({
        id: "1",
        isAvailable: true,
        availabilitySchedule: {
          isAlwaysAvailable: false,
          slots: [
            { dayOfWeek: now.getDay(), startTime: "18:00", endTime: "22:00" },
          ],
        },
      }),
      createMenuItem({ id: "2", isAvailable: true, availabilitySchedule: null }),
    ];
    const result = filterAvailableItems(items, now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });
});

// ---------------------------------------------------------------------------
// calculateItemPrice
// ---------------------------------------------------------------------------

describe("calculateItemPrice", () => {
  it("returns base price when no portion/modifiers", () => {
    const item = createMenuItem({ basePrice: 100, modifierGroups: [] });
    expect(calculateItemPrice(item, null, [])).toBe(100);
  });

  it("applies portion price multiplier", () => {
    const item = createMenuItem({
      basePrice: 100,
      portions: [
        createPortion({ id: "lg", priceMultiplier: 1.5, priceOverride: null }),
      ],
      modifierGroups: [],
    });
    expect(calculateItemPrice(item, "lg", [])).toBe(150);
  });

  it("applies portion price override", () => {
    const item = createMenuItem({
      basePrice: 100,
      portions: [
        createPortion({ id: "xl", priceMultiplier: 2, priceOverride: 180 }),
      ],
      modifierGroups: [],
    });
    expect(calculateItemPrice(item, "xl", [])).toBe(180);
  });

  it("adds modifier prices", () => {
    const item = createMenuItem({
      basePrice: 100,
      modifierGroups: [
        createModifierGroup({
          modifiers: [
            { id: "m1", name: "Cheese", price: 10, isDefault: false },
            { id: "m2", name: "Bacon", price: 15, isDefault: false },
          ],
        }),
      ],
    });
    expect(calculateItemPrice(item, null, ["m1", "m2"])).toBe(125);
  });
});

// ---------------------------------------------------------------------------
// validateModifierSelections
// ---------------------------------------------------------------------------

describe("validateModifierSelections", () => {
  it("returns valid when all required groups satisfied", () => {
    const item = createMenuItem({
      modifierGroups: [
        createModifierGroup({
          id: "g1",
          required: true,
          minSelections: 1,
          maxSelections: 3,
        }),
      ],
    });
    const result = validateModifierSelections(item, ["mod-1"]);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns invalid with error when required group has too few selections", () => {
    const item = createMenuItem({
      modifierGroups: [
        createModifierGroup({
          id: "g1",
          name: "Sauce",
          required: true,
          minSelections: 2,
          maxSelections: 3,
        }),
      ],
    });
    const result = validateModifierSelections(item, ["mod-1"]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].groupId).toBe("g1");
    expect(result.errors[0].actualSelections).toBe(1);
  });

  it("returns invalid when max exceeded", () => {
    const item = createMenuItem({
      modifierGroups: [
        createModifierGroup({
          id: "g1",
          name: "Extras",
          required: false,
          minSelections: 0,
          maxSelections: 1,
        }),
      ],
    });
    const result = validateModifierSelections(item, ["mod-1", "mod-2"]);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("at most 1");
  });
});

// ---------------------------------------------------------------------------
// searchByPLU
// ---------------------------------------------------------------------------

describe("searchByPLU", () => {
  const items = [
    createMenuItem({ id: "1", pluCode: "ABC123" }),
    createMenuItem({ id: "2", pluCode: "DEF456" }),
  ];

  it("finds item by exact PLU match", () => {
    const result = searchByPLU(items, "ABC123");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("1");
  });

  it("returns null for non-existent PLU", () => {
    expect(searchByPLU(items, "ZZZZZ")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// searchMenuItems
// ---------------------------------------------------------------------------

describe("searchMenuItems", () => {
  const items = [
    createMenuItem({
      id: "1",
      name: "Chicken Burger",
      description: "Spicy grilled patty",
      pluCode: "PLU100",
      tags: ["grilled"],
    }),
    createMenuItem({
      id: "2",
      name: "Beef Steak",
      description: "Aged ribeye",
      pluCode: "PLU200",
      tags: ["premium"],
    }),
    createMenuItem({
      id: "3",
      name: "Veggie Wrap",
      description: "Fresh garden wrap",
      pluCode: "PLU300",
      tags: ["vegan", "healthy"],
    }),
  ];

  it("finds items by name substring (case insensitive)", () => {
    const result = searchMenuItems(items, "chicken");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("finds items by PLU code", () => {
    const result = searchMenuItems(items, "PLU200");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("finds items by tag", () => {
    const result = searchMenuItems(items, "vegan");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });
});

// ---------------------------------------------------------------------------
// calculateFoodCostPercentage
// ---------------------------------------------------------------------------

describe("calculateFoodCostPercentage", () => {
  it("calculates correct percentage", () => {
    expect(calculateFoodCostPercentage(30, 100)).toBe(30);
    expect(calculateFoodCostPercentage(25, 80)).toBe(31.25);
  });

  it("returns 0 for zero selling price", () => {
    expect(calculateFoodCostPercentage(30, 0)).toBe(0);
  });
});
