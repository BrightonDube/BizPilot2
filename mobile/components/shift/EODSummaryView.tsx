/**
 * EODSummaryView — End-of-Day reconciliation screen for managers.
 * (shift-management tasks 9.1, 9.4)
 *
 * Displays all shifts for the selected date and terminal, with:
 *   - Total expected vs counted cash
 *   - Per-shift breakdown
 *   - Total variance (colour-coded)
 *   - Export button (CSV)
 *
 * Why a scrollable card layout instead of a table?
 * On tablets, managers review EOD summaries after a long day. Card-based
 * layouts are easier to scan at a glance, with colour coding drawing
 * attention to variances. Tables are denser but harder to read with
 * tired eyes. Cards also work well across tablet and phone widths.
 */

import React, { useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import {
  buildEndOfDaySummary,
  shiftSummaryToCsvRow,
  toCsvString,
  type ClosedShiftRecord,
  type EndOfDaySummary,
  type ShiftSummaryReport,
} from "@/services/shift/ShiftReportService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EODSummaryViewProps {
  /** All closed shifts (the component filters by date + terminal) */
  shifts: ClosedShiftRecord[];
  /** Date to display in YYYY-MM-DD format */
  date: string;
  /** Terminal ID to filter on */
  terminalId: string;
  /**
   * Called when the user taps "Export CSV".
   * Parent handles the file save (Expo FileSystem / Share sheet).
   */
  onExportCsv?: (csvString: string, filename: string) => void;
  /** Additional container styles */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EODSummaryView: React.FC<EODSummaryViewProps> = React.memo(
  function EODSummaryView({ shifts, date, terminalId, onExportCsv, style }) {
    const eod: EndOfDaySummary = useMemo(
      () => buildEndOfDaySummary(shifts, date, terminalId),
      [shifts, date, terminalId]
    );

    const handleExport = useCallback(() => {
      if (!onExportCsv) return;
      const rows = eod.shifts.map(shiftSummaryToCsvRow);
      const csv = toCsvString(rows);
      const filename = `eod-${date}-${terminalId}.csv`;
      onExportCsv(csv, filename);
    }, [eod, date, terminalId, onExportCsv]);

    const varianceColor =
      eod.totalVariance > 0
        ? "#22c55e"
        : eod.totalVariance < 0
        ? "#ef4444"
        : "#9ca3af";

    return (
      <ScrollView
        style={[styles.container, style]}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>End of Day Summary</Text>
            <Text style={styles.headerSubtitle}>
              {date} · Terminal {terminalId}
            </Text>
          </View>
          {onExportCsv && (
            <Pressable
              style={styles.exportButton}
              onPress={handleExport}
              accessibilityLabel="Export EOD report as CSV"
              accessibilityRole="button"
            >
              <Ionicons name="download-outline" size={18} color="#60a5fa" />
              <Text style={styles.exportButtonText}>Export CSV</Text>
            </Pressable>
          )}
        </View>

        {/* Totals cards */}
        <View style={styles.totalsRow}>
          <TotalCard
            label="Shifts"
            value={String(eod.shiftCount)}
            icon="time-outline"
            color="#8b5cf6"
          />
          <TotalCard
            label="Expected"
            value={formatCurrency(eod.totalExpectedCash)}
            icon="calculator-outline"
            color="#3b82f6"
          />
          <TotalCard
            label="Counted"
            value={formatCurrency(eod.totalCountedCash)}
            icon="cash-outline"
            color="#22c55e"
          />
          <TotalCard
            label="Variance"
            value={
              (eod.totalVariance >= 0 ? "+" : "") +
              formatCurrency(eod.totalVariance)
            }
            icon={
              eod.totalVariance === 0
                ? "checkmark-circle-outline"
                : "alert-circle-outline"
            }
            color={varianceColor}
          />
        </View>

        {/* Carry-over info */}
        <View style={styles.carryOverBanner}>
          <Ionicons name="arrow-forward-circle-outline" size={18} color="#60a5fa" />
          <Text style={styles.carryOverText}>
            Carry-over for next day: {formatCurrency(eod.closingBalance)}
          </Text>
        </View>

        {/* Shift list */}
        <Text style={styles.sectionTitle}>Shift Breakdown</Text>
        {eod.shifts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={40} color="#4b5563" />
            <Text style={styles.emptyText}>No closed shifts for this date</Text>
          </View>
        ) : (
          eod.shifts.map((shift) => (
            <ShiftCard key={shift.shiftId} shift={shift} />
          ))
        )}
      </ScrollView>
    );
  }
);

// ---------------------------------------------------------------------------
// TotalCard sub-component
// ---------------------------------------------------------------------------

interface TotalCardProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const TotalCard: React.FC<TotalCardProps> = React.memo(function TotalCard({
  label,
  value,
  icon,
  color,
}) {
  return (
    <View style={totalCardStyles.card}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={totalCardStyles.label}>{label}</Text>
      <Text style={[totalCardStyles.value, { color }]}>{value}</Text>
    </View>
  );
});

const totalCardStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontSize: 11,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 14,
    fontWeight: "700",
  },
});

// ---------------------------------------------------------------------------
// ShiftCard sub-component
// ---------------------------------------------------------------------------

interface ShiftCardProps {
  shift: ShiftSummaryReport;
}

const ShiftCard: React.FC<ShiftCardProps> = React.memo(function ShiftCard({
  shift,
}) {
  const varianceColor =
    shift.variance > 0
      ? "#22c55e"
      : shift.variance < 0
      ? "#ef4444"
      : "#9ca3af";

  const openTime = new Date(shift.openedAt).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const closeTime = new Date(shift.closedAt).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={shiftCardStyles.card}>
      {/* Top row: time range + duration */}
      <View style={shiftCardStyles.topRow}>
        <View style={shiftCardStyles.timeBlock}>
          <Ionicons name="time-outline" size={14} color="#6b7280" />
          <Text style={shiftCardStyles.timeText}>
            {openTime} → {closeTime}
          </Text>
          <Text style={shiftCardStyles.durationText}>
            ({shift.durationMinutes}m)
          </Text>
        </View>
        <Text style={shiftCardStyles.userId}>
          User: {shift.userId.substring(0, 8)}…
        </Text>
      </View>

      {/* Numbers grid */}
      <View style={shiftCardStyles.numbersRow}>
        <NumberCell label="Sales" value={shift.cashSummary.cashSales} color="#22c55e" />
        <NumberCell label="Refunds" value={shift.cashSummary.cashRefunds} color="#ef4444" />
        <NumberCell label="Expected" value={shift.cashSummary.expectedCash} color="#3b82f6" />
        <NumberCell label="Counted" value={shift.closingCash} color="#d1d5db" />
        <NumberCell label="Variance" value={shift.variance} color={varianceColor} signed />
      </View>

      {/* Variance reason */}
      {shift.varianceReason ? (
        <View style={shiftCardStyles.reasonRow}>
          <Ionicons name="chatbox-ellipses-outline" size={14} color="#9ca3af" />
          <Text style={shiftCardStyles.reasonText}>{shift.varianceReason}</Text>
        </View>
      ) : null}
    </View>
  );
});

const NumberCell: React.FC<{
  label: string;
  value: number;
  color: string;
  signed?: boolean;
}> = React.memo(function NumberCell({ label, value, color, signed = false }) {
  const formatted = signed
    ? (value >= 0 ? "+" : "") + formatCurrency(value)
    : formatCurrency(value);
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: "600", color }}>{formatted}</Text>
    </View>
  );
});

const shiftCardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: {
    fontSize: 13,
    color: "#d1d5db",
    fontWeight: "500",
  },
  durationText: {
    fontSize: 12,
    color: "#6b7280",
  },
  userId: {
    fontSize: 12,
    color: "#6b7280",
  },
  numbersRow: {
    flexDirection: "row",
    gap: 4,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 8,
  },
  reasonText: {
    fontSize: 12,
    color: "#9ca3af",
    flex: 1,
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1e3a5f",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  exportButtonText: {
    color: "#60a5fa",
    fontSize: 14,
    fontWeight: "600",
  },

  // Totals
  totalsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },

  // Carry-over
  carryOverBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e3a5f",
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 20,
  },
  carryOverText: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "500",
  },

  // Section
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#d1d5db",
    marginBottom: 12,
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 15,
  },
});

export default EODSummaryView;
