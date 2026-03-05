/**
 * LaybyReports — analytics dashboard for layby performance.
 *
 * Displays KPIs, monthly trends, and recent payment activity so
 * managers can monitor layby health at a glance.
 *
 * Why show a completion rate?
 * Completion rate is the single best indicator of layby programme
 * health. A low rate signals pricing/deposit issues; a high rate
 * means customers follow through and the policy is working.
 *
 * Why include overdue count prominently?
 * Overdue laybys need proactive follow-up. Surfacing them in the
 * KPI row ensures they don't slip through the cracks.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { triggerHaptic } from "@/utils/haptics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentPayment {
  id: string;
  customerName: string;
  amount: number;
  date: string;
  laybyId: string;
}

interface MonthlyTrendEntry {
  month: string;
  created: number;
  completed: number;
  cancelled: number;
}

export interface LaybyReportData {
  activeLaybysCount: number;
  totalOutstanding: number;
  totalCollected: number;
  averageDepositPercent: number;
  overdueCount: number;
  completionRate: number;
  recentPayments: RecentPayment[];
  monthlyTrend: MonthlyTrendEntry[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LaybyReportsProps {
  data: LaybyReportData;
  period: string;
  onPeriodChange: (period: string) => void;
  onLaybyPress?: (laybyId: string) => void;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERIOD_OPTIONS = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple bar width as a percentage of the max value in the column.
 * Capped at 100% to prevent overflow.
 */
function barWidth(value: number, max: number): string {
  if (max <= 0) return "0%";
  return `${Math.min(Math.round((value / max) * 100), 100)}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function LaybyReportsInner({
  data,
  period,
  onPeriodChange,
  onLaybyPress,
  isLoading = false,
}: LaybyReportsProps) {
  const handlePeriodSelect = useCallback(
    (key: string) => {
      triggerHaptic("selection");
      onPeriodChange(key);
    },
    [onPeriodChange],
  );

  const handleLaybyPress = useCallback(
    (laybyId: string) => {
      triggerHaptic("tap");
      onLaybyPress?.(laybyId);
    },
    [onLaybyPress],
  );

  /**
   * Max value across all trend columns — used to scale bar indicators
   * so the tallest bar fills 100% of the available width.
   */
  const trendMax = useMemo(() => {
    let max = 1;
    for (const entry of data.monthlyTrend) {
      max = Math.max(max, entry.created, entry.completed, entry.cancelled);
    }
    return max;
  }, [data.monthlyTrend]);

  // -- Loading state --------------------------------------------------------

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="layby-reports-loading">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading reports…</Text>
      </View>
    );
  }

  // -- Render ---------------------------------------------------------------

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="layby-reports"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="bar-chart-outline" size={22} color="#3b82f6" />
          <Text style={styles.headerTitle}>Layby Reports</Text>
        </View>
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((opt) => {
          const isActive = period === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.periodPill, isActive && styles.periodPillActive]}
              onPress={() => handlePeriodSelect(opt.key)}
              testID={`layby-reports-period-${opt.key}`}
            >
              <Text
                style={[
                  styles.periodPillText,
                  isActive && styles.periodPillTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* KPI cards */}
      <View style={styles.kpiGrid}>
        {/* Active */}
        <View style={styles.kpiCard} testID="layby-reports-active">
          <Ionicons name="layers-outline" size={20} color="#3b82f6" />
          <Text style={styles.kpiValue}>{data.activeLaybysCount}</Text>
          <Text style={styles.kpiLabel}>Active</Text>
        </View>

        {/* Outstanding */}
        <View style={styles.kpiCard} testID="layby-reports-outstanding">
          <Ionicons name="time-outline" size={20} color="#fbbf24" />
          <Text style={[styles.kpiValue, { color: "#fbbf24" }]}>
            {formatCurrency(data.totalOutstanding)}
          </Text>
          <Text style={styles.kpiLabel}>Outstanding</Text>
        </View>

        {/* Collected */}
        <View style={styles.kpiCard}>
          <Ionicons name="checkmark-done-outline" size={20} color="#22c55e" />
          <Text style={[styles.kpiValue, { color: "#22c55e" }]}>
            {formatCurrency(data.totalCollected)}
          </Text>
          <Text style={styles.kpiLabel}>Collected</Text>
        </View>

        {/* Overdue */}
        <View style={styles.kpiCard} testID="layby-reports-overdue">
          <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
          <Text style={[styles.kpiValue, { color: "#ef4444" }]}>
            {data.overdueCount}
          </Text>
          <Text style={styles.kpiLabel}>Overdue</Text>
        </View>

        {/* Completion rate */}
        <View style={styles.kpiCard} testID="layby-reports-completion">
          <Ionicons name="trophy-outline" size={20} color="#8b5cf6" />
          <Text style={[styles.kpiValue, { color: "#8b5cf6" }]}>
            {data.completionRate.toFixed(1)}%
          </Text>
          <Text style={styles.kpiLabel}>Completion</Text>
        </View>

        {/* Avg deposit */}
        <View style={styles.kpiCard}>
          <Ionicons name="wallet-outline" size={20} color="#6b7280" />
          <Text style={styles.kpiValue}>
            {data.averageDepositPercent.toFixed(0)}%
          </Text>
          <Text style={styles.kpiLabel}>Avg Deposit</Text>
        </View>
      </View>

      {/* Monthly trend */}
      {data.monthlyTrend.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Trend</Text>
          <View style={styles.trendCard}>
            {/* Table header */}
            <View style={styles.trendHeaderRow}>
              <Text style={[styles.trendHeaderCell, styles.trendMonthCol]}>
                Month
              </Text>
              <Text style={styles.trendHeaderCell}>Created</Text>
              <Text style={styles.trendHeaderCell}>Completed</Text>
              <Text style={styles.trendHeaderCell}>Cancelled</Text>
            </View>

            {data.monthlyTrend.map((entry) => (
              <View key={entry.month} style={styles.trendRow}>
                <Text style={[styles.trendCell, styles.trendMonthCol]}>
                  {entry.month}
                </Text>

                {/* Created */}
                <View style={styles.trendBarCell}>
                  <View
                    style={[
                      styles.trendBar,
                      styles.trendBarCreated,
                      { width: barWidth(entry.created, trendMax) },
                    ]}
                  />
                  <Text style={styles.trendBarText}>{entry.created}</Text>
                </View>

                {/* Completed */}
                <View style={styles.trendBarCell}>
                  <View
                    style={[
                      styles.trendBar,
                      styles.trendBarCompleted,
                      { width: barWidth(entry.completed, trendMax) },
                    ]}
                  />
                  <Text style={styles.trendBarText}>{entry.completed}</Text>
                </View>

                {/* Cancelled */}
                <View style={styles.trendBarCell}>
                  <View
                    style={[
                      styles.trendBar,
                      styles.trendBarCancelled,
                      { width: barWidth(entry.cancelled, trendMax) },
                    ]}
                  />
                  <Text style={styles.trendBarText}>{entry.cancelled}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Recent payments */}
      {data.recentPayments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          <View style={styles.paymentsCard}>
            {data.recentPayments.map((payment) => (
              <TouchableOpacity
                key={payment.id}
                style={styles.paymentRow}
                onPress={() => handleLaybyPress(payment.laybyId)}
                disabled={!onLaybyPress}
                testID={`layby-reports-payment-${payment.id}`}
              >
                <View style={styles.paymentLeft}>
                  <Text style={styles.paymentCustomer} numberOfLines={1}>
                    {payment.customerName}
                  </Text>
                  <Text style={styles.paymentDate}>{payment.date}</Text>
                </View>
                <Text style={styles.paymentAmount}>
                  {formatCurrency(payment.amount)}
                </Text>
                {onLaybyPress && (
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color="#6b7280"
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const LaybyReports = React.memo(LaybyReportsInner);
export default LaybyReports;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 20, gap: 16, paddingBottom: 40 },

  /* Loading */
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { color: "#9ca3af", fontSize: 14 },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#f3f4f6" },

  /* Period selector */
  periodRow: { flexDirection: "row", gap: 8 },
  periodPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    minHeight: 42,
  },
  periodPillActive: { borderColor: "#3b82f6", backgroundColor: "#1e3a5f" },
  periodPillText: { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  periodPillTextActive: { color: "#3b82f6" },

  /* KPI grid */
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 4,
    /* 3 cards per row: (100% - 2*10 gap) / 3 */
    width: "31%",
    flexGrow: 1,
  },
  kpiValue: { color: "#f3f4f6", fontSize: 18, fontWeight: "700" },
  kpiLabel: { color: "#9ca3af", fontSize: 11, fontWeight: "500" },

  /* Sections */
  section: { gap: 8 },
  sectionTitle: { color: "#f3f4f6", fontSize: 16, fontWeight: "700" },

  /* Monthly trend table */
  trendCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  trendHeaderRow: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  trendHeaderCell: {
    flex: 1,
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  trendMonthCol: { flex: 1.2, textAlign: "left" },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  trendCell: { flex: 1, color: "#d1d5db", fontSize: 12 },
  trendBarCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trendBar: {
    height: 8,
    borderRadius: 4,
    minWidth: 2,
  },
  trendBarCreated: { backgroundColor: "#3b82f6" },
  trendBarCompleted: { backgroundColor: "#22c55e" },
  trendBarCancelled: { backgroundColor: "#ef4444" },
  trendBarText: { color: "#9ca3af", fontSize: 11 },

  /* Recent payments */
  paymentsCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 12,
    gap: 2,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  paymentLeft: { flex: 1 },
  paymentCustomer: { color: "#f3f4f6", fontSize: 14, fontWeight: "600" },
  paymentDate: { color: "#6b7280", fontSize: 12 },
  paymentAmount: { color: "#22c55e", fontSize: 15, fontWeight: "700" },
});
