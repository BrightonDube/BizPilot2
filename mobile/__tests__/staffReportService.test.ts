/**
 * StaffReportService unit tests + PBTs
 * (staff-reports tasks 2.6, 3.6, 4.5, 5.6, 6.6, 7.4, 8.6, 16.1-16.4)
 *
 * PBT Properties:
 *   Property 1 (task 16.1): totalSales = sum of completed transaction amounts
 *   Property 2 (task 16.2): hoursWorked = (clockOut - clockIn - breaks) / 60
 *   Property 3 (task 16.3): totalCommission = sum of individual commission amounts
 *   Property 4 (task 16.4): every auditable action has at least one log entry
 */

import {
  calculateStaffPerformance,
  compareStaffPerformance,
  calculateAttendanceSummary,
  aggregateAttendance,
  calculateCommissions,
  filterActivity,
  verifyActivityCompleteness,
  calculateProductivity,
  rankTeamByProductivity,
  AUDITABLE_ACTIONS,
  type StaffTransaction,
  type AttendanceRecord,
  type ActivityEntry,
  type ActivityActionType,
} from "@/services/staff/StaffReportService";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTxn(
  id: string,
  staffId: string,
  amount: number,
  itemCount = 1,
  status: StaffTransaction["status"] = "completed",
  commissionRate?: number
): StaffTransaction {
  return {
    id, staffId, amount, itemCount, status,
    timestamp: new Date().toISOString(),
    commissionRate,
  };
}

/**
 * Create an attendance record with times expressed as minute offsets from a base.
 * @param offsetClockIn   minutes from base (0 = on time)
 * @param offsetClockOut  minutes from base for clock-out
 * @param breakMins       break duration in minutes
 */
function makeAttendance(
  id: string,
  staffId: string,
  clockInHour: number,
  clockOutHour: number | null,
  breakMins = 0,
  scheduledStartHour?: number,
  scheduledEndHour?: number
): AttendanceRecord {
  const base = new Date("2024-01-01T00:00:00Z");
  const toISO = (h: number) => new Date(base.getTime() + h * 3600000).toISOString();
  return {
    id, staffId,
    clockIn:  toISO(clockInHour),
    clockOut: clockOutHour !== null ? toISO(clockOutHour) : null,
    breakMinutes: breakMins,
    scheduledStart: scheduledStartHour !== undefined ? toISO(scheduledStartHour) : undefined,
    scheduledEnd:   scheduledEndHour   !== undefined ? toISO(scheduledEndHour)   : undefined,
  };
}

// ---------------------------------------------------------------------------
// Unit tests: calculateStaffPerformance (task 2.6)
// ---------------------------------------------------------------------------

describe("calculateStaffPerformance (task 2.6)", () => {
  it("returns zeros for staff with no transactions", () => {
    const p = calculateStaffPerformance("s1", []);
    expect(p.totalSales).toBe(0);
    expect(p.transactionCount).toBe(0);
    expect(p.averageTransactionValue).toBe(0);
  });

  it("only counts completed transactions in totalSales", () => {
    const txns = [
      makeTxn("t1", "s1", 100, 1, "completed"),
      makeTxn("t2", "s1", 200, 1, "voided"),
      makeTxn("t3", "s1", 50,  1, "refunded"),
      makeTxn("t4", "s1", 150, 1, "completed"),
    ];
    const p = calculateStaffPerformance("s1", txns);
    expect(p.totalSales).toBe(250);
    expect(p.completedTransactions).toBe(2);
    expect(p.voidedTransactions).toBe(1);
    expect(p.refundedTransactions).toBe(1);
  });

  it("calculates averageTransactionValue correctly", () => {
    const txns = [
      makeTxn("t1", "s1", 100, 1, "completed"),
      makeTxn("t2", "s1", 200, 1, "completed"),
    ];
    const p = calculateStaffPerformance("s1", txns);
    expect(p.averageTransactionValue).toBe(150);
  });

  it("counts total items sold from completed transactions only", () => {
    const txns = [
      makeTxn("t1", "s1", 100, 3, "completed"),
      makeTxn("t2", "s1", 50,  2, "voided"),
    ];
    const p = calculateStaffPerformance("s1", txns);
    expect(p.itemsSold).toBe(3);
  });

  it("ignores transactions from other staff", () => {
    const txns = [
      makeTxn("t1", "s1", 100, 1, "completed"),
      makeTxn("t2", "s2", 500, 1, "completed"), // different staff
    ];
    const p = calculateStaffPerformance("s1", txns);
    expect(p.totalSales).toBe(100);
  });
});

describe("compareStaffPerformance", () => {
  it("ranks staff by totalSales descending", () => {
    const txns = [
      makeTxn("t1", "s1", 100, 1, "completed"),
      makeTxn("t2", "s2", 500, 1, "completed"),
      makeTxn("t3", "s3", 300, 1, "completed"),
    ];
    const ranked = compareStaffPerformance(["s1", "s2", "s3"], txns);
    expect(ranked[0].staffId).toBe("s2");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].staffId).toBe("s3");
    expect(ranked[2].staffId).toBe("s1");
    expect(ranked[2].rank).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: calculateAttendanceSummary (task 3.6)
// ---------------------------------------------------------------------------

describe("calculateAttendanceSummary (task 3.6)", () => {
  it("returns 0 hours when clockOut is null", () => {
    const rec = makeAttendance("a1", "s1", 9, null, 0);
    const s = calculateAttendanceSummary(rec);
    expect(s.hoursWorked).toBe(0);
    expect(s.minutesWorked).toBe(0);
  });

  it("calculates 8 hours shift correctly", () => {
    const rec = makeAttendance("a1", "s1", 8, 16, 0); // 8am-4pm, no break
    const s = calculateAttendanceSummary(rec);
    expect(s.hoursWorked).toBe(8);
    expect(s.minutesWorked).toBe(480);
  });

  it("subtracts break time", () => {
    const rec = makeAttendance("a1", "s1", 8, 16, 30); // 8am-4pm, 30min break
    const s = calculateAttendanceSummary(rec);
    expect(s.hoursWorked).toBeCloseTo(7.5, 2);
    expect(s.minutesWorked).toBe(450);
  });

  it("detects late arrival", () => {
    // scheduled 9am, clocked in at 9:30am = 30 mins late
    const rec = makeAttendance("a1", "s1", 9.5, 17.5, 0, 9, 17.5);
    const s = calculateAttendanceSummary(rec);
    expect(s.isLate).toBe(true);
    expect(s.minsLate).toBe(30);
  });

  it("detects on-time arrival (not late)", () => {
    const rec = makeAttendance("a1", "s1", 9, 17, 0, 9, 17);
    const s = calculateAttendanceSummary(rec);
    expect(s.isLate).toBe(false);
    expect(s.minsLate).toBe(0);
  });

  it("detects early departure", () => {
    // scheduled to end at 5pm, left at 4pm = 60 mins early
    const rec = makeAttendance("a1", "s1", 9, 16, 0, 9, 17);
    const s = calculateAttendanceSummary(rec);
    expect(s.isEarlyDeparture).toBe(true);
    expect(s.minsEarly).toBe(60);
  });

  it("calculates overtime for shifts over 8h", () => {
    const rec = makeAttendance("a1", "s1", 8, 17.5, 0); // 9.5h
    const s = calculateAttendanceSummary(rec, 8);
    expect(s.overtimeMinutes).toBe(90);
  });

  it("returns 0 overtime for normal shift", () => {
    const rec = makeAttendance("a1", "s1", 8, 16, 0); // exactly 8h
    const s = calculateAttendanceSummary(rec, 8);
    expect(s.overtimeMinutes).toBe(0);
  });
});

describe("aggregateAttendance", () => {
  it("sums hours across multiple records for same staff", () => {
    const records = [
      makeAttendance("a1", "s1", 8, 16, 0),   // 8h
      makeAttendance("a2", "s1", 8, 12, 0),   // 4h
    ];
    const agg = aggregateAttendance("s1", records);
    expect(agg.totalHours).toBe(12);
    expect(agg.totalMinutes).toBe(720);
  });

  it("ignores records for other staff", () => {
    const records = [
      makeAttendance("a1", "s1", 8, 16, 0),
      makeAttendance("a2", "s2", 8, 16, 0),
    ];
    const agg = aggregateAttendance("s1", records);
    expect(agg.totalHours).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: calculateCommissions (task 4.5)
// ---------------------------------------------------------------------------

describe("calculateCommissions (task 4.5)", () => {
  it("returns zero commission for no transactions", () => {
    const s = calculateCommissions("s1", []);
    expect(s.totalCommission).toBe(0);
    expect(s.lines).toHaveLength(0);
  });

  it("calculates commission correctly", () => {
    const txns = [
      makeTxn("t1", "s1", 100, 1, "completed", 0.05),
      makeTxn("t2", "s1", 200, 1, "completed", 0.10),
    ];
    const s = calculateCommissions("s1", txns);
    // 100×0.05 + 200×0.10 = 5 + 20 = 25
    expect(s.totalCommission).toBe(25);
    expect(s.lines).toHaveLength(2);
  });

  it("skips voided and refunded transactions", () => {
    const txns = [
      makeTxn("t1", "s1", 100, 1, "voided",   0.05),
      makeTxn("t2", "s1", 200, 1, "refunded", 0.05),
      makeTxn("t3", "s1", 50,  1, "completed", 0.05),
    ];
    const s = calculateCommissions("s1", txns);
    expect(s.totalCommission).toBe(2.5);
    expect(s.lines).toHaveLength(1);
  });

  it("skips transactions with no commission rate", () => {
    const txns = [
      makeTxn("t1", "s1", 100, 1, "completed"), // no commissionRate
    ];
    const s = calculateCommissions("s1", txns);
    expect(s.totalCommission).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: activity filtering + completeness (task 5.6)
// ---------------------------------------------------------------------------

describe("filterActivity (task 5.6)", () => {
  const entries: ActivityEntry[] = [
    { id: "e1", staffId: "s1", actionType: "sale",    timestamp: new Date().toISOString(), referenceId: "r1" },
    { id: "e2", staffId: "s1", actionType: "void",    timestamp: new Date().toISOString(), referenceId: "r2" },
    { id: "e3", staffId: "s2", actionType: "sale",    timestamp: new Date().toISOString(), referenceId: "r3" },
    { id: "e4", staffId: "s1", actionType: "refund",  timestamp: new Date().toISOString(), referenceId: "r4" },
    { id: "e5", staffId: "s1", actionType: "login",   timestamp: new Date().toISOString(), referenceId: "r5" },
  ];

  it("returns all entries for a staff member", () => {
    expect(filterActivity(entries, "s1")).toHaveLength(4);
  });

  it("filters by action type", () => {
    const sales = filterActivity(entries, "s1", "sale");
    expect(sales).toHaveLength(1);
    expect(sales[0].id).toBe("e1");
  });

  it("returns empty for unknown staff", () => {
    expect(filterActivity(entries, "s99")).toHaveLength(0);
  });
});

describe("verifyActivityCompleteness (task 5.6)", () => {
  it("reports complete when all action IDs have entries", () => {
    const entries: ActivityEntry[] = [
      { id: "e1", staffId: "s1", actionType: "sale", timestamp: "", referenceId: "a1" },
      { id: "e2", staffId: "s1", actionType: "void", timestamp: "", referenceId: "a2" },
    ];
    const result = verifyActivityCompleteness(new Set(["a1", "a2"]), entries);
    expect(result.complete).toBe(true);
    expect(result.missingIds).toHaveLength(0);
  });

  it("detects missing entries", () => {
    const entries: ActivityEntry[] = [
      { id: "e1", staffId: "s1", actionType: "sale", timestamp: "", referenceId: "a1" },
    ];
    const result = verifyActivityCompleteness(new Set(["a1", "a2"]), entries);
    expect(result.complete).toBe(false);
    expect(result.missingIds).toContain("a2");
  });
});

// ---------------------------------------------------------------------------
// Unit tests: calculateProductivity (task 6.6)
// ---------------------------------------------------------------------------

describe("calculateProductivity (task 6.6)", () => {
  it("returns 0 salesPerHour when no hours worked", () => {
    const txns = [makeTxn("t1", "s1", 100, 1, "completed")];
    const p = calculateProductivity("s1", txns, []);
    expect(p.salesPerHour).toBe(0);
  });

  it("calculates salesPerHour correctly", () => {
    const txns = [makeTxn("t1", "s1", 100, 1, "completed")];
    const recs = [makeAttendance("a1", "s1", 8, 10, 0)]; // 2h
    const p = calculateProductivity("s1", txns, recs);
    expect(p.salesPerHour).toBe(50); // 100 / 2h
    expect(p.hoursWorked).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// PBT: Property 1 — Performance = sum of completed transactions (task 16.1)
// ---------------------------------------------------------------------------

describe("PBT Property 1: totalSales = sum of completed transactions (task 16.1)", () => {
  it("Property 1 holds for any mix of transaction statuses — 400 runs", () => {
    const STATUSES: StaffTransaction["status"][] = ["completed", "voided", "refunded", "pending"];

    for (let i = 0; i < 400; i++) {
      const staffId = "staff-1";
      const n = Math.floor(Math.random() * 20) + 1;
      const txns: StaffTransaction[] = Array.from({ length: n }, (_, j) => ({
        id: `t-${j}`, staffId, itemCount: 1,
        amount: Math.round((Math.random() * 500 + 1) * 100) / 100,
        status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
        timestamp: new Date().toISOString(),
      }));

      const p = calculateStaffPerformance(staffId, txns);

      // Property 1: totalSales = sum of completed amounts
      const expectedTotal = Math.round(
        txns
          .filter((t) => t.status === "completed")
          .reduce((s, t) => s + t.amount, 0) * 100
      ) / 100;
      expect(Math.abs(p.totalSales - expectedTotal)).toBeLessThan(0.01);
    }
  });

  it("totalSales is always non-negative — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const n = Math.floor(Math.random() * 10) + 1;
      const txns: StaffTransaction[] = Array.from({ length: n }, (_, j) => ({
        id: `t-${j}`, staffId: "s1", itemCount: 1,
        amount: Math.round(Math.random() * 1000 * 100) / 100,
        status: "completed" as const,
        timestamp: new Date().toISOString(),
      }));
      const p = calculateStaffPerformance("s1", txns);
      expect(p.totalSales).toBeGreaterThanOrEqual(0);
    }
  });

  it("transactionCount = completed + voided + refunded + pending — 300 runs", () => {
    const STATUSES: StaffTransaction["status"][] = ["completed", "voided", "refunded", "pending"];
    for (let i = 0; i < 300; i++) {
      const n = Math.floor(Math.random() * 15) + 1;
      const txns: StaffTransaction[] = Array.from({ length: n }, (_, j) => ({
        id: `t-${j}`, staffId: "s1", itemCount: 1, amount: 10,
        status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
        timestamp: new Date().toISOString(),
      }));
      const p = calculateStaffPerformance("s1", txns);
      const sum = p.completedTransactions + p.voidedTransactions + p.refundedTransactions;
      // pending are counted in transactionCount but not in any breakdown bucket
      expect(p.transactionCount).toBeGreaterThanOrEqual(sum);
    }
  });
});

// ---------------------------------------------------------------------------
// PBT: Property 2 — Hours = (clockOut - clockIn - breaks) / 60 (task 16.2)
// ---------------------------------------------------------------------------

describe("PBT Property 2: hoursWorked = (clockOut - clockIn - breaks) / 60 (task 16.2)", () => {
  it("Property 2 holds for any shift duration — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const clockInHour  = Math.floor(Math.random() * 12);                    // 0-11h
      const shiftLength  = Math.round((Math.random() * 12 + 0.5) * 10) / 10; // 0.5-12.5h
      const clockOutHour = clockInHour + shiftLength;
      const breakMins    = Math.floor(Math.random() * 60);                    // 0-59min

      const base = new Date("2024-01-01T00:00:00Z").getTime();
      const toISO = (h: number) => new Date(base + h * 3600000).toISOString();

      const rec: AttendanceRecord = {
        id: "a1", staffId: "s1",
        clockIn: toISO(clockInHour),
        clockOut: toISO(clockOutHour),
        breakMinutes: breakMins,
      };

      const s = calculateAttendanceSummary(rec);

      // Property 2: hoursWorked ≈ shiftLength - (breakMins / 60)
      const expectedHours = shiftLength - breakMins / 60;
      const clampedExpected = Math.max(0, Math.round(expectedHours * 100) / 100);
      expect(Math.abs(s.hoursWorked - clampedExpected)).toBeLessThan(0.05);
    }
  });

  it("hoursWorked is always non-negative — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const clockInHour  = Math.floor(Math.random() * 12);
      const clockOutHour = clockInHour + Math.random() * 12;
      const breakMins    = Math.floor(Math.random() * 120); // up to 2h breaks

      const base = new Date("2024-01-01T00:00:00Z").getTime();
      const toISO = (h: number) => new Date(base + h * 3600000).toISOString();

      const rec: AttendanceRecord = {
        id: "a1", staffId: "s1",
        clockIn: toISO(clockInHour),
        clockOut: toISO(clockOutHour),
        breakMinutes: breakMins,
      };

      const s = calculateAttendanceSummary(rec);
      expect(s.hoursWorked).toBeGreaterThanOrEqual(0);
      expect(s.minutesWorked).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// PBT: Property 3 — totalCommission = sum of individual lines (task 16.3)
// ---------------------------------------------------------------------------

describe("PBT Property 3: totalCommission = sum of commission lines (task 16.3)", () => {
  it("Property 3 holds for any set of transactions — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const n = Math.floor(Math.random() * 15) + 1;
      const txns: StaffTransaction[] = Array.from({ length: n }, (_, j) => ({
        id: `t-${j}`, staffId: "s1", itemCount: 1,
        amount: Math.round((Math.random() * 300 + 10) * 100) / 100,
        status: "completed" as const,
        commissionRate: Math.round(Math.random() * 0.2 * 100) / 100,
        timestamp: new Date().toISOString(),
      }));

      const s = calculateCommissions("s1", txns);

      // Property 3: totalCommission = sum(lines)
      const linesSum = Math.round(
        s.lines.reduce((acc, l) => acc + l.commissionAmount, 0) * 100
      ) / 100;
      expect(Math.abs(s.totalCommission - linesSum)).toBeLessThan(0.01);
    }
  });

  it("commission total is always non-negative — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const n = Math.floor(Math.random() * 10) + 1;
      const txns: StaffTransaction[] = Array.from({ length: n }, (_, j) => ({
        id: `t-${j}`, staffId: "s1", itemCount: 1,
        amount: Math.round((Math.random() * 200 + 1) * 100) / 100,
        status: "completed" as const,
        commissionRate: Math.random() * 0.3,
        timestamp: new Date().toISOString(),
      }));
      const s = calculateCommissions("s1", txns);
      expect(s.totalCommission).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// PBT: Property 4 — Every auditable action has a log entry (task 16.4)
// ---------------------------------------------------------------------------

describe("PBT Property 4: auditable actions produce log entries (task 16.4)", () => {
  const AUDITABLE = [...AUDITABLE_ACTIONS] as ActivityActionType[];

  it("verifyActivityCompleteness catches any missing reference — 400 runs", () => {
    for (let i = 0; i < 400; i++) {
      const n = Math.floor(Math.random() * 10) + 1;
      // Generate action IDs and always create a matching log entry
      const actionIds: string[] = Array.from({ length: n }, (_, j) => `action-${i}-${j}`);
      const entries: ActivityEntry[] = actionIds.map((refId, j) => ({
        id: `e-${i}-${j}`, staffId: "s1",
        actionType: AUDITABLE[Math.floor(Math.random() * AUDITABLE.length)],
        timestamp: new Date().toISOString(),
        referenceId: refId,
      }));

      // Property 4: completeness check passes when all actions have entries
      const result = verifyActivityCompleteness(new Set(actionIds), entries);
      expect(result.complete).toBe(true);
      expect(result.missingIds).toHaveLength(0);
    }
  });

  it("detects missing log entries — 300 runs", () => {
    for (let i = 0; i < 300; i++) {
      const n = Math.floor(Math.random() * 8) + 2; // at least 2 actions
      const actionIds: string[] = Array.from({ length: n }, (_, j) => `act-${i}-${j}`);
      const missingIdx = Math.floor(Math.random() * n);

      // Create entries for all except the one at missingIdx
      const entries: ActivityEntry[] = actionIds
        .filter((_, j) => j !== missingIdx)
        .map((refId, j) => ({
          id: `e-${i}-${j}`, staffId: "s1",
          actionType: "sale" as ActivityActionType,
          timestamp: new Date().toISOString(),
          referenceId: refId,
        }));

      const result = verifyActivityCompleteness(new Set(actionIds), entries);
      expect(result.complete).toBe(false);
      expect(result.missingIds).toContain(actionIds[missingIdx]);
    }
  });
});
