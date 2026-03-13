/**
 * BizPilot Mobile POS — LoyaltyService
 *
 * Client-side loyalty points calculations for the POS checkout.
 * These functions are pure (no database/network I/O) so they work
 * offline and are easily testable.
 *
 * Why pure functions?
 * The POS needs to show points earned and preview redemption totals
 * instantly during checkout — before any server round-trip. By keeping
 * the calculation logic pure and server-authoritative writes async,
 * we get immediate UI feedback with eventual consistency.
 *
 * Server writes (award, redeem) happen via the API sync queue and are
 * validated server-side. The values calculated here are display-only
 * until the order is committed.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoyaltyTransaction {
  type: "earned" | "redeemed" | "expired" | "adjusted";
  points: number;
  createdAt: number;
}

export interface RedemptionValidation {
  valid: boolean;
  error?: string;
}

export interface LoyaltyTier {
  name: string;
  minLifetimePoints: number;
  multiplier: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default earn rate: 1 point per ZAR spent.
 * Override per-business via settings.
 */
export const DEFAULT_EARN_RATE = 1; // points per ZAR

/**
 * Default redemption rate: 1 point = R0.01 discount.
 * i.e., 100 points = R1.00 off.
 */
export const DEFAULT_REDEMPTION_RATE = 0.01; // ZAR per point

/** Default tiers (Bronze → Silver → Gold → Platinum) */
export const DEFAULT_TIERS: LoyaltyTier[] = [
  { name: "Bronze", minLifetimePoints: 0, multiplier: 1.0 },
  { name: "Silver", minLifetimePoints: 500, multiplier: 1.25 },
  { name: "Gold", minLifetimePoints: 2000, multiplier: 1.5 },
  { name: "Platinum", minLifetimePoints: 5000, multiplier: 2.0 },
];

// ---------------------------------------------------------------------------
// Pure calculation functions
// ---------------------------------------------------------------------------

/**
 * Calculate points earned for a purchase.
 *
 * Points = floor(orderAmount × earnRate × tierMultiplier)
 * We floor to avoid fractional points (which would violate integer balance invariant).
 *
 * @param orderAmount - Order total in ZAR
 * @param earnRate - Points per ZAR (default: 1)
 * @param tierMultiplier - Multiplier from current tier (default: 1.0)
 */
export function calculatePointsEarned(
  orderAmount: number,
  earnRate: number = DEFAULT_EARN_RATE,
  tierMultiplier: number = 1.0
): number {
  if (orderAmount <= 0) return 0;
  if (earnRate <= 0) return 0;
  return Math.floor(orderAmount * earnRate * tierMultiplier);
}

/**
 * Calculate the discount value of a redemption.
 *
 * Discount = pointsToRedeem × redemptionRate
 * Capped at the order total (cannot redeem more than order value).
 *
 * @param pointsToRedeem - Number of points the customer wants to redeem
 * @param redemptionRate - ZAR value per point (default: 0.01)
 * @param orderTotal - Maximum discount cap
 */
export function calculateRedemptionDiscount(
  pointsToRedeem: number,
  redemptionRate: number = DEFAULT_REDEMPTION_RATE,
  orderTotal: number = Infinity
): number {
  if (pointsToRedeem <= 0) return 0;
  const rawDiscount = pointsToRedeem * redemptionRate;
  // Round to 2 decimal places to avoid FP issues
  const discount = Math.round(rawDiscount * 100) / 100;
  return Math.min(discount, orderTotal);
}

/**
 * Calculate current points balance from a list of transactions.
 *
 * Property 1: balance = sum(earned) - sum(redeemed) - sum(expired) + sum(adjusted)
 * Balance is always >= 0 (clamped at 0 to handle edge cases).
 */
export function calculateBalance(transactions: LoyaltyTransaction[]): number {
  const balance = transactions.reduce((sum, tx) => {
    switch (tx.type) {
      case "earned":
        return sum + tx.points;
      case "redeemed":
        return sum - tx.points;
      case "expired":
        return sum - tx.points;
      case "adjusted":
        return sum + tx.points; // can be negative for manual deductions
      default:
        return sum;
    }
  }, 0);
  // Safety: balance cannot go below 0 (server should prevent this, but guard here)
  return Math.max(0, balance);
}

/**
 * Validate a redemption request against the current balance.
 *
 * Property 2: A redemption MUST be rejected if pointsToRedeem > availableBalance.
 */
export function validateRedemption(
  pointsToRedeem: number,
  availableBalance: number
): RedemptionValidation {
  if (pointsToRedeem <= 0) {
    return { valid: false, error: "Redemption amount must be greater than zero" };
  }
  if (pointsToRedeem > availableBalance) {
    return {
      valid: false,
      error: `Insufficient points: ${pointsToRedeem} requested, ${availableBalance} available`,
    };
  }
  return { valid: true };
}

/**
 * Determine a customer's loyalty tier based on their lifetime points earned.
 *
 * Property 3: Tier = highest tier whose minLifetimePoints <= lifetimeEarned.
 * The tiers array must be sorted ascending by minLifetimePoints.
 */
export function determineTier(
  lifetimePointsEarned: number,
  tiers: LoyaltyTier[] = DEFAULT_TIERS
): LoyaltyTier {
  // Sort ascending to find the highest qualifying tier
  const sorted = [...tiers].sort((a, b) => a.minLifetimePoints - b.minLifetimePoints);

  let currentTier = sorted[0];
  for (const tier of sorted) {
    if (lifetimePointsEarned >= tier.minLifetimePoints) {
      currentTier = tier;
    }
  }
  return currentTier;
}

// ---------------------------------------------------------------------------
// Order integration (task 3.2)
// ---------------------------------------------------------------------------

/**
 * Calculate points earned for a completed order.
 *
 * Integrates LoyaltyService with the order completion flow.
 * Call this at the end of processPayment / order confirmation to determine
 * how many points to award before writing to the Customer record.
 *
 * This is a pure function so it works offline (no DB or network needed).
 * The caller is responsible for persisting the returned pointsEarned to
 * the Customer record via the WatermelonDB write pipeline.
 *
 * Why pure instead of writing to DB directly?
 * Keeping it pure means the same function is used for:
 * 1. Receipt display ("You earned X points!")
 * 2. Checkout preview ("You will earn X points")
 * 3. The actual DB update in OrderService.finalizeOrder()
 *
 * @param orderTotal   - The final order total (after discount, before tip)
 * @param earnRate     - Points per currency unit. Default: DEFAULT_EARN_RATE
 * @param tierMultiplier - Bonus multiplier from the customer's tier. Default: 1
 */
export function earnPointsForOrder(
  orderTotal: number,
  earnRate: number = DEFAULT_EARN_RATE,
  tierMultiplier: number = 1
): number {
  return calculatePointsEarned(orderTotal, earnRate, tierMultiplier);
}

/**
 * Compute the updated loyalty balance after an order is completed.
 *
 * Offline-safe: operates entirely on local data (task 11.3).
 *
 * @param existingTransactions - All historical loyalty transactions for the customer
 * @param orderTotal           - Total value of the just-completed order
 * @param earnRate             - Points earn rate (default: DEFAULT_EARN_RATE)
 * @param tierMultiplier       - Tier bonus multiplier (default: 1)
 * @returns New balance after adding the earned points
 */
export function applyOrderPointsEarned(
  existingTransactions: LoyaltyTransaction[],
  orderTotal: number,
  earnRate: number = DEFAULT_EARN_RATE,
  tierMultiplier: number = 1
): number {
  const earned = earnPointsForOrder(orderTotal, earnRate, tierMultiplier);
  const orderTransaction: LoyaltyTransaction = {
    type: "earned",
    points: earned,
  };
  return calculateBalance([...existingTransactions, orderTransaction]);
}

// ---------------------------------------------------------------------------
// Product-specific earn rates (task 3.3)
// ---------------------------------------------------------------------------

/**
 * A product or category can override the default earn rate.
 * Attach to products in the catalogue; falls back to the default rate.
 */
export interface ProductEarnRate {
  productId: string;
  earnRate: number;
}

/**
 * Calculate points for a single order line item, respecting product-specific rates.
 *
 * Why per-line instead of per-order?
 * Different SKUs can have different earn rates (e.g., cigarettes earn 0 points;
 * premium products earn 3× points). Summing at line level is the only
 * correct approach.
 *
 * @param lineTotal   - Item price × quantity for this line
 * @param productId   - ID of the product (for rate lookup)
 * @param rateOverrides - Array of product-specific earn rates
 * @param defaultRate  - Fallback earn rate
 * @param tierMultiplier - Bonus multiplier from the customer's tier
 */
export function calculateLinePoints(
  lineTotal: number,
  productId: string,
  rateOverrides: ProductEarnRate[] = [],
  defaultRate: number = DEFAULT_EARN_RATE,
  tierMultiplier: number = 1
): number {
  const override = rateOverrides.find((r) => r.productId === productId);
  const rate = override !== undefined ? override.earnRate : defaultRate;
  return calculatePointsEarned(lineTotal, rate, tierMultiplier);
}

/**
 * Calculate total points earned across a multi-line order, respecting
 * product-specific earn rates (task 3.3).
 */
export interface OrderLine {
  productId: string;
  lineTotal: number;
}

export function calculateOrderPointsWithRates(
  lines: OrderLine[],
  rateOverrides: ProductEarnRate[] = [],
  defaultRate: number = DEFAULT_EARN_RATE,
  tierMultiplier: number = 1
): number {
  return lines.reduce((sum, line) => {
    return sum + calculateLinePoints(
      line.lineTotal,
      line.productId,
      rateOverrides,
      defaultRate,
      tierMultiplier
    );
  }, 0);
}

// ---------------------------------------------------------------------------
// Receipt points display helper (task 3.4)
// ---------------------------------------------------------------------------

/**
 * Build the points summary string shown on a receipt.
 *
 * Returns a human-readable string like:
 *   "You earned 125 points! New balance: 830 points."
 *
 * This is a pure string formatter — call it in the receipt rendering
 * component to display points earned.
 */
export function formatReceiptPointsSummary(
  pointsEarned: number,
  newBalance: number
): string {
  if (pointsEarned <= 0) {
    return `Your points balance: ${newBalance} points.`;
  }
  return `You earned ${pointsEarned} points! New balance: ${newBalance} points.`;
}

// ---------------------------------------------------------------------------
// Bonus promotions (tasks 10.1, 10.2, 10.3)
// ---------------------------------------------------------------------------

/**
 * A promotion that multiplies points earned for a specific period.
 * Used for double-points days, sign-up bonuses, and category promotions.
 *
 * Why a multiplier instead of a flat bonus?
 * Multiplicative promotions scale naturally with order size.
 * Flat bonuses can be applied on top via type="flat" promotions.
 */
export interface LoyaltyPromotion {
  id: string;
  type: "multiplier" | "flat" | "signup_bonus";
  /** For "multiplier": points = base × value. For "flat": points += value. */
  value: number;
  /** ISO start date (inclusive). Null means always active. */
  startsAt: string | null;
  /** ISO end date (inclusive). Null means no expiry. */
  endsAt: string | null;
  /** Optional: only apply to specific product IDs */
  productIds?: string[];
}

/**
 * Check whether a promotion is currently active for a given date.
 *
 * @param promotion - The promotion to evaluate
 * @param now       - Current timestamp (ISO string). Defaults to Date.now().
 */
export function isPromotionActive(
  promotion: LoyaltyPromotion,
  now: string = new Date().toISOString()
): boolean {
  const ts = new Date(now).getTime();
  if (promotion.startsAt !== null) {
    const start = new Date(promotion.startsAt);
    start.setHours(0, 0, 0, 0);
    if (ts < start.getTime()) return false;
  }
  if (promotion.endsAt !== null) {
    const end = new Date(promotion.endsAt);
    end.setHours(23, 59, 59, 999);
    if (ts > end.getTime()) return false;
  }
  return true;
}

/**
 * Apply active promotions to a base points amount.
 *
 * Processing order:
 * 1. Multipliers are composed multiplicatively (2× then 3× = 6×).
 * 2. Flat bonuses are added after all multipliers have been applied.
 * 3. signup_bonus promotions are handled separately by applySignupBonus().
 *
 * @param basePoints  - Points before promotions
 * @param promotions  - All promotions to evaluate
 * @param now         - ISO timestamp for active check
 */
export function applyActivePromotions(
  basePoints: number,
  promotions: LoyaltyPromotion[],
  now: string = new Date().toISOString()
): number {
  const active = promotions.filter(
    (p) => isPromotionActive(p, now) && p.type !== "signup_bonus"
  );

  let multiplier = 1;
  let flatBonus = 0;

  for (const promo of active) {
    if (promo.type === "multiplier") {
      multiplier *= promo.value;
    } else if (promo.type === "flat") {
      flatBonus += promo.value;
    }
  }

  return Math.max(0, Math.floor(basePoints * multiplier) + flatBonus);
}

/**
 * Calculate the sign-up bonus for a new customer (task 10.3).
 *
 * Returns the total sign-up bonus points from all active signup_bonus promotions.
 * Summed (not multiplied) because a customer can only sign up once.
 */
export function calculateSignupBonus(
  promotions: LoyaltyPromotion[],
  now: string = new Date().toISOString()
): number {
  return promotions
    .filter((p) => p.type === "signup_bonus" && isPromotionActive(p, now))
    .reduce((sum, p) => sum + p.value, 0);
}
