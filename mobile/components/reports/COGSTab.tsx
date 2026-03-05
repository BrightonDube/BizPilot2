/**
 * COGSTab — Cost of Goods Sold report view.
 *
 * Shows total COGS, COGS-as-% of revenue, and a category breakdown where
 * each row visualises the Opening → Purchases → Closing = COGS flow.
 *
 * Tablet-first: summary cards span full width, category rows use generous
 * horizontal spacing.
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
import type { COGSEntry } from "@/services/reports/ReportService";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface COGSTabProps {
  entries: COGSEntry[];
  totalCOGS: number;
  totalRevenue: number;
  period: string;
  isLoading?: boolean;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Summary KPI card (re-usable within this tab). */
const KPICard = React.memo(function KPICard({
  label,
  value,
  subLabel,
  icon,
  color,
  testID,
}: {
  label: string;
  value: string;
  subLabel?: string;
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
      {subLabel ? <Text style={styles.kpiSub}>{subLabel}</Text> : null}
    </View>
  );
});

/**
 * Percentage bar — width represents `cogsPercentage` out of 100 %.
 *
 * Colour thresholds give a quick visual cue:
 *   ≤ 40 % → green (healthy)
 *   ≤ 60 % → amber (watch)
 *   > 60 % → red (margin squeeze)
 */
const PercentageBar = React.memo(function PercentageBar({
  percentage,
}: {
  percentage: number;
}) {
  const clamped = Math.min(Math.max(percentage, 0), 100);

  let barColor = "#22c55e";
  if (percentage > 40) barColor = "#fbbf24";
  if (percentage > 60) barColor = "#ef4444";

  return (
    <View style={styles.percentBarTrack}>
      <View
        style={[
          styles.percentBarFill,
          { width: `${clamped}%`, backgroundColor: barColor },
        ]}
      />
    </View>
  );
});

/** Single COGS flow row for one category. */
const COGSRow = React.memo(function COGSRow({
  entry,
  index,
}: {
  entry: COGSEntry;
  index: number;
}) {
  return (
    <View style={styles.rowCard} testID={`cogs-entry-${index}`}>
      {/* Category header */}
      <Text style={styles.rowCategory}>{entry.category}</Text>

      {/* Flow: Opening → Purchases → Closing = COGS */}
      <View style={styles.flowRow}>
        <FlowCell label="Opening" value={formatCurrency(entry.openingStock)} />
        <Ionicons name="add" size={14} color="#6b7280" style={styles.flowOp} />
        <FlowCell label="Purchases" value={formatCurrency(entry.purchases)} />
        <Ionicons name="remove" size={14} color="#6b7280" style={styles.flowOp} />
        <FlowCell label="Closing" value={formatCurrency(entry.closingStock)} />
        <Text style={styles.flowEquals}>=</Text>
        <FlowCell
          label="COGS"
          value={formatCurrency(entry.cogs)}
          highlight
        />
      </View>

      {/* Percentage bar */}
      <View style={styles.percentRow}>
        <PercentageBar percentage={entry.cogsPercentage} />
        <Text style={styles.percentText}>{entry.cogsPercentage.toFixed(1)}%</Text>
      </View>
    </View>
  );
});

/** Small label + value cell inside the flow. */
const FlowCell = React.memo(function FlowCell({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.flowCell}>
      <Text style={styles.flowCellLabel}>{label}</Text>
      <Text style={[styles.flowCellValue, highlight && styles.flowCellHighlight]}>
        {value}
      </Text>
    </View>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

function COGSTab({
  entries,
  totalCOGS,
  totalRevenue,
  period,
  isLoading = false,
}: COGSTabProps) {
  const cogsPercentage =
    totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0;

  // ── Item renderer ──
  const renderEntry = useCallback(
    ({ item, index }: ListRenderItemInfo<COGSEntry>) => (
      <COGSRow entry={item} index={index} />
    ),
    [],
  );

  const keyExtractor = useCallback(
    (_: COGSEntry, index: number) => `cogs-${index}`,
    [],
  );

  // ── Loading state ──
  if (isLoading) {
    return (
      <View style={styles.centred} testID="cogs-loading">
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Calculating cost of goods…</Text>
      </View>
    );
  }

  // ── Main render ──
  return (
    <View style={styles.container} testID="cogs-tab">
      {/* ── Summary ── */}
      <View style={styles.summaryRow}>
        <KPICard
          testID="cogs-total"
          label="Total COGS"
          value={formatCurrency(totalCOGS)}
          subLabel={period}
          icon="cart-outline"
          color="#ef4444"
        />
        <KPICard
          testID="cogs-percentage"
          label="COGS %"
          value={`${cogsPercentage.toFixed(1)}%`}
          subLabel="of revenue"
          icon="pie-chart-outline"
          color="#fbbf24"
        />
        <KPICard
          label="Revenue"
          value={formatCurrency(totalRevenue)}
          subLabel={period}
          icon="cash-outline"
          color="#22c55e"
        />
      </View>

      {/* ── Category Breakdown ── */}
      <Text style={styles.sectionTitle}>Category Breakdown</Text>

      <FlatList
        data={entries}
        keyExtractor={keyExtractor}
        renderItem={renderEntry}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.centred}>
            <Ionicons name="receipt-outline" size={48} color="#6b7280" />
            <Text style={styles.emptyTitle}>No COGS data</Text>
            <Text style={styles.emptySubtitle}>
              Cost of goods data will appear once transactions are recorded.
            </Text>
          </View>
        }
      />
    </View>
  );
}

export default React.memo(COGSTab);

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

  // ── Summary ──
  summaryRow: {
    flexDirection: "row",
    padding: 12,
    gap: 10,
  },
  kpiCard: {
    flex: 1,
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
  kpiSub: {
    fontSize: 11,
    color: "#6b7280",
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
  rowCategory: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f3f4f6",
  } as TextStyle,

  // ── Flow row ──
  flowRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  flowOp: {
    marginHorizontal: 2,
  },
  flowEquals: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginHorizontal: 4,
  },
  flowCell: {
    alignItems: "center",
    gap: 2,
  },
  flowCellLabel: {
    fontSize: 10,
    color: "#6b7280",
  },
  flowCellValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#d1d5db",
  } as TextStyle,
  flowCellHighlight: {
    color: "#f3f4f6",
    fontSize: 14,
  },

  // ── Percentage bar ──
  percentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  percentBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#111827",
    overflow: "hidden",
  },
  percentBarFill: {
    height: 6,
    borderRadius: 3,
  },
  percentText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#d1d5db",
    minWidth: 48,
    textAlign: "right",
  } as TextStyle,
});
