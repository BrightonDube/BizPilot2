/**
 * Tests for TabAlertService — task 11.3.
 *
 * Coverage:
 * - Tab age calculation
 * - Alert evaluation with warning and critical thresholds
 * - Custom thresholds
 * - Alert sorting by age
 * - Tab alert summary for dashboard
 * - Duration formatting
 */

import {
  getTabAgeMinutes,
  evaluateTabAlerts,
  getTabAlertSummary,
  formatDuration,
  OpenTab,
  DEFAULT_TAB_THRESHOLDS,
} from "../services/orders/TabAlertService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTab(overrides: Partial<OpenTab> = {}): OpenTab {
  return {
    tabId: "tab-1",
    label: "Table 5",
    openedAt: "2024-01-15T12:00:00Z",
    currentTotal: 350.0,
    itemCount: 4,
    ...overrides,
  };
}

const NOW = new Date("2024-01-15T14:30:00Z"); // 2.5 hours after noon

// ---------------------------------------------------------------------------
// getTabAgeMinutes
// ---------------------------------------------------------------------------

describe("getTabAgeMinutes", () => {
  it("calculates age correctly", () => {
    // 2024-01-15T12:00 to 2024-01-15T14:30 = 150 minutes
    expect(getTabAgeMinutes("2024-01-15T12:00:00Z", NOW)).toBe(150);
  });

  it("returns 0 for just-opened tab", () => {
    expect(
      getTabAgeMinutes("2024-01-15T14:30:00Z", NOW)
    ).toBe(0);
  });

  it("handles tabs opened earlier in the day", () => {
    expect(getTabAgeMinutes("2024-01-15T09:00:00Z", NOW)).toBe(330); // 5.5 hours
  });
});

// ---------------------------------------------------------------------------
// evaluateTabAlerts
// ---------------------------------------------------------------------------

describe("evaluateTabAlerts", () => {
  it("returns empty for young tabs", () => {
    const tabs = [makeTab({ openedAt: "2024-01-15T14:00:00Z" })]; // 30 min old
    const alerts = evaluateTabAlerts(tabs, NOW);
    expect(alerts).toHaveLength(0);
  });

  it("returns warning for tabs exceeding warning threshold", () => {
    // 150 minutes old, warning at 120
    const tabs = [makeTab()];
    const alerts = evaluateTabAlerts(tabs, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("warning");
    expect(alerts[0].ageMinutes).toBe(150);
  });

  it("returns critical for tabs exceeding critical threshold", () => {
    // 330 minutes old (5.5 hours), critical at 240
    const tabs = [makeTab({ openedAt: "2024-01-15T09:00:00Z" })];
    const alerts = evaluateTabAlerts(tabs, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("critical");
  });

  it("sorts alerts by age descending", () => {
    const tabs = [
      makeTab({ tabId: "t1", openedAt: "2024-01-15T13:00:00Z", label: "90min" }), // 90 min - no alert
      makeTab({ tabId: "t2", openedAt: "2024-01-15T12:00:00Z", label: "150min" }), // 150 min - warning
      makeTab({ tabId: "t3", openedAt: "2024-01-15T09:00:00Z", label: "330min" }), // 330 min - critical
    ];
    const alerts = evaluateTabAlerts(tabs, NOW);
    expect(alerts).toHaveLength(2);
    expect(alerts[0].tabId).toBe("t3"); // oldest first
    expect(alerts[1].tabId).toBe("t2");
  });

  it("supports custom thresholds", () => {
    const tabs = [makeTab({ openedAt: "2024-01-15T14:00:00Z" })]; // 30 min old
    const alerts = evaluateTabAlerts(tabs, NOW, {
      warningMinutes: 20,
      criticalMinutes: 60,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("warning");
  });

  it("includes tab total in message", () => {
    const tabs = [makeTab({ currentTotal: 450.5 })];
    const alerts = evaluateTabAlerts(tabs, NOW);
    expect(alerts[0].message).toContain("R 450.50");
  });

  it("includes tab label in message", () => {
    const tabs = [makeTab({ label: "John Smith" })];
    const alerts = evaluateTabAlerts(tabs, NOW);
    expect(alerts[0].message).toContain("John Smith");
  });
});

// ---------------------------------------------------------------------------
// getTabAlertSummary
// ---------------------------------------------------------------------------

describe("getTabAlertSummary", () => {
  it("returns correct summary counts", () => {
    const tabs = [
      makeTab({ tabId: "t1", openedAt: "2024-01-15T14:00:00Z", currentTotal: 100 }), // 30 min - ok
      makeTab({ tabId: "t2", openedAt: "2024-01-15T12:00:00Z", currentTotal: 200 }), // 150 min - warning
      makeTab({ tabId: "t3", openedAt: "2024-01-15T09:00:00Z", currentTotal: 300 }), // 330 min - critical
    ];

    const summary = getTabAlertSummary(tabs, NOW);
    expect(summary.totalOpen).toBe(3);
    expect(summary.warningCount).toBe(1);
    expect(summary.criticalCount).toBe(1);
    expect(summary.oldestTabMinutes).toBe(330);
    expect(summary.totalOutstanding).toBe(600);
  });

  it("returns zeros for no tabs", () => {
    const summary = getTabAlertSummary([], NOW);
    expect(summary.totalOpen).toBe(0);
    expect(summary.warningCount).toBe(0);
    expect(summary.criticalCount).toBe(0);
    expect(summary.oldestTabMinutes).toBe(0);
    expect(summary.totalOutstanding).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe("formatDuration", () => {
  it("formats minutes-only", () => {
    expect(formatDuration(45)).toBe("45m");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(135)).toBe("2h 15m");
  });

  it("formats exact hours", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats zero", () => {
    expect(formatDuration(0)).toBe("0m");
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_TAB_THRESHOLDS
// ---------------------------------------------------------------------------

describe("DEFAULT_TAB_THRESHOLDS", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_TAB_THRESHOLDS.warningMinutes).toBe(120);
    expect(DEFAULT_TAB_THRESHOLDS.criticalMinutes).toBe(240);
  });
});
