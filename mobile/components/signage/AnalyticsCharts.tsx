/**
 * AnalyticsCharts — Analytics dashboard for signage performance.
 *
 * Shows KPI summary cards, a horizontal bar chart of daily impressions,
 * and a display performance table. All visualisation is built with plain
 * Views so we avoid heavy charting library dependencies.
 *
 * Why View-based bars instead of a chart library?
 * Signage analytics is a secondary screen — operators glance at trends,
 * not pixel-exact data points. Simple proportional bars convey the same
 * insight with zero extra bundle weight and full dark-theme control.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DisplayMetric {
  displayId: string;
  displayName: string;
  impressions: number;
  uptimePercentage: number;
  avgViewDuration: number;
}

export interface DailyMetric {
  date: string;
  impressions: number;
  uniqueViewers: number;
}

export interface AnalyticsChartsProps {
  displayMetrics: DisplayMetric[];
  dailyMetrics: DailyMetric[];
  totalImpressions: number;
  averageUptime: number;
  activeDisplaysCount: number;
  period: string;
  onPeriodChange: (period: string) => void;
  isLoading?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PERIODS = ["7d", "30d", "90d"] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Format large numbers with K/M suffixes for compact display. */
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/** Extract day label from an ISO date string (e.g. "15 Jun"). */
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

/** Colour an uptime percentage: green ≥ 95, amber ≥ 80, red below. */
function uptimeColor(pct: number): string {
  if (pct >= 95) return "#22c55e";
  if (pct >= 80) return "#fbbf24";
  return "#ef4444";
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

/** KPI summary card */
const KpiCard = React.memo(function KpiCard({
  icon,
  label,
  value,
  color,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.kpiCard}>
      <View style={[styles.kpiIconContainer, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
});

/** Single horizontal bar in the daily trend chart. */
const DailyBar = React.memo(function DailyBar({
  metric,
  maxImpressions,
}: {
  metric: DailyMetric;
  maxImpressions: number;
}) {
  const widthPct = maxImpressions > 0
    ? Math.max((metric.impressions / maxImpressions) * 100, 2)
    : 2;

  return (
    <View style={styles.barRow}>
      <Text style={styles.barDateLabel}>{formatDateLabel(metric.date)}</Text>
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${widthPct}%` }]}
        />
      </View>
      <Text style={styles.barValue}>{formatNumber(metric.impressions)}</Text>
    </View>
  );
});

/** Display performance table row. */
const DisplayRow = React.memo(function DisplayRow({
  metric,
}: {
  metric: DisplayMetric;
}) {
  const upColor = uptimeColor(metric.uptimePercentage);

  return (
    <View testID={`analytics-display-${metric.displayId}`} style={styles.displayRow}>
      <View style={styles.displayNameCol}>
        <Ionicons name="tv-outline" size={16} color="#9ca3af" />
        <Text style={styles.displayName} numberOfLines={1}>
          {metric.displayName}
        </Text>
      </View>

      <Text style={styles.displayMetricText}>
        {formatNumber(metric.impressions)}
      </Text>

      <Text style={[styles.displayMetricText, { color: upColor }]}>
        {metric.uptimePercentage.toFixed(1)}%
      </Text>

      <Text style={styles.displayMetricText}>
        {metric.avgViewDuration.toFixed(1)}s
      </Text>
    </View>
  );
});

// ─── Main Component ─────────────────────────────────────────────────────────

/**
 * @param props - {@link AnalyticsChartsProps}
 * @returns Signage analytics dashboard with KPIs, daily trend chart, and display table.
 */
const AnalyticsCharts = React.memo(function AnalyticsCharts({
  displayMetrics,
  dailyMetrics,
  totalImpressions,
  averageUptime,
  activeDisplaysCount,
  period,
  onPeriodChange,
  isLoading = false,
}: AnalyticsChartsProps) {
  const handlePeriodChange = useCallback(
    (p: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPeriodChange(p);
    },
    [onPeriodChange],
  );

  /** Max impressions for bar chart scaling. */
  const maxImpressions = useMemo(
    () => Math.max(...dailyMetrics.map((d) => d.impressions), 1),
    [dailyMetrics],
  );

  /** Display metrics sorted by impressions descending. */
  const sortedDisplays = useMemo(
    () => [...displayMetrics].sort((a, b) => b.impressions - a.impressions),
    [displayMetrics],
  );

  // ── Loading state ────────────────────────────────────────────

  if (isLoading) {
    return (
      <View testID="analytics-loading" style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading analytics…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      testID="analytics-charts"
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="analytics-outline" size={24} color="#f3f4f6" />
          <Text style={styles.headerTitle}>Signage Analytics</Text>
        </View>

        {/* Period selector */}
        <View style={styles.periodToggle}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              testID={`analytics-period-${p}`}
              style={[
                styles.periodButton,
                period === p && styles.periodButtonActive,
              ]}
              onPress={() => handlePeriodChange(p)}
              accessibilityLabel={`${p} period`}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.periodButtonText,
                  period === p && styles.periodButtonTextActive,
                ]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── KPI Cards ───────────────────────────────────── */}
      <View style={styles.kpiRow}>
        <KpiCard
          testID="analytics-impressions"
          icon="eye-outline"
          label="Total Impressions"
          value={formatNumber(totalImpressions)}
          color="#3b82f6"
        />
        <KpiCard
          testID="analytics-uptime"
          icon="pulse-outline"
          label="Avg Uptime"
          value={`${averageUptime.toFixed(1)}%`}
          color={uptimeColor(averageUptime)}
        />
        <KpiCard
          icon="tv-outline"
          label="Active Displays"
          value={activeDisplaysCount.toString()}
          color="#8b5cf6"
        />
      </View>

      {/* ── Daily Trend Chart ───────────────────────────── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Daily Impressions</Text>
        {dailyMetrics.length > 0 ? (
          <View style={styles.barsContainer}>
            {dailyMetrics.map((dm) => (
              <DailyBar
                key={dm.date}
                metric={dm}
                maxImpressions={maxImpressions}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.noDataText}>No data for this period.</Text>
        )}
      </View>

      {/* ── Display Performance Table ───────────────────── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Display Performance</Text>

        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.displayNameCol]}>Display</Text>
          <Text style={styles.tableHeaderText}>Impr.</Text>
          <Text style={styles.tableHeaderText}>Uptime</Text>
          <Text style={styles.tableHeaderText}>Avg View</Text>
        </View>

        {sortedDisplays.length > 0 ? (
          sortedDisplays.map((dm) => (
            <DisplayRow key={dm.displayId} metric={dm} />
          ))
        ) : (
          <Text style={styles.noDataText}>No display data available.</Text>
        )}
      </View>
    </ScrollView>
  );
});

export default AnalyticsCharts;

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollContent: {
    paddingBottom: 40,
  },

  /* ── Header ─────────────────────────────────────────── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },

  /* Period toggle */
  periodToggle: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    borderRadius: 10,
    overflow: "hidden",
  },
  periodButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  periodButtonActive: {
    backgroundColor: "#3b82f6",
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
  },
  periodButtonTextActive: {
    color: "#f3f4f6",
  },

  /* ── KPI Cards ──────────────────────────────────────── */
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  kpiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f3f4f6",
  },
  kpiLabel: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
  },

  /* ── Section card (shared for chart and table) ─────── */
  sectionCard: {
    backgroundColor: "#1f2937",
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
  },

  /* ── Bar chart ──────────────────────────────────────── */
  barsContainer: {
    gap: 8,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 28,
  },
  barDateLabel: {
    width: 52,
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "right",
  },
  barTrack: {
    flex: 1,
    height: 20,
    backgroundColor: "#111827",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: 20,
    backgroundColor: "#3b82f6",
    borderRadius: 4,
  },
  barValue: {
    width: 44,
    fontSize: 12,
    fontWeight: "600",
    color: "#f3f4f6",
    textAlign: "right",
  },

  /* ── Table ──────────────────────────────────────────── */
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    gap: 10,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    flex: 1,
    textAlign: "right",
  },
  displayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#111827",
    minHeight: 48,
    gap: 10,
  },
  displayNameCol: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    textAlign: "left",
  },
  displayName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  displayMetricText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#f3f4f6",
    textAlign: "right",
  },

  /* ── Shared ─────────────────────────────────────────── */
  noDataText: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    paddingVertical: 20,
  },

  /* ── Loading ────────────────────────────────────────── */
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#9ca3af",
  },
});
