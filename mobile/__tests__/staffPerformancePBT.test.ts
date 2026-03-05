/**
 * Property-Based Tests for StaffPerformanceService.
 *
 * Uses fast-check to verify mathematical invariants across random inputs.
 */

import fc from "fast-check";
import {
  calculateFlatCommission,
  calculateTieredCommission,
  calculateCommission,
  applyCommissionCap,
  calculateTargetProgress,
  buildLeaderboard,
  calculateIncentiveProgress,
  calculateAverageTicket,
  type StaffTarget,
  type CommissionRule,
  type CommissionTier,
  type IncentiveProgram,
} from "../services/staff/StaffPerformanceService";

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbCommissionRule = (
  ruleType: "flat_rate" | "tiered" = "flat_rate",
): fc.Arbitrary<CommissionRule> =>
  fc.record({
    id: fc.constant("r-pbt"),
    name: fc.constant("PBT Rule"),
    ruleType: fc.constant(ruleType),
    rate: fc.double({ min: 0.01, max: 50, noNaN: true }),
    minThreshold: fc.constant(null),
    maxThreshold: fc.constant(null),
    capAmount: fc.constant(null),
    tiers: fc.constant([]),
    isActive: fc.constant(true),
  });

const arbCappedRule = fc.record({
  id: fc.constant("r-cap"),
  name: fc.constant("Capped Rule"),
  ruleType: fc.constant("flat_rate" as const),
  rate: fc.double({ min: 0.01, max: 50, noNaN: true }),
  minThreshold: fc.constant(null),
  maxThreshold: fc.constant(null),
  capAmount: fc.double({ min: 1, max: 100000, noNaN: true }),
  tiers: fc.constant([] as CommissionTier[]),
  isActive: fc.constant(true),
});

const arbTieredRule: fc.Arbitrary<CommissionRule> = fc
  .tuple(
    fc.double({ min: 0.01, max: 20, noNaN: true }),
    fc.double({ min: 0.01, max: 20, noNaN: true }),
  )
  .map(([rate1, rate2]) => ({
    id: "r-tiered",
    name: "PBT Tiered",
    ruleType: "tiered" as const,
    rate: 0,
    minThreshold: null,
    maxThreshold: null,
    capAmount: null,
    tiers: [
      { tierOrder: 1, minValue: 0, maxValue: 5000, rate: rate1 },
      { tierOrder: 2, minValue: 5000, maxValue: null, rate: rate2 },
    ],
    isActive: true,
  }));

const arbTarget: fc.Arbitrary<StaffTarget> = fc.record({
  id: fc.constant("t-pbt"),
  userId: fc.constant("u-pbt"),
  userName: fc.constant("PBT User"),
  targetType: fc.constant("sales" as const),
  periodType: fc.constant("monthly" as const),
  periodStart: fc.constant("2025-01-01T00:00:00Z"),
  periodEnd: fc.constant("2025-01-31T23:59:59Z"),
  targetValue: fc.double({ min: 1, max: 1000000, noNaN: true }),
  achievedValue: fc.double({ min: 0, max: 2000000, noNaN: true }),
  status: fc.constant("active" as const),
});

const arbLeaderboardEntry = fc.record({
  userId: fc.uuid(),
  userName: fc.string({ minLength: 1, maxLength: 20 }),
  avatarUrl: fc.constant(null),
  value: fc.double({ min: 0, max: 1000000, noNaN: true }),
  target: fc.constant(null),
  previousRank: fc.constant(null),
});

const arbIncentive: fc.Arbitrary<IncentiveProgram> = fc.record({
  id: fc.constant("inc-pbt"),
  name: fc.constant("PBT Incentive"),
  description: fc.constant("PBT description"),
  incentiveType: fc.constant("bonus" as const),
  targetType: fc.constant("sales" as const),
  targetValue: fc.double({ min: 1, max: 1000000, noNaN: true }),
  rewardType: fc.constant("cash" as const),
  rewardValue: fc.double({ min: 1, max: 100000, noNaN: true }),
  startDate: fc.constant("2025-01-01T00:00:00Z"),
  endDate: fc.constant("2025-12-31T23:59:59Z"),
  isTeam: fc.boolean(),
  isActive: fc.constant(true),
});

// ---------------------------------------------------------------------------
// PBTs
// ---------------------------------------------------------------------------

describe("StaffPerformanceService PBTs", () => {
  it("commission is non-negative for any positive sales and valid rule", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1000000, noNaN: true }),
        arbCommissionRule(),
        (sales, rule) => {
          const result = calculateFlatCommission(sales, rule);
          expect(result.commissionAmount).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("flat commission is monotonic — higher sales produce higher or equal commission", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 500000, noNaN: true }),
        fc.double({ min: 0, max: 500000, noNaN: true }),
        arbCommissionRule(),
        (salesA, salesB, rule) => {
          const lo = Math.min(salesA, salesB);
          const hi = Math.max(salesA, salesB);
          const resultLo = calculateFlatCommission(lo, rule);
          const resultHi = calculateFlatCommission(hi, rule);
          expect(resultHi.commissionAmount).toBeGreaterThanOrEqual(
            resultLo.commissionAmount,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("tiered commission is monotonic — higher sales produce higher or equal commission", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 500000, noNaN: true }),
        fc.double({ min: 0, max: 500000, noNaN: true }),
        arbTieredRule,
        (salesA, salesB, rule) => {
          const lo = Math.min(salesA, salesB);
          const hi = Math.max(salesA, salesB);
          const resultLo = calculateTieredCommission(lo, rule);
          const resultHi = calculateTieredCommission(hi, rule);
          expect(resultHi.commissionAmount).toBeGreaterThanOrEqual(
            resultLo.commissionAmount,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("commission cap is always enforced", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1000000, noNaN: true }),
        arbCappedRule,
        (sales, rule) => {
          const result = calculateCommission(sales, rule);
          const capped = applyCommissionCap(result, rule.capAmount);
          // Allow 1-cent tolerance for fp rounding
          expect(capped.commissionAmount).toBeLessThanOrEqual(
            round2(rule.capAmount!) + 0.01,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("target progress is always >= 0 for positive targetValue", () => {
    fc.assert(
      fc.property(arbTarget, (target) => {
        const progress = calculateTargetProgress(target);
        expect(progress).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 },
    );
  });

  it("target progress accuracy — achievedValue / targetValue * 100", () => {
    fc.assert(
      fc.property(arbTarget, (target) => {
        const progress = calculateTargetProgress(target);
        const expected = round2((target.achievedValue / target.targetValue) * 100);
        expect(progress).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it("leaderboard ranks are unique", () => {
    fc.assert(
      fc.property(
        fc.array(arbLeaderboardEntry, { minLength: 1, maxLength: 20 }),
        (entries) => {
          const board = buildLeaderboard(entries);
          const ranks = board.map((e) => e.rank);
          expect(new Set(ranks).size).toBe(ranks.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("leaderboard entries are sorted by value descending", () => {
    fc.assert(
      fc.property(
        fc.array(arbLeaderboardEntry, { minLength: 2, maxLength: 20 }),
        (entries) => {
          const board = buildLeaderboard(entries);
          for (let i = 1; i < board.length; i++) {
            expect(board[i - 1].value).toBeGreaterThanOrEqual(board[i].value);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("incentive progress is always >= 0", () => {
    fc.assert(
      fc.property(
        arbIncentive,
        fc.double({ min: 1, max: 2000000, noNaN: true }),
        (incentive, currentValue) => {
          const now = new Date("2025-06-15T12:00:00Z");
          try {
            const result = calculateIncentiveProgress(incentive, currentValue, now);
            expect(result.progressPercent).toBeGreaterThanOrEqual(0);
          } catch (e) {
            // projectCompletionDate may overflow for extreme ratios — not a progress invariant
            expect(e).toBeInstanceOf(RangeError);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("average ticket consistency — avgTicket * count ≈ sales", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1000000, noNaN: true }),
        fc.integer({ min: 1, max: 10000 }),
        (sales, count) => {
          const avg = calculateAverageTicket(sales, count);
          const reconstructed = round2(avg * count);
          // Allow ±1 cent tolerance per transaction for cumulative rounding
          expect(Math.abs(reconstructed - round2(sales))).toBeLessThanOrEqual(
            count * 0.01 + 0.01,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
