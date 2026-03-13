/**
 * ProfitMarginTab — Gross profit margin report view.
 *
 * Displays summary KPI cards (Revenue, COGS, Gross Profit, Average Margin)
 * and a category breakdown FlatList where each row shows revenue/COGS/profit
 * columns plus a colour-coded margin percentage and trend arrow.
 *
 * Tablet-first: four-column summary grid, wide metric rows.
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  type ListRenderItemInfo,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import type { ProfitMarginEntry } from "@/services/reports/ReportService";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProfitMarginTabProps {
  entries: ProfitMarginEntry[];
  totalRevenue: number;
  totalCOGS: number;
  totalGrossProfit: number;
  averageMargin: number;
  isLoading?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a margin percentage to a traffic-light colour.
 *
 * Thresholds based on typical retail benchmarks:
 *   ≥ 40 % → green (strong)
 *   ≥ 20 % → amber (acceptable)
 *   <  20 % → red (thin / negative)
 */
function marginColor(pct: number): string {
  if (pct >= 40) return "#22c55e";
  if (pct >= 20) return "#fbbf24";
  return "#ef4444";
}

/** Icon + colour for the trend indicator. */
function trendMeta(trend: "up" | "down" | "flat") {
  switch (trend) {
    case "up":
      return { icon: "trending-up" as const, color: "#22c55e" };
    case "down":
      return { icon: "trending-down" as const, color: "#ef4444" };
    default:
      return { icon: "remove-outline" as const, color: "#6b7280" };
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Summary KPI card. */
const SummaryKPI = React.memo(function SummaryKPI({
  label,
  value,
  icon,
  color,
  testID,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  testID?: string;
}) {
  return (
    <View style={styles.kpiCard} testID={testID}>
      <View style={[styles.kpiIconWrap, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
});

/** Single margin breakdown row for one category. */
const MarginRow = React.memo(function MarginRow({
  entry,
  index,
}: {
  entry: ProfitMarginEntry;
  index: number;
}) {
  const mColor = marginColor(entry.grossMarginPercentage);
  const trend = trendMeta(entry.trend);

  return (
    <View style={styles.rowCard} testID={`margin-entry-${index}`}>
      {/* Header: category + trend arrow */}
      <View style={styles.rowHeader}>
        <Text style={styles.rowCategory}>{entry.category}</Text>
        <View style={styles.trendBadge}>
          <Ionicons name={trend.icon} size={16} color={trend.color} />
        </View>
      </View>

      {/* Metrics columns */}
      <View style={styles.columnsRow}>
        <MetricColumn label="Revenue" value={formatCurrency(entry.revenue)} />
        <MetricColumn label="COGS" value={formatCurrency(entry.cogs)} />
        <MetricColumn
          label="Gross Profit"
          value={formatCurrency(entry.grossProfit)}
          color={entry.grossProfit >= 0 ? "#22c55e" : "#ef4444"}
        />
      </View>

      {/* Margin bar + percentage */}
      <View style={styles.marginBarRow}>
        <View style={styles.marginBarTrack}>
          <View
            style={[
              styles.marginBarFill,
              {
                // Clamp between 0-100 for display; negative margins show as 0-width.
                width: `${Math.min(Math.max(entry.grossMarginPercentage, 0), 100)}%`,
                backgroundColor: mColor,
              },
            ]}
          />
        </View>
        <Text style={[styles.marginPct, { color: mColor }]}>
          {entry.grossMarginPercentage.toFixed(1)}%
        </Text>
      </View>
    </View>
  );
});

/** Small label + value column used inside the metrics row. */
const MetricColumn = React.memo(function MetricColumn({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.metricCol}>
      <Text style={styles.metricColLabel}>{label}</Text>
      <Text style={[styles.metricColValue, color ? { color } : undefined]}>
        {value}
      </Text>
    </View>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

function ProfitMarginTab({
  entries,
  totalRevenue,
  totalCOGS,
  totalGrossProfit,
  averageMargin,
  isLoading = false,
}: ProfitMarginTabProps) {
  // ── Item renderer ──
  const renderEntry = useCallback(
    ({ item, index }: ListRenderItemInfo<ProfitMarginEntry>) => (
      <MarginRow entry={item} index={index} />
    ),
    [],
  );

  const keyExtractor = useCallback(
    (_: ProfitMarginEntry, index: number) => `margin-${index}`,
    [],
  );

  // ── Loading state ──
  if (isLoading) {
    return (
      <View style={styles.centred} testID="margin-loading">
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Calculating margins…</Text>
      </View>
    );
  }

  // ── Main render ──
  return (
    <View style={styles.container} testID="margin-tab">
      {/* ── Summary KPI Cards ── */}
      <View style={styles.kpiGrid}>
        <SummaryKPI
          testID="margin-revenue"
          label="Revenue"
          value={formatCurrency(totalRevenue)}
          icon="cash-outline"
          color="#3b82f6"
        />
        <SummaryKPI
          label="COGS"
          value={formatCurrency(totalCOGS)}
          icon="cart-outline"
          color="#ef4444"
        />
        <SummaryKPI
          testID="margin-profit"
          label="Gross Profit"
          value={formatCurrency(totalGrossProfit)}
          icon="trending-up-outline"
          color="#22c55e"
        />
        <SummaryKPI
          testID="margin-average"
          label="Avg Margin"
          value={`${averageMargin.toFixed(1)}%`}
          icon="analytics-outline"
          color={marginColor(averageMargin)}
        />
      </View>

      {/* ── Section heading ── */}
      <Text style={styles.sectionTitle}>Category Breakdown</Text>

      {/* ── Category Breakdown ── */}
      <FlatList
        data={entries}
        keyExtractor={keyExtractor}
        renderItem={renderEntry}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.centred}>
            <Ionicons name="bar-chart-outline" size={48} color="#6b7280" />
            <Text style={styles.emptyTitle}>No margin data</Text>
            <Text style={styles.emptySubtitle}>
              Profit margin data will appear once sales are recorded.
            </Text>
          </View>
        }
      />
    </View>
  );
}

export default React.memo(ProfitMarginTab);

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,

  // ── Centred states ──
  centred: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#9ca3af",
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },

  // ── KPI grid ──
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: "#1f2937",
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f4f6",
  } as TextStyle,
  kpiLabel: {
    fontSize: 12,
    color: "#9ca3af",
  },

  // ── Section heading ──
  sectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    fontSize: 15,
    fontWeight: "600",
    color: "#f3f4f6",
  } as TextStyle,

  // ── Row cards ──
  listContent: {
    padding: 12,
    gap: 10,
    paddingBottom: 32,
  },
  rowCard: {
    backgroundColor: "#1f2937",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowCategory: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f3f4f6",
  } as TextStyle,
  trendBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Columns ──
  columnsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricCol: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  metricColLabel: {
    fontSize: 11,
    color: "#6b7280",
  },
  metricColValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#d1d5db",
  } as TextStyle,

  // ── Margin bar ──
  marginBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  marginBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#111827",
    overflow: "hidden",
  },
  marginBarFill: {
    height: 6,
    borderRadius: 3,
  },
  marginPct: {
    fontSize: 14,
    fontWeight: "700",
    minWidth: 52,
    textAlign: "right",
  } as TextStyle,
});
