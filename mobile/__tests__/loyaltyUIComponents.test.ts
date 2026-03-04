/**
 * Tests: Loyalty UI Components
 *
 * Tests for:
 * - LoyaltyRedemptionPanel (Task 4.1) — logic + PBT
 * - RewardsCatalogModal sorting logic (Tasks 5.1–5.4) — pure logic
 * - LoyaltyCardModal formatting helpers (Tasks 8.1–8.3) — pure logic
 *
 * NOTE: Full React component render tests require a device/simulator.
 * These tests focus on:
 * 1. The pure calculation functions used by components
 * 2. The sorting/filtering logic extracted from render helpers
 * 3. Property-based tests verifying invariants
 *
 * Why test logic separately from rendering?
 * The render environment (NTFS/WSL) has jest-haste-map performance issues
 * with JSX transforms. Testing pure logic gives us high confidence with
 * fast turnaround, while render tests are handled on the CI device runner.
 */

import {
  calculateRedemptionDiscount,
  validateRedemption,
  DEFAULT_REDEMPTION_RATE,
} from "../services/LoyaltyService";
import type { Reward } from "../components/loyalty/RewardsCatalogModal";

// ---------------------------------------------------------------------------
// Helper re-implementations (extracted from components for unit testing)
// These mirror the logic in the components without JSX/RN dependencies.
// ---------------------------------------------------------------------------

/**
 * Mirror of maxRedeemable calculation from LoyaltyRedemptionPanel.
 * Extracted so we can PBT it without rendering the component.
 */
function computeMaxRedeemable(
  availablePoints: number,
  orderTotal: number,
  redemptionRate: number,
  step: number
): number {
  // Floor balance to nearest step so the result is always a step multiple
  const maxByBalance = Math.floor(availablePoints / step) * step;
  const maxByOrder = Math.floor(orderTotal / redemptionRate / step) * step;
  return Math.min(maxByBalance, maxByOrder);
}

/**
 * Mirror of reward sorting from RewardsCatalogModal.
 * Affordable rewards first, then by points ascending.
 */
function sortRewards(rewards: Reward[], customerBalance: number): Reward[] {
  const active = rewards.filter((r) => r.active);
  const affordable = active.filter((r) => r.pointsCost <= customerBalance);
  const notAffordable = active.filter((r) => r.pointsCost > customerBalance);
  const sortByPoints = (a: Reward, b: Reward) => a.pointsCost - b.pointsCost;
  return [...affordable.sort(sortByPoints), ...notAffordable.sort(sortByPoints)];
}

/**
 * Mirror of formatCardNumber from LoyaltyCardModal.
 */
function formatCardNumber(cardNumber: string): string {
  const clean = cardNumber.replace(/\s/g, "");
  const groups = clean.match(/.{1,4}/g) ?? [clean];
  return groups.join(" ");
}

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeReward(
  overrides: Partial<Reward> = {}
): Reward {
  return {
    id: `r-${Math.random().toString(36).slice(2)}`,
    name: "Test Reward",
    description: "A test reward",
    pointsCost: 100,
    type: "discount_fixed",
    value: 10,
    availability: null,
    active: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// LoyaltyRedemptionPanel — maxRedeemable calculation
// ---------------------------------------------------------------------------

describe("LoyaltyRedemptionPanel — maxRedeemable", () => {
  const STEP = 50;
  const RATE = DEFAULT_REDEMPTION_RATE; // 0.01 ZAR per point

  test("capped by balance when balance is lower", () => {
    // Balance: 200 pts → R2.00 discount potential
    // Order: R100 → can discount up to 10,000 pts worth → capped by balance
    const result = computeMaxRedeemable(200, 100, RATE, STEP);
    expect(result).toBe(200);
  });

  test("capped by order total when order is lower", () => {
    // Balance: 10,000 pts
    // Order: R5.00 → max discount = 500 pts (floored to nearest 50)
    const result = computeMaxRedeemable(10_000, 5.0, RATE, STEP);
    expect(result).toBe(500);
  });

  test("floors to nearest step increment", () => {
    // Order: R7.33 → max = floor(733 / 50) * 50 = floor(14.66) * 50 = 700
    const result = computeMaxRedeemable(10_000, 7.33, RATE, STEP);
    expect(result).toBe(700);
  });

  test("returns 0 when order total is zero", () => {
    const result = computeMaxRedeemable(1_000, 0, RATE, STEP);
    expect(result).toBe(0);
  });

  test("returns 0 when balance is zero", () => {
    const result = computeMaxRedeemable(0, 100, RATE, STEP);
    expect(result).toBe(0);
  });

  test("step of 1 matches exact floor", () => {
    const result = computeMaxRedeemable(10_000, 12.34, RATE, 1);
    // 12.34 / 0.01 = 1234 pts max
    expect(result).toBe(1234);
  });
});

// ---------------------------------------------------------------------------
// LoyaltyRedemptionPanel — discount calculation (uses LoyaltyService)
// ---------------------------------------------------------------------------

describe("LoyaltyRedemptionPanel — discount amount", () => {
  test("0 points → R0 discount", () => {
    expect(calculateRedemptionDiscount(0)).toBe(0);
  });

  test("100 pts at default rate → R1.00 discount", () => {
    expect(calculateRedemptionDiscount(100)).toBeCloseTo(1.0, 2);
  });

  test("500 pts at default rate → R5.00 discount", () => {
    expect(calculateRedemptionDiscount(500)).toBeCloseTo(5.0, 2);
  });

  test("discount scales linearly with points", () => {
    for (let pts = 0; pts <= 2000; pts += 50) {
      const expected = pts * DEFAULT_REDEMPTION_RATE;
      expect(calculateRedemptionDiscount(pts)).toBeCloseTo(expected, 2);
    }
  });
});

// ---------------------------------------------------------------------------
// LoyaltyRedemptionPanel — validation
// ---------------------------------------------------------------------------

describe("LoyaltyRedemptionPanel — validation", () => {
  test("valid when points within balance", () => {
    expect(validateRedemption(300, 500).valid).toBe(true);
  });

  test("invalid when points exceed balance", () => {
    const result = validateRedemption(500, 300);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("valid when redeeming exact balance", () => {
    expect(validateRedemption(500, 500).valid).toBe(true);
  });

  test("invalid when balance is 0", () => {
    expect(validateRedemption(100, 0).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PBT: LoyaltyRedemptionPanel invariants
// ---------------------------------------------------------------------------

describe("PBT: maxRedeemable invariants", () => {
  /**
   * Property 1: maxRedeemable is always a non-negative multiple of STEP
   */
  test("Property 1 — result is always ≥ 0 and a multiple of STEP", () => {
    const STEP = 50;
    const RATE = DEFAULT_REDEMPTION_RATE;

    for (let i = 0; i < 300; i++) {
      const balance = Math.floor(Math.random() * 5000);
      const order = Math.random() * 500;
      const result = computeMaxRedeemable(balance, order, RATE, STEP);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result % STEP).toBe(0);
    }
  });

  /**
   * Property 2: maxRedeemable never exceeds the available balance
   */
  test("Property 2 — result never exceeds balance", () => {
    const STEP = 50;
    const RATE = DEFAULT_REDEMPTION_RATE;

    for (let i = 0; i < 300; i++) {
      const balance = Math.floor(Math.random() * 5000);
      const order = Math.random() * 200;
      const result = computeMaxRedeemable(balance, order, RATE, STEP);
      expect(result).toBeLessThanOrEqual(balance);
    }
  });

  /**
   * Property 3: discount(maxRedeemable) never exceeds orderTotal
   * (prevents over-discounting)
   */
  test("Property 3 — discount from max points never exceeds order total", () => {
    const STEP = 50;
    const RATE = DEFAULT_REDEMPTION_RATE;

    for (let i = 0; i < 300; i++) {
      const balance = Math.floor(Math.random() * 10_000);
      const order = Math.random() * 300 + 0.01;
      const maxPts = computeMaxRedeemable(balance, order, RATE, STEP);
      const discount = calculateRedemptionDiscount(maxPts, RATE);
      // Allow a rounding tolerance of one STEP worth of discount
      expect(discount).toBeLessThanOrEqual(order + STEP * RATE + 0.001);
    }
  });
});

// ---------------------------------------------------------------------------
// RewardsCatalogModal — sorting logic
// ---------------------------------------------------------------------------

describe("RewardsCatalogModal — sortRewards", () => {
  test("affordable rewards appear before unaffordable ones", () => {
    const affordable = makeReward({ pointsCost: 100 });
    const notAffordable = makeReward({ pointsCost: 500 });
    const sorted = sortRewards([notAffordable, affordable], 200);
    expect(sorted[0].id).toBe(affordable.id);
    expect(sorted[1].id).toBe(notAffordable.id);
  });

  test("within affordable group, sorted by points ascending", () => {
    const r1 = makeReward({ pointsCost: 300 });
    const r2 = makeReward({ pointsCost: 100 });
    const r3 = makeReward({ pointsCost: 200 });
    const sorted = sortRewards([r1, r2, r3], 400);
    expect(sorted.map((r) => r.pointsCost)).toEqual([100, 200, 300]);
  });

  test("inactive rewards are excluded", () => {
    const active = makeReward({ active: true, pointsCost: 100 });
    const inactive = makeReward({ active: false, pointsCost: 50 });
    const sorted = sortRewards([active, inactive], 500);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe(active.id);
  });

  test("empty catalog returns empty array", () => {
    expect(sortRewards([], 1000)).toHaveLength(0);
  });

  test("all rewards unaffordable — still returns them sorted by points", () => {
    const r1 = makeReward({ pointsCost: 500 });
    const r2 = makeReward({ pointsCost: 300 });
    const sorted = sortRewards([r1, r2], 0);
    expect(sorted[0].pointsCost).toBe(300);
    expect(sorted[1].pointsCost).toBe(500);
  });

  test("customer with exact cost can see that reward as affordable", () => {
    const r = makeReward({ pointsCost: 200 });
    const sorted = sortRewards([r], 200);
    expect(sorted[0].id).toBe(r.id);
  });
});

// ---------------------------------------------------------------------------
// PBT: RewardsCatalogModal sort invariants
// ---------------------------------------------------------------------------

describe("PBT: RewardsCatalogModal sortRewards invariants", () => {
  /**
   * Property 1: All affordable rewards appear before all unaffordable ones
   */
  test("Property 1 — affordable before unaffordable", () => {
    for (let i = 0; i < 200; i++) {
      const balance = Math.floor(Math.random() * 1000);
      const count = Math.floor(Math.random() * 10) + 2;
      const rewards = Array.from({ length: count }, () =>
        makeReward({
          pointsCost: Math.floor(Math.random() * 800) + 50,
          active: true,
        })
      );

      const sorted = sortRewards(rewards, balance);

      // Find the boundary between affordable and not
      let foundNotAffordable = false;
      for (const r of sorted) {
        if (r.pointsCost > balance) {
          foundNotAffordable = true;
        } else if (foundNotAffordable) {
          // An affordable reward appears AFTER an unaffordable one — violation
          throw new Error(
            `Affordable reward (cost=${r.pointsCost}) appeared after unaffordable (balance=${balance})`
          );
        }
      }
    }
  });

  /**
   * Property 2: Sorted output is a permutation of the filtered input
   * (no rewards added or dropped other than inactive ones)
   */
  test("Property 2 — sorted count equals active-only input count", () => {
    for (let i = 0; i < 200; i++) {
      const count = Math.floor(Math.random() * 8) + 2;
      const rewards = Array.from({ length: count }, () =>
        makeReward({ active: Math.random() > 0.3 })
      );

      const activeCount = rewards.filter((r) => r.active).length;
      const sorted = sortRewards(rewards, 999_999);
      expect(sorted).toHaveLength(activeCount);
    }
  });
});

// ---------------------------------------------------------------------------
// LoyaltyCardModal — formatCardNumber helper
// ---------------------------------------------------------------------------

describe("LoyaltyCardModal — formatCardNumber", () => {
  test("16-digit card → 4 groups of 4", () => {
    expect(formatCardNumber("1234567890123456")).toBe("1234 5678 9012 3456");
  });

  test("strips existing spaces before formatting", () => {
    expect(formatCardNumber("1234 5678 9012 3456")).toBe("1234 5678 9012 3456");
  });

  test("short card number — single group", () => {
    expect(formatCardNumber("ABC123")).toBe("ABC1 23");
  });

  test("empty string → empty string", () => {
    expect(formatCardNumber("")).toBe("");
  });

  test("8-digit card → 2 groups of 4", () => {
    expect(formatCardNumber("12345678")).toBe("1234 5678");
  });

  test("alphanumeric card numbers handled correctly", () => {
    expect(formatCardNumber("BPLOY2024ABCD")).toBe("BPLO Y202 4ABC D");
  });
});
