/**
 * ShiftReportService — pure aggregation layer for shift reports, EOD, and multi-user tracking.
 * (shift-management tasks 8.2-8.3, 9.1-9.4, 10.1-10.4, 11.1-11.2)
 *
 * This file covers:
 *   - Float management helpers (carry-over, alerts) — Tasks 8.2, 8.3
 *   - End-of-day aggregation (summary, variance, report) — Tasks 9.1-9.4
 *   - Shift reports (summary, per-operator, variances) — Tasks 10.1-10.3
 *   - Multi-user tracking (user switching, per-user sales) — Tasks 11.1-11.2
 *
 * Why pure functions instead of a class?
 * Shift reports and EOD summaries are displayed in a dashboard where the
 * manager selects a date or operator to filter. Pure functions compose
 * cleanly with React's useMemo, making the UI re-render only when the
 * filter inputs change. No class instantiation overhead, no side effects.
 *
 * All monetary calculations use Math.round(x * 100) / 100 to avoid
 * floating-point drift (the same pattern used in ShiftService and
 * CashDrawerService for consistency).
 */

import type {
  ShiftRecord,
  ShiftCashEvent,
  ShiftCashSummary,
  ShiftCashEventType,
} from "./ShiftService";
import { calculateExpectedCash, calculateVariance } from "./ShiftService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A closed shift with its events and counted cash. */
export interface ClosedShiftRecord extends ShiftRecord {
  status: "closed";
  closedAt: string;
  closingCash: number;
  cashEvents: ShiftCashEvent[];
  varianceReason?: string;
}

/** Summary for a single shift — used by Task 10.1 */
export interface ShiftSummaryReport {
  shiftId: string;
  userId: string;
  terminalId: string;
  openedAt: string;
  closedAt: string;
  durationMinutes: number;
  openingFloat: number;
  closingCash: number;
  cashSummary: ShiftCashSummary;
  variance: number;
  varianceReason?: string;
}

/** Per-operator aggregation — used by Task 10.2 */
export interface OperatorReport {
  userId: string;
  shiftCount: number;
  totalSales: number;
  totalRefunds: number;
  totalVariance: number;
  averageVariance: number;
  totalHoursWorked: number;
}

/** Variance line item — used by Task 10.3 */
export interface VarianceReport {
  shiftId: string;
  userId: string;
  closedAt: string;
  expectedCash: number;
  countedCash: number;
  variance: number;
  varianceReason?: string;
  /** True if |variance| exceeds the threshold */
  flagged: boolean;
}

/** End-of-day aggregate — used by Tasks 9.1-9.4 */
export interface EndOfDaySummary {
  date: string; // YYYY-MM-DD
  terminalId: string;
  shiftCount: number;
  totalExpectedCash: number;
  totalCountedCash: number;
  totalVariance: number;
  shifts: ShiftSummaryReport[];
  /**
   * Float carry-over: the closing cash of the last shift.
   * Used as the default opening float for the next day (Task 8.2).
   */
  closingBalance: number;
}

/** Float alert — Task 8.3 */
export interface FloatAlert {
  type: "below_minimum" | "above_maximum" | "carry_over_mismatch";
  message: string;
  currentFloat: number;
  threshold: number;
}

/** Per-user sales tracking within a shift — Task 11.2 */
export interface UserShiftActivity {
  userId: string;
  /** ISO timestamp when this user started their portion */
  switchedInAt: string;
  /** ISO timestamp when they switched out (null if still active) */
  switchedOutAt: string | null;
  salesCount: number;
  salesTotal: number;
  refundsCount: number;
  refundsTotal: number;
}

/** User switch event — Task 11.1 */
export interface UserSwitchEvent {
  fromUserId: string;
  toUserId: string;
  timestamp: string;
  /** PIN-verified flag */
  verified: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;

function durationMinutes(start: string, end: string): number {
  return Math.floor(
    (new Date(end).getTime() - new Date(start).getTime()) / 60_000
  );
}

function isoDate(isoTimestamp: string): string {
  return isoTimestamp.substring(0, 10);
}

// ---------------------------------------------------------------------------
// Task 10.1: Shift summary report
// ---------------------------------------------------------------------------

/**
 * Build a summary report for a single closed shift.
 * This is the foundation for EOD aggregation and per-operator reports.
 */
export function buildShiftSummary(shift: ClosedShiftRecord): ShiftSummaryReport {
  const cashSummary = calculateExpectedCash(shift.openingFloat, shift.cashEvents);
  const variance = calculateVariance(cashSummary.expectedCash, shift.closingCash);

  return {
    shiftId: shift.id,
    userId: shift.userId,
    terminalId: shift.terminalId,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    durationMinutes: durationMinutes(shift.openedAt, shift.closedAt),
    openingFloat: shift.openingFloat,
    closingCash: shift.closingCash,
    cashSummary,
    variance,
    varianceReason: shift.varianceReason,
  };
}

// ---------------------------------------------------------------------------
// Task 10.2: Report by operator
// ---------------------------------------------------------------------------

/**
 * Aggregate shift data by operator (userId).
 * Returns one OperatorReport per unique user found in the shift list.
 */
export function buildOperatorReports(
  shifts: ClosedShiftRecord[]
): OperatorReport[] {
  const byUser = new Map<string, OperatorReport>();

  for (const shift of shifts) {
    const summary = buildShiftSummary(shift);
    const existing = byUser.get(shift.userId);

    if (!existing) {
      byUser.set(shift.userId, {
        userId: shift.userId,
        shiftCount: 1,
        totalSales: summary.cashSummary.cashSales,
        totalRefunds: summary.cashSummary.cashRefunds,
        totalVariance: summary.variance,
        averageVariance: summary.variance,
        totalHoursWorked: round2(summary.durationMinutes / 60),
      });
    } else {
      existing.shiftCount += 1;
      existing.totalSales = round2(existing.totalSales + summary.cashSummary.cashSales);
      existing.totalRefunds = round2(existing.totalRefunds + summary.cashSummary.cashRefunds);
      existing.totalVariance = round2(existing.totalVariance + summary.variance);
      existing.averageVariance = round2(existing.totalVariance / existing.shiftCount);
      existing.totalHoursWorked = round2(
        existing.totalHoursWorked + summary.durationMinutes / 60
      );
    }
  }

  return Array.from(byUser.values());
}

// ---------------------------------------------------------------------------
// Task 10.3: Report variances
// ---------------------------------------------------------------------------

/**
 * Build a variance report — one line per shift, with flagged high-variance shifts.
 *
 * @param threshold - Absolute variance threshold (in ZAR) to flag shifts.
 */
export function buildVarianceReport(
  shifts: ClosedShiftRecord[],
  threshold: number = 50
): VarianceReport[] {
  return shifts.map((shift) => {
    const summary = buildShiftSummary(shift);
    return {
      shiftId: shift.id,
      userId: shift.userId,
      closedAt: shift.closedAt,
      expectedCash: summary.cashSummary.expectedCash,
      countedCash: shift.closingCash,
      variance: summary.variance,
      varianceReason: shift.varianceReason,
      flagged: Math.abs(summary.variance) > threshold,
    };
  });
}

// ---------------------------------------------------------------------------
// Tasks 9.1-9.3: End-of-day summary
// ---------------------------------------------------------------------------

/**
 * Aggregate all shifts for a given day and terminal into an EOD summary.
 *
 * Task 9.1: Create EOD summary view (data layer)
 * Task 9.2: Aggregate all shifts for day
 * Task 9.3: Calculate total variance
 */
export function buildEndOfDaySummary(
  shifts: ClosedShiftRecord[],
  date: string,
  terminalId: string
): EndOfDaySummary {
  // Filter to the requested date + terminal
  const dayShifts = shifts.filter(
    (s) =>
      s.terminalId === terminalId &&
      isoDate(s.closedAt) === date
  );

  // Sort by close time to determine carry-over from last shift
  const sorted = [...dayShifts].sort(
    (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
  );

  const summaries = sorted.map(buildShiftSummary);

  const totalExpectedCash = round2(
    summaries.reduce((sum, s) => sum + s.cashSummary.expectedCash, 0)
  );
  const totalCountedCash = round2(
    summaries.reduce((sum, s) => sum + s.closingCash, 0)
  );
  const totalVariance = round2(totalCountedCash - totalExpectedCash);

  // Carry-over: the last shift's counted cash becomes the next day's default float
  const closingBalance = sorted.length > 0
    ? sorted[sorted.length - 1].closingCash
    : 0;

  return {
    date,
    terminalId,
    shiftCount: sorted.length,
    totalExpectedCash,
    totalCountedCash,
    totalVariance,
    shifts: summaries,
    closingBalance,
  };
}

// ---------------------------------------------------------------------------
// Task 8.2: Float carry-over
// ---------------------------------------------------------------------------

/**
 * Determine the recommended opening float for the next shift.
 *
 * If carry-over is enabled, the float comes from the previous shift's
 * counted cash. Otherwise, the configured default is used.
 *
 * @param lastClosingCash - Counted cash from the previous shift (or null if none)
 * @param defaultFloat    - Business-configured standard float amount
 * @param carryOverEnabled - Whether float carry-over is enabled
 */
export function getRecommendedFloat(
  lastClosingCash: number | null,
  defaultFloat: number,
  carryOverEnabled: boolean
): number {
  if (carryOverEnabled && lastClosingCash !== null && lastClosingCash > 0) {
    return round2(lastClosingCash);
  }
  return defaultFloat;
}

// ---------------------------------------------------------------------------
// Task 8.3: Float alerts
// ---------------------------------------------------------------------------

/**
 * Check the opening float against business rules and return any alerts.
 *
 * @param openingFloat   - The actual float entered for the shift
 * @param minimumFloat   - Minimum required float (business setting)
 * @param maximumFloat   - Maximum allowed float (business setting)
 * @param lastClosingCash - Previous shift's closing cash (for carry-over check)
 * @param carryOverEnabled - Whether float carry-over is enabled
 */
export function checkFloatAlerts(
  openingFloat: number,
  minimumFloat: number,
  maximumFloat: number,
  lastClosingCash: number | null = null,
  carryOverEnabled: boolean = false
): FloatAlert[] {
  const alerts: FloatAlert[] = [];

  if (openingFloat < minimumFloat) {
    alerts.push({
      type: "below_minimum",
      message: `Float R${openingFloat.toFixed(2)} is below the minimum of R${minimumFloat.toFixed(2)}`,
      currentFloat: openingFloat,
      threshold: minimumFloat,
    });
  }

  if (openingFloat > maximumFloat) {
    alerts.push({
      type: "above_maximum",
      message: `Float R${openingFloat.toFixed(2)} exceeds the maximum of R${maximumFloat.toFixed(2)}`,
      currentFloat: openingFloat,
      threshold: maximumFloat,
    });
  }

  if (
    carryOverEnabled &&
    lastClosingCash !== null &&
    Math.abs(openingFloat - lastClosingCash) > 0.01
  ) {
    alerts.push({
      type: "carry_over_mismatch",
      message: `Float R${openingFloat.toFixed(2)} does not match previous close of R${lastClosingCash.toFixed(2)}`,
      currentFloat: openingFloat,
      threshold: lastClosingCash,
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Task 11.1: User switching
// ---------------------------------------------------------------------------

/**
 * Build a user switch event. The calling component is responsible for
 * PIN verification (via PinEntryPad) before calling this function.
 *
 * @param fromUserId - The user being switched away from
 * @param toUserId   - The user being switched to
 * @param pinVerified - Whether the new user's PIN was verified
 */
export function createUserSwitchEvent(
  fromUserId: string,
  toUserId: string,
  pinVerified: boolean,
  now: Date = new Date()
): UserSwitchEvent {
  if (fromUserId === toUserId) {
    throw new Error("Cannot switch to the same user");
  }
  if (!pinVerified) {
    throw new Error("PIN verification required for user switching");
  }
  return {
    fromUserId,
    toUserId,
    timestamp: now.toISOString(),
    verified: true,
  };
}

// ---------------------------------------------------------------------------
// Task 11.2: Track sales per user within a shift
// ---------------------------------------------------------------------------

/**
 * Aggregate cash events by userId within a shift.
 *
 * Each event must include a userId attribution (e.g., who was active at the POS
 * when the sale happened). The UserShiftActivity returned per user includes
 * their sales count/total and refunds count/total.
 */
export function aggregateUserActivity(
  events: Array<ShiftCashEvent & { userId: string }>,
  switchEvents: UserSwitchEvent[]
): UserShiftActivity[] {
  const byUser = new Map<string, UserShiftActivity>();

  for (const event of events) {
    if (event.type !== "sale" && event.type !== "refund") continue;

    let activity = byUser.get(event.userId);
    if (!activity) {
      // Find the earliest switch-in timestamp for this user
      const firstSwitch = switchEvents.find((s) => s.toUserId === event.userId);
      activity = {
        userId: event.userId,
        switchedInAt: firstSwitch?.timestamp ?? event.timestamp,
        switchedOutAt: null,
        salesCount: 0,
        salesTotal: 0,
        refundsCount: 0,
        refundsTotal: 0,
      };
      byUser.set(event.userId, activity);
    }

    if (event.type === "sale") {
      activity.salesCount += 1;
      activity.salesTotal = round2(activity.salesTotal + event.amount);
    } else if (event.type === "refund") {
      activity.refundsCount += 1;
      activity.refundsTotal = round2(activity.refundsTotal + event.amount);
    }
  }

  // Set switchedOutAt from switch events
  for (const switchEvt of switchEvents) {
    const fromActivity = byUser.get(switchEvt.fromUserId);
    if (fromActivity && !fromActivity.switchedOutAt) {
      fromActivity.switchedOutAt = switchEvt.timestamp;
    }
  }

  return Array.from(byUser.values());
}

// ---------------------------------------------------------------------------
// Task 10.4: Export helpers (for CSV/text generation)
// ---------------------------------------------------------------------------

/**
 * Format a ShiftSummaryReport as a flat record for CSV export.
 * Returns an array of key-value pairs suitable for a CSV row.
 */
export function shiftSummaryToCsvRow(
  report: ShiftSummaryReport
): Record<string, string | number> {
  return {
    shift_id: report.shiftId,
    user_id: report.userId,
    terminal_id: report.terminalId,
    opened_at: report.openedAt,
    closed_at: report.closedAt,
    duration_minutes: report.durationMinutes,
    opening_float: report.openingFloat,
    closing_cash: report.closingCash,
    cash_sales: report.cashSummary.cashSales,
    cash_refunds: report.cashSummary.cashRefunds,
    cash_drops: report.cashSummary.cashDrops,
    paid_outs: report.cashSummary.paidOuts,
    pay_ins: report.cashSummary.payIns,
    expected_cash: report.cashSummary.expectedCash,
    variance: report.variance,
    variance_reason: report.varianceReason ?? "",
  };
}

/**
 * Convert an array of records to CSV string.
 * Basic CSV generator — handles quoting of values containing commas.
 */
export function toCsvString(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const lines: string[] = [headers.join(",")];

  for (const row of rows) {
    const values = headers.map((h) => {
      const val = row[h];
      const str = String(val);
      // Quote if contains comma, newline, or double-quote
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(","));
  }

  return lines.join("\n");
}
