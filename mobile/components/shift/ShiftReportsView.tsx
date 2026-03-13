/**
 * ShiftReportsView — tabbed view for shift reports.
 * (shift-management tasks 10.1, 10.2, 10.3, 10.4)
 *
 * Tabs:
 *   1. Summary   — all shifts with key metrics (Task 10.1)
 *   2. Operators — aggregated per-operator stats (Task 10.2)
 *   3. Variances — flagged variance list (Task 10.3)
 *
 * Task 10.4 (export) is handled by the onExport callback — the parent
 * component decides whether to use Expo FileSystem, Share sheet, etc.
 *
 * Why tabs instead of a single scrollable report?
 * Managers ask different questions at different times. The summary tab
 * answers "what happened today?" The operator tab answers "who performed
 * best/worst?" The variance tab answers "where is the money missing?"
 * Tabs let the manager jump directly to their question.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  FlatList,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import {
  buildShiftSummary,
  buildOperatorReports,
  buildVarianceReport,
  shiftSummaryToCsvRow,
  toCsvString,
  type ClosedShiftRecord,
  type ShiftSummaryReport,
  type OperatorReport,
  type VarianceReport,
} from "@/services/shift/ShiftReportService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportTab = "summary" | "operators" | "variances";

export interface ShiftReportsViewProps {
  /** All closed shifts to report on */
  shifts: ClosedShiftRecord[];
  /** Variance threshold for flagging (default: R50) */
  varianceThreshold?: number;
  /** Called when user taps Export. Parent handles file I/O. */
  onExport?: (csvString: string, filename: string) => void;
  /** Optional container style */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Tab configuration
// ---------------------------------------------------------------------------

interface TabMeta {
  key: ReportTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TABS: TabMeta[] = [
  { key: "summary", label: "Summary", icon: "list-outline" },
  { key: "operators", label: "Operators", icon: "people-outline" },
  { key: "variances", label: "Variances", icon: "alert-circle-outline" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ShiftReportsView: React.FC<ShiftReportsViewProps> = React.memo(
  function ShiftReportsView({
    shifts,
    varianceThreshold = 50,
    onExport,
    style,
  }) {
    const [activeTab, setActiveTab] = useState<ReportTab>("summary");

    // Pre-compute all report data (memoized — only recalculates when shifts change)
    const summaries = useMemo(
      () => shifts.map(buildShiftSummary),
      [shifts]
    );

    const operatorReports = useMemo(
      () => buildOperatorReports(shifts),
      [shifts]
    );

    const varianceReports = useMemo(
      () => buildVarianceReport(shifts, varianceThreshold),
      [shifts, varianceThreshold]
    );

    const flaggedCount = useMemo(
      () => varianceReports.filter((v) => v.flagged).length,
      [varianceReports]
    );

    const handleExport = useCallback(() => {
      if (!onExport) return;
      const rows = summaries.map(shiftSummaryToCsvRow);
      const csv = toCsvString(rows);
      onExport(csv, `shift-report-${Date.now()}.csv`);
    }, [summaries, onExport]);

    return (
      <View style={[styles.container, style]}>
        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && styles.tabActive,
              ]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityLabel={`${tab.label} tab`}
              accessibilityRole="tab"
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={activeTab === tab.key ? "#3b82f6" : "#6b7280"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
              {/* Badge on variances tab */}
              {tab.key === "variances" && flaggedCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{flaggedCount}</Text>
                </View>
              )}
            </Pressable>
          ))}

          {/* Export button */}
          {onExport && (
            <Pressable
              style={styles.exportBtn}
              onPress={handleExport}
              accessibilityLabel="Export report CSV"
            >
              <Ionicons name="download-outline" size={18} color="#60a5fa" />
            </Pressable>
          )}
        </View>

        {/* Tab content */}
        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === "summary" && (
            <SummaryTab summaries={summaries} />
          )}
          {activeTab === "operators" && (
            <OperatorsTab reports={operatorReports} />
          )}
          {activeTab === "variances" && (
            <VariancesTab reports={varianceReports} threshold={varianceThreshold} />
          )}
        </ScrollView>
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Summary Tab (Task 10.1)
// ---------------------------------------------------------------------------

const SummaryTab: React.FC<{ summaries: ShiftSummaryReport[] }> = React.memo(
  function SummaryTab({ summaries }) {
    if (summaries.length === 0) {
      return <EmptyState message="No shifts to summarize" />;
    }

    return (
      <View style={tabStyles.container}>
        {summaries.map((s) => {
          const vColor =
            s.variance > 0 ? "#22c55e" : s.variance < 0 ? "#ef4444" : "#9ca3af";
          return (
            <View key={s.shiftId} style={tabStyles.row}>
              <View style={tabStyles.rowLeft}>
                <Text style={tabStyles.rowTitle}>
                  {new Date(s.openedAt).toLocaleTimeString("en-ZA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  →{" "}
                  {new Date(s.closedAt).toLocaleTimeString("en-ZA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <Text style={tabStyles.rowSubtitle}>
                  {s.durationMinutes}m · User {s.userId.substring(0, 8)}
                </Text>
              </View>
              <View style={tabStyles.rowRight}>
                <Text style={tabStyles.salesText}>
                  Sales {formatCurrency(s.cashSummary.cashSales)}
                </Text>
                <Text style={[tabStyles.varianceText, { color: vColor }]}>
                  {s.variance >= 0 ? "+" : ""}
                  {formatCurrency(s.variance)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Operators Tab (Task 10.2)
// ---------------------------------------------------------------------------

const OperatorsTab: React.FC<{ reports: OperatorReport[] }> = React.memo(
  function OperatorsTab({ reports }) {
    if (reports.length === 0) {
      return <EmptyState message="No operator data" />;
    }

    return (
      <View style={tabStyles.container}>
        {/* Table header */}
        <View style={opStyles.headerRow}>
          <Text style={[opStyles.cell, opStyles.headerText, { flex: 2 }]}>
            Operator
          </Text>
          <Text style={[opStyles.cell, opStyles.headerText]}>Shifts</Text>
          <Text style={[opStyles.cell, opStyles.headerText]}>Sales</Text>
          <Text style={[opStyles.cell, opStyles.headerText]}>Refunds</Text>
          <Text style={[opStyles.cell, opStyles.headerText]}>Avg Var.</Text>
          <Text style={[opStyles.cell, opStyles.headerText]}>Hours</Text>
        </View>

        {reports.map((r) => {
          const vColor =
            r.averageVariance > 0
              ? "#22c55e"
              : r.averageVariance < 0
              ? "#ef4444"
              : "#9ca3af";
          return (
            <View key={r.userId} style={opStyles.row}>
              <Text style={[opStyles.cell, { flex: 2, color: "#d1d5db" }]}>
                {r.userId.substring(0, 10)}
              </Text>
              <Text style={opStyles.cell}>{r.shiftCount}</Text>
              <Text style={[opStyles.cell, { color: "#22c55e" }]}>
                {formatCurrency(r.totalSales)}
              </Text>
              <Text style={[opStyles.cell, { color: "#ef4444" }]}>
                {formatCurrency(r.totalRefunds)}
              </Text>
              <Text style={[opStyles.cell, { color: vColor }]}>
                {r.averageVariance >= 0 ? "+" : ""}
                {formatCurrency(r.averageVariance)}
              </Text>
              <Text style={opStyles.cell}>
                {r.totalHoursWorked.toFixed(1)}h
              </Text>
            </View>
          );
        })}
      </View>
    );
  }
);

const opStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  cell: {
    flex: 1,
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
  },
  headerText: {
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    fontSize: 11,
    letterSpacing: 0.5,
  },
});

// ---------------------------------------------------------------------------
// Variances Tab (Task 10.3)
// ---------------------------------------------------------------------------

const VariancesTab: React.FC<{
  reports: VarianceReport[];
  threshold: number;
}> = React.memo(function VariancesTab({ reports, threshold }) {
  if (reports.length === 0) {
    return <EmptyState message="No variance data" />;
  }

  return (
    <View style={tabStyles.container}>
      {reports.map((r) => {
        const vColor =
          r.variance > 0 ? "#22c55e" : r.variance < 0 ? "#ef4444" : "#9ca3af";

        return (
          <View
            key={r.shiftId}
            style={[
              varStyles.card,
              r.flagged && varStyles.cardFlagged,
            ]}
          >
            <View style={varStyles.topRow}>
              <Text style={varStyles.timeText}>
                {new Date(r.closedAt).toLocaleTimeString("en-ZA", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              <Text style={varStyles.userId}>
                User {r.userId.substring(0, 8)}
              </Text>
              {r.flagged && (
                <View style={varStyles.flagBadge}>
                  <Ionicons name="flag" size={12} color="#fbbf24" />
                  <Text style={varStyles.flagText}>Flagged</Text>
                </View>
              )}
            </View>

            <View style={varStyles.numbersRow}>
              <View style={varStyles.numberCell}>
                <Text style={varStyles.numberLabel}>Expected</Text>
                <Text style={varStyles.numberValue}>
                  {formatCurrency(r.expectedCash)}
                </Text>
              </View>
              <View style={varStyles.numberCell}>
                <Text style={varStyles.numberLabel}>Counted</Text>
                <Text style={varStyles.numberValue}>
                  {formatCurrency(r.countedCash)}
                </Text>
              </View>
              <View style={varStyles.numberCell}>
                <Text style={varStyles.numberLabel}>Variance</Text>
                <Text style={[varStyles.numberValue, { color: vColor, fontWeight: "700" }]}>
                  {r.variance >= 0 ? "+" : ""}
                  {formatCurrency(r.variance)}
                </Text>
              </View>
            </View>

            {r.varianceReason ? (
              <Text style={varStyles.reason}>"{r.varianceReason}"</Text>
            ) : r.flagged ? (
              <Text style={varStyles.noReason}>⚠ No reason provided</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
});

const varStyles = StyleSheet.create({
  card: {
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  cardFlagged: {
    borderLeftWidth: 3,
    borderLeftColor: "#fbbf24",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeText: {
    fontSize: 14,
    color: "#d1d5db",
    fontWeight: "600",
  },
  userId: {
    fontSize: 12,
    color: "#6b7280",
    flex: 1,
  },
  flagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#78350f",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  flagText: {
    color: "#fde68a",
    fontSize: 11,
    fontWeight: "600",
  },
  numbersRow: {
    flexDirection: "row",
    gap: 8,
  },
  numberCell: {
    flex: 1,
    alignItems: "center",
  },
  numberLabel: {
    fontSize: 10,
    color: "#6b7280",
    textTransform: "uppercase",
  },
  numberValue: {
    fontSize: 14,
    color: "#d1d5db",
    fontWeight: "500",
  },
  reason: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  noReason: {
    fontSize: 12,
    color: "#fbbf24",
  },
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const EmptyState: React.FC<{ message: string }> = React.memo(function EmptyState({
  message,
}) {
  return (
    <View style={emptyStyles.container}>
      <Ionicons name="folder-open-outline" size={36} color="#4b5563" />
      <Text style={emptyStyles.text}>{message}</Text>
    </View>
  );
});

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  text: {
    color: "#6b7280",
    fontSize: 15,
  },
});

// ---------------------------------------------------------------------------
// Shared tab content styles
// ---------------------------------------------------------------------------

const tabStyles = StyleSheet.create({
  container: {
    gap: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  rowLeft: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    color: "#d1d5db",
    fontWeight: "600",
  },
  rowSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  rowRight: {
    alignItems: "flex-end",
  },
  salesText: {
    fontSize: 13,
    color: "#22c55e",
    fontWeight: "500",
  },
  varianceText: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
});

// ---------------------------------------------------------------------------
// Container styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    alignItems: "center",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: "#1e3a5f",
  },
  tabText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#3b82f6",
    fontWeight: "700",
  },
  badge: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  exportBtn: {
    marginLeft: "auto",
    padding: 10,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
});

export default ShiftReportsView;
