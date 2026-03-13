/**
 * BizPilot Mobile POS — AlertDisplay Component
 *
 * Displays inventory alerts (low stock, out of stock, expiring items, reorder
 * reminders, count discrepancies) in a filterable, scrollable list.
 *
 * Why a dedicated alert display instead of inline notifications?
 * 1. Centralised view — staff can triage all inventory issues from one screen
 *    rather than discovering them ad-hoc while ringing up sales.
 * 2. Severity filtering — a busy restaurant manager can focus on critical
 *    stock-outs first, then address warnings during quieter periods.
 * 3. Acknowledgement tracking — once an alert is acknowledged it is visually
 *    muted, giving clear signal of what still needs attention.
 *
 * Why React.memo?
 * The alert list may contain dozens of items. Memoising the outer component
 * and each card prevents full list re-renders when a single alert is
 * acknowledged or a filter is toggled.
 */

import React, { useState, useMemo, useCallback } from "react";
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
import * as Haptics from "expo-haptics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlertSeverity = "critical" | "warning" | "info";

type AlertType =
  | "low_stock"
  | "out_of_stock"
  | "expiring_soon"
  | "reorder_needed"
  | "count_discrepancy";

interface InventoryAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  productName: string;
  productId: string;
  message: string;
  currentStock?: number;
  reorderLevel?: number;
  expiryDate?: string;
  createdAt: string;
  isAcknowledged: boolean;
}

interface AlertDisplayProps {
  alerts: InventoryAlert[];
  onAcknowledge: (alertId: string) => void;
  onAlertPress?: (alert: InventoryAlert) => void;
  onDismissAll?: () => void;
  /** When true, acknowledged alerts are included in the list. */
  showAcknowledged?: boolean;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type FilterKey = "all" | AlertSeverity;

const SEVERITY_FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warning" },
  { key: "info", label: "Info" },
];

/**
 * Maps alert types to human-readable badge labels.
 * Why a record instead of a switch? Constant-time lookup with zero branching,
 * and adding new types is a single-line change.
 */
const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
  expiring_soon: "Expiring Soon",
  reorder_needed: "Reorder",
  count_discrepancy: "Discrepancy",
};

/** Severity → icon / colour mapping */
const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  critical: { icon: "alert-circle", color: "#ef4444" },
  warning: { icon: "warning", color: "#fbbf24" },
  info: { icon: "information-circle", color: "#3b82f6" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable relative time string ("2 h ago", "3 d ago").
 *
 * Why hand-rolled instead of date-fns/moment?
 * We only need coarse granularity (minutes/hours/days) and adding a date
 * library would bloat the bundle for this single use-case.
 */
function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Format an ISO date to a short readable string. */
function formatExpiryDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// AlertCard — individual alert row
// ---------------------------------------------------------------------------

interface AlertCardProps {
  alert: InventoryAlert;
  onAcknowledge: (alertId: string) => void;
  onPress?: (alert: InventoryAlert) => void;
}

/**
 * Single alert card showing severity, product info, and acknowledge action.
 *
 * Why React.memo on the card?
 * FlatList re-renders visible items on any state change in the parent.
 * Memoising each card means only the mutated card (e.g. after acknowledgement)
 * actually re-renders.
 */
const AlertCard = React.memo(function AlertCard({
  alert,
  onAcknowledge,
  onPress,
}: AlertCardProps) {
  const severity = SEVERITY_CONFIG[alert.severity];

  const handleAcknowledge = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAcknowledge(alert.id);
  }, [alert.id, onAcknowledge]);

  const handlePress = useCallback(() => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress(alert);
    }
  }, [alert, onPress]);

  return (
    <TouchableOpacity
      testID={`alert-card-${alert.id}`}
      style={[styles.card, alert.isAcknowledged && styles.cardAcknowledged]}
      onPress={handlePress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityRole="button"
      accessibilityLabel={`${alert.severity} alert for ${alert.productName}`}
    >
      {/* Top row: severity icon + product + time */}
      <View style={styles.cardHeader}>
        <Ionicons
          name={severity.icon}
          size={22}
          color={alert.isAcknowledged ? "#4b5563" : severity.color}
        />
        <View style={styles.cardHeaderText}>
          <Text
            style={[
              styles.productName,
              alert.isAcknowledged && styles.textMuted,
            ]}
            numberOfLines={1}
          >
            {alert.productName}
          </Text>
          <Text style={styles.timeText}>{timeAgo(alert.createdAt)}</Text>
        </View>
      </View>

      {/* Alert type badge */}
      <View style={styles.badgeRow}>
        <View
          style={[
            styles.typeBadge,
            {
              backgroundColor: alert.isAcknowledged
                ? "#374151"
                : `${severity.color}20`,
            },
          ]}
        >
          <Text
            style={[
              styles.typeBadgeText,
              {
                color: alert.isAcknowledged ? "#6b7280" : severity.color,
              },
            ]}
          >
            {ALERT_TYPE_LABELS[alert.type]}
          </Text>
        </View>
      </View>

      {/* Message */}
      <Text
        style={[styles.messageText, alert.isAcknowledged && styles.textMuted]}
        numberOfLines={2}
      >
        {alert.message}
      </Text>

      {/* Stock / expiry details */}
      {(alert.currentStock !== undefined || alert.expiryDate) && (
        <View style={styles.detailsRow}>
          {alert.currentStock !== undefined && (
            <View style={styles.detailChip}>
              <Ionicons name="cube-outline" size={14} color="#9ca3af" />
              <Text style={styles.detailText}>
                Stock: {alert.currentStock}
                {alert.reorderLevel !== undefined &&
                  ` / Reorder: ${alert.reorderLevel}`}
              </Text>
            </View>
          )}
          {alert.expiryDate && (
            <View style={styles.detailChip}>
              <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
              <Text style={styles.detailText}>
                Expires: {formatExpiryDate(alert.expiryDate)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Acknowledge button */}
      {!alert.isAcknowledged && (
        <TouchableOpacity
          testID={`alert-acknowledge-${alert.id}`}
          style={styles.acknowledgeButton}
          onPress={handleAcknowledge}
          accessibilityRole="button"
          accessibilityLabel={`Acknowledge alert for ${alert.productName}`}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#22c55e" />
          <Text style={styles.acknowledgeText}>Acknowledge</Text>
        </TouchableOpacity>
      )}

      {alert.isAcknowledged && (
        <View style={styles.acknowledgedBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#4b5563" />
          <Text style={styles.acknowledgedText}>Acknowledged</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Severity filter pills
// ---------------------------------------------------------------------------

interface FilterPillsProps {
  activeFilter: FilterKey;
  onFilterChange: (filter: FilterKey) => void;
}

const FilterPills = React.memo(function FilterPills({
  activeFilter,
  onFilterChange,
}: FilterPillsProps) {
  return (
    <View style={styles.filterRow}>
      {SEVERITY_FILTERS.map(({ key, label }) => {
        const isActive = activeFilter === key;
        const severityColor =
          key !== "all" ? SEVERITY_CONFIG[key].color : "#3b82f6";

        return (
          <TouchableOpacity
            key={key}
            testID={`alert-filter-${key}`}
            style={[
              styles.filterPill,
              isActive && { backgroundColor: `${severityColor}20` },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onFilterChange(key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`Filter by ${label}`}
          >
            <Text
              style={[
                styles.filterPillText,
                isActive && { color: severityColor },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Empty & loading states
// ---------------------------------------------------------------------------

const EmptyState = React.memo(function EmptyState() {
  return (
    <View style={styles.emptyContainer} testID="alert-empty">
      <Ionicons name="checkmark-done-circle-outline" size={48} color="#4b5563" />
      <Text style={styles.emptyTitle}>All Clear</Text>
      <Text style={styles.emptySubtext}>No inventory alerts to display.</Text>
    </View>
  );
});

const LoadingState = React.memo(function LoadingState() {
  return (
    <View style={styles.loadingContainer} testID="alert-loading">
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.loadingText}>Loading alerts…</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// AlertDisplay — main component
// ---------------------------------------------------------------------------

function AlertDisplayInner({
  alerts,
  onAcknowledge,
  onAlertPress,
  onDismissAll,
  showAcknowledged = false,
  isLoading = false,
}: AlertDisplayProps): React.JSX.Element {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  // ── Derived data ────────────────────────────────────────────────────────

  /**
   * Visible alerts after applying the acknowledged toggle and severity filter.
   *
   * Why useMemo instead of filtering inline?
   * Filtering on every render is O(n) — acceptable for small lists but
   * wasteful when only the filter pill changed and the source array didn't.
   */
  const filteredAlerts = useMemo(() => {
    let result = alerts;

    // Hide acknowledged unless opted-in
    if (!showAcknowledged) {
      result = result.filter((a) => !a.isAcknowledged);
    }

    // Apply severity filter
    if (activeFilter !== "all") {
      result = result.filter((a) => a.severity === activeFilter);
    }

    return result;
  }, [alerts, showAcknowledged, activeFilter]);

  const unacknowledgedCount = useMemo(
    () => alerts.filter((a) => !a.isAcknowledged).length,
    [alerts],
  );

  // ── Callbacks ───────────────────────────────────────────────────────────

  const handleDismissAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDismissAll?.();
  }, [onDismissAll]);

  const keyExtractor = useCallback((item: InventoryAlert) => item.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<InventoryAlert>) => (
      <AlertCard
        alert={item}
        onAcknowledge={onAcknowledge}
        onPress={onAlertPress}
      />
    ),
    [onAcknowledge, onAlertPress],
  );

  // ── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.container} testID="alert-display">
        <LoadingState />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="alert-display">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Inventory Alerts</Text>
          {unacknowledgedCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{unacknowledgedCount}</Text>
            </View>
          )}
        </View>

        {onDismissAll && unacknowledgedCount > 0 && (
          <TouchableOpacity
            testID="alert-dismiss-all"
            style={styles.dismissAllButton}
            onPress={handleDismissAll}
            accessibilityRole="button"
            accessibilityLabel="Dismiss all alerts"
          >
            <Ionicons name="checkmark-done" size={18} color="#9ca3af" />
            <Text style={styles.dismissAllText}>Dismiss All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Severity filter pills */}
      <FilterPills
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* Alert list */}
      {filteredAlerts.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={filteredAlerts}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}
    </View>
  );
}

/**
 * Memoised AlertDisplay.
 *
 * Why memo at the outer level?
 * Parent screens (e.g., Inventory tab) may re-render due to unrelated state
 * changes. The memo avoids re-filtering and re-rendering the entire list
 * unless the alerts array or callbacks actually change.
 */
const AlertDisplay = React.memo(AlertDisplayInner);
export default AlertDisplay;

// ---------------------------------------------------------------------------
// Styles
//
// Why StyleSheet.create?
// StyleSheet.create validates styles at creation time and assigns numeric IDs
// internally, which is faster than passing fresh object literals on each render.
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  // ── Header ──────────────────────────────────────────────────────────────

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  countBadge: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  dismissAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#1f2937",
  },
  dismissAllText: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "500",
  },

  // ── Filter pills ───────────────────────────────────────────────────────

  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#1f2937",
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9ca3af",
  },

  // ── Alert card ─────────────────────────────────────────────────────────

  card: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardAcknowledged: {
    opacity: 0.55,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  cardHeaderText: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f3f4f6",
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: "#6b7280",
    marginLeft: 8,
  },
  textMuted: {
    color: "#6b7280",
  },

  // ── Badge ──────────────────────────────────────────────────────────────

  badgeRow: {
    flexDirection: "row",
    marginBottom: 6,
    marginLeft: 32,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // ── Message & details ─────────────────────────────────────────────────

  messageText: {
    fontSize: 13,
    color: "#d1d5db",
    marginLeft: 32,
    marginBottom: 8,
    lineHeight: 18,
  },
  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginLeft: 32,
    marginBottom: 8,
  },
  detailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#111827",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  detailText: {
    fontSize: 12,
    color: "#9ca3af",
  },

  // ── Acknowledge ────────────────────────────────────────────────────────

  acknowledgeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 32,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#22c55e15",
    alignSelf: "flex-start",
  },
  acknowledgeText: {
    color: "#22c55e",
    fontSize: 13,
    fontWeight: "600",
  },
  acknowledgedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 32,
    marginTop: 2,
  },
  acknowledgedText: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "500",
  },

  // ── List ───────────────────────────────────────────────────────────────

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },

  // ── Empty & loading ────────────────────────────────────────────────────

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f4f6",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 12,
  },
});
