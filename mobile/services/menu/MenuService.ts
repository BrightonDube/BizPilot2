/**
 * MenuService — Pure TypeScript service for menu engineering in a POS system.
 *
 * Every function is pure: no side-effects, no mutations, no database access.
 * Date/time is always injected via a `now` parameter so callers (and tests)
 * control the clock.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to 2 decimal places — avoids floating-point dust on currency values. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single window of availability within a week. */
export interface TimeSlot {
  /** 0 = Sunday, 6 = Saturday */
  dayOfWeek: number;
  /** "HH:mm" 24-hour format */
  startTime: string;
  /** "HH:mm" 24-hour format */
  endTime: string;
}

/** Controls when a category or item is shown on the POS. */
export interface Schedule {
  slots: TimeSlot[];
  /** When true the entity is available regardless of slots. */
  isAlwaysAvailable: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  parentId: string | null;
  imageUrl: string | null;
  /** Ionicons icon name */
  iconName: string | null;
  /** Hex colour used for the POS tab strip */
  color: string;
  sortOrder: number;
  schedule: Schedule | null;
  isActive: boolean;
}

export interface Modifier {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  modifiers: Modifier[];
}

export interface Portion {
  id: string;
  /** e.g. "Regular", "Large" */
  name: string;
  /** 1.0 for regular, 1.5 for large, etc. */
  priceMultiplier: number;
  /** If set, takes precedence over the multiplier. */
  priceOverride: number | null;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  basePrice: number;
  /** Price-Look-Up code for barcode / quick-key access */
  pluCode: string | null;
  categoryId: string;
  /** Kitchen display / printer routing */
  kitchenStation: string | null;
  isAvailable: boolean;
  availabilitySchedule: Schedule | null;
  modifierGroups: ModifierGroup[];
  portions: Portion[];
  recipeId: string | null;
  /** Pre-calculated or manually entered food-cost % */
  foodCostPercentage: number | null;
  tags: string[];
}

export interface CategoryTreeNode {
  category: MenuCategory;
  children: CategoryTreeNode[];
}

export interface ModifierValidationResult {
  isValid: boolean;
  errors: ModifierValidationError[];
}

export interface ModifierValidationError {
  groupId: string;
  groupName: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  actualSelections: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Time / Schedule helpers
// ---------------------------------------------------------------------------

/**
 * Parse an "HH:mm" string into total minutes since midnight.
 * Kept private — callers work with `Date` objects instead.
 */
const parseHHmm = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Check whether `now` falls inside the given time slot.
 *
 * Day-of-week is compared first (cheap check) before parsing the
 * time strings, so we avoid unnecessary work on non-matching days.
 */
export const isTimeSlotActive = (slot: TimeSlot, now: Date): boolean => {
  if (now.getDay() !== slot.dayOfWeek) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = parseHHmm(slot.startTime);
  const end = parseHHmm(slot.endTime);

  // Overnight spans (e.g. 22:00 → 04:00) are handled by splitting the
  // comparison: current must be >= start OR <= end.
  if (start <= end) {
    return currentMinutes >= start && currentMinutes < end;
  }
  return currentMinutes >= start || currentMinutes < end;
};

/**
 * A `null` schedule means "always available" (backwards-compat default).
 * An explicit schedule with `isAlwaysAvailable: true` also means always on.
 * Otherwise at least one slot must match `now`.
 */
export const isScheduleActive = (
  schedule: Schedule | null,
  now: Date,
): boolean => {
  if (schedule === null) return true;
  if (schedule.isAlwaysAvailable) return true;
  return schedule.slots.some((slot) => isTimeSlotActive(slot, now));
};

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

/**
 * Return only the categories that are both `isActive` **and** currently
 * within their availability schedule, sorted by `sortOrder` ascending.
 */
export const getActiveCategories = (
  categories: ReadonlyArray<MenuCategory>,
  now: Date,
): MenuCategory[] =>
  [...categories]
    .filter((c) => c.isActive && isScheduleActive(c.schedule, now))
    .sort((a, b) => a.sortOrder - b.sortOrder);

/**
 * Build a tree from a flat list of categories using `parentId`.
 *
 * Root nodes are those whose `parentId` is `null`.  Children are sorted
 * by `sortOrder` at every level so the UI can render in the correct order.
 */
export const buildCategoryTree = (
  categories: ReadonlyArray<MenuCategory>,
): CategoryTreeNode[] => {
  // Index children by parentId for O(n) tree construction.
  const childrenMap = new Map<string | null, MenuCategory[]>();

  for (const cat of categories) {
    const siblings = childrenMap.get(cat.parentId) ?? [];
    siblings.push(cat);
    childrenMap.set(cat.parentId, siblings);
  }

  const buildLevel = (parentId: string | null): CategoryTreeNode[] => {
    const cats = childrenMap.get(parentId) ?? [];
    return [...cats]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => ({
        category,
        children: buildLevel(category.id),
      }));
  };

  return buildLevel(null);
};

/** Get direct children of a given parent, sorted by `sortOrder`. */
export const getCategoryChildren = (
  categories: ReadonlyArray<MenuCategory>,
  parentId: string,
): MenuCategory[] =>
  [...categories]
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

// ---------------------------------------------------------------------------
// Menu-item filtering
// ---------------------------------------------------------------------------

/**
 * Filter items belonging to `categoryId`.
 * Pass `null` to return all items (useful for a global search view).
 */
export const filterMenuItemsByCategory = (
  items: ReadonlyArray<MenuItem>,
  categoryId: string | null,
): MenuItem[] => {
  if (categoryId === null) return [...items];
  return items.filter((i) => i.categoryId === categoryId);
};

/**
 * Return items that are both `isAvailable` **and** within their
 * availability schedule at the given time.
 */
export const filterAvailableItems = (
  items: ReadonlyArray<MenuItem>,
  now: Date,
): MenuItem[] =>
  items.filter(
    (i) => i.isAvailable && isScheduleActive(i.availabilitySchedule, now),
  );

/** Items explicitly marked unavailable (e.g. 86'd / out-of-stock). */
export const getUnavailableItems = (
  items: ReadonlyArray<MenuItem>,
): MenuItem[] => items.filter((i) => !i.isAvailable);

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

/**
 * Calculate the final price of an item given an optional portion and a set
 * of selected modifier IDs.
 *
 * Price logic:
 *   1. Start with `basePrice`.
 *   2. If a portion is selected and has a `priceOverride`, use that as the
 *      base. Otherwise multiply `basePrice` by the portion's `priceMultiplier`.
 *   3. Sum the prices of every selected modifier.
 *   4. Round to 2 decimals (currency precision).
 */
export const calculateItemPrice = (
  item: MenuItem,
  portionId: string | null,
  selectedModifierIds: string[],
): number => {
  let price = item.basePrice;

  // Apply portion pricing
  if (portionId !== null) {
    const portion = item.portions.find((p) => p.id === portionId);
    if (portion) {
      price =
        portion.priceOverride !== null
          ? portion.priceOverride
          : round2(item.basePrice * portion.priceMultiplier);
    }
  }

  // Collect all modifiers from every group into a lookup for O(n) access.
  const modifierMap = new Map<string, Modifier>();
  for (const group of item.modifierGroups) {
    for (const mod of group.modifiers) {
      modifierMap.set(mod.id, mod);
    }
  }

  const modifierTotal = selectedModifierIds.reduce((sum, id) => {
    const mod = modifierMap.get(id);
    return mod ? sum + mod.price : sum;
  }, 0);

  return round2(price + modifierTotal);
};

// ---------------------------------------------------------------------------
// Modifier validation
// ---------------------------------------------------------------------------

/**
 * Validate that every modifier group's min/max selection constraints are
 * satisfied.
 *
 * Required groups that have zero selections always produce an error even
 * when `minSelections` is 0 — the `required` flag is an additional gate.
 */
export const validateModifierSelections = (
  item: MenuItem,
  selectedModifierIds: string[],
): ModifierValidationResult => {
  const selectedSet = new Set(selectedModifierIds);
  const errors: ModifierValidationError[] = [];

  for (const group of item.modifierGroups) {
    const groupModifierIds = new Set(group.modifiers.map((m) => m.id));
    const actualSelections = selectedModifierIds.filter((id) =>
      groupModifierIds.has(id),
    ).length;

    const tooFew = actualSelections < group.minSelections;
    const tooMany =
      group.maxSelections > 0 && actualSelections > group.maxSelections;
    const requiredButEmpty = group.required && actualSelections === 0;

    if (tooFew || tooMany || requiredButEmpty) {
      let message: string;
      if (requiredButEmpty && !tooFew) {
        message = `"${group.name}" is required — please make a selection.`;
      } else if (tooFew) {
        message = `"${group.name}" requires at least ${group.minSelections} selection(s), but ${actualSelections} selected.`;
      } else {
        message = `"${group.name}" allows at most ${group.maxSelections} selection(s), but ${actualSelections} selected.`;
      }

      errors.push({
        groupId: group.id,
        groupName: group.name,
        required: group.required,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        actualSelections,
        message,
      });
    }
  }

  return { isValid: errors.length === 0, errors };
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** Exact PLU code lookup — returns the first match or `null`. */
export const searchByPLU = (
  items: ReadonlyArray<MenuItem>,
  pluCode: string,
): MenuItem | null =>
  items.find((i) => i.pluCode !== null && i.pluCode === pluCode) ?? null;

/**
 * Simple fuzzy-ish search across name, description, PLU, and tags.
 *
 * The query is lowercased and split on whitespace; an item matches when
 * **every** token appears in at least one of the searchable fields.
 * This gives "AND" semantics ("chicken large" matches items containing both
 * words) which feels more intuitive on a POS than "OR".
 */
export const searchMenuItems = (
  items: ReadonlyArray<MenuItem>,
  query: string,
): MenuItem[] => {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [...items];

  return items.filter((item) => {
    // Build a single searchable blob per item to avoid repeated toLowerCase
    const blob = [
      item.name,
      item.description,
      item.pluCode ?? '',
      ...item.tags,
    ]
      .join(' ')
      .toLowerCase();

    return tokens.every((token) => blob.includes(token));
  });
};

// ---------------------------------------------------------------------------
// Food-cost analysis
// ---------------------------------------------------------------------------

/**
 * Calculate food-cost percentage: `(recipeCost / sellingPrice) * 100`.
 *
 * Returns 0 when `sellingPrice` is zero to avoid division-by-zero — a
 * zero selling price is a data-entry error, not a reason to crash.
 */
export const calculateFoodCostPercentage = (
  recipeCost: number,
  sellingPrice: number,
): number => {
  if (sellingPrice === 0) return 0;
  return round2((recipeCost / sellingPrice) * 100);
};
