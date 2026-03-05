/**
 * TransferListScreen — Lists inter-location stock transfers with status filtering.
 *
 * Filter pills let the user quickly narrow by workflow stage so they can
 * focus on what needs attention (e.g. "in_transit" for receiving teams).
 */
import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type TransferStatus =
  | "draft"
  | "pending"
  | "in_transit"
  | "received"
  | "cancelled";

export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromLocation: string;
  toLocation: string;
  itemCount: number;
  totalValue: number;
  status: TransferStatus;
  createdAt: string;
  createdBy: string;
}

export interface TransferListScreenProps {
  transfers: StockTransfer[];
  onTransferPress: (transferId: string) => void;
  onCreateTransfer: () => void;
  filterStatus: TransferStatus | "all";
  onFilterChange: (status: TransferStatus | "all") => void;
  isLoading?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Map every status to a colour so badges are visually distinct at a glance. */
const STATUS_CONFIG: Record<
  TransferStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  draft: {
    label: "Draft",
    color: "#9ca3af",
    bg: "rgba(156,163,175,0.15)",
    icon: "document-outline",
  },
  pending: {
    label: "Pending",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.15)",
    icon: "time-outline",
  },
  in_transit: {
    label: "In Transit",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.15)",
    icon: "airplane-outline",
  },
  received: {
    label: "Received",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.15)",
    icon: "checkmark-circle-outline",
  },
  cancelled: {
    label: "Cancelled",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.15)",
    icon: "close-circle-outline",
  },
};

const FILTER_OPTIONS: Array<{ key: TransferStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "pending", label: "Pending" },
  { key: "in_transit", label: "In Transit" },
  { key: "received", label: "Received" },
  { key: "cancelled", label: "Cancelled" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Simple date formatter — avoids pulling in a heavy date library. */
const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

interface StatusBadgeProps {
  status: TransferStatus;
}

/** Coloured pill showing the transfer's workflow stage. */
const StatusBadge = React.memo<StatusBadgeProps>(function StatusBadge({
  status,
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
      <Text style={[styles.statusBadgeText, { color: cfg.color }]}>
        {cfg.label}
      </Text>
    </View>
  );
});

/* ---- Transfer card ---- */

interface TransferCardProps {
  transfer: StockTransfer;
  onPress: (id: string) => void;
}

const TransferCard = React.memo<TransferCardProps>(function TransferCard({
  transfer,
  onPress,
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(transfer.id);
  }, [transfer.id, onPress]);

  return (
    <TouchableOpacity
      testID={`transfer-card-${transfer.id}`}
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* ---- Row 1: Number + status ---- */}
      <View style={styles.cardHeader}>
        <Text style={styles.transferNumber}>{transfer.transferNumber}</Text>
        <StatusBadge status={transfer.status} />
      </View>

      {/* ---- Row 2: From → To ---- */}
      <View style={styles.routeRow}>
        <View style={styles.routePoint}>
          <Ionicons name="location-outline" size={14} color="#9ca3af" />
          <Text style={styles.routeText} numberOfLines={1}>
            {transfer.fromLocation}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={14} color="#6b7280" />
        <View style={styles.routePoint}>
          <Ionicons name="location" size={14} color="#3b82f6" />
          <Text style={styles.routeText} numberOfLines={1}>
            {transfer.toLocation}
          </Text>
        </View>
      </View>

      {/* ---- Row 3: Items + value ---- */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Ionicons name="cube-outline" size={14} color="#8b5cf6" />
          <Text style={styles.metricValue}>
            {transfer.itemCount} item{transfer.itemCount !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.metric}>
          <Ionicons name="cash-outline" size={14} color="#22c55e" />
          <Text style={styles.metricValue}>
            {formatCurrency(transfer.totalValue)}
          </Text>
        </View>
      </View>

      {/* ---- Row 4: Created by + date ---- */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="person-outline" size={12} color="#6b7280" />
          <Text style={styles.metaText}>{transfer.createdBy}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={12} color="#6b7280" />
          <Text style={styles.metaText}>{formatDate(transfer.createdAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

/* ---- Filter pill ---- */

interface FilterPillProps {
  label: string;
  filterKey: TransferStatus | "all";
  isSelected: boolean;
  onPress: (key: TransferStatus | "all") => void;
}

const FilterPill = React.memo<FilterPillProps>(function FilterPill({
  label,
  filterKey,
  isSelected,
  onPress,
}) {
  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onPress(filterKey);
  }, [filterKey, onPress]);

  return (
    <TouchableOpacity
      testID={`transfer-filter-${filterKey}`}
      style={[styles.pill, isSelected && styles.pillSelected]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const TransferListScreen: React.FC<TransferListScreenProps> = ({
  transfers,
  onTransferPress,
  onCreateTransfer,
  filterStatus,
  onFilterChange,
  isLoading = false,
}) => {
  /** Client-side filter keeps the UI snappy while a background refetch may occur. */
  const filtered = useMemo(() => {
    if (filterStatus === "all") return transfers;
    return transfers.filter((t) => t.status === filterStatus);
  }, [transfers, filterStatus]);

  const handleCreate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCreateTransfer();
  }, [onCreateTransfer]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<StockTransfer>) => (
      <TransferCard transfer={item} onPress={onTransferPress} />
    ),
    [onTransferPress],
  );

  const keyExtractor = useCallback((item: StockTransfer) => item.id, []);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View testID="transfer-empty" style={styles.emptyContainer}>
        <Ionicons name="swap-horizontal-outline" size={48} color="#4b5563" />
        <Text style={styles.emptyTitle}>No transfers found</Text>
        <Text style={styles.emptySubtitle}>
          {filterStatus !== "all"
            ? "Try a different filter"
            : "Create your first stock transfer"}
        </Text>
      </View>
    );
  }, [isLoading, filterStatus]);

  return (
    <View testID="transfer-list" style={styles.container}>
      {/* ---- Header ---- */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stock Transfers</Text>
        <TouchableOpacity
          testID="transfer-create"
          style={styles.createButton}
          onPress={handleCreate}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.createButtonText}>New Transfer</Text>
        </TouchableOpacity>
      </View>

      {/* ---- Filter pills ---- */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_OPTIONS.map((opt) => (
          <FilterPill
            key={opt.key}
            label={opt.label}
            filterKey={opt.key}
            isSelected={filterStatus === opt.key}
            onPress={onFilterChange}
          />
        ))}
      </ScrollView>

      {/* ---- Loading ---- */}
      {isLoading && (
        <View testID="transfer-loading" style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading transfers…</Text>
        </View>
      )}

      {/* ---- List ---- */}
      {!isLoading && (
        <FlatList<StockTransfer>
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  /* Layout */
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  separator: {
    height: 12,
  },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#22c55e",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  createButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },

  /* Filters */
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  pillSelected: {
    backgroundColor: "rgba(59,130,246,0.2)",
    borderColor: "#3b82f6",
  },
  pillText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#9ca3af",
  },
  pillTextSelected: {
    color: "#3b82f6",
  },

  /* Card */
  card: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  transferNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
  },

  /* Status badge */
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  /* Route */
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  routeText: {
    fontSize: 13,
    color: "#d1d5db",
    flex: 1,
  },

  /* Metrics */
  metricsRow: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 10,
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f3f4f6",
  },

  /* Meta */
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#6b7280",
  },

  /* Loading */
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#9ca3af",
    fontSize: 14,
  },

  /* Empty */
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
});

export default React.memo(TransferListScreen);
