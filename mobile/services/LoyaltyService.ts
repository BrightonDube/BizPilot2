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
