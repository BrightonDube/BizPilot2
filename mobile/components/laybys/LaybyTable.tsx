/**
 * LaybyTable — searchable, filterable list of laybys (lay-aways).
 *
 * Layout: Header → Stats Row → Filter Pills → Search → FlatList of cards.
 * Each card shows reference, customer, payment progress bar, amounts,
 * next payment date, and a colour-coded status badge.
 *
 * Why FlatList?
 * A busy retail store may have hundreds of active laybys. FlatList
 * virtualises the list so only visible rows are rendered — essential
 * for tablet-first POS performance.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ListRenderItemInfo,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { triggerHaptic } from "@/utils/haptics";
import {
  Layby,
  LaybyStatus,
  LAYBY_STATUS_LABELS,
  LAYBY_STATUS_COLORS,
  searchLaybys,
  sortLaybysByDate,
  filterLaybysByStatus,
  getLaybyProgress,
  isPaymentOverdue,
} from "@/services/laybys/LaybyService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LaybyTableProps {
  laybys: Layby[];
  onLaybyPress: (laybyId: string) => void;
  onCreateNew: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Filter config
// ---------------------------------------------------------------------------

interface FilterOption {
  key: LaybyStatus | "all";
  label: string;
  testID: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { key: "all", label: "All", testID: "layby-filter-all" },
  { key: "active", label: "Active", testID: "layby-filter-active" },
  { key: "overdue", label: "Overdue", testID: "layby-filter-overdue" },
  { key: "ready_for_collection", label: "Ready", testID: "layby-filter-ready_for_collection" },
  { key: "completed", label: "Completed", testID: "layby-filter-completed" },
  { key: "cancelled", label: "Cancelled", testID: "layby-filter-cancelled" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Stat mini-card used in the stats row. */
const StatCard = React.memo(function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

/** Horizontal progress bar showing payment completion. */
const ProgressBar = React.memo(function ProgressBar({
  percentage,
}: {
  percentage: number;
}) {
  return (
    <View style={styles.progressBarBg}>
      <View
        style={[
          styles.progressBarFill,
          {
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: percentage >= 100 ? "#22c55e" : "#3b82f6",
          },
        ]}
      />
    </View>
  );
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function LaybyTableInner({
  laybys,
  onLaybyPress,
  onCreateNew,
  onBack,
  isLoading = false,
}: LaybyTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<LaybyStatus | "all">("all");

  const now = useMemo(() => new Date(), []);

  // --- Derived data ---

  const stats = useMemo(() => {
    const active = laybys.filter((l) => l.status === "active").length;
    const overdue = laybys.filter(
      (l) => l.status === "overdue" || (l.status === "active" && isPaymentOverdue(l.schedule, now))
    ).length;
    const totalValue = laybys
      .filter((l) => l.status === "active" || l.status === "overdue")
      .reduce((sum, l) => sum + l.balanceDue, 0);
    const ready = laybys.filter((l) => l.status === "ready_for_collection").length;

    return { active, overdue, totalValue, ready };
  }, [laybys, now]);

  const filteredLaybys = useMemo(() => {
    let result = laybys;

    if (activeFilter !== "all") {
      result = filterLaybysByStatus(result, [activeFilter]);
    }

    result = searchLaybys(result, searchQuery);
    return sortLaybysByDate(result, "startDate", "desc");
  }, [laybys, activeFilter, searchQuery]);

  // --- Handlers ---

  const handleFilterPress = useCallback((filter: LaybyStatus | "all") => {
    triggerHaptic("selection");
    setActiveFilter(filter);
  }, []);

  const handleCreatePress = useCallback(() => {
    triggerHaptic("tap");
    onCreateNew();
  }, [onCreateNew]);

  const handleBackPress = useCallback(() => {
    triggerHaptic("tap");
    onBack();
  }, [onBack]);

  // --- FlatList renderItem ---

  const renderLaybyCard = useCallback(
    ({ item }: ListRenderItemInfo<Layby>) => {
      const statusColor = LAYBY_STATUS_COLORS[item.status];
      const progress = getLaybyProgress(item.amountPaid, item.totalAmount);
      const itemCount = item.items.reduce((sum, i) => sum + i.quantity, 0);

      const nextPayDate = item.nextPaymentDate
        ? new Date(item.nextPaymentDate).toLocaleDateString("en-ZA", {
            day: "numeric",
            month: "short",
          })
        : null;

      return (
        <TouchableOpacity
          style={styles.laybyCard}
          onPress={() => {
            triggerHaptic("tap");
            onLaybyPress(item.id);
          }}
          testID={`layby-card-${item.id}`}
        >
          {/* Row 1: Reference + status badge */}
          <View style={styles.cardTopRow}>
            <Text style={styles.referenceNumber}>{item.referenceNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {LAYBY_STATUS_LABELS[item.status]}
              </Text>
            </View>
          </View>

          {/* Row 2: Customer name */}
          <Text style={styles.customerName} numberOfLines={1}>
            {item.customerName}
          </Text>

          {/* Row 3: Progress bar */}
          <ProgressBar percentage={progress.percentage} />

          {/* Row 4: Amount paid / total */}
          <View style={styles.amountRow}>
            <Text style={styles.amountPaid}>
              {formatCurrency(item.amountPaid)}
            </Text>
            <Text style={styles.amountSeparator}>/</Text>
            <Text style={styles.amountTotal}>
              {formatCurrency(item.totalAmount)}
            </Text>
            <Text style={styles.progressPercentage}>
              {progress.percentage.toFixed(0)}%
            </Text>
          </View>

          {/* Row 5: Next payment + items count */}
          <View style={styles.cardBottomRow}>
            {nextPayDate && item.nextPaymentAmount > 0 ? (
              <Text style={styles.nextPayment}>
                Next: {nextPayDate} · {formatCurrency(item.nextPaymentAmount)}
              </Text>
            ) : (
              <Text style={styles.nextPayment}> </Text>
            )}
            <Text style={styles.itemsCount}>
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [onLaybyPress]
  );

  const keyExtractor = useCallback((item: Layby) => item.id, []);

  // --- Render ---

  return (
    <View style={styles.container} testID="layby-table">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBackPress}
          hitSlop={12}
          testID="layby-back-btn"
        >
          <Ionicons name="arrow-back" size={24} color="#f3f4f6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Laybys</Text>
        <TouchableOpacity
          style={styles.newButton}
          onPress={handleCreatePress}
          testID="layby-new-btn"
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newButtonText}>New Layby</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow} testID="layby-stats">
        <StatCard label="Active" value={stats.active} color="#22c55e" />
        <StatCard label="Overdue" value={stats.overdue} color="#fbbf24" />
        <StatCard
          label="Total Due"
          value={formatCurrency(stats.totalValue)}
          color="#f3f4f6"
        />
        <StatCard label="Ready" value={stats.ready} color="#3b82f6" />
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_OPTIONS.map((opt) => {
          const isActive = activeFilter === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => handleFilterPress(opt.key)}
              testID={opt.testID}
            >
              <Text
                style={[
                  styles.filterPillText,
                  isActive && styles.filterPillTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by reference or customer name…"
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="layby-search-input"
        />
      </View>

      {/* Layby List */}
      {isLoading ? (
        <View style={styles.loadingState} testID="layby-loading">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading laybys…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLaybys}
          renderItem={renderLaybyCard}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState} testID="layby-empty">
              <Ionicons name="layers-outline" size={48} color="#4b5563" />
              <Text style={styles.emptyText}>No laybys found</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery || activeFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : 'Tap "New Layby" to create one'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const LaybyTable = React.memo(LaybyTableInner);
export default LaybyTable;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#f3f4f6" },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 48,
  },
  newButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  /* Stats row */
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, color: "#9ca3af", marginTop: 2 },

  /* Filter pills */
  filterRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    minHeight: 48,
    justifyContent: "center",
  },
  filterPillActive: { borderColor: "#3b82f6", backgroundColor: "#1e3a5f" },
  filterPillText: { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  filterPillTextActive: { color: "#3b82f6" },

  /* Search */
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 16,
    paddingVertical: 12,
  },

  /* List */
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },

  /* Loading */
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#9ca3af", fontSize: 14, marginTop: 12 },

  /* Empty */
  emptyState: { alignItems: "center", paddingVertical: 64 },
  emptyText: { color: "#6b7280", fontSize: 16, marginTop: 12 },
  emptySubtext: { color: "#4b5563", fontSize: 13, marginTop: 4 },

  /* Layby card */
  laybyCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  referenceNumber: { color: "#f3f4f6", fontSize: 16, fontWeight: "700" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  customerName: { color: "#d1d5db", fontSize: 14, marginBottom: 10 },

  /* Progress bar */
  progressBarBg: {
    height: 6,
    backgroundColor: "#374151",
    borderRadius: 3,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },

  /* Amounts */
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 8,
  },
  amountPaid: { color: "#f3f4f6", fontSize: 16, fontWeight: "700" },
  amountSeparator: { color: "#6b7280", fontSize: 14 },
  amountTotal: { color: "#9ca3af", fontSize: 14 },
  progressPercentage: {
    color: "#6b7280",
    fontSize: 12,
    marginLeft: "auto",
  },

  /* Bottom row */
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nextPayment: { color: "#6b7280", fontSize: 12 },
  itemsCount: { color: "#6b7280", fontSize: 11 },
});
