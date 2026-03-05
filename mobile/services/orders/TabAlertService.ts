/**
 * TabAlertService — monitor open tabs and alert when they exceed age thresholds.
 *
 * Task: 11.3 (Alert on old tabs)
 *
 * Requirement 8.6: "THE System SHALL alert on tabs open too long."
 *
 * Why a dedicated service?
 * Tab alerts are polled on a timer (e.g., every 60 seconds) by the POS
 * dashboard. Keeping the logic in a pure service means the polling interval
 * and alert display are owned by the UI layer, while the threshold math
 * lives here, fully testable without timers.
 *
 * Why pure functions with `now` injection?
 * Date.now() is a side effect that makes tests flaky. Injecting `now`
 * lets tests verify exact thresholds without sleeping or mocking globals.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpenTab {
  tabId: string;
  /** Customer name or table reference */
  label: string;
  /** ISO 8601 timestamp when the tab was opened */
  openedAt: string;
  /** Running total (ZAR) */
  currentTotal: number;
  /** Number of items on the tab */
  itemCount: number;
}

export type TabAlertSeverity = "warning" | "critical";

export interface TabAlert {
  tabId: string;
  label: string;
  severity: TabAlertSeverity;
  /** Age in minutes */
  ageMinutes: number;
  currentTotal: number;
  message: string;
}

export interface TabAlertThresholds {
  /** Minutes after which a warning is raised (default: 120 = 2 hours) */
  warningMinutes: number;
  /** Minutes after which a critical alert is raised (default: 240 = 4 hours) */
  criticalMinutes: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Default thresholds.
 *
 * Why 2 hours / 4 hours?
 * Most restaurant tabs are closed within 90 minutes. A 2-hour tab
 * is unusual and worth flagging. A 4-hour tab likely means the
 * customer left without paying, which is a loss-prevention issue.
 */
export const DEFAULT_TAB_THRESHOLDS: TabAlertThresholds = {
  warningMinutes: 120,
  criticalMinutes: 240,
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Calculate the age of a tab in minutes.
 */
export function getTabAgeMinutes(openedAt: string, now: Date): number {
  const opened = new Date(openedAt).getTime();
  const current = now.getTime();
  return Math.floor((current - opened) / 60000);
}

/**
 * Evaluate all open tabs and return those exceeding alert thresholds.
 *
 * @param tabs       - Currently open tabs
 * @param now        - Current time (injected for testability)
 * @param thresholds - Warning/critical thresholds
 */
export function evaluateTabAlerts(
  tabs: OpenTab[],
  now: Date,
  thresholds: TabAlertThresholds = DEFAULT_TAB_THRESHOLDS
): TabAlert[] {
  const alerts: TabAlert[] = [];

  for (const tab of tabs) {
    const ageMinutes = getTabAgeMinutes(tab.openedAt, now);

    if (ageMinutes >= thresholds.criticalMinutes) {
      alerts.push({
        tabId: tab.tabId,
        label: tab.label,
        severity: "critical",
        ageMinutes,
        currentTotal: tab.currentTotal,
        message: `Tab "${tab.label}" has been open for ${formatDuration(ageMinutes)} (R ${tab.currentTotal.toFixed(2)})`,
      });
    } else if (ageMinutes >= thresholds.warningMinutes) {
      alerts.push({
        tabId: tab.tabId,
        label: tab.label,
        severity: "warning",
        ageMinutes,
        currentTotal: tab.currentTotal,
        message: `Tab "${tab.label}" has been open for ${formatDuration(ageMinutes)} (R ${tab.currentTotal.toFixed(2)})`,
      });
    }
  }

  // Sort by age descending so the oldest tab appears first
  alerts.sort((a, b) => b.ageMinutes - a.ageMinutes);

  return alerts;
}

/**
 * Get a summary of open tab health for dashboard display.
 */
export function getTabAlertSummary(
  tabs: OpenTab[],
  now: Date,
  thresholds: TabAlertThresholds = DEFAULT_TAB_THRESHOLDS
): {
  totalOpen: number;
  warningCount: number;
  criticalCount: number;
  oldestTabMinutes: number;
  totalOutstanding: number;
} {
  let warningCount = 0;
  let criticalCount = 0;
  let oldestTabMinutes = 0;
  let totalOutstanding = 0;

  for (const tab of tabs) {
    const ageMinutes = getTabAgeMinutes(tab.openedAt, now);
    totalOutstanding += tab.currentTotal;

    if (ageMinutes > oldestTabMinutes) {
      oldestTabMinutes = ageMinutes;
    }

    if (ageMinutes >= thresholds.criticalMinutes) {
      criticalCount++;
    } else if (ageMinutes >= thresholds.warningMinutes) {
      warningCount++;
    }
  }

  return {
    totalOpen: tabs.length,
    warningCount,
    criticalCount,
    oldestTabMinutes,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
  };
}

/**
 * Format a duration in minutes to a human-readable string.
 * e.g., 135 → "2h 15m", 45 → "45m"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
