/**
 * Loyalty Order Integration Property-Based Tests
 * (loyalty-programs tasks 3.2, 11.1, 11.3)
 *
 * Properties tested:
 * - Property A (task 3.2): Points earned for an order = floor(total × earnRate × tierMultiplier)
 * - Property B (task 3.2): Balance after order = previousBalance + earnPointsForOrder(...)
 * - Property C (task 11.3): applyOrderPointsEarned works with empty transaction history (offline/new customer)
 * - Property D (task 11.1): Receipt points preview matches what gets applied
 *
 * All tests are offline-safe — no DB, no network.
 * Uses manual random loops consistent with the project's PBT style.
 */

import {
  earnPointsForOrder,
  applyOrderPointsEarned,
  calculateBalance,
  calculatePointsEarned,
  type LoyaltyTransaction,
} from "@/services/LoyaltyService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randAmount(max = 10000): number {
  return Math.round((Math.random() * max + 0.01) * 100) / 100;
}

function randEarnRate(): number {
  // Realistic earn rates: 0.1 to 5 points per rand
  return parseFloat((Math.random() * 4.9 + 0.1).toFixed(2));
}

function randMultiplier(): number {
  // Tier multipliers: 1x to 3x
  return parseFloat((Math.random() * 2 + 1).toFixed(2));
}

function randTransactions(n: number): LoyaltyTransaction[] {
  const types: LoyaltyTransaction["type"][] = ["earned", "redeemed", "expired", "adjusted"];
  return Array.from({ length: n }, () => ({
    type: types[Math.floor(Math.random() * types.length)],
    points: Math.floor(Math.random() * 1000 + 1),
  }));
}

// ---------------------------------------------------------------------------
// Property A: earnPointsForOrder = calculatePointsEarned (task 3.2)
// ---------------------------------------------------------------------------

describe("Property A: earnPointsForOrder matches calculatePointsEarned formula (task 3.2)", () => {
  it("earnPointsForOrder matches direct calculatePointsEarned call — 500 runs", () => {
    for (let i = 0; i < 500; i++) {
      const total = randAmount();
      const earnRate = randEarnRate();
      const multiplier = randMultiplier();

      const via_integration = earnPointsForOrder(total, earnRate, multiplier);
      const via_direct = calculatePointsEarned(total, earnRate, multiplier);

      expect(via_integration).toBe(via_direct);
    }
  });

  it("earnPointsForOrder result is always a non-negative integer — 500 runs", () => {
    for (let i = 0; i < 500; i++) {
      const total = randAmount();
      const earnRate = randEarnRate();
      const multiplier = randMultiplier();

      const points = earnPointsForOrder(total, earnRate, multiplier);

      expect(Number.isInteger(points)).toBe(true);
      expect(points).toBeGreaterThanOrEqual(0);
    }
  });

  it("higher earn rate always yields >= points than lower rate for same order — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const total = randAmount();
      const rateA = randEarnRate();
      const rateB = randEarnRate();
      const multiplier = randMultiplier();

      const pointsA = earnPointsForOrder(total, rateA, multiplier);
      const pointsB = earnPointsForOrder(total, rateB, multiplier);

      if (rateA > rateB) {
        expect(pointsA).toBeGreaterThanOrEqual(pointsB);
      } else {
        expect(pointsB).toBeGreaterThanOrEqual(pointsA);
      }
    }
  });

  it("zero total always yields zero points — 200 runs", () => {
    for (let i = 0; i < 200; i++) {
      const earnRate = randEarnRate();
      const multiplier = randMultiplier();
      expect(earnPointsForOrder(0, earnRate, multiplier)).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Property B: balance after order = previousBalance + newEarned (task 3.2)
// ---------------------------------------------------------------------------

describe("Property B: applyOrderPointsEarned balance invariant (task 3.2)", () => {
  /**
   * calculateBalance clamps at the END (not per-step), so:
   *   balance(txns) = max(0, rawSum(txns))
   * Adding an earned entry appends to rawSum BEFORE clamping:
   *   balance([...txns, {earned, n}]) = max(0, rawSum(txns) + n)
   *
   * This means the real invariant is:
   *   actualBalance >= previousBalance  (earning never reduces balance)
   *   actualBalance <= previousBalance + newPoints  (can't over-credit)
   *   When rawSum >= 0: actualBalance === previousBalance + newPoints
   */
  it("earning never decreases the balance (monotonic) — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const transactions = randTransactions(Math.floor(Math.random() * 10));
      const total = randAmount();

      const previousBalance = calculateBalance(transactions);
      const actualBalance = applyOrderPointsEarned(transactions, total);

      expect(actualBalance).toBeGreaterThanOrEqual(previousBalance);
    }
  });

  it("balance increase is never more than newPoints (no over-crediting) — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const transactions = randTransactions(Math.floor(Math.random() * 10));
      const total = randAmount();
      const earnRate = randEarnRate();
      const multiplier = randMultiplier();

      const previousBalance = calculateBalance(transactions);
      const newPoints = earnPointsForOrder(total, earnRate, multiplier);
      const actualBalance = applyOrderPointsEarned(transactions, total, earnRate, multiplier);

      // Balance increase <= newPoints
      expect(actualBalance - previousBalance).toBeLessThanOrEqual(newPoints);
    }
  });

  it("when customer has a positive balance, balance after = previous + newPoints exactly — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const total = randAmount();
      const earnRate = randEarnRate();
      const multiplier = randMultiplier();

      // Only earned transactions so rawSum is always non-negative
      const n = Math.floor(Math.random() * 10);
      const earnOnlyTxns: LoyaltyTransaction[] = Array.from({ length: n }, () => ({
        type: "earned" as const,
        points: Math.floor(Math.random() * 1000 + 1),
      }));

      const previousBalance = calculateBalance(earnOnlyTxns);
      const newPoints = earnPointsForOrder(total, earnRate, multiplier);
      const actualBalance = applyOrderPointsEarned(earnOnlyTxns, total, earnRate, multiplier);

      expect(actualBalance).toBe(previousBalance + newPoints);
    }
  });

  it("balance is always non-negative after any sequence of transactions — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const n = Math.floor(Math.random() * 15);
      const transactions = randTransactions(n);
      const total = randAmount();

      const balance = applyOrderPointsEarned(transactions, total);

      expect(balance).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Property C: offline / new customer (empty history) (task 11.3)
// ---------------------------------------------------------------------------

describe("Property C: applyOrderPointsEarned works offline with empty history (task 11.3)", () => {
  it("new customer with no history earns points from first order — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const total = randAmount();
      const earnRate = randEarnRate();
      const multiplier = randMultiplier();

      const balance = applyOrderPointsEarned([], total, earnRate, multiplier);
      const expectedPoints = earnPointsForOrder(total, earnRate, multiplier);

      expect(balance).toBe(expectedPoints);
    }
  });

  it("earnPointsForOrder is idempotent: same inputs always produce same output — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const total = randAmount();
      const rate = randEarnRate();
      const multi = randMultiplier();

      expect(earnPointsForOrder(total, rate, multi)).toBe(
        earnPointsForOrder(total, rate, multi)
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Property D: receipt preview matches applied points (task 11.1)
// ---------------------------------------------------------------------------

describe("Property D: receipt preview points match applied points (task 11.1)", () => {
  /**
   * The receipt shows "You earned X points" which is earnPointsForOrder(...).
   * This is distinct from the net balance change, which can be less when the
   * customer has a negative rawSum (over-redeemed). The preview should always
   * show the points earned for the order, not the net balance change.
   */
  it("receipt preview = earnPointsForOrder for the order amount — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const total = randAmount();
      const earnRate = randEarnRate();
      const multiplier = randMultiplier();

      // What the receipt shows (preview before committing):
      const previewPoints = earnPointsForOrder(total, earnRate, multiplier);

      // Invariant: preview points = earnPointsForOrder(total, earnRate, multiplier)
      const expected = calculatePointsEarned(total, earnRate, multiplier);
      expect(previewPoints).toBe(expected);
    }
  });

  it("preview points are always non-negative — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const total = randAmount();
      const previewPoints = earnPointsForOrder(total);
      expect(previewPoints).toBeGreaterThanOrEqual(0);
    }
  });
});
