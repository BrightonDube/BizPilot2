/**
 * BulkApprovalList — List for approving/rejecting bulk stock operations.
 *
 * Why checkbox multi-select instead of swipe gestures?
 * Month-end approval workflows involve 50-200+ items. Swipe-to-approve
 * would be tedious at scale. Checkboxes + "Approve All" lets managers
 * batch-process quickly, while individual buttons handle exceptions.
 *
 * Why filter by operation type?
 * Different managers may be responsible for different operation types
 * (e.g., finance approves waste write-offs, ops approves transfers).
 * Type filters let each approver focus on their domain.
 *
 * @module BulkApprovalList
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { triggerHaptic } from "@/utils/haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

type ApprovalStatus = "pending" | "approved" | "rejected";

interface ApprovalItem {
  id: string;
  type: "adjustment" | "waste" | "transfer" | "stock_take";
  description: string;
  requestedBy: string;
  requestedAt: string;
  quantity: number;
  value: number;
  status: ApprovalStatus;
}

interface BulkApprovalListProps {
  items: ApprovalItem[];
  onApprove: (itemId: string) => void;
  onReject: (itemId: string) => void;
  onApproveAll: () => void;
  onRejectAll: () => void;
  selectedIds: string[];
  onToggleSelect: (itemId: string) => void;
  onSelectAll: () => void;
  isProcessing?: boolean;
  filterType: string;
  onFilterTypeChange: (type: string) => void;
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

// ─── Type metadata ───────────────────────────────────────────────────────────

interface TypeMeta {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const TYPE_META: Record<ApprovalItem["type"], TypeMeta> = {
  adjustment: {
    key: "adjustment",
    label: "Adjustment",
    icon: "swap-horizontal-outline",
    color: COLORS.blue,
  },
  waste: {
    key: "waste",
    label: "Waste",
    icon: "trash-outline",
    color: COLORS.red,
  },
  transfer: {
    key: "transfer",
    label: "Transfer",
    icon: "arrow-forward-outline",
    color: COLORS.purple,
  },
  stock_take: {
    key: "stock_take",
    label: "Stock Take",
    icon: "clipboard-outline",
    color: COLORS.amber,
  },
};

const FILTER_OPTIONS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "adjustment", label: "Adjustment" },
  { key: "waste", label: "Waste" },
  { key: "transfer", label: "Transfer" },
  { key: "stock_take", label: "Stock Take" },
];

// ─── Status badge colours ────────────────────────────────────────────────────

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  pending: COLORS.amber,
  approved: COLORS.green,
  rejected: COLORS.red,
};

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Filter pill for operation type.
 */
const FilterPill = React.memo(function FilterPill({
  filterKey,
  label,
  isActive,
  onPress,
}: {
  filterKey: string;
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      testID={`approval-filter-${filterKey || "all"}`}
      onPress={onPress}
      style={[styles.filterPill, isActive && styles.filterPillActive]}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.filterPillText,
          isActive && styles.filterPillTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});

/**
 * Individual approval row with checkbox, type badge, and approve/reject buttons.
 */
const ApprovalItemRow = React.memo(function ApprovalItemRow({
  item,
  isSelected,
  onToggleSelect,
  onApprove,
  onReject,
  isProcessing,
}: {
  item: ApprovalItem;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isProcessing: boolean;
}) {
  const typeMeta = TYPE_META[item.type];
  const statusColor = STATUS_COLORS[item.status];

  const handleToggle = useCallback(() => {
    triggerHaptic("selection");
    onToggleSelect(item.id);
  }, [item.id, onToggleSelect]);

  const handleApprove = useCallback(() => {
    triggerHaptic("success");
    onApprove(item.id);
  }, [item.id, onApprove]);

  const handleReject = useCallback(() => {
    triggerHaptic("warning");
    onReject(item.id);
  }, [item.id, onReject]);

  /** Format date string to a readable short format. */
  const dateStr = useMemo(() => {
    try {
      const d = new Date(item.requestedAt);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return item.requestedAt;
    }
  }, [item.requestedAt]);

  return (
    <View
      testID={`approval-item-${item.id}`}
      style={[styles.itemRow, { borderLeftColor: typeMeta.color }]}
    >
      {/* Top row: checkbox + type badge + description */}
      <View style={styles.itemTopRow}>
        <TouchableOpacity
          testID={`approval-select-${item.id}`}
          onPress={handleToggle}
          style={styles.checkbox}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isSelected ? "checkbox" : "square-outline"}
            size={24}
            color={isSelected ? COLORS.blue : COLORS.muted}
          />
        </TouchableOpacity>

        <View style={[styles.typeBadge, { backgroundColor: `${typeMeta.color}20` }]}>
          <Ionicons name={typeMeta.icon} size={14} color={typeMeta.color} />
          <Text style={[styles.typeBadgeText, { color: typeMeta.color }]}>
            {typeMeta.label}
          </Text>
        </View>

        <Text style={styles.itemDescription} numberOfLines={2}>
          {item.description}
        </Text>
      </View>

      {/* Middle row: metadata */}
      <View style={styles.itemMetaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="person-outline" size={13} color={COLORS.muted} />
          <Text style={styles.metaText}>{item.requestedBy}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={13} color={COLORS.muted} />
          <Text style={styles.metaText}>{dateStr}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Qty:</Text>
          <Text style={styles.metaValue}>{item.quantity}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Value:</Text>
          <Text style={styles.metaValue}>{formatCurrency(item.value)}</Text>
        </View>
      </View>

      {/* Bottom row: status + action buttons */}
      <View style={styles.itemActionRow}>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            testID={`approval-approve-${item.id}`}
            onPress={handleApprove}
            style={styles.approveButton}
            disabled={isProcessing || item.status === "approved"}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark" size={18} color={COLORS.text} />
            <Text style={styles.approveButtonText}>Approve</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID={`approval-reject-${item.id}`}
            onPress={handleReject}
            style={styles.rejectButton}
            disabled={isProcessing || item.status === "rejected"}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color={COLORS.text} />
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

function BulkApprovalList({
  items,
  onApprove,
  onReject,
  onApproveAll,
  onRejectAll,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  isProcessing = false,
  filterType,
  onFilterTypeChange,
}: BulkApprovalListProps) {
  // ── Filtered items ─────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (!filterType) return items;
    return items.filter((i) => i.type === filterType);
  }, [items, filterType]);

  // ── Pending count ──────────────────────────────────────────────────────────

  const pendingCount = useMemo(
    () => items.filter((i) => i.status === "pending").length,
    [items]
  );

  // ── Selection state ────────────────────────────────────────────────────────

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleFilterPress = useCallback(
    (key: string) => {
      triggerHaptic("selection");
      onFilterTypeChange(key);
    },
    [onFilterTypeChange]
  );

  const handleSelectAll = useCallback(() => {
    triggerHaptic("tap");
    onSelectAll();
  }, [onSelectAll]);

  const handleApproveAll = useCallback(() => {
    triggerHaptic("success");
    onApproveAll();
  }, [onApproveAll]);

  const handleRejectAll = useCallback(() => {
    triggerHaptic("warning");
    onRejectAll();
  }, [onRejectAll]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ApprovalItem>) => (
      <ApprovalItemRow
        item={item}
        isSelected={selectedSet.has(item.id)}
        onToggleSelect={onToggleSelect}
        onApprove={onApprove}
        onReject={onReject}
        isProcessing={isProcessing}
      />
    ),
    [selectedSet, onToggleSelect, onApprove, onReject, isProcessing]
  );

  const keyExtractor = useCallback(
    (item: ApprovalItem) => item.id,
    []
  );

  // ── List header ────────────────────────────────────────────────────────────

  const ListHeader = useMemo(
    () => (
      <View>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.purple} />
            <Text style={styles.headerTitle}>Bulk Approvals</Text>
          </View>
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>
                {pendingCount} pending
              </Text>
            </View>
          )}
        </View>

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((opt) => (
            <FilterPill
              key={opt.key || "all"}
              filterKey={opt.key}
              label={opt.label}
              isActive={filterType === opt.key}
              onPress={() => handleFilterPress(opt.key)}
            />
          ))}
        </View>

        {/* Bulk action bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            testID="approval-select-all"
            onPress={handleSelectAll}
            style={styles.actionBarButton}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            <Ionicons name="checkbox-outline" size={18} color={COLORS.blue} />
            <Text style={[styles.actionBarText, { color: COLORS.blue }]}>
              Select All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="approval-approve-all"
            onPress={handleApproveAll}
            style={styles.actionBarButton}
            disabled={isProcessing || selectedIds.length === 0}
            activeOpacity={0.7}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={COLORS.green} />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={18} color={COLORS.green} />
                <Text style={[styles.actionBarText, { color: COLORS.green }]}>
                  Approve All
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID="approval-reject-all"
            onPress={handleRejectAll}
            style={styles.actionBarButton}
            disabled={isProcessing || selectedIds.length === 0}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle-outline" size={18} color={COLORS.red} />
            <Text style={[styles.actionBarText, { color: COLORS.red }]}>
              Reject All
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [
      pendingCount,
      filterType,
      handleFilterPress,
      handleSelectAll,
      handleApproveAll,
      handleRejectAll,
      isProcessing,
      selectedIds.length,
    ]
  );

  // ── Empty state ────────────────────────────────────────────────────────────

  const EmptyList = useMemo(
    () => (
      <View testID="approval-empty" style={styles.emptyState}>
        <Ionicons name="checkmark-done-outline" size={48} color={COLORS.muted} />
        <Text style={styles.emptyText}>No items to review</Text>
        <Text style={styles.emptySubtext}>
          {filterType
            ? "Try clearing the filter to see all items"
            : "All stock operations have been processed"}
        </Text>
      </View>
    ),
    [filterType]
  );

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <View testID="bulk-approval-list" style={styles.container}>
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyList}
        contentContainerStyle={styles.contentContainer}
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
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: `${COLORS.amber}20`,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.amber,
  },

  // Filter pills
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  filterPillActive: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.muted,
  },
  filterPillTextActive: {
    color: COLORS.text,
  },

  // Action bar
  actionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  actionBarText: {
    fontSize: 13,
    fontWeight: "600",
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
  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  checkbox: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  itemDescription: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },

  // Meta row
  itemMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 10,
    paddingLeft: 48,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  metaLabel: {
    fontSize: 12,
    color: COLORS.muted,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
  },

  // Action row
  itemActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 48,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  approveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: COLORS.green,
  },
  approveButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  rejectButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: COLORS.red,
  },
  rejectButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});

export default React.memo(BulkApprovalList);
