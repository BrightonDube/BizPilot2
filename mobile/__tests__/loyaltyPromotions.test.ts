/**
 * Tests for LoyaltyService product-specific rates and promotions
 * (loyalty-programs tasks 3.3, 3.4, 10.1, 10.2, 10.3)
 */

import {
  calculateLinePoints,
  calculateOrderPointsWithRates,
  formatReceiptPointsSummary,
  isPromotionActive,
  applyActivePromotions,
  calculateSignupBonus,
  DEFAULT_EARN_RATE,
  type ProductEarnRate,
  type OrderLine,
  type LoyaltyPromotion,
} from "@/services/LoyaltyService";

// ---------------------------------------------------------------------------
// calculateLinePoints (task 3.3)
// ---------------------------------------------------------------------------

describe("calculateLinePoints — product-specific earn rates (task 3.3)", () => {
  const rates: ProductEarnRate[] = [
    { productId: "premium-whisky", earnRate: 3 },
    { productId: "cigarettes", earnRate: 0 },
  ];

  it("uses override rate when product has a specific rate", () => {
    // R100 of premium whisky at 3pts/R = 300pts
    expect(calculateLinePoints(100, "premium-whisky", rates)).toBe(300);
  });

  it("returns 0 for zero-rate product (e.g., cigarettes)", () => {
    expect(calculateLinePoints(200, "cigarettes", rates)).toBe(0);
  });

  it("uses defaultRate when product has no override", () => {
    const expected = Math.floor(150 * DEFAULT_EARN_RATE);
    expect(calculateLinePoints(150, "unknown-product", rates)).toBe(expected);
  });

  it("returns 0 for zero lineTotal regardless of rate", () => {
    expect(calculateLinePoints(0, "premium-whisky", rates)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateOrderPointsWithRates (task 3.3)
// ---------------------------------------------------------------------------

describe("calculateOrderPointsWithRates (task 3.3)", () => {
  it("sums points across lines with mixed rates", () => {
    const rates: ProductEarnRate[] = [
      { productId: "p1", earnRate: 2 },
    ];
    const lines: OrderLine[] = [
      { productId: "p1", lineTotal: 100 },  // 200 pts
      { productId: "p2", lineTotal: 50 },   // 50 pts at default rate 1
    ];
    expect(calculateOrderPointsWithRates(lines, rates)).toBe(250);
  });

  it("returns 0 for empty order", () => {
    expect(calculateOrderPointsWithRates([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatReceiptPointsSummary (task 3.4)
// ---------------------------------------------------------------------------

describe("formatReceiptPointsSummary (task 3.4)", () => {
  it("shows earned message when points > 0", () => {
    const msg = formatReceiptPointsSummary(125, 830);
    expect(msg).toContain("125 points");
    expect(msg).toContain("830 points");
  });

  it("shows balance-only message when 0 points earned (e.g., no-earn products)", () => {
    const msg = formatReceiptPointsSummary(0, 500);
    expect(msg).toContain("500 points");
    expect(msg).not.toContain("earned");
  });
});

// ---------------------------------------------------------------------------
// isPromotionActive (task 10.1)
// ---------------------------------------------------------------------------

describe("isPromotionActive (task 10.1)", () => {
  const always: LoyaltyPromotion = {
    id: "promo-1", type: "multiplier", value: 2,
    startsAt: null, endsAt: null,
  };

  it("always-active promotion is active at any time", () => {
    expect(isPromotionActive(always)).toBe(true);
    expect(isPromotionActive(always, "2000-01-01T00:00:00Z")).toBe(true);
    expect(isPromotionActive(always, "2099-12-31T23:59:59Z")).toBe(true);
  });

  it("not active before start date", () => {
    const promo: LoyaltyPromotion = {
      id: "p2", type: "multiplier", value: 2,
      startsAt: "2030-06-01", endsAt: null,
    };
    expect(isPromotionActive(promo, "2024-01-01T00:00:00Z")).toBe(false);
  });

  it("not active after end date", () => {
    const promo: LoyaltyPromotion = {
      id: "p3", type: "multiplier", value: 2,
      startsAt: null, endsAt: "2020-01-01",
    };
    expect(isPromotionActive(promo, "2024-06-01T00:00:00Z")).toBe(false);
  });

  it("active within date range", () => {
    const promo: LoyaltyPromotion = {
      id: "p4", type: "multiplier", value: 2,
      startsAt: "2024-01-01", endsAt: "2024-12-31",
    };
    expect(isPromotionActive(promo, "2024-06-15T12:00:00Z")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyActivePromotions (tasks 10.1, 10.2)
// ---------------------------------------------------------------------------

describe("applyActivePromotions (tasks 10.1 & 10.2)", () => {
  const doublePoints: LoyaltyPromotion = {
    id: "double", type: "multiplier", value: 2,
    startsAt: null, endsAt: null,
  };
  const triplePoints: LoyaltyPromotion = {
    id: "triple", type: "multiplier", value: 3,
    startsAt: null, endsAt: null,
  };
  const flat100: LoyaltyPromotion = {
    id: "flat100", type: "flat", value: 100,
    startsAt: null, endsAt: null,
  };
  const expired: LoyaltyPromotion = {
    id: "expired", type: "multiplier", value: 5,
    startsAt: null, endsAt: "2020-01-01",
  };

  it("no active promotions returns basePoints unchanged", () => {
    expect(applyActivePromotions(200, [])).toBe(200);
  });

  it("double points day gives 2× (task 10.2)", () => {
    expect(applyActivePromotions(100, [doublePoints])).toBe(200);
  });

  it("multipliers compose multiplicatively (2× then 3× = 6×)", () => {
    expect(applyActivePromotions(100, [doublePoints, triplePoints])).toBe(600);
  });

  it("flat bonus added after multiplier", () => {
    // 100 × 2 = 200 + 100 = 300
    expect(applyActivePromotions(100, [doublePoints, flat100])).toBe(300);
  });

  it("expired promotion has no effect", () => {
    expect(applyActivePromotions(100, [expired])).toBe(100);
  });

  it("signup_bonus promotions are excluded from applyActivePromotions", () => {
    const signup: LoyaltyPromotion = {
      id: "signup", type: "signup_bonus", value: 500,
      startsAt: null, endsAt: null,
    };
    // Should not add signup bonus here (separate function for that)
    expect(applyActivePromotions(100, [signup])).toBe(100);
  });

  it("returns 0 for 0 base points even with multiplier", () => {
    expect(applyActivePromotions(0, [doublePoints])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateSignupBonus (task 10.3)
// ---------------------------------------------------------------------------

describe("calculateSignupBonus (task 10.3)", () => {
  const bonus500: LoyaltyPromotion = {
    id: "signup-2024", type: "signup_bonus", value: 500,
    startsAt: null, endsAt: null,
  };
  const bonus200: LoyaltyPromotion = {
    id: "signup-extra", type: "signup_bonus", value: 200,
    startsAt: null, endsAt: null,
  };
  const doublePoints: LoyaltyPromotion = {
    id: "double", type: "multiplier", value: 2,
    startsAt: null, endsAt: null,
  };

  it("returns signup bonus when active", () => {
    expect(calculateSignupBonus([bonus500])).toBe(500);
  });

  it("sums multiple signup bonuses", () => {
    expect(calculateSignupBonus([bonus500, bonus200])).toBe(700);
  });

  it("ignores non-signup promotions", () => {
    expect(calculateSignupBonus([doublePoints])).toBe(0);
  });

  it("returns 0 when no promotions", () => {
    expect(calculateSignupBonus([])).toBe(0);
  });

  it("expired signup bonus is not counted", () => {
    const expired: LoyaltyPromotion = {
      id: "old-bonus", type: "signup_bonus", value: 1000,
      startsAt: null, endsAt: "2020-01-01",
    };
    expect(calculateSignupBonus([expired])).toBe(0);
  });
});
