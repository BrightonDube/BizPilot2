/**
 * StaffPerformanceService
 *
 * Pure-function service for staff performance tracking, commission calculation,
 * target progress monitoring, and leaderboard ranking. Every function is
 * deterministic — time-dependent logic accepts an injectable `now` parameter
 * so callers (and tests) control the clock.
 */

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Round to 2 decimal places — used for all currency / percentage outputs. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TargetType =
  | 'sales'
  | 'items'
  | 'transactions'
  | 'customers'
  | 'average_ticket';

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type CommissionRuleType = 'flat_rate' | 'tiered' | 'product_category';

export type IncentiveType = 'bonus' | 'prize' | 'commission_boost';

export interface StaffTarget {
  id: string;
  userId: string;
  userName: string;
  targetType: TargetType;
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  targetValue: number;
  achievedValue: number;
  status: 'active' | 'completed' | 'missed' | 'cancelled';
}

export interface CommissionTier {
  tierOrder: number;
  minValue: number;
  maxValue: number | null;
  /** Percentage rate applied within this tier. */
  rate: number;
}

export interface CommissionRule {
  id: string;
  name: string;
  ruleType: CommissionRuleType;
  /** Flat rate percentage — used when ruleType is 'flat_rate'. */
  rate: number;
  minThreshold: number | null;
  maxThreshold: number | null;
  /** Hard cap on commission payout. */
  capAmount: number | null;
  tiers: CommissionTier[];
  isActive: boolean;
}

export interface CommissionResult {
  staffId: string;
  totalSales: number;
  commissionAmount: number;
  ruleApplied: string;
  breakdown: Array<{
    tierOrder: number;
    salesInTier: number;
    rate: number;
    commission: number;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  value: number;
  target: number | null;
  progressPercent: number;
  trend: 'up' | 'down' | 'stable';
  previousRank: number | null;
}

export interface IncentiveProgram {
  id: string;
  name: string;
  description: string;
  incentiveType: IncentiveType;
  targetType: TargetType;
  targetValue: number;
  rewardType: 'cash' | 'voucher' | 'time_off';
  rewardValue: number;
  startDate: string;
  endDate: string;
  isTeam: boolean;
  isActive: boolean;
}

export interface IncentiveProgress {
  incentive: IncentiveProgram;
  currentValue: number;
  progressPercent: number;
  isEligible: boolean;
  isAchieved: boolean;
  daysRemaining: number;
  projectedCompletion: string | null;
}

export interface PerformanceSnapshot {
  date: string;
  totalSales: number;
  transactionCount: number;
  itemCount: number;
  customerCount: number;
  avgTransaction: number;
  hoursWorked: number | null;
}

export interface StaffDashboardData {
  staffId: string;
  staffName: string;
  todaySales: number;
  periodSales: number;
  activeTargets: StaffTarget[];
  recentTransactionCount: number;
  rank: number | null;
  totalStaff: number;
  incentiveProgress: IncentiveProgress[];
}

// ─── Pure Functions ────────────────────────────────────────────────────────────

/**
 * Calculate how far a staff member is toward their target.
 *
 * @returns Percentage 0–100+. Values above 100 mean the target was exceeded.
 */
export function calculateTargetProgress(target: StaffTarget): number {
  if (target.targetValue <= 0) return 0;
  return round2((target.achievedValue / target.targetValue) * 100);
}

/**
 * Derive the real-time status of a target.
 *
 * Why an injectable `now`? So unit tests and server-rendered previews
 * can pin time without mocking globals.
 *
 * - "completed" if achievedValue ≥ targetValue (regardless of date).
 * - "missed" if the period has ended without hitting the target.
 * - "active" otherwise.
 */
export function getTargetStatus(
  target: StaffTarget,
  now: Date,
): 'active' | 'completed' | 'missed' {
  if (target.achievedValue >= target.targetValue) return 'completed';
  if (now > new Date(target.periodEnd)) return 'missed';
  return 'active';
}

/**
 * Apply a flat-rate commission to total sales.
 *
 * A flat rule ignores tiers — the single `rule.rate` percentage is applied
 * to the full sales amount (provided it exceeds `minThreshold`).
 */
export function calculateFlatCommission(
  totalSales: number,
  rule: CommissionRule,
): CommissionResult {
  // Sales below the minimum threshold earn zero commission.
  const eligibleSales =
    rule.minThreshold !== null && totalSales < rule.minThreshold
      ? 0
      : totalSales;

  const commission = round2(eligibleSales * (rule.rate / 100));

  return {
    staffId: '',
    totalSales,
    commissionAmount: commission,
    ruleApplied: rule.name,
    breakdown: [
      {
        tierOrder: 1,
        salesInTier: eligibleSales,
        rate: rule.rate,
        commission,
      },
    ],
  };
}

/**
 * Calculate commission across progressive tiers.
 *
 * Each tier applies its rate only to the portion of sales that falls within
 * [minValue, maxValue]. Tiers are processed in `tierOrder` so higher sales
 * "fill" cheaper tiers first — just like progressive income tax brackets.
 */
export function calculateTieredCommission(
  totalSales: number,
  rule: CommissionRule,
): CommissionResult {
  const sortedTiers = [...rule.tiers].sort(
    (a, b) => a.tierOrder - b.tierOrder,
  );

  let remaining = totalSales;
  const breakdown: CommissionResult['breakdown'] = [];
  let totalCommission = 0;

  for (const tier of sortedTiers) {
    if (remaining <= 0) break;

    const tierCeiling =
      tier.maxValue !== null ? tier.maxValue - tier.minValue : remaining;
    // Sales that actually fall inside this tier.
    const salesInTier = Math.min(remaining, tierCeiling);
    const commission = round2(salesInTier * (tier.rate / 100));

    breakdown.push({
      tierOrder: tier.tierOrder,
      salesInTier: round2(salesInTier),
      rate: tier.rate,
      commission,
    });

    totalCommission += commission;
    remaining -= salesInTier;
  }

  return {
    staffId: '',
    totalSales,
    commissionAmount: round2(totalCommission),
    ruleApplied: rule.name,
    breakdown,
  };
}

/**
 * Dispatcher — picks the right calculation strategy based on `rule.ruleType`.
 *
 * `product_category` rules fall back to flat-rate logic because category
 * filtering is the caller's responsibility; by the time sales reach this
 * function they are already category-scoped.
 */
export function calculateCommission(
  totalSales: number,
  rule: CommissionRule,
): CommissionResult {
  if (rule.ruleType === 'tiered') {
    return calculateTieredCommission(totalSales, rule);
  }
  // 'flat_rate' and 'product_category' both use flat logic.
  return calculateFlatCommission(totalSales, rule);
}

/**
 * Enforce a hard cap on the commission payout.
 *
 * Why a separate function? Caps are a business-policy concern, not a
 * calculation concern — keeping them apart makes both easier to test.
 */
export function applyCommissionCap(
  result: CommissionResult,
  capAmount: number | null,
): CommissionResult {
  if (capAmount === null || result.commissionAmount <= capAmount) {
    return result;
  }
  return {
    ...result,
    commissionAmount: round2(capAmount),
  };
}

/**
 * Determine whether a staff member moved up, down, or stayed the same.
 *
 * Lower rank number = better position, so currentRank < previousRank is "up".
 */
export function getRankChange(
  currentRank: number,
  previousRank: number | null,
): 'up' | 'down' | 'stable' {
  if (previousRank === null) return 'stable';
  if (currentRank < previousRank) return 'up';
  if (currentRank > previousRank) return 'down';
  return 'stable';
}

/**
 * Build a sorted leaderboard from raw staff data.
 *
 * Entries are ranked by `value` descending. Progress is calculated against
 * each entry's personal target (if set), and trend is derived from the
 * previous rank snapshot.
 */
export function buildLeaderboard(
  entries: Array<{
    userId: string;
    userName: string;
    avatarUrl: string | null;
    value: number;
    target: number | null;
    previousRank: number | null;
  }>,
): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => b.value - a.value);

  return sorted.map((entry, index) => {
    const rank = index + 1;
    const progressPercent =
      entry.target !== null && entry.target > 0
        ? round2((entry.value / entry.target) * 100)
        : 0;

    return {
      rank,
      userId: entry.userId,
      userName: entry.userName,
      avatarUrl: entry.avatarUrl,
      value: entry.value,
      target: entry.target,
      progressPercent,
      trend: getRankChange(rank, entry.previousRank),
      previousRank: entry.previousRank,
    };
  });
}

/**
 * Project when a staff member will hit their target using linear extrapolation.
 *
 * Uses elapsed time and current progress to estimate a completion date.
 * Returns `null` if no measurable progress has been made (avoids divide-by-zero
 * and infinite projections).
 */
export function projectCompletionDate(
  currentValue: number,
  targetValue: number,
  startDate: string,
  now: Date,
): string | null {
  if (currentValue <= 0 || currentValue >= targetValue) return null;

  const start = new Date(startDate);
  const elapsedMs = now.getTime() - start.getTime();
  if (elapsedMs <= 0) return null;

  // Rate of progress per millisecond, then extrapolate to full target.
  const ratePerMs = currentValue / elapsedMs;
  const remainingValue = targetValue - currentValue;
  const remainingMs = remainingValue / ratePerMs;

  const projected = new Date(now.getTime() + remainingMs);
  return projected.toISOString();
}

/**
 * Calculate full incentive progress including eligibility and projection.
 *
 * Eligibility requires the incentive to be active and the current date to
 * fall within the program window.
 */
export function calculateIncentiveProgress(
  incentive: IncentiveProgram,
  currentValue: number,
  now: Date,
): IncentiveProgress {
  const endDate = new Date(incentive.endDate);
  const startDate = new Date(incentive.startDate);

  const daysRemaining = Math.max(
    0,
    Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const progressPercent =
    incentive.targetValue > 0
      ? round2((currentValue / incentive.targetValue) * 100)
      : 0;

  const isAchieved = currentValue >= incentive.targetValue;

  // Eligible only when the program is active and we are within its window.
  const isEligible = incentive.isActive && now >= startDate && now <= endDate;

  const projectedCompletion = isAchieved
    ? null
    : projectCompletionDate(
        currentValue,
        incentive.targetValue,
        incentive.startDate,
        now,
      );

  return {
    incentive,
    currentValue,
    progressPercent,
    isEligible,
    isAchieved,
    daysRemaining,
    projectedCompletion,
  };
}

/**
 * Safe average-ticket calculation.
 *
 * Returns 0 when there are no transactions instead of producing NaN / Infinity.
 */
export function calculateAverageTicket(
  totalSales: number,
  transactionCount: number,
): number {
  if (transactionCount <= 0) return 0;
  return round2(totalSales / transactionCount);
}

/**
 * Sales-per-hour productivity metric.
 *
 * Returns 0 for zero hours to avoid divide-by-zero.
 */
export function calculateSalesPerHour(
  totalSales: number,
  hoursWorked: number,
): number {
  if (hoursWorked <= 0) return 0;
  return round2(totalSales / hoursWorked);
}

/**
 * Roll up an array of daily snapshots into a single aggregate object.
 *
 * Useful for period summaries (weekly / monthly views).
 */
export function aggregateSnapshots(snapshots: PerformanceSnapshot[]): {
  totalSales: number;
  totalTransactions: number;
  totalCustomers: number;
  avgTicket: number;
} {
  const totalSales = round2(
    snapshots.reduce((sum, s) => sum + s.totalSales, 0),
  );
  const totalTransactions = snapshots.reduce(
    (sum, s) => sum + s.transactionCount,
    0,
  );
  const totalCustomers = snapshots.reduce(
    (sum, s) => sum + s.customerCount,
    0,
  );
  const avgTicket = calculateAverageTicket(totalSales, totalTransactions);

  return { totalSales, totalTransactions, totalCustomers, avgTicket };
}

/**
 * Keep only targets that match the requested period type.
 */
export function filterTargetsByPeriod(
  targets: StaffTarget[],
  periodType: PeriodType,
): StaffTarget[] {
  return targets.filter((t) => t.periodType === periodType);
}

/**
 * Sort targets by completion percentage (highest first).
 *
 * Gives managers a quick view of who is closest to — or furthest from —
 * hitting their goals.
 */
export function sortByPerformance(targets: StaffTarget[]): StaffTarget[] {
  return [...targets].sort(
    (a, b) => calculateTargetProgress(b) - calculateTargetProgress(a),
  );
}
