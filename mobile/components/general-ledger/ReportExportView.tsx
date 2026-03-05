/**
 * ReportExportView — Export view for general-ledger reports.
 *
 * Renders a period selector, report-generation buttons, and a FlatList of
 * previously generated reports with PDF / Excel export actions.
 *
 * Why separate generate buttons per report type instead of a single dropdown?
 * In a mobile POS context, each report type is a distinct mental model for the
 * user. Dedicated buttons give immediate affordance and let the operator
 * trigger the exact report without extra taps through a dropdown.
 *
 * Why FlatList instead of ScrollView for the report list?
 * Businesses that run many reports accumulate a long list quickly. FlatList
 * virtualises rows so only visible items are mounted, keeping memory usage
 * constant regardless of list size.
 *
 * Why React.memo?  The parent screen re-renders on every poll interval while
 * reports generate; memo avoids repaint when props haven't changed.
 */

import React, { memo, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { formatCurrency } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LedgerReport {
  id: string;
  name: string;
  type: "trial_balance" | "income_statement" | "balance_sheet" | "journal";
  period: string;
  generatedAt: string;
  status: "ready" | "generating" | "error";
}

interface ReportExportViewProps {
  reports: LedgerReport[];
  onGenerateReport: (type: string) => void;
  onExportPDF: (reportId: string) => void;
  onExportExcel: (reportId: string) => void;
  onViewReport: (reportId: string) => void;
  isGenerating?: boolean;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const COLORS = {
  bg: "#0f172a",
  card: "#1f2937",
  input: "#111827",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#fbbf24",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  grey: "#6b7280",
  border: "#374151",
} as const;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Available period filter options. */
const PERIODS = ["Month", "Quarter", "Year", "Custom"] as const;

/** Report generation buttons with associated metadata. */
const REPORT_TYPES: {
  type: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
}[] = [
  { type: "trial_balance", label: "Trial Balance", icon: "scale-outline", color: COLORS.blue },
  { type: "income_statement", label: "Income Statement", icon: "trending-up-outline", color: COLORS.green },
  { type: "balance_sheet", label: "Balance Sheet", icon: "document-text-outline", color: COLORS.purple },
  { type: "journal", label: "Journal", icon: "book-outline", color: COLORS.amber },
];

/** Human-readable labels for report type badges. */
const TYPE_LABELS: Record<string, string> = {
  trial_balance: "Trial Balance",
  income_statement: "Income Statement",
  balance_sheet: "Balance Sheet",
  journal: "Journal",
};

/** Badge colour per report type for quick visual distinction. */
const TYPE_BADGE_COLORS: Record<string, string> = {
  trial_balance: COLORS.blue,
  income_statement: COLORS.green,
  balance_sheet: COLORS.purple,
  journal: COLORS.amber,
};

/** Status badge metadata. */
const STATUS_META: Record<
  LedgerReport["status"],
  { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>["name"] }
> = {
  ready: { label: "Ready", color: COLORS.green, icon: "checkmark-circle" },
  generating: { label: "Generating…", color: COLORS.amber, icon: "hourglass-outline" },
  error: { label: "Error", color: COLORS.red, icon: "alert-circle" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO date string to a compact locale representation. */
const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single period filter pill. */
const PeriodPill = memo(function PeriodPill({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      testID={`report-period-${label.toLowerCase()}`}
      style={[styles.periodPill, isActive && styles.periodPillActive]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.periodPillText, isActive && styles.periodPillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

/** Generate report button for a single report type. */
const GenerateButton = memo(function GenerateButton({
  type,
  label,
  icon,
  color,
  disabled,
  onPress,
}: {
  type: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  disabled: boolean;
  onPress: (type: string) => void;
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress(type);
  }, [onPress, type]);

  return (
    <TouchableOpacity
      testID={`report-generate-${type}`}
      style={[styles.generateButton, { borderColor: color }, disabled && styles.disabledButton]}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <Ionicons name={icon} size={20} color={disabled ? COLORS.grey : color} />
      <Text style={[styles.generateButtonText, { color: disabled ? COLORS.grey : color }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

/** Single row in the reports FlatList. */
const ReportRow = memo(function ReportRow({
  report,
  onExportPDF,
  onExportExcel,
  onViewReport,
}: {
  report: LedgerReport;
  onExportPDF: (id: string) => void;
  onExportExcel: (id: string) => void;
  onViewReport: (id: string) => void;
}) {
  const statusMeta = STATUS_META[report.status];
  const badgeColor = TYPE_BADGE_COLORS[report.type] ?? COLORS.grey;

  const handlePDF = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onExportPDF(report.id);
  }, [onExportPDF, report.id]);

  const handleExcel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onExportExcel(report.id);
  }, [onExportExcel, report.id]);

  const handleView = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onViewReport(report.id);
  }, [onViewReport, report.id]);

  return (
    <View testID={`report-item-${report.id}`} style={styles.reportRow}>
      {/* Top: name + type badge */}
      <View style={styles.reportHeader}>
        <Text style={styles.reportName} numberOfLines={1}>
          {report.name}
        </Text>
        <View style={[styles.typeBadge, { backgroundColor: badgeColor + "22" }]}>
          <Text style={[styles.typeBadgeText, { color: badgeColor }]}>
            {TYPE_LABELS[report.type] ?? report.type}
          </Text>
        </View>
      </View>

      {/* Middle: period + date + status */}
      <View style={styles.reportMeta}>
        <View style={styles.metaLeft}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.metaText}>{report.period}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{formatDate(report.generatedAt)}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + "22" }]}>
          <Ionicons name={statusMeta.icon} size={12} color={statusMeta.color} />
          <Text style={[styles.statusText, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      {/* Bottom: action buttons */}
      <View style={styles.reportActions}>
        <TouchableOpacity
          testID={`report-view-${report.id}`}
          style={styles.actionButton}
          onPress={handleView}
          activeOpacity={0.7}
        >
          <Ionicons name="eye-outline" size={16} color={COLORS.blue} />
          <Text style={[styles.actionText, { color: COLORS.blue }]}>View</Text>
        </TouchableOpacity>

        {/* Export buttons only shown when the report is ready */}
        {report.status === "ready" && (
          <>
            <TouchableOpacity
              testID={`report-export-pdf-${report.id}`}
              style={styles.actionButton}
              onPress={handlePDF}
              activeOpacity={0.7}
            >
              <Ionicons name="document-outline" size={16} color={COLORS.red} />
              <Text style={[styles.actionText, { color: COLORS.red }]}>PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID={`report-export-excel-${report.id}`}
              style={styles.actionButton}
              onPress={handleExcel}
              activeOpacity={0.7}
            >
              <Ionicons name="grid-outline" size={16} color={COLORS.green} />
              <Text style={[styles.actionText, { color: COLORS.green }]}>Excel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ReportExportView: React.FC<ReportExportViewProps> = ({
  reports,
  onGenerateReport,
  onExportPDF,
  onExportExcel,
  onViewReport,
  isGenerating = false,
  selectedPeriod,
  onPeriodChange,
}) => {
  // ------- memoised derived data -------

  /** Stable key-extractor for FlatList. */
  const keyExtractor = useCallback((item: LedgerReport) => item.id, []);

  /** Render a single report row. */
  const renderItem = useCallback(
    ({ item }: { item: LedgerReport }) => (
      <ReportRow
        report={item}
        onExportPDF={onExportPDF}
        onExportExcel={onExportExcel}
        onViewReport={onViewReport}
      />
    ),
    [onExportPDF, onExportExcel, onViewReport],
  );

  /** Empty state when there are no reports yet. */
  const ListEmpty = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons name="folder-open-outline" size={48} color={COLORS.grey} />
        <Text style={styles.emptyTitle}>No reports yet</Text>
        <Text style={styles.emptySubtitle}>
          Generate a report above to get started
        </Text>
      </View>
    ),
    [],
  );

  // ------- render -------

  return (
    <View testID="report-export-view" style={styles.container}>
      {/* ---- Header ---- */}
      <View style={styles.header}>
        <Ionicons name="stats-chart-outline" size={24} color={COLORS.text} />
        <Text style={styles.headerTitle}>Ledger Reports</Text>
        {isGenerating && (
          <ActivityIndicator size="small" color={COLORS.amber} style={styles.headerSpinner} />
        )}
      </View>

      {/* ---- Period selector ---- */}
      <View testID="report-period" style={styles.periodRow}>
        {PERIODS.map((p) => (
          <PeriodPill
            key={p}
            label={p}
            isActive={selectedPeriod === p}
            onPress={() => onPeriodChange(p)}
          />
        ))}
      </View>

      {/* ---- Generate buttons ---- */}
      <View style={styles.generateRow}>
        {REPORT_TYPES.map((rt) => (
          <GenerateButton
            key={rt.type}
            type={rt.type}
            label={rt.label}
            icon={rt.icon}
            color={rt.color}
            disabled={!!isGenerating}
            onPress={onGenerateReport}
          />
        ))}
      </View>

      {/* ---- Reports list ---- */}
      <Text style={styles.sectionLabel}>Generated Reports</Text>

      {isGenerating && reports.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.blue} />
          <Text style={styles.loadingText}>Generating report…</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    marginLeft: 8,
  },
  headerSpinner: {
    marginLeft: "auto",
  },

  // Period pills
  periodRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  periodPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  periodPillActive: {
    backgroundColor: COLORS.blue + "22",
    borderColor: COLORS.blue,
  },
  periodPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  periodPillTextActive: {
    color: COLORS.blue,
  },

  // Generate buttons — 2-column grid
  generateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  generateButton: {
    flexBasis: "47%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
  },
  generateButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },

  // Section label
  sectionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textMuted,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Report row
  reportRow: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reportName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginRight: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Meta row (period + date + status)
  reportMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  metaDot: {
    fontSize: 12,
    color: COLORS.grey,
    marginHorizontal: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Action buttons
  reportActions: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: COLORS.input,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // List
  listContent: {
    paddingBottom: 32,
  },
  separator: {
    height: 10,
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // Loading
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 12,
  },
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default memo(ReportExportView);
export type { ReportExportViewProps, LedgerReport };
