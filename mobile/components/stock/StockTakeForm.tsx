/**
 * StockTakeForm — Form for conducting periodic stock takes / physical counts.
 *
 * Why search + category filters together?
 * Warehouses organise stock by zone/category. During a stock take the counter
 * works through one zone at a time — the category filter scopes the list,
 * and the search bar lets them jump to a specific SKU within that zone.
 *
 * Why show variance inline instead of a separate report?
 * Real-time variance visibility lets counters re-count suspicious items
 * immediately, before they move on. This catches mistakes at the source
 * and reduces the re-count cycles that delay month-end closes.
 *
 * @module StockTakeForm
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { triggerHaptic } from "@/utils/haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StockTakeItem {
  id: string;
  productName: string;
  sku: string;
  expectedQty: number;
  countedQty: number | null;
  category: string;
}

interface StockTakeFormProps {
  stockTakeName: string;
  items: StockTakeItem[];
  onUpdateCount: (itemId: string, count: number) => void;
  onMarkCounted: (itemId: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (cat: string) => void;
  categories: string[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

// ─── Theme ───────────────────────────────────────────────────────────────────

const COLORS = {
  bg: "#0f172a",
  card: "#1f2937",
  input: "#111827",
  text: "#f3f4f6",
  muted: "#9ca3af",
  border: "#374151",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#fbbf24",
  blue: "#3b82f6",
  purple: "#8b5cf6",
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Variance colour: green if positive (surplus), red if negative (shortage),
 * gray if not yet counted.
 */
function varianceColor(counted: number | null, expected: number): string {
  if (counted === null) return COLORS.muted;
  const diff = counted - expected;
  if (diff === 0) return COLORS.green;
  return diff > 0 ? COLORS.green : COLORS.red;
}

/** Format variance with +/− prefix for clarity. */
function formatVariance(counted: number | null, expected: number): string {
  if (counted === null) return "—";
  const diff = counted - expected;
  if (diff === 0) return "0";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Category filter pill.
 */
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
      testID={`stock-take-category-${label}`}
      onPress={onPress}
      style={[styles.categoryPill, isActive && styles.categoryPillActive]}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.categoryPillText,
          isActive && styles.categoryPillTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});

/**
 * Individual stock take row.
 * Memoised — only the row whose count changes re-renders.
 */
const StockTakeItemRow = React.memo(function StockTakeItemRow({
  item,
  onUpdateCount,
  onMarkCounted,
}: {
  item: StockTakeItem;
  onUpdateCount: (itemId: string, count: number) => void;
  onMarkCounted: (itemId: string) => void;
}) {
  const isCounted = item.countedQty !== null;
  const variance = formatVariance(item.countedQty, item.expectedQty);
  const varColor = varianceColor(item.countedQty, item.expectedQty);

  const handleCountChange = useCallback(
    (text: string) => {
      const parsed = parseInt(text, 10);
      onUpdateCount(item.id, Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
    },
    [item.id, onUpdateCount]
  );

  const handleMark = useCallback(() => {
    triggerHaptic("tap");
    onMarkCounted(item.id);
  }, [item.id, onMarkCounted]);

  return (
    <View
      testID={`stock-take-item-${item.id}`}
      style={[
        styles.itemRow,
        { borderLeftColor: isCounted ? COLORS.green : COLORS.muted },
      ]}
    >
      {/* Product info */}
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.productName}
          </Text>
          <Text style={styles.itemSku}>SKU: {item.sku}</Text>
        </View>
        <View style={styles.expectedBadge}>
          <Text style={styles.expectedLabel}>Expected</Text>
          <Text style={styles.expectedValue}>{item.expectedQty}</Text>
        </View>
      </View>

      {/* Count input + variance + mark button */}
      <View style={styles.countRow}>
        <View style={styles.countInputGroup}>
          <Text style={styles.countInputLabel}>COUNT</Text>
          <TextInput
            testID={`stock-take-count-${item.id}`}
            style={styles.countInput}
            value={item.countedQty !== null ? String(item.countedQty) : ""}
            onChangeText={handleCountChange}
            placeholder="—"
            placeholderTextColor={COLORS.muted}
            keyboardType="number-pad"
            returnKeyType="done"
          />
        </View>

        <View style={styles.varianceGroup}>
          <Text style={styles.varianceLabel}>VARIANCE</Text>
          <Text style={[styles.varianceValue, { color: varColor }]}>
            {variance}
          </Text>
        </View>

        <TouchableOpacity
          testID={`stock-take-mark-${item.id}`}
          onPress={handleMark}
          style={[
            styles.markButton,
            isCounted && styles.markButtonActive,
          ]}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isCounted ? "checkmark-circle" : "checkmark-circle-outline"}
            size={24}
            color={isCounted ? COLORS.green : COLORS.muted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

function StockTakeForm({
  stockTakeName,
  items,
  onUpdateCount,
  onMarkCounted,
  filterCategory,
  onFilterCategoryChange,
  categories,
  searchQuery,
  onSearchChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: StockTakeFormProps) {
  // ── Filtered items ─────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    let result = items;

    if (filterCategory) {
      result = result.filter((i) => i.category === filterCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.productName.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q)
      );
    }

    return result;
  }, [items, filterCategory, searchQuery]);

  // ── Progress stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = items.length;
    const counted = items.filter((i) => i.countedQty !== null).length;
    const uncounted = total - counted;
    const withVariance = items.filter(
      (i) => i.countedQty !== null && i.countedQty !== i.expectedQty
    ).length;

    return { total, counted, uncounted, withVariance };
  }, [items]);

  const progressPct = useMemo(
    () => (stats.total > 0 ? Math.round((stats.counted / stats.total) * 100) : 0),
    [stats]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCategoryPress = useCallback(
    (cat: string) => {
      triggerHaptic("selection");
      // Toggle: tapping the active category clears the filter
      onFilterCategoryChange(cat === filterCategory ? "" : cat);
    },
    [filterCategory, onFilterCategoryChange]
  );

  const handleSubmit = useCallback(() => {
    triggerHaptic("success");
    onSubmit();
  }, [onSubmit]);

  const handleCancel = useCallback(() => {
    triggerHaptic("tap");
    onCancel();
  }, [onCancel]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<StockTakeItem>) => (
      <StockTakeItemRow
        item={item}
        onUpdateCount={onUpdateCount}
        onMarkCounted={onMarkCounted}
      />
    ),
    [onUpdateCount, onMarkCounted]
  );

  const keyExtractor = useCallback(
    (item: StockTakeItem) => item.id,
    []
  );

  // ── List header ────────────────────────────────────────────────────────────

  const ListHeader = useMemo(
    () => (
      <View>
        {/* Header with progress */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="clipboard-outline" size={22} color={COLORS.purple} />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {stockTakeName}
            </Text>
          </View>
          <View
            testID="stock-take-progress"
            style={styles.progressBadge}
          >
            <Text style={styles.progressText}>
              {stats.counted}/{stats.total}
            </Text>
            <Text style={styles.progressPct}>{progressPct}%</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarOuter}>
          <View
            style={[
              styles.progressBarInner,
              {
                width: `${progressPct}%` as any,
                backgroundColor:
                  progressPct === 100 ? COLORS.green : COLORS.blue,
              },
            ]}
          />
        </View>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={COLORS.muted} />
          <TextInput
            testID="stock-take-search"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search products or SKU…"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {/* Category filter pills */}
        {categories.length > 0 && (
          <View style={styles.categoryRow}>
            {categories.map((cat) => (
              <CategoryPill
                key={cat}
                label={cat}
                isActive={filterCategory === cat}
                onPress={() => handleCategoryPress(cat)}
              />
            ))}
          </View>
        )}

        <Text style={styles.listSectionLabel}>
          ITEMS ({filteredItems.length})
        </Text>
      </View>
    ),
    [
      stockTakeName,
      stats,
      progressPct,
      searchQuery,
      onSearchChange,
      categories,
      filterCategory,
      handleCategoryPress,
      filteredItems.length,
    ]
  );

  // ── List footer (summary + actions) ────────────────────────────────────────

  const ListFooter = useMemo(
    () => (
      <View style={styles.footerContainer}>
        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>COUNT SUMMARY</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Items</Text>
            <Text style={styles.summaryValue}>{stats.total}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Counted</Text>
            <Text style={[styles.summaryValue, { color: COLORS.green }]}>
              {stats.counted}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Uncounted</Text>
            <Text
              style={[
                styles.summaryValue,
                { color: stats.uncounted > 0 ? COLORS.amber : COLORS.green },
              ]}
            >
              {stats.uncounted}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryRowLast]}>
            <Text style={styles.summaryLabel}>With Variance</Text>
            <Text
              style={[
                styles.summaryValue,
                { color: stats.withVariance > 0 ? COLORS.red : COLORS.green },
              ]}
            >
              {stats.withVariance}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            testID="stock-take-cancel"
            onPress={handleCancel}
            style={styles.cancelButton}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Ionicons name="close-outline" size={20} color={COLORS.text} />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="stock-take-submit"
            onPress={handleSubmit}
            style={[
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled,
            ]}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color={COLORS.text}
                />
                <Text style={styles.submitButtonText}>Submit Count</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    ),
    [stats, isSubmitting, handleCancel, handleSubmit]
  );

  // ── Empty state ────────────────────────────────────────────────────────────

  const EmptyList = useMemo(
    () => (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={36} color={COLORS.muted} />
        <Text style={styles.emptyText}>No items match</Text>
        <Text style={styles.emptySubtext}>
          Try adjusting your search or category filter
        </Text>
      </View>
    ),
    []
  );

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <View testID="stock-take-form" style={styles.container}>
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={EmptyList}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    flex: 1,
  },
  progressBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  progressText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  progressPct: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.blue,
  },

  // Progress bar
  progressBarOuter: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: 16,
  },
  progressBarInner: {
    height: 4,
    borderRadius: 2,
  },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.input,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    paddingVertical: 12,
    minHeight: 48,
  },

  // Category pills
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  categoryPill: {
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  categoryPillActive: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.muted,
  },
  categoryPillTextActive: {
    color: COLORS.text,
  },

  // List section label
  listSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 8,
  },

  // Item row
  itemRow: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  itemSku: {
    fontSize: 12,
    color: COLORS.muted,
    fontFamily: "monospace",
    marginTop: 2,
  },
  expectedBadge: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: `${COLORS.muted}15`,
  },
  expectedLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: COLORS.muted,
    textTransform: "uppercase",
  },
  expectedValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.muted,
  },

  // Count row
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  countInputGroup: {
    flex: 2,
  },
  countInputLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.muted,
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  countInput: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 48,
  },
  varianceGroup: {
    flex: 1,
    alignItems: "center",
  },
  varianceLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.muted,
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  varianceValue: {
    fontSize: 20,
    fontWeight: "800",
    paddingVertical: 10,
  },
  markButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    // Self-align to bottom so it lines up with the input
    alignSelf: "flex-end",
  },
  markButtonActive: {
    backgroundColor: `${COLORS.green}20`,
    borderColor: COLORS.green,
  },

  // Footer
  footerContainer: {
    marginTop: 8,
  },

  // Summary
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.muted,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },

  // Actions
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  submitButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: COLORS.blue,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 6,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.muted,
  },
});

export default React.memo(StockTakeForm);
