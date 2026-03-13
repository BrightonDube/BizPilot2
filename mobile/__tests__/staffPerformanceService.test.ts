/**
 * Unit tests for StaffPerformanceService pure functions.
 */

import {
  calculateTargetProgress,
  getTargetStatus,
  calculateFlatCommission,
  calculateTieredCommission,
  calculateCommission,
  applyCommissionCap,
  buildLeaderboard,
  getRankChange,
  calculateIncentiveProgress,
  projectCompletionDate,
  calculateAverageTicket,
  type StaffTarget,
  type CommissionRule,
  type CommissionTier,
  type CommissionResult,
  type IncentiveProgram,
  type PerformanceSnapshot,
} from "../services/staff/StaffPerformanceService";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeTarget(overrides: Partial<StaffTarget> = {}): StaffTarget {
  return {
    id: "t-1",
    userId: "u-1",
    userName: "Alice",
    targetType: "sales",
    periodType: "monthly",
    periodStart: "2025-01-01T00:00:00Z",
    periodEnd: "2025-01-31T23:59:59Z",
    targetValue: 10000,
    achievedValue: 0,
    status: "active",
    ...overrides,
  };
}

function makeTier(overrides: Partial<CommissionTier> = {}): CommissionTier {
  return {
    tierOrder: 1,
    minValue: 0,
    maxValue: 5000,
    rate: 5,
    ...overrides,
  };
}

function makeRule(overrides: Partial<CommissionRule> = {}): CommissionRule {
  return {
    id: "r-1",
    name: "Standard Flat",
    ruleType: "flat_rate",
    rate: 10,
    minThreshold: null,
    maxThreshold: null,
    capAmount: null,
    tiers: [],
    isActive: true,
    ...overrides,
  };
}

function makeIncentive(
  overrides: Partial<IncentiveProgram> = {},
): IncentiveProgram {
  return {
    id: "inc-1",
    name: "Monthly Bonus",
    description: "Hit R 50 000 in sales",
    incentiveType: "bonus",
    targetType: "sales",
    targetValue: 50000,
    rewardType: "cash",
    rewardValue: 2000,
    startDate: "2025-01-01T00:00:00Z",
    endDate: "2025-01-31T23:59:59Z",
    isTeam: false,
    isActive: true,
    ...overrides,
  };
}

function makeSnapshot(
  overrides: Partial<PerformanceSnapshot> = {},
): PerformanceSnapshot {
  return {
    date: "2025-01-15",
    totalSales: 5000,
    transactionCount: 40,
    itemCount: 120,
    customerCount: 35,
    avgTransaction: 125,
    hoursWorked: 8,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateTargetProgress
// ---------------------------------------------------------------------------

describe("calculateTargetProgress", () => {
  it("returns 0 for zero achieved", () => {
    const target = makeTarget({ achievedValue: 0, targetValue: 10000 });
    expect(calculateTargetProgress(target)).toBe(0);
  });

  it("returns 100 for fully achieved", () => {
    const target = makeTarget({ achievedValue: 10000, targetValue: 10000 });
    expect(calculateTargetProgress(target)).toBe(100);
  });

  it("returns >100 for overachieved", () => {
    const target = makeTarget({ achievedValue: 15000, targetValue: 10000 });
    expect(calculateTargetProgress(target)).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// getTargetStatus
// ---------------------------------------------------------------------------

describe("getTargetStatus", () => {
  it("returns 'completed' when achieved >= target and period ended", () => {
    const target = makeTarget({
      achievedValue: 10000,
      targetValue: 10000,
      periodEnd: "2025-01-31T23:59:59Z",
    });
    const now = new Date("2025-02-01T00:00:00Z");
    expect(getTargetStatus(target, now)).toBe("completed");
  });

  it("returns 'missed' when not achieved and period ended", () => {
    const target = makeTarget({
      achievedValue: 5000,
      targetValue: 10000,
      periodEnd: "2025-01-31T23:59:59Z",
    });
    const now = new Date("2025-02-01T00:00:00Z");
    expect(getTargetStatus(target, now)).toBe("missed");
  });

  it("returns 'active' when period not ended", () => {
    const target = makeTarget({
      achievedValue: 5000,
      targetValue: 10000,
      periodEnd: "2025-01-31T23:59:59Z",
    });
    const now = new Date("2025-01-15T00:00:00Z");
    expect(getTargetStatus(target, now)).toBe("active");
  });
});

// ---------------------------------------------------------------------------
// calculateFlatCommission
// ---------------------------------------------------------------------------

describe("calculateFlatCommission", () => {
  it("returns correct amount", () => {
    const rule = makeRule({ rate: 10 });
    const result = calculateFlatCommission(5000, rule);
    expect(result.commissionAmount).toBe(500);
  });

  it("respects min threshold", () => {
    const rule = makeRule({ rate: 10, minThreshold: 3000 });
    const result = calculateFlatCommission(2000, rule);
    expect(result.commissionAmount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateTieredCommission
// ---------------------------------------------------------------------------

describe("calculateTieredCommission", () => {
  it("calculates each tier correctly", () => {
    const rule = makeRule({
      ruleType: "tiered",
      tiers: [
        makeTier({ tierOrder: 1, minValue: 0, maxValue: 5000, rate: 5 }),
        makeTier({ tierOrder: 2, minValue: 5000, maxValue: 10000, rate: 10 }),
        makeTier({ tierOrder: 3, minValue: 10000, maxValue: null, rate: 15 }),
      ],
    });
    // 8000 total: first 5000 @5% = 250, next 3000 @10% = 300
    const result = calculateTieredCommission(8000, rule);
    expect(result.commissionAmount).toBe(550);
    expect(result.breakdown).toHaveLength(2);
  });

  it("handles single tier", () => {
    const rule = makeRule({
      ruleType: "tiered",
      tiers: [
        makeTier({ tierOrder: 1, minValue: 0, maxValue: null, rate: 8 }),
      ],
    });
    const result = calculateTieredCommission(10000, rule);
    expect(result.commissionAmount).toBe(800);
    expect(result.breakdown).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// calculateCommission (dispatcher)
// ---------------------------------------------------------------------------

describe("calculateCommission", () => {
  it("dispatches to flat for flat_rate rules", () => {
    const rule = makeRule({ ruleType: "flat_rate", rate: 10 });
    const result = calculateCommission(5000, rule);
    expect(result.commissionAmount).toBe(500);
    expect(result.ruleApplied).toBe(rule.name);
  });
});

// ---------------------------------------------------------------------------
// applyCommissionCap
// ---------------------------------------------------------------------------

describe("applyCommissionCap", () => {
  const baseResult: CommissionResult = {
    staffId: "",
    totalSales: 20000,
    commissionAmount: 2000,
    ruleApplied: "Standard",
    breakdown: [],
  };

  it("caps at max amount", () => {
    const capped = applyCommissionCap(baseResult, 1500);
    expect(capped.commissionAmount).toBe(1500);
  });

  it("leaves uncapped when below cap", () => {
    const uncapped = applyCommissionCap(baseResult, 3000);
    expect(uncapped.commissionAmount).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// buildLeaderboard
// ---------------------------------------------------------------------------

describe("buildLeaderboard", () => {
  it("assigns correct ranks sorted by value desc", () => {
    const entries = [
      { userId: "u1", userName: "A", avatarUrl: null, value: 100, target: null, previousRank: null },
      { userId: "u2", userName: "B", avatarUrl: null, value: 300, target: null, previousRank: null },
      { userId: "u3", userName: "C", avatarUrl: null, value: 200, target: null, previousRank: null },
    ];
    const board = buildLeaderboard(entries);
    expect(board[0].userId).toBe("u2");
    expect(board[0].rank).toBe(1);
    expect(board[1].userId).toBe("u3");
    expect(board[1].rank).toBe(2);
    expect(board[2].userId).toBe("u1");
    expect(board[2].rank).toBe(3);
  });

  it("handles ties", () => {
    const entries = [
      { userId: "u1", userName: "A", avatarUrl: null, value: 500, target: null, previousRank: null },
      { userId: "u2", userName: "B", avatarUrl: null, value: 500, target: null, previousRank: null },
    ];
    const board = buildLeaderboard(entries);
    // Both have value 500, ranks are sequential based on stable sort
    expect(board).toHaveLength(2);
    expect(board[0].value).toBe(board[1].value);
  });
});

// ---------------------------------------------------------------------------
// getRankChange
// ---------------------------------------------------------------------------

describe("getRankChange", () => {
  it("returns 'up' when rank improved (lower number)", () => {
    expect(getRankChange(2, 5)).toBe("up");
  });

  it("returns 'down' when rank worsened", () => {
    expect(getRankChange(5, 2)).toBe("down");
  });
});

// ---------------------------------------------------------------------------
// calculateIncentiveProgress
// ---------------------------------------------------------------------------

describe("calculateIncentiveProgress", () => {
  it("returns correct progress", () => {
    const incentive = makeIncentive({ targetValue: 50000 });
    const now = new Date("2025-01-15T12:00:00Z");
    const result = calculateIncentiveProgress(incentive, 25000, now);
    expect(result.progressPercent).toBe(50);
    expect(result.isAchieved).toBe(false);
    expect(result.isEligible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// projectCompletionDate
// ---------------------------------------------------------------------------

describe("projectCompletionDate", () => {
  it("returns null when no progress", () => {
    const result = projectCompletionDate(
      0,
      50000,
      "2025-01-01T00:00:00Z",
      new Date("2025-01-15T00:00:00Z"),
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculateAverageTicket
// ---------------------------------------------------------------------------

describe("calculateAverageTicket", () => {
  it("returns 0 for zero transactions", () => {
    expect(calculateAverageTicket(5000, 0)).toBe(0);
  });
});
