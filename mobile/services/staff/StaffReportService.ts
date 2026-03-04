/**
 * StaffReportService — pure aggregation layer for staff reporting.
 * (staff-reports tasks 2.6, 3.6, 4.5, 5.6, 6.6, 7.4, 8.6, 16.1-16.4)
 *
 * Properties (from design.md):
 *   Property 1: total sales for a staff member = sum of their completed transactions
 *   Property 2: hours worked = clock_out - clock_in - breaks (in any unit)
 *   Property 3: total commission = sum of individual commissions
 *   Property 4: every auditable action produces at least one activity log entry
 *
 * Why pure functions?
 * Staff reports are displayed on a dashboard that recalculates as filters change.
 * Pure functions make each metric trivially memoizable (useMemo in the component)
 * and testable without database access — critical for offline-capable POS apps.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransactionStatus = "completed" | "voided" | "refunded" | "pending";

/** A sale transaction attributed to a staff member. */
export interface StaffTransaction {
  id: string;
  staffId: string;
  amount: number;
  itemCount: number;
  status: TransactionStatus;
  timestamp: string; // ISO timestamp
  commissionRate?: number; // 0.0–1.0 (e.g., 0.05 = 5%)
}

/** A clock-in/clock-out record with optional break time. */
export interface AttendanceRecord {
  id: string;
  staffId: string;
  clockIn: string;  // ISO timestamp
  clockOut: string | null; // null = still clocked in
  /** Total break duration in minutes */
  breakMinutes: number;
  /** Scheduled shift start (ISO timestamp) for late/early detection */
  scheduledStart?: string;
  /** Scheduled shift end (ISO timestamp) for early departure detection */
  scheduledEnd?: string;
}

export interface StaffPerformance {
  staffId: string;
  totalSales: number;
  transactionCount: number;
  averageTransactionValue: number;
  itemsSold: number;
  completedTransactions: number;
  voidedTransactions: number;
  refundedTransactions: number;
}

export interface AttendanceSummary {
  staffId: string;
  hoursWorked: number;
  minutesWorked: number;
  isLate: boolean;
  minsLate: number;
  isEarlyDeparture: boolean;
  minsEarly: number;
  overtimeMinutes: number;
}

export interface CommissionLine {
  transactionId: string;
  staffId: string;
  saleAmount: number;
  commissionRate: number;
  commissionAmount: number;
}

export interface CommissionSummary {
  staffId: string;
  totalCommission: number;
  lines: CommissionLine[];
}

export type ActivityActionType =
  | "sale"
  | "void"
  | "refund"
  | "discount"
  | "cash_drawer"
  | "login"
  | "logout"
  | "price_override";

export interface ActivityEntry {
  id: string;
  staffId: string;
  actionType: ActivityActionType;
  referenceId?: string;
  amount?: number;
  note?: string;
  timestamp: string;
}

export interface ProductivityMetrics {
  staffId: string;
  hoursWorked: number;
  totalSales: number;
  /** Sales per hour worked */
  salesPerHour: number;
  /** Transactions per hour worked */
  transactionsPerHour: number;
  transactionCount: number;
}

// ---------------------------------------------------------------------------
// Property 1: Performance aggregation (task 2.6 + 16.1)
// ---------------------------------------------------------------------------

/**
 * Aggregate performance metrics for a staff member from their transactions.
 *
 * Property 1: totalSales = sum of completed transaction amounts.
 *
 * Only completed transactions count toward sales; voided/refunded are tracked
 * separately for audit but not added to the sales total.
 */
export function calculateStaffPerformance(
  staffId: string,
  transactions: StaffTransaction[]
): StaffPerformance {
  const staffTxns = transactions.filter((t) => t.staffId === staffId);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const completed = staffTxns.filter((t) => t.status === "completed");
  const voided   = staffTxns.filter((t) => t.status === "voided");
  const refunded = staffTxns.filter((t) => t.status === "refunded");

  const totalSales = round2(completed.reduce((s, t) => s + t.amount, 0));
  const itemsSold  = completed.reduce((s, t) => s + t.itemCount, 0);
  const avg = completed.length > 0
    ? round2(totalSales / completed.length)
    : 0;

  return {
    staffId,
    totalSales,
    transactionCount: staffTxns.length,
    averageTransactionValue: avg,
    itemsSold,
    completedTransactions: completed.length,
    voidedTransactions:    voided.length,
    refundedTransactions:  refunded.length,
  };
}

/**
 * Compare performance across a set of staff IDs and rank them by totalSales.
 * Returns array sorted descending (highest sales first).
 */
export function compareStaffPerformance(
  staffIds: string[],
  transactions: StaffTransaction[]
): Array<StaffPerformance & { rank: number }> {
  const results = staffIds.map((id) => calculateStaffPerformance(id, transactions));
  results.sort((a, b) => b.totalSales - a.totalSales);
  return results.map((r, idx) => ({ ...r, rank: idx + 1 }));
}

// ---------------------------------------------------------------------------
// Property 2: Attendance / hours calculation (task 3.6 + 16.2)
// ---------------------------------------------------------------------------

/**
 * Calculate attendance summary from a clock-in/clock-out record.
 *
 * Property 2: hoursWorked = (clockOut - clockIn - breakMinutes) / 60
 * If clockOut is null, treats the record as still open (0 hours).
 *
 * @param record          Attendance record
 * @param overtimeThreshold  Standard shift length in hours; anything over is overtime (default 8h)
 */
export function calculateAttendanceSummary(
  record: AttendanceRecord,
  overtimeThreshold = 8
): AttendanceSummary {
  if (!record.clockOut) {
    return {
      staffId: record.staffId,
      hoursWorked: 0,
      minutesWorked: 0,
      isLate: false,
      minsLate: 0,
      isEarlyDeparture: false,
      minsEarly: 0,
      overtimeMinutes: 0,
    };
  }

  const clockInMs  = new Date(record.clockIn).getTime();
  const clockOutMs = new Date(record.clockOut).getTime();
  const totalMinutes = (clockOutMs - clockInMs) / 60000 - record.breakMinutes;
  const minutesWorked = Math.max(0, totalMinutes);
  const hoursWorked   = Math.round((minutesWorked / 60) * 100) / 100;

  // Late arrival
  let isLate = false;
  let minsLate = 0;
  if (record.scheduledStart) {
    const scheduledStartMs = new Date(record.scheduledStart).getTime();
    minsLate = Math.max(0, (clockInMs - scheduledStartMs) / 60000);
    isLate = minsLate > 0;
  }

  // Early departure
  let isEarlyDeparture = false;
  let minsEarly = 0;
  if (record.scheduledEnd) {
    const scheduledEndMs = new Date(record.scheduledEnd).getTime();
    minsEarly = Math.max(0, (scheduledEndMs - clockOutMs) / 60000);
    isEarlyDeparture = minsEarly > 0;
  }

  const overtimeMinutes = Math.max(0, minutesWorked - overtimeThreshold * 60);

  return {
    staffId: record.staffId,
    hoursWorked,
    minutesWorked: Math.round(minutesWorked),
    isLate,
    minsLate: Math.round(minsLate),
    isEarlyDeparture,
    minsEarly: Math.round(minsEarly),
    overtimeMinutes: Math.round(overtimeMinutes),
  };
}

/**
 * Aggregate attendance across multiple records for a single staff member.
 * Returns total hours and overtime.
 */
export function aggregateAttendance(
  staffId: string,
  records: AttendanceRecord[],
  overtimeThreshold = 8
): { totalHours: number; totalMinutes: number; totalOvertime: number } {
  const staffRecords = records.filter((r) => r.staffId === staffId);
  const summaries = staffRecords.map((r) =>
    calculateAttendanceSummary(r, overtimeThreshold)
  );
  const totalMinutes = summaries.reduce((s, x) => s + x.minutesWorked, 0);
  const totalOvertime = summaries.reduce((s, x) => s + x.overtimeMinutes, 0);
  return {
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    totalMinutes,
    totalOvertime,
  };
}

// ---------------------------------------------------------------------------
// Property 3: Commission calculation (task 4.5 + 16.3)
// ---------------------------------------------------------------------------

/**
 * Calculate commission lines and totals for a staff member.
 *
 * Property 3: totalCommission = sum(saleAmount × commissionRate) for each
 *             completed transaction that has a commission rate.
 */
export function calculateCommissions(
  staffId: string,
  transactions: StaffTransaction[]
): CommissionSummary {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const eligible = transactions.filter(
    (t) => t.staffId === staffId &&
           t.status === "completed" &&
           t.commissionRate !== undefined &&
           t.commissionRate > 0
  );

  const lines: CommissionLine[] = eligible.map((t) => ({
    transactionId: t.id,
    staffId: t.staffId,
    saleAmount: t.amount,
    commissionRate: t.commissionRate!,
    commissionAmount: round2(t.amount * t.commissionRate!),
  }));

  const totalCommission = round2(lines.reduce((s, l) => s + l.commissionAmount, 0));

  return { staffId, totalCommission, lines };
}

// ---------------------------------------------------------------------------
// Property 4: Activity log (task 5.6 + 16.4)
// ---------------------------------------------------------------------------

/** Auditable action types — every action in this set MUST produce a log entry. */
export const AUDITABLE_ACTIONS: Set<ActivityActionType> = new Set([
  "sale", "void", "refund", "discount", "cash_drawer", "login", "logout",
  "price_override",
]);

/**
 * Filter activity log entries by action type.
 */
export function filterActivity(
  entries: ActivityEntry[],
  staffId: string,
  actionType?: ActivityActionType
): ActivityEntry[] {
  return entries.filter(
    (e) =>
      e.staffId === staffId &&
      (actionType === undefined || e.actionType === actionType)
  );
}

/**
 * Verify that activity log completeness:
 * For every auditable action reference ID, at least one log entry must exist.
 *
 * Property 4 check: used in PBT to ensure no auditable action slips through.
 *
 * @param actionIds  Set of known action reference IDs that occurred
 * @param entries    The activity log to check
 */
export function verifyActivityCompleteness(
  actionIds: Set<string>,
  entries: ActivityEntry[]
): { complete: boolean; missingIds: string[] } {
  const loggedIds = new Set(entries.map((e) => e.referenceId).filter(Boolean));
  const missingIds = [...actionIds].filter((id) => !loggedIds.has(id));
  return { complete: missingIds.length === 0, missingIds };
}

// ---------------------------------------------------------------------------
// Productivity analysis (tasks 6.6, 7.4)
// ---------------------------------------------------------------------------

/**
 * Calculate productivity (sales per hour) for a staff member.
 */
export function calculateProductivity(
  staffId: string,
  transactions: StaffTransaction[],
  attendanceRecords: AttendanceRecord[]
): ProductivityMetrics {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const performance = calculateStaffPerformance(staffId, transactions);
  const { totalHours } = aggregateAttendance(staffId, attendanceRecords);

  const salesPerHour = totalHours > 0
    ? round2(performance.totalSales / totalHours)
    : 0;
  const transactionsPerHour = totalHours > 0
    ? round2(performance.completedTransactions / totalHours)
    : 0;

  return {
    staffId,
    hoursWorked: totalHours,
    totalSales: performance.totalSales,
    salesPerHour,
    transactionsPerHour,
    transactionCount: performance.completedTransactions,
  };
}

/**
 * Rank team members by sales-per-hour productivity.
 */
export function rankTeamByProductivity(
  staffIds: string[],
  transactions: StaffTransaction[],
  attendanceRecords: AttendanceRecord[]
): Array<ProductivityMetrics & { rank: number }> {
  const metrics = staffIds.map((id) =>
    calculateProductivity(id, transactions, attendanceRecords)
  );
  metrics.sort((a, b) => b.salesPerHour - a.salesPerHour);
  return metrics.map((m, idx) => ({ ...m, rank: idx + 1 }));
}
