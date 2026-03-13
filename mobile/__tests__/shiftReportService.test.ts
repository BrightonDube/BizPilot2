/**
 * Tests for ShiftReportService — EOD, operator reports, variance, float management, multi-user.
 * (shift-management tasks 8.2-8.3, 9.1-9.4, 10.1-10.4, 11.1-11.2)
 *
 * Tests are organized by task group:
 *   - Float carry-over & alerts (8.2, 8.3)
 *   - Shift summary report (10.1)
 *   - Operator reports (10.2)
 *   - Variance reports (10.3)
 *   - EOD summary (9.1-9.3)
 *   - CSV export (10.4)
 *   - User switching (11.1)
 *   - Per-user activity (11.2)
 */

import {
  buildShiftSummary,
  buildOperatorReports,
  buildVarianceReport,
  buildEndOfDaySummary,
  getRecommendedFloat,
  checkFloatAlerts,
  createUserSwitchEvent,
  aggregateUserActivity,
  shiftSummaryToCsvRow,
  toCsvString,
  type ClosedShiftRecord,
} from "@/services/shift/ShiftReportService";

import type { ShiftCashEvent } from "@/services/shift/ShiftService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeShift = (overrides: Partial<ClosedShiftRecord> = {}): ClosedShiftRecord => ({
  id: `shift-${Math.random().toString(36).substring(7)}`,
  terminalId: "terminal-1",
  userId: "user-1",
  status: "closed",
  openedAt: "2025-06-15T08:00:00.000Z",
  closedAt: "2025-06-15T16:00:00.000Z",
  openingFloat: 500,
  closingCash: 750,
  cashEvents: [
    { type: "sale", amount: 300, timestamp: "2025-06-15T10:00:00.000Z" },
    { type: "refund", amount: 50, timestamp: "2025-06-15T14:00:00.000Z" },
  ],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Task 10.1: Shift summary report
// ---------------------------------------------------------------------------

describe("buildShiftSummary (Task 10.1)", () => {
  it("calculates expected cash and variance correctly", () => {
    const shift = makeShift({
      openingFloat: 500,
      closingCash: 750,
      cashEvents: [
        { type: "sale", amount: 300, timestamp: "2025-06-15T10:00:00.000Z" },
        { type: "refund", amount: 50, timestamp: "2025-06-15T14:00:00.000Z" },
      ],
    });
    const summary = buildShiftSummary(shift);
    // Expected = 500 + 300 - 50 = 750
    expect(summary.cashSummary.expectedCash).toBe(750);
    expect(summary.variance).toBe(0);
  });

  it("computes positive variance (over)", () => {
    const shift = makeShift({ closingCash: 800 });
    const summary = buildShiftSummary(shift);
    expect(summary.variance).toBe(50); // 800 - 750
  });

  it("computes negative variance (short)", () => {
    const shift = makeShift({ closingCash: 700 });
    const summary = buildShiftSummary(shift);
    expect(summary.variance).toBe(-50); // 700 - 750
  });

  it("computes duration in minutes", () => {
    const shift = makeShift({
      openedAt: "2025-06-15T08:00:00.000Z",
      closedAt: "2025-06-15T16:30:00.000Z",
    });
    const summary = buildShiftSummary(shift);
    expect(summary.durationMinutes).toBe(510); // 8.5 hours
  });

  it("handles zero events", () => {
    const shift = makeShift({ cashEvents: [], closingCash: 500 });
    const summary = buildShiftSummary(shift);
    expect(summary.cashSummary.expectedCash).toBe(500);
    expect(summary.variance).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Task 10.2: Operator reports
// ---------------------------------------------------------------------------

describe("buildOperatorReports (Task 10.2)", () => {
  it("aggregates by unique userId", () => {
    const shifts: ClosedShiftRecord[] = [
      makeShift({ userId: "alice" }),
      makeShift({ userId: "alice" }),
      makeShift({ userId: "bob" }),
    ];
    const reports = buildOperatorReports(shifts);
    expect(reports).toHaveLength(2);
    const alice = reports.find((r) => r.userId === "alice");
    expect(alice?.shiftCount).toBe(2);
  });

  it("sums sales and refunds across shifts", () => {
    const shifts: ClosedShiftRecord[] = [
      makeShift({
        userId: "alice",
        cashEvents: [{ type: "sale", amount: 200, timestamp: "" }],
      }),
      makeShift({
        userId: "alice",
        cashEvents: [{ type: "sale", amount: 300, timestamp: "" }],
      }),
    ];
    const alice = buildOperatorReports(shifts).find((r) => r.userId === "alice");
    expect(alice?.totalSales).toBe(500);
  });

  it("computes average variance", () => {
    const shifts: ClosedShiftRecord[] = [
      makeShift({ userId: "alice", closingCash: 760 }), // +10
      makeShift({ userId: "alice", closingCash: 740 }), // -10
    ];
    const alice = buildOperatorReports(shifts).find((r) => r.userId === "alice");
    expect(alice?.averageVariance).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Task 10.3: Variance reports
// ---------------------------------------------------------------------------

describe("buildVarianceReport (Task 10.3)", () => {
  it("flags shifts with variance above threshold", () => {
    const shifts: ClosedShiftRecord[] = [
      makeShift({ closingCash: 850 }), // +100 variance
      makeShift({ closingCash: 750 }), // 0 variance
    ];
    const reports = buildVarianceReport(shifts, 50);
    const flagged = reports.filter((r) => r.flagged);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].variance).toBe(100);
  });

  it("does not flag shifts within threshold", () => {
    const shifts: ClosedShiftRecord[] = [
      makeShift({ closingCash: 760 }), // +10 variance
    ];
    const reports = buildVarianceReport(shifts, 50);
    expect(reports[0].flagged).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tasks 9.1-9.3: EOD summary
// ---------------------------------------------------------------------------

describe("buildEndOfDaySummary (Tasks 9.1-9.3)", () => {
  it("filters by date and terminal", () => {
    const shifts: ClosedShiftRecord[] = [
      makeShift({ terminalId: "t1", closedAt: "2025-06-15T16:00:00.000Z" }),
      makeShift({ terminalId: "t2", closedAt: "2025-06-15T16:00:00.000Z" }),
      makeShift({ terminalId: "t1", closedAt: "2025-06-16T16:00:00.000Z" }),
    ];
    const eod = buildEndOfDaySummary(shifts, "2025-06-15", "t1");
    expect(eod.shiftCount).toBe(1);
  });

  it("aggregates total expected and counted cash", () => {
    const shifts: ClosedShiftRecord[] = [
      makeShift({ closingCash: 700 }),
      makeShift({ closingCash: 800 }),
    ];
    const eod = buildEndOfDaySummary(shifts, "2025-06-15", "terminal-1");
    expect(eod.totalCountedCash).toBe(1500);
    expect(eod.totalVariance).toBe(eod.totalCountedCash - eod.totalExpectedCash);
  });

  it("sets closingBalance from the last shift", () => {
    const shifts: ClosedShiftRecord[] = [
      makeShift({ closedAt: "2025-06-15T12:00:00.000Z", closingCash: 600 }),
      makeShift({ closedAt: "2025-06-15T20:00:00.000Z", closingCash: 900 }),
    ];
    const eod = buildEndOfDaySummary(shifts, "2025-06-15", "terminal-1");
    expect(eod.closingBalance).toBe(900); // Last chronological shift
  });

  it("returns 0 closingBalance when no shifts", () => {
    const eod = buildEndOfDaySummary([], "2025-06-15", "terminal-1");
    expect(eod.closingBalance).toBe(0);
    expect(eod.shiftCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Task 8.2: Float carry-over
// ---------------------------------------------------------------------------

describe("getRecommendedFloat (Task 8.2)", () => {
  it("uses lastClosingCash when carry-over is enabled", () => {
    expect(getRecommendedFloat(750, 500, true)).toBe(750);
  });

  it("uses default float when carry-over is disabled", () => {
    expect(getRecommendedFloat(750, 500, false)).toBe(500);
  });

  it("falls back to default if lastClosingCash is null", () => {
    expect(getRecommendedFloat(null, 500, true)).toBe(500);
  });

  it("falls back to default if lastClosingCash is 0", () => {
    expect(getRecommendedFloat(0, 500, true)).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Task 8.3: Float alerts
// ---------------------------------------------------------------------------

describe("checkFloatAlerts (Task 8.3)", () => {
  it("alerts when float is below minimum", () => {
    const alerts = checkFloatAlerts(100, 200, 2000);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("below_minimum");
  });

  it("alerts when float exceeds maximum", () => {
    const alerts = checkFloatAlerts(3000, 200, 2000);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("above_maximum");
  });

  it("alerts on carry-over mismatch", () => {
    const alerts = checkFloatAlerts(600, 200, 2000, 750, true);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("carry_over_mismatch");
  });

  it("returns empty when float is within bounds", () => {
    const alerts = checkFloatAlerts(500, 200, 2000);
    expect(alerts).toHaveLength(0);
  });

  it("can return multiple alerts", () => {
    const alerts = checkFloatAlerts(100, 200, 2000, 500, true);
    // Below minimum + carry-over mismatch
    expect(alerts.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Task 11.1: User switching
// ---------------------------------------------------------------------------

describe("createUserSwitchEvent (Task 11.1)", () => {
  it("creates a valid switch event", () => {
    const event = createUserSwitchEvent("alice", "bob", true);
    expect(event.fromUserId).toBe("alice");
    expect(event.toUserId).toBe("bob");
    expect(event.verified).toBe(true);
    expect(event.timestamp).toBeTruthy();
  });

  it("throws when switching to same user", () => {
    expect(() => createUserSwitchEvent("alice", "alice", true)).toThrow(
      "Cannot switch to the same user"
    );
  });

  it("throws when PIN is not verified", () => {
    expect(() => createUserSwitchEvent("alice", "bob", false)).toThrow(
      "PIN verification required"
    );
  });
});

// ---------------------------------------------------------------------------
// Task 11.2: Per-user activity
// ---------------------------------------------------------------------------

describe("aggregateUserActivity (Task 11.2)", () => {
  it("aggregates sales and refunds per user", () => {
    const events = [
      { type: "sale" as const, amount: 100, timestamp: "", userId: "alice" },
      { type: "sale" as const, amount: 200, timestamp: "", userId: "alice" },
      { type: "refund" as const, amount: 50, timestamp: "", userId: "alice" },
      { type: "sale" as const, amount: 150, timestamp: "", userId: "bob" },
    ];
    const result = aggregateUserActivity(events, []);
    const alice = result.find((a) => a.userId === "alice");
    const bob = result.find((a) => a.userId === "bob");
    expect(alice?.salesCount).toBe(2);
    expect(alice?.salesTotal).toBe(300);
    expect(alice?.refundsCount).toBe(1);
    expect(alice?.refundsTotal).toBe(50);
    expect(bob?.salesCount).toBe(1);
    expect(bob?.salesTotal).toBe(150);
  });

  it("ignores non-sale/refund events", () => {
    const events = [
      { type: "drop" as const, amount: 100, timestamp: "", userId: "alice" },
      { type: "paidout" as const, amount: 50, timestamp: "", userId: "alice" },
    ];
    const result = aggregateUserActivity(events, []);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Task 10.4: CSV export
// ---------------------------------------------------------------------------

describe("toCsvString (Task 10.4)", () => {
  it("returns empty string for no rows", () => {
    expect(toCsvString([])).toBe("");
  });

  it("generates correct CSV headers and values", () => {
    const rows = [
      { name: "Alice", sales: 500 },
      { name: "Bob", sales: 300 },
    ];
    const csv = toCsvString(rows);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("name,sales");
    expect(lines[1]).toBe("Alice,500");
    expect(lines[2]).toBe("Bob,300");
  });

  it("quotes values containing commas", () => {
    const rows = [{ note: "Hello, world", value: 1 }];
    const csv = toCsvString(rows);
    expect(csv).toContain('"Hello, world"');
  });
});

describe("shiftSummaryToCsvRow (Task 10.4)", () => {
  it("converts summary to flat record", () => {
    const shift = makeShift();
    const summary = buildShiftSummary(shift);
    const row = shiftSummaryToCsvRow(summary);
    expect(row).toHaveProperty("shift_id");
    expect(row).toHaveProperty("cash_sales");
    expect(row).toHaveProperty("variance");
    expect(typeof row.cash_sales).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests (random-loop PBTs)
// ---------------------------------------------------------------------------

describe("PBT: EOD total variance = sum of individual variances", () => {
  it("holds for 50 random shift sets", () => {
    for (let i = 0; i < 50; i++) {
      const shiftCount = 1 + Math.floor(Math.random() * 5);
      const shifts: ClosedShiftRecord[] = [];

      for (let j = 0; j < shiftCount; j++) {
        const float = Math.round(Math.random() * 1000 * 100) / 100;
        const sales = Math.round(Math.random() * 500 * 100) / 100;
        const counted = Math.round((float + sales + (Math.random() * 100 - 50)) * 100) / 100;

        shifts.push(
          makeShift({
            id: `shift-${i}-${j}`,
            openingFloat: float,
            closingCash: counted,
            cashEvents: [{ type: "sale", amount: sales, timestamp: "" }],
          })
        );
      }

      const eod = buildEndOfDaySummary(shifts, "2025-06-15", "terminal-1");
      const sumIndividual = eod.shifts.reduce((s, sh) => s + sh.variance, 0);
      const rounded = Math.round(sumIndividual * 100) / 100;

      // Total variance should equal sum of individual variances (within rounding)
      expect(Math.abs(eod.totalVariance - rounded)).toBeLessThanOrEqual(0.02);
    }
  });
});
