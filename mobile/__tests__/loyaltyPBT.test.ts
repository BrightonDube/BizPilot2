/**
 * Loyalty Points Property-Based Tests (tasks 2.6, 4.4, 6.5)
 *
 * Property 1 (task 2.6): Balance accuracy
 *   balance = sum(earned) - sum(redeemed) - sum(expired)
 *
 * Property 2 (task 4.4): Redemption validation
 *   Any redemption with pointsToRedeem > balance MUST be rejected
 *
 * Property 3 (task 6.5): Tier consistency
 *   Tier SHALL match the highest tier threshold <= lifetimeEarned
 *
 * Why PBTs for loyalty?
 * A loyalty system is a financial ledger. Incorrect balance calculations
 * or invalid redemptions accepted are direct financial losses for the business.
 * PBTs with hundreds of random transaction sequences catch edge cases
 * that deterministic tests miss (e.g., redemption just over balance,
 * balance = 0 after multiple expiries).
 */

import {
  calculateBalance,
  calculatePointsEarned,
  calculateRedemptionDiscount,
  validateRedemption,
  determineTier,
  DEFAULT_TIERS,
  LoyaltyTransaction,
  LoyaltyTier,
} from "@/services/LoyaltyService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function randomTransactions(count: number): LoyaltyTransaction[] {
  const txs: LoyaltyTransaction[] = [];
  let balance = 0;

  for (let i = 0; i < count; i++) {
    const type = (["earned", "redeemed", "expired"] as const)[randInt(0, 2)];
    const points = randInt(1, 500);

    // Never redeem/expire more than available balance (preserve valid state)
    if ((type === "redeemed" || type === "expired") && points > balance) {
      // Fall back to "earned" to keep balance valid
      txs.push({ type: "earned", points: randInt(1, 500), createdAt: Date.now() });
      balance += txs[txs.length - 1].points;
    } else {
      txs.push({ type, points, createdAt: Date.now() });
      if (type === "earned") balance += points;
      else balance -= points;
    }
  }
  return txs;
}

const ITERATIONS = 300;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Loyalty PBTs", () => {
  // -------------------------------------------------------------------------
  // Task 2.6: Property 1 — Balance accuracy
  // -------------------------------------------------------------------------

  describe("Property 1: balance accuracy", () => {
    it("balance = sum(earned) - sum(redeemed) - sum(expired)", () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const txs = randomTransactions(randInt(0, 50));

        const calculated = calculateBalance(txs);

        // Manual calculation to cross-check
        const expected = Math.max(
          0,
          txs.reduce((sum, tx) => {
            if (tx.type === "earned") return sum + tx.points;
            if (tx.type === "redeemed") return sum - tx.points;
            if (tx.type === "expired") return sum - tx.points;
            if (tx.type === "adjusted") return sum + tx.points;
            return sum;
          }, 0)
        );

        expect(calculated).toBe(expected);
      }
    });

    it("empty transaction list yields balance of 0", () => {
      expect(calculateBalance([])).toBe(0);
    });

    it("balance is always non-negative", () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const txs = randomTransactions(randInt(0, 50));
        expect(calculateBalance(txs)).toBeGreaterThanOrEqual(0);
      }
    });

    it("balance only grows when earning points", () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const basePoints = randInt(0, 1000);
        const base: LoyaltyTransaction[] = [
          { type: "earned", points: basePoints, createdAt: 1000 },
        ];
        const earnMore = randInt(1, 500);
        const withMore: LoyaltyTransaction[] = [
          ...base,
          { type: "earned", points: earnMore, createdAt: 2000 },
        ];

        expect(calculateBalance(withMore)).toBeGreaterThan(calculateBalance(base));
      }
    });

    it("order of transactions does not affect final balance", () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const txs = randomTransactions(randInt(2, 20));
        // Reverse order
        const reversed = [...txs].reverse();
        expect(calculateBalance(txs)).toBe(calculateBalance(reversed));
      }
    });
  });

  // -------------------------------------------------------------------------
  // Task 4.4: Property 2 — Redemption validation
  // -------------------------------------------------------------------------

  describe("Property 2: redemption validation", () => {
    it("always rejects redemption when pointsToRedeem > balance", () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const balance = randInt(0, 1000);
        const over = balance + randInt(1, 500);

        const result = validateRedemption(over, balance);

        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it("always accepts redemption when pointsToRedeem <= balance (and > 0)", () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const balance = randInt(1, 1000);
        const redeem = randInt(1, balance);

        const result = validateRedemption(redeem, balance);

        expect(result.valid).toBe(true);
      }
    });

    it("rejects redemption of 0 or negative points", () => {
      expect(validateRedemption(0, 1000).valid).toBe(false);
      expect(validateRedemption(-1, 1000).valid).toBe(false);
    });

    it("rejects exactly balance+1 points (off-by-one boundary)", () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const balance = randInt(1, 1000);
        const result = validateRedemption(balance + 1, balance);
        expect(result.valid).toBe(false);
      }
    });

    it("accepts exactly balance points (full redemption)", () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const balance = randInt(1, 1000);
        const result = validateRedemption(balance, balance);
        expect(result.valid).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Task 6.5: Property 3 — Tier consistency
  // -------------------------------------------------------------------------

  describe("Property 3: tier consistency", () => {
    it("tier matches the highest threshold <= lifetimeEarned", () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const lifetimePoints = randInt(0, 10000);

        const tier = determineTier(lifetimePoints, DEFAULT_TIERS);

        // Verify: tier.minLifetimePoints <= lifetimePoints
        expect(tier.minLifetimePoints).toBeLessThanOrEqual(lifetimePoints);

        // Verify: no higher tier exists that the customer has also qualified for
        const betterTier = DEFAULT_TIERS.find(
          (t) => t.minLifetimePoints > tier.minLifetimePoints && t.minLifetimePoints <= lifetimePoints
        );
        expect(betterTier).toBeUndefined();
      }
    });

    it("all customers qualify for at least Bronze (tier 0)", () => {
      expect(determineTier(0).name).toBe("Bronze");
      expect(determineTier(1).name).toBe("Bronze");
    });

    it("higher lifetime points never yield a lower tier", () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const lower = randInt(0, 4999);
        const higher = lower + randInt(1, 5000);

        const tierA = determineTier(lower);
        const tierB = determineTier(higher);

        // tierB multiplier >= tierA multiplier
        expect(tierB.multiplier).toBeGreaterThanOrEqual(tierA.multiplier);
      }
    });

    it("works correctly with custom tier configurations", () => {
      const customTiers: LoyaltyTier[] = [
        { name: "Starter", minLifetimePoints: 0, multiplier: 1.0 },
        { name: "Pro", minLifetimePoints: 1000, multiplier: 2.0 },
      ];

      expect(determineTier(0, customTiers).name).toBe("Starter");
      expect(determineTier(999, customTiers).name).toBe("Starter");
      expect(determineTier(1000, customTiers).name).toBe("Pro");
      expect(determineTier(9999, customTiers).name).toBe("Pro");
    });
  });

  // -------------------------------------------------------------------------
  // calculatePointsEarned — bonus coverage
  // -------------------------------------------------------------------------

  describe("calculatePointsEarned", () => {
    it("returns 0 for non-positive order amounts", () => {
      expect(calculatePointsEarned(0)).toBe(0);
      expect(calculatePointsEarned(-10)).toBe(0);
    });

    it("points earned is always a non-negative integer", () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const amount = Math.random() * 10000;
        const rate = Math.random() * 3;
        const multiplier = 1 + Math.random();

        const points = calculatePointsEarned(amount, rate, multiplier);

        expect(points).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(points)).toBe(true);
      }
    });

    it("higher multiplier tier always yields >= points than lower", () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const amount = randInt(10, 10000);
        const rate = 1;
        const lowMultiplier = 1 + Math.random();
        const highMultiplier = lowMultiplier + Math.random();

        expect(calculatePointsEarned(amount, rate, highMultiplier)).toBeGreaterThanOrEqual(
          calculatePointsEarned(amount, rate, lowMultiplier)
        );
      }
    });
  });

  // -------------------------------------------------------------------------
  // calculateRedemptionDiscount
  // -------------------------------------------------------------------------

  describe("calculateRedemptionDiscount", () => {
    it("discount is always non-negative", () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const points = randInt(0, 5000);
        const discount = calculateRedemptionDiscount(points);
        expect(discount).toBeGreaterThanOrEqual(0);
      }
    });

    it("discount is capped at order total", () => {
      const points = 10000; // Would give R100 at default rate
      const orderTotal = 50;
      const discount = calculateRedemptionDiscount(points, 0.01, orderTotal);
      expect(discount).toBeLessThanOrEqual(orderTotal);
    });
  });
});
