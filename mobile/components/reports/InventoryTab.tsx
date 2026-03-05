/**
 * InventoryTab — Inventory valuation & health report.
 *
 * Renders summary cards (total value, item count, low-stock alerts,
 * slow movers), a filter/sort bar, and a FlatList of inventory item cards
 * with colour-coded stock-level indicators.
 *
 * Tablet-first: two-column summary grid, generous card padding.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  type ListRenderItemInfo,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";
import type { InventoryReportItem } from "@/services/reports/ReportService";
import {
  sortReportItems,
  filterByCategory,
} from "@/services/reports/ReportService";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InventoryTabProps {
  items: InventoryReportItem[];
  totalValue: number;
  lowStockCount: number;
  slowMoverCount: number;
  onItemPress?: (productId: string) => void;
  isLoading?: boolean;
}

type SortField = "totalValue" | "currentStock" | "turnoverRate";

// ─── Constants ───────────────────────────────────────────────────────────────

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: "totalValue", label: "Value" },
  { field: "currentStock", label: "Stock" },
  { field: "turnoverRate", label: "Turnover" },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

/** KPI card shown in the summary grid. */
const SummaryCard = React.memo(function SummaryCard({
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
    <View style={styles.summaryCard} testID={testID}>
      <View style={[styles.summaryIconWrap, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
});

/**
 * Horizontal stock bar — width proportional to `currentStock / reorderLevel`.
 *
 * Colour thresholds are intentionally relative to the reorder level
 * rather than absolute numbers, so the indicator works across
 * different product categories with vastly different stock ranges.
 */
const StockBar = React.memo(function StockBar({
  current,
  reorder,
}: {
  current: number;
  reorder: number;
}) {
  const ratio = reorder > 0 ? current / reorder : 1;
  const clampedWidth = Math.min(ratio * 100, 100);

  let barColor = "#22c55e"; // green — healthy
  if (ratio <= 1) barColor = "#fbbf24"; // amber — at reorder level
  if (ratio < 0.5) barColor = "#ef4444"; // red — critical

  return (
    <View style={styles.stockBarTrack}>
      <View
        style={[
          styles.stockBarFill,
          { width: `${clampedWidth}%`, backgroundColor: barColor },
        ]}
      />
    </View>
  );
});

/** Single category filter pill. */
const CategoryPill = React.memo(function CategoryPill({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.categoryPill, isActive && styles.categoryPillActive]}
    >
      <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

/** Sort toggle button. */
const SortButton = React.memo(function SortButton({
  label,
  isActive,
  direction,
  onPress,
}: {
  label: string;
  isActive: boolean;
  direction: "asc" | "desc";
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.sortButton, isActive && styles.sortButtonActive]}
    >
      <Text style={[styles.sortButtonText, isActive && styles.sortButtonTextActive]}>
        {label}
      </Text>
      {isActive && (
        <Ionicons
          name={direction === "asc" ? "arrow-up" : "arrow-down"}
          size={14}
          color="#22c55e"
        />
      )}
    </TouchableOpacity>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

function InventoryTab({
  items,
  totalValue,
  lowStockCount,
  slowMoverCount,
  onItemPress,
  isLoading = false,
}: InventoryTabProps) {
  // ── Local filter / sort state ──
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("totalValue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ── Derived data ──
  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category))).sort(),
    [items],
  );

  const processedItems = useMemo(() => {
    const filtered = filterByCategory(items, selectedCategories);
    return sortReportItems(filtered, sortField, sortDir);
  }, [items, selectedCategories, sortField, sortDir]);

  // ── Handlers ──
  const toggleCategory = useCallback(
    (cat: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedCategories((prev) =>
        prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
      );
    },
    [],
  );

  const toggleSort = useCallback(
    (field: SortField) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (field === sortField) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    },
    [sortField],
  );

  const handleItemPress = useCallback(
    (productId: string) => {
      if (!onItemPress) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onItemPress(productId);
    },
    [onItemPress],
  );

  // ── Item renderer ──
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<InventoryReportItem>) => (
      <TouchableOpacity
        testID={`inventory-item-${item.productId}`}
        style={styles.itemCard}
        activeOpacity={onItemPress ? 0.7 : 1}
        onPress={() => handleItemPress(item.productId)}
      >
        {/* Top row: name + category badge */}
        <View style={styles.itemHeader}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.productName}
          </Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{item.category}</Text>
          </View>
        </View>

        {/* Stock bar */}
        <StockBar current={item.currentStock} reorder={item.reorderLevel} />

        {/* Metrics row */}
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Stock</Text>
            <Text style={styles.metricValue}>{item.currentStock}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Days Left</Text>
            <Text
              style={[
                styles.metricValue,
                item.daysOfStock < 7 && { color: "#ef4444" },
              ]}
            >
              {item.daysOfStock}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Turnover</Text>
            <Text style={styles.metricValue}>{item.turnoverRate.toFixed(1)}×</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Value</Text>
            <Text style={styles.metricValue}>{formatCurrency(item.totalValue)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    ),
    [handleItemPress, onItemPress],
  );

  const keyExtractor = useCallback((item: InventoryReportItem) => item.productId, []);

  // ── Loading state ──
  if (isLoading) {
    return (
      <View style={styles.centred} testID="inventory-loading">
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Loading inventory data…</Text>
      </View>
    );
  }

  // ── Empty state ──
  if (items.length === 0) {
    return (
      <View style={styles.centred} testID="inventory-empty">
        <Ionicons name="cube-outline" size={48} color="#6b7280" />
        <Text style={styles.emptyTitle}>No inventory data</Text>
        <Text style={styles.emptySubtitle}>
          Inventory items will appear here once stock is recorded.
        </Text>
      </View>
    );
  }

  // ── Main render ──
  return (
    <View style={styles.container} testID="inventory-tab">
      {/* ── Summary Cards ── */}
      <View style={styles.summaryGrid}>
        <SummaryCard
          testID="inventory-total-value"
          label="Total Value"
          value={formatCurrency(totalValue)}
          icon="wallet-outline"
          color="#3b82f6"
        />
        <SummaryCard
          label="Items"
          value={items.length.toString()}
          icon="cube-outline"
          color="#22c55e"
        />
        <SummaryCard
          testID="inventory-low-stock"
          label="Low Stock"
          value={lowStockCount.toString()}
          icon="alert-circle-outline"
          color="#fbbf24"
        />
        <SummaryCard
          label="Slow Movers"
          value={slowMoverCount.toString()}
          icon="hourglass-outline"
          color="#ef4444"
        />
      </View>

      {/* ── Filter / Sort Bar ── */}
      <View style={styles.filterBar}>
        {/* Category pills */}
        <FlatList
          horizontal
          data={categories}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(c) => c}
          contentContainerStyle={styles.pillRow}
          renderItem={({ item: cat }) => (
            <CategoryPill
              label={cat}
              isActive={selectedCategories.includes(cat)}
              onPress={() => toggleCategory(cat)}
            />
          )}
        />

        {/* Sort buttons */}
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <SortButton
              key={opt.field}
              label={opt.label}
              isActive={sortField === opt.field}
              direction={sortDir}
              onPress={() => toggleSort(opt.field)}
            />
          ))}
        </View>
      </View>

      {/* ── Items List ── */}
      <FlatList
        data={processedItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

export default React.memo(InventoryTab);

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

  // ── Summary grid ──
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: "#1f2937",
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  } as TextStyle,
  summaryLabel: {
    fontSize: 12,
    color: "#9ca3af",
  },

  // ── Filter bar ──
  filterBar: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#374151",
  },
  pillRow: {
    gap: 6,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#111827",
  },
  categoryPillActive: {
    backgroundColor: "#3b82f6",
  },
  categoryPillText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  categoryPillTextActive: {
    color: "#f3f4f6",
    fontWeight: "600",
  },
  sortRow: {
    flexDirection: "row",
    gap: 6,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#111827",
  },
  sortButtonActive: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  sortButtonText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  sortButtonTextActive: {
    color: "#22c55e",
    fontWeight: "600",
  },

  // ── Item cards ──
  listContent: {
    padding: 12,
    gap: 10,
    paddingBottom: 32,
  },
  itemCard: {
    backgroundColor: "#1f2937",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#f3f4f6",
    marginRight: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#111827",
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#9ca3af",
  },

  // ── Stock bar ──
  stockBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#111827",
    overflow: "hidden",
  },
  stockBarFill: {
    height: 6,
    borderRadius: 3,
  },

  // ── Metrics ──
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metric: {
    alignItems: "center",
    gap: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: "#6b7280",
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f3f4f6",
  },
});
