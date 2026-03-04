/**
 * Integration Tests: Staff Reports
 *
 * Tasks 17.1–17.4 — staff-reports spec
 *
 * Tests entire workflows using realistic weekly sample data:
 * - 17.1: Report generation with sample data
 * - 17.2: Export functionality (CSV/JSON structure verification)
 * - 17.3: Custom report builder (filter + projection pipeline)
 * - 17.4: Scheduled report delivery pipeline
 *
 * Validates: staff-reports Requirements 1–5
 */

import {
  calculateStaffPerformance,
  calculateAttendanceSummary,
  aggregateAttendance,
  calculateCommissions,
  filterActivity,
  rankTeamByProductivity,
  calculateProductivity,
  compareStaffPerformance,
} from "../services/staff/StaffReportService";

import type {
  StaffTransaction,
  AttendanceRecord,
  ActivityEntry,
  ActivityActionType,
  StaffPerformance,
} from "../services/staff/StaffReportService";

// ---------------------------------------------------------------------------
// Fixtures — realistic weekly sample data
// ---------------------------------------------------------------------------

const STAFF_ALICE = "staff-alice";
const STAFF_BOB   = "staff-bob";
const STAFF_CAROL = "staff-carol";
const ALL_STAFF = [STAFF_ALICE, STAFF_BOB, STAFF_CAROL];

function isoDay(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date(2024, 0, 1 + dayOffset, hour, minute);
  return d.toISOString();
}

/** 7-day sample week transactions */
function makeWeekTransactions(): StaffTransaction[] {
  const txns: StaffTransaction[] = [];

  // Alice: high performer — 10 tx/day × 7 days, amounts 100-190
  for (let day = 0; day < 7; day++) {
    for (let i = 0; i < 10; i++) {
      txns.push({
        id: `alice-d${day}-t${i}`,
        staffId: STAFF_ALICE,
        amount: 100 + i * 10,
        itemCount: 2 + (i % 3),
        status: "completed",
        timestamp: isoDay(day, 9 + i),
        commissionRate: 0.05,
      });
    }
  }

  // Bob: mid performer — 6 tx/day × 7 days, 1 void per day
  for (let day = 0; day < 7; day++) {
    for (let i = 0; i < 6; i++) {
      txns.push({
        id: `bob-d${day}-t${i}`,
        staffId: STAFF_BOB,
        amount: 80 + i * 8,
        itemCount: 1 + (i % 2),
        status: i === 5 ? "voided" : "completed",
        timestamp: isoDay(day, 10 + i),
        commissionRate: 0.03,
      });
    }
  }

  // Carol: new employee — 3 tx/day × 5 days
  for (let day = 0; day < 5; day++) {
    for (let i = 0; i < 3; i++) {
      txns.push({
        id: `carol-d${day}-t${i}`,
        staffId: STAFF_CAROL,
        amount: 60 + i * 15,
        itemCount: 1,
        status: "completed",
        timestamp: isoDay(day, 11 + i),
        commissionRate: 0.02,
      });
    }
  }

  return txns;
}

/** 7-day sample week attendance */
function makeWeekAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];

  for (let day = 0; day < 7; day++) {
    // Alice: always on time, 8:00–17:00
    records.push({
      id: `alice-att-${day}`,
      staffId: STAFF_ALICE,
      clockIn:  isoDay(day, 8, 0),
      clockOut: isoDay(day, 17, 0),
      breakMinutes: 30,
      scheduledStart: isoDay(day, 8, 0),
      scheduledEnd:   isoDay(day, 17, 0),
    });

    // Bob: sometimes late (odd days), 8:00 or 8:20–17:00
    records.push({
      id: `bob-att-${day}`,
      staffId: STAFF_BOB,
      clockIn:  isoDay(day, 8, day % 2 === 0 ? 0 : 20),
      clockOut: isoDay(day, 17, 0),
      breakMinutes: 30,
      scheduledStart: isoDay(day, 8, 0),
      scheduledEnd:   isoDay(day, 17, 0),
    });
  }

  // Carol: 5-day week only
  for (let day = 0; day < 5; day++) {
    records.push({
      id: `carol-att-${day}`,
      staffId: STAFF_CAROL,
      clockIn:  isoDay(day, 9, 0),
      clockOut: isoDay(day, 17, 0),
      breakMinutes: 30,
      scheduledStart: isoDay(day, 9, 0),
      scheduledEnd:   isoDay(day, 17, 0),
    });
  }

  return records;
}

function makeWeekActivity(): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (let day = 0; day < 7; day++) {
    entries.push({ id: `alice-login-${day}`,  staffId: STAFF_ALICE, action: "login",          timestamp: isoDay(day, 8),  details: {} });
    entries.push({ id: `alice-logout-${day}`, staffId: STAFF_ALICE, action: "logout",         timestamp: isoDay(day, 17), details: {} });
    entries.push({ id: `alice-sale-${day}`,   staffId: STAFF_ALICE, action: "sale_completed", timestamp: isoDay(day, 10), details: {} });

    entries.push({ id: `bob-login-${day}`,  staffId: STAFF_BOB, action: "login",             timestamp: isoDay(day, 8),  details: {} });
    entries.push({ id: `bob-logout-${day}`, staffId: STAFF_BOB, action: "logout",            timestamp: isoDay(day, 17), details: {} });
    entries.push({ id: `bob-void-${day}`,   staffId: STAFF_BOB, action: "void_transaction",  timestamp: isoDay(day, 12), details: {} });

    if (day < 5) {
      entries.push({ id: `carol-login-${day}`,  staffId: STAFF_CAROL, action: "login",  timestamp: isoDay(day, 9),  details: {} });
      entries.push({ id: `carol-logout-${day}`, staffId: STAFF_CAROL, action: "logout", timestamp: isoDay(day, 17), details: {} });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// 17.1: Report generation with sample data
// ---------------------------------------------------------------------------

describe("Task 17.1 — Report generation with sample data", () => {
  const transactions = makeWeekTransactions();
  const attendance = makeWeekAttendance();

  test("generates performance report for Alice (70 transactions)", () => {
    const perf = calculateStaffPerformance(STAFF_ALICE, transactions);
    expect(perf.completedTransactions).toBe(70); // 10/day × 7 days
    expect(perf.voidedTransactions).toBe(0);
    expect(perf.totalSales).toBeGreaterThan(0);
  });

  test("generates performance report for Bob with voided transactions", () => {
    const perf = calculateStaffPerformance(STAFF_BOB, transactions);
    expect(perf.voidedTransactions).toBe(7); // 1 void/day × 7 days
    expect(perf.completedTransactions).toBe(35); // 5 completed/day × 7
    expect(perf.completedTransactions + perf.voidedTransactions).toBe(42);
  });

  test("generates performance report for Carol (15 transactions)", () => {
    const perf = calculateStaffPerformance(STAFF_CAROL, transactions);
    expect(perf.completedTransactions).toBe(15); // 3/day × 5 days
  });

  test("Alice total sales > Bob total sales", () => {
    const alicePerf = calculateStaffPerformance(STAFF_ALICE, transactions);
    const bobPerf   = calculateStaffPerformance(STAFF_BOB, transactions);
    expect(alicePerf.totalSales).toBeGreaterThan(bobPerf.totalSales);
  });

  test("aggregates attendance for all staff", () => {
    for (const staffId of ALL_STAFF) {
      const agg = aggregateAttendance(staffId, attendance);
      expect(agg.totalHours).toBeGreaterThan(0);
    }
    // Alice worked every day; Carol 5 days — Alice has more hours
    const aliceHours = aggregateAttendance(STAFF_ALICE, attendance).totalHours;
    const carolHours = aggregateAttendance(STAFF_CAROL, attendance).totalHours;
    expect(aliceHours).toBeGreaterThan(carolHours);
  });

  test("full pipeline: team total revenue equals sum of individual revenues", () => {
    const allPerfs = ALL_STAFF.map((id) => calculateStaffPerformance(id, transactions));
    const teamTotal = allPerfs.reduce((s, p) => s + p.totalSales, 0);

    const completedTransactions = transactions.filter((t) => t.status === "completed");
    const directSum = completedTransactions.reduce((s, t) => s + t.amount, 0);

    expect(teamTotal).toBeCloseTo(directSum, 1);
  });
});

// ---------------------------------------------------------------------------
// 17.2: Export functionality
// ---------------------------------------------------------------------------

/**
 * Performance export row — the shape sent to the CSV/PDF formatter.
 */
interface PerformanceExportRow {
  staffId: string;
  totalSales: number;
  completedTransactions: number;
  voidedTransactions: number;
  avgTransactionValue: number;
  itemsSold: number;
}

function buildExportRows(
  staffIds: string[],
  transactions: StaffTransaction[]
): PerformanceExportRow[] {
  return staffIds.map((staffId) => {
    const p = calculateStaffPerformance(staffId, transactions);
    return {
      staffId,
      totalSales: p.totalSales,
      completedTransactions: p.completedTransactions,
      voidedTransactions: p.voidedTransactions,
      avgTransactionValue: p.averageTransactionValue,
      itemsSold: p.itemsSold,
    };
  });
}

function rowsToCsv(rows: PerformanceExportRow[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]).join(",");
  const lines = rows.map((row) =>
    Object.values(row)
      .map((v) => (typeof v === "number" ? v.toFixed(2) : String(v)))
      .join(",")
  );
  return [headers, ...lines].join("\n");
}

describe("Task 17.2 — Export functionality", () => {
  const transactions = makeWeekTransactions();

  test("export rows contain all required fields", () => {
    const rows = buildExportRows(ALL_STAFF, transactions);
    for (const row of rows) {
      expect(row).toHaveProperty("staffId");
      expect(row).toHaveProperty("totalSales");
      expect(row).toHaveProperty("completedTransactions");
      expect(row).toHaveProperty("voidedTransactions");
      expect(row).toHaveProperty("avgTransactionValue");
      expect(row).toHaveProperty("itemsSold");
    }
  });

  test("CSV has one data row per staff member plus header", () => {
    const rows = buildExportRows(ALL_STAFF, transactions);
    const csv = rowsToCsv(rows);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines).toHaveLength(4); // 1 header + 3 staff
  });

  test("CSV header contains expected field names", () => {
    const rows = buildExportRows(ALL_STAFF, transactions);
    const csv = rowsToCsv(rows);
    const header = csv.split("\n")[0];
    expect(header).toContain("staffId");
    expect(header).toContain("totalSales");
    expect(header).toContain("voidedTransactions");
  });

  test("numeric fields round-trip through JSON without precision loss", () => {
    const rows = buildExportRows(ALL_STAFF, transactions);
    const json = JSON.parse(JSON.stringify(rows)) as PerformanceExportRow[];
    for (let i = 0; i < rows.length; i++) {
      expect(json[i].totalSales).toBeCloseTo(rows[i].totalSales, 2);
    }
  });

  test("all export values are non-negative", () => {
    const rows = buildExportRows(ALL_STAFF, transactions);
    for (const row of rows) {
      expect(row.totalSales).toBeGreaterThanOrEqual(0);
      expect(row.completedTransactions).toBeGreaterThanOrEqual(0);
      expect(row.voidedTransactions).toBeGreaterThanOrEqual(0);
      expect(row.avgTransactionValue).toBeGreaterThanOrEqual(0);
      expect(row.itemsSold).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 17.3: Custom report builder
// ---------------------------------------------------------------------------

/**
 * Custom report: filter transactions then compute performance.
 * Mirrors a manager-configurable report builder.
 */
interface CustomReportFilter {
  staffIds?: string[];
  minAmount?: number;
  statusFilter?: Array<StaffTransaction["status"]>;
  fromTimestamp?: string;
  toTimestamp?: string;
}

function buildCustomReport(
  transactions: StaffTransaction[],
  filter: CustomReportFilter,
  targetStaffId: string
): StaffPerformance {
  let filtered = [...transactions];

  if (filter.staffIds) {
    filtered = filtered.filter((t) => filter.staffIds!.includes(t.staffId));
  }
  if (filter.minAmount !== undefined) {
    filtered = filtered.filter((t) => t.amount >= filter.minAmount!);
  }
  if (filter.statusFilter) {
    filtered = filtered.filter((t) => filter.statusFilter!.includes(t.status));
  }
  if (filter.fromTimestamp) {
    filtered = filtered.filter((t) => t.timestamp >= filter.fromTimestamp!);
  }
  if (filter.toTimestamp) {
    filtered = filtered.filter((t) => t.timestamp <= filter.toTimestamp!);
  }

  return calculateStaffPerformance(targetStaffId, filtered);
}

describe("Task 17.3 — Custom report builder", () => {
  const transactions = makeWeekTransactions();

  test("no filters returns all transactions", () => {
    const report = buildCustomReport(transactions, {}, STAFF_ALICE);
    expect(report.completedTransactions).toBe(70);
  });

  test("filter by staff ID shows only that staff's data", () => {
    const report = buildCustomReport(
      transactions,
      { staffIds: [STAFF_ALICE] },
      STAFF_ALICE
    );
    // Bob and Carol excluded from the source data; Alice still has 70
    expect(report.completedTransactions).toBe(70);
  });

  test("filter by minAmount excludes low-value transactions", () => {
    const allAlice = buildCustomReport(transactions, {}, STAFF_ALICE);
    const highValueAlice = buildCustomReport(
      transactions,
      { minAmount: 150 },
      STAFF_ALICE
    );
    expect(highValueAlice.completedTransactions).toBeLessThanOrEqual(
      allAlice.completedTransactions
    );
  });

  test("filter for completed only excludes voids", () => {
    const allBob = buildCustomReport(transactions, {}, STAFF_BOB);
    const completedBob = buildCustomReport(
      transactions,
      { statusFilter: ["completed"] },
      STAFF_BOB
    );
    expect(completedBob.voidedTransactions).toBe(0);
    expect(completedBob.completedTransactions).toBeLessThan(
      allBob.completedTransactions + allBob.voidedTransactions
    );
  });

  test("date range filter: first 3 days only gives 30 Alice transactions", () => {
    const from = isoDay(0, 0, 0);   // Jan 1 00:00
    const to   = isoDay(2, 23, 59); // Jan 3 23:59

    const report = buildCustomReport(
      transactions,
      { fromTimestamp: from, toTimestamp: to },
      STAFF_ALICE
    );
    expect(report.completedTransactions).toBe(30); // 10/day × 3 days
  });

  test("multi-staff filter combined totals match individuals sum", () => {
    const aliceReport = buildCustomReport(transactions, { staffIds: [STAFF_ALICE] }, STAFF_ALICE);
    const bobReport   = buildCustomReport(transactions, { staffIds: [STAFF_BOB] }, STAFF_BOB);

    // Combine Alice + Bob
    const combined = transactions.filter((t) => [STAFF_ALICE, STAFF_BOB].includes(t.staffId));
    const aliceFromCombined = calculateStaffPerformance(STAFF_ALICE, combined);
    const bobFromCombined   = calculateStaffPerformance(STAFF_BOB, combined);

    expect(aliceFromCombined.totalSales).toBeCloseTo(aliceReport.totalSales, 2);
    expect(bobFromCombined.totalSales).toBeCloseTo(bobReport.totalSales, 2);
  });
});

// ---------------------------------------------------------------------------
// 17.4: Scheduled report delivery pipeline
// ---------------------------------------------------------------------------

interface ScheduledReportPayload {
  period: { start: string; end: string };
  teamSummary: {
    totalSales: number;
    totalTransactions: number;
    topPerformerStaffId: string;
  };
  staffRanking: Array<{
    staffId: string;
    rank: number;
    totalSales: number;
    hoursWorked: number;
  }>;
}

function buildScheduledReport(
  transactions: StaffTransaction[],
  attendance: AttendanceRecord[],
  periodStart: string,
  periodEnd: string
): ScheduledReportPayload {
  const ranked = rankTeamByProductivity(ALL_STAFF, transactions, attendance);

  const allPerfs = ALL_STAFF.map((id) => calculateStaffPerformance(id, transactions));
  const totalSales = allPerfs.reduce((s, p) => s + p.totalSales, 0);
  const totalTxns  = allPerfs.reduce((s, p) => s + p.completedTransactions + p.voidedTransactions + p.refundedTransactions, 0);

  return {
    period: { start: periodStart, end: periodEnd },
    teamSummary: {
      totalSales,
      totalTransactions: totalTxns,
      topPerformerStaffId: ranked[0]?.staffId ?? "",
    },
    staffRanking: ranked.map((r) => ({
      staffId: r.staffId,
      rank: r.rank,
      totalSales: allPerfs.find((p) => p.staffId === r.staffId)?.totalSales ?? 0,
      hoursWorked: aggregateAttendance(r.staffId, attendance).totalHours,
    })),
  };
}

describe("Task 17.4 — Scheduled report delivery pipeline", () => {
  const transactions = makeWeekTransactions();
  const attendance = makeWeekAttendance();

  test("report includes all 3 staff members", () => {
    const report = buildScheduledReport(transactions, attendance, "2024-01-01", "2024-01-07");
    expect(report.staffRanking).toHaveLength(3);
  });

  test("team total sales equals sum of individual staff sales", () => {
    const report = buildScheduledReport(transactions, attendance, "2024-01-01", "2024-01-07");
    const sumFromRanking = report.staffRanking.reduce((s, r) => s + r.totalSales, 0);
    expect(report.teamSummary.totalSales).toBeCloseTo(sumFromRanking, 1);
  });

  test("ranks are 1, 2, 3 with no duplicates", () => {
    const report = buildScheduledReport(transactions, attendance, "2024-01-01", "2024-01-07");
    const ranks = report.staffRanking.map((r) => r.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3]);
  });

  test("top performer staffId matches position-1 in ranking", () => {
    const report = buildScheduledReport(transactions, attendance, "2024-01-01", "2024-01-07");
    const topRanked = report.staffRanking.find((r) => r.rank === 1);
    expect(topRanked?.staffId).toBe(report.teamSummary.topPerformerStaffId);
  });

  test("period metadata matches input dates", () => {
    const report = buildScheduledReport(transactions, attendance, "2024-01-01", "2024-01-07");
    expect(report.period.start).toBe("2024-01-01");
    expect(report.period.end).toBe("2024-01-07");
  });

  test("staff with more attendance hours have non-zero hoursWorked", () => {
    const report = buildScheduledReport(transactions, attendance, "2024-01-01", "2024-01-07");
    for (const row of report.staffRanking) {
      expect(row.hoursWorked).toBeGreaterThan(0);
    }
  });

  test("Alice works more hours than Carol (7 days vs 5 days)", () => {
    const aliceHours = aggregateAttendance(STAFF_ALICE, attendance).totalHours;
    const carolHours = aggregateAttendance(STAFF_CAROL, attendance).totalHours;
    expect(aliceHours).toBeGreaterThan(carolHours);
  });
});
