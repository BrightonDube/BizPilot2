/**
 * IngredientTrackingService — inventory tracking, deduction, low-stock alerts,
 * and ingredient substitution logic for recipe management.
 *
 * Tasks: 4.1 (track inventory), 4.2 (deduct on sale), 4.3 (alert low stock),
 *        4.4 (support substitutions)
 *
 * Why pure functions?
 * POS devices must show stock warnings and allow substitutions offline.
 * Pure functions let the UI compute alerts reactively via useMemo without
 * waiting for a server round-trip. The caller persists changes to
 * WatermelonDB and syncs when connectivity returns.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stock level status thresholds */
export type StockAlertLevel = "ok" | "low" | "critical" | "out_of_stock";

export interface IngredientStock {
  ingredientId: string;
  name: string;
  /** Current quantity on hand (in base unit) */
  currentQuantity: number;
  /** Unit of measure (g, ml, each, etc.) */
  unit: string;
  /** When currentQuantity falls below this, status is "low" */
  lowStockThreshold: number;
  /** When currentQuantity falls below this, status is "critical" */
  criticalStockThreshold: number;
  /** Cost per unit (ZAR) */
  unitCost: number;
  /** Optional: ISO date string of last restock */
  lastRestockedAt?: string;
}

export interface StockAlert {
  ingredientId: string;
  name: string;
  currentQuantity: number;
  unit: string;
  level: StockAlertLevel;
  /** How many units below the threshold */
  deficit: number;
}

export interface StockDeduction {
  ingredientId: string;
  previousQuantity: number;
  deductedQuantity: number;
  newQuantity: number;
}

export interface DeductionResult {
  deductions: StockDeduction[];
  /** Ingredients that could not be fully deducted (insufficient stock) */
  shortages: Array<{
    ingredientId: string;
    name: string;
    required: number;
    available: number;
    shortfall: number;
  }>;
}

export interface IngredientSubstitution {
  originalIngredientId: string;
  substituteIngredientId: string;
  /** Conversion ratio: 1 unit of original = conversionRatio units of substitute */
  conversionRatio: number;
  /** Optional notes about the substitution (e.g., "use unsalted butter") */
  notes?: string;
}

export interface SubstitutionSuggestion {
  originalIngredientId: string;
  originalName: string;
  substitute: {
    ingredientId: string;
    name: string;
    /** Quantity of substitute needed to replace `requiredOriginalQty` */
    substituteQuantity: number;
    unit: string;
    available: number;
    /** true if there is enough substitute stock */
    isFeasible: boolean;
  };
}

// ---------------------------------------------------------------------------
// Task 4.1: Track ingredient inventory
// ---------------------------------------------------------------------------

/**
 * Determine the stock alert level for a single ingredient.
 *
 * Why explicit thresholds instead of a single %?
 * Different ingredients have very different reorder lead times. A spice
 * running low is less urgent than a protein. Separate thresholds let the
 * kitchen manager configure per-ingredient urgency.
 */
export function getStockAlertLevel(stock: IngredientStock): StockAlertLevel {
  if (stock.currentQuantity <= 0) return "out_of_stock";
  if (stock.currentQuantity <= stock.criticalStockThreshold) return "critical";
  if (stock.currentQuantity <= stock.lowStockThreshold) return "low";
  return "ok";
}

/**
 * Scan all ingredient stock levels and return only those that need attention.
 *
 * Why filter in a separate function?
 * The POS dashboard calls this on every stock mutation to update a badge
 * count. Keeping it separate from getStockAlertLevel avoids coupling the
 * single-ingredient check to the list iteration pattern.
 */
export function getStockAlerts(
  stockList: IngredientStock[]
): StockAlert[] {
  const alerts: StockAlert[] = [];

  for (const stock of stockList) {
    const level = getStockAlertLevel(stock);
    if (level === "ok") continue;

    const threshold =
      level === "out_of_stock"
        ? stock.lowStockThreshold
        : level === "critical"
        ? stock.criticalStockThreshold
        : stock.lowStockThreshold;

    alerts.push({
      ingredientId: stock.ingredientId,
      name: stock.name,
      currentQuantity: stock.currentQuantity,
      unit: stock.unit,
      level,
      deficit: Math.max(0, threshold - stock.currentQuantity),
    });
  }

  return alerts;
}

/**
 * Calculate the total inventory value for a set of ingredients.
 */
export function calculateInventoryValue(stockList: IngredientStock[]): number {
  return Math.round(
    stockList.reduce((sum, s) => sum + s.currentQuantity * s.unitCost, 0) * 100
  ) / 100;
}

// ---------------------------------------------------------------------------
// Task 4.2: Deduct on sale
// ---------------------------------------------------------------------------

/**
 * Apply ingredient deductions for a sale and return the results.
 *
 * Why return a result object instead of mutating?
 * Immutable return values let the caller decide whether to commit the
 * deductions (e.g., skip if payment fails). It also makes testing trivial —
 * no need to reset shared state between assertions.
 *
 * @param stockList  - Current stock levels
 * @param deductions - Required deductions (from RecipeService.calculateIngredientDeductions)
 * @param allowNegative - If true, allow stock to go negative (default: false)
 */
export function applyDeductions(
  stockList: IngredientStock[],
  deductions: Array<{ ingredientId: string; deductQuantity: number }>,
  allowNegative: boolean = false
): DeductionResult {
  const stockMap = new Map<string, IngredientStock>();
  for (const s of stockList) {
    stockMap.set(s.ingredientId, s);
  }

  const appliedDeductions: StockDeduction[] = [];
  const shortages: DeductionResult["shortages"] = [];

  for (const ded of deductions) {
    const stock = stockMap.get(ded.ingredientId);
    if (!stock) {
      shortages.push({
        ingredientId: ded.ingredientId,
        name: ded.ingredientId, // fallback if stock not found
        required: ded.deductQuantity,
        available: 0,
        shortfall: ded.deductQuantity,
      });
      continue;
    }

    const previousQuantity = stock.currentQuantity;
    const required = ded.deductQuantity;

    if (!allowNegative && previousQuantity < required) {
      shortages.push({
        ingredientId: stock.ingredientId,
        name: stock.name,
        required,
        available: previousQuantity,
        shortfall: Math.round((required - previousQuantity) * 1000) / 1000,
      });
      // Still deduct what we can
      appliedDeductions.push({
        ingredientId: stock.ingredientId,
        previousQuantity,
        deductedQuantity: previousQuantity,
        newQuantity: 0,
      });
    } else {
      const newQuantity =
        Math.round((previousQuantity - required) * 1000) / 1000;
      appliedDeductions.push({
        ingredientId: stock.ingredientId,
        previousQuantity,
        deductedQuantity: required,
        newQuantity,
      });
    }
  }

  return { deductions: appliedDeductions, shortages };
}

// ---------------------------------------------------------------------------
// Task 4.3: Alert on low stock (uses getStockAlerts above)
// ---------------------------------------------------------------------------

/**
 * Check if a sale can proceed based on ingredient availability.
 *
 * Returns the list of ingredients that would be short. If the returned
 * array is empty, the sale can proceed.
 *
 * Why a separate pre-check?
 * On the POS screen, we want to show a warning *before* the cashier
 * confirms the order, not after deduction. This lets the UI show
 * "Low stock: Chicken Breast (need 500g, only 200g left)" inline.
 */
export function checkAvailabilityForSale(
  stockList: IngredientStock[],
  deductions: Array<{ ingredientId: string; deductQuantity: number }>
): DeductionResult["shortages"] {
  const stockMap = new Map<string, IngredientStock>();
  for (const s of stockList) {
    stockMap.set(s.ingredientId, s);
  }

  const shortages: DeductionResult["shortages"] = [];

  for (const ded of deductions) {
    const stock = stockMap.get(ded.ingredientId);
    if (!stock) {
      shortages.push({
        ingredientId: ded.ingredientId,
        name: ded.ingredientId,
        required: ded.deductQuantity,
        available: 0,
        shortfall: ded.deductQuantity,
      });
      continue;
    }

    if (stock.currentQuantity < ded.deductQuantity) {
      shortages.push({
        ingredientId: stock.ingredientId,
        name: stock.name,
        required: ded.deductQuantity,
        available: stock.currentQuantity,
        shortfall:
          Math.round((ded.deductQuantity - stock.currentQuantity) * 1000) /
          1000,
      });
    }
  }

  return shortages;
}

/**
 * Get a summary of stock health for dashboard display.
 */
export function getStockHealthSummary(stockList: IngredientStock[]): {
  total: number;
  ok: number;
  low: number;
  critical: number;
  outOfStock: number;
} {
  let ok = 0;
  let low = 0;
  let critical = 0;
  let outOfStock = 0;

  for (const stock of stockList) {
    const level = getStockAlertLevel(stock);
    switch (level) {
      case "ok":
        ok++;
        break;
      case "low":
        low++;
        break;
      case "critical":
        critical++;
        break;
      case "out_of_stock":
        outOfStock++;
        break;
    }
  }

  return { total: stockList.length, ok, low, critical, outOfStock };
}

// ---------------------------------------------------------------------------
// Task 4.4: Support substitutions
// ---------------------------------------------------------------------------

/**
 * Find available substitutions for a short ingredient.
 *
 * Why a substitution registry instead of auto-detection?
 * Ingredient substitutions are domain-specific (e.g., butter ↔ margarine
 * requires a conversion ratio). The kitchen manager defines these mappings,
 * and we simply look up + validate availability. Auto-detection would
 * require AI inference, which is inappropriate for a critical POS path.
 */
export function findSubstitutions(
  shortIngredientId: string,
  requiredQuantity: number,
  substitutions: IngredientSubstitution[],
  stockList: IngredientStock[]
): SubstitutionSuggestion[] {
  const stockMap = new Map<string, IngredientStock>();
  for (const s of stockList) {
    stockMap.set(s.ingredientId, s);
  }

  // Find the original ingredient's name
  const original = stockMap.get(shortIngredientId);
  const originalName = original?.name ?? shortIngredientId;

  const applicable = substitutions.filter(
    (sub) => sub.originalIngredientId === shortIngredientId
  );

  return applicable.map((sub) => {
    const substituteStock = stockMap.get(sub.substituteIngredientId);
    const substituteQuantity =
      Math.round(requiredQuantity * sub.conversionRatio * 1000) / 1000;

    return {
      originalIngredientId: shortIngredientId,
      originalName,
      substitute: {
        ingredientId: sub.substituteIngredientId,
        name: substituteStock?.name ?? sub.substituteIngredientId,
        substituteQuantity,
        unit: substituteStock?.unit ?? "unit",
        available: substituteStock?.currentQuantity ?? 0,
        isFeasible: (substituteStock?.currentQuantity ?? 0) >= substituteQuantity,
      },
    };
  });
}

/**
 * Apply a substitution to a recipe's ingredients list.
 * Returns a new ingredients array with the original ingredient replaced.
 *
 * Why return a new array?
 * Immutability — the caller decides whether to persist the substitution
 * temporarily (for this order only) or permanently (update the recipe).
 */
export function applySubstitution(
  ingredients: Array<{
    ingredientId: string;
    name: string;
    quantity: number;
    unitCost: number;
    unit: string;
  }>,
  originalIngredientId: string,
  substitution: IngredientSubstitution,
  substituteStock: IngredientStock
): Array<{
  ingredientId: string;
  name: string;
  quantity: number;
  unitCost: number;
  unit: string;
}> {
  return ingredients.map((ing) => {
    if (ing.ingredientId !== originalIngredientId) return ing;

    return {
      ingredientId: substitution.substituteIngredientId,
      name: substituteStock.name,
      quantity:
        Math.round(ing.quantity * substitution.conversionRatio * 1000) / 1000,
      unitCost: substituteStock.unitCost,
      unit: substituteStock.unit,
    };
  });
}
