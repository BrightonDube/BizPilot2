/**
 * UserActivityTab — Report tab showing user/staff activity in the POS system.
 *
 * Displays summary cards (active users, total logins, avg session hours,
 * total transactions) followed by a sortable FlatList of per-user metrics.
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

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface UserActivity {
  userId: string;
  userName: string;
  role: string;
  loginCount: number;
  totalSessionHours: number;
  transactionsProcessed: number;
  salesTotal: number;
  lastActiveAt: string;
  isCurrentlyActive: boolean;
}

export interface UserActivityTabProps {
  activities: UserActivity[];
  dateRange: { startDate: string; endDate: string };
  onUserPress?: (userId: string) => void;
  isLoading?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Sort helpers
// ────────────────────────────────────────────────────────────────────────────

type SortKey = "transactions" | "sales" | "logins" | "hours";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "transactions", label: "Transactions" },
  { key: "sales", label: "Sales" },
  { key: "logins", label: "Logins" },
  { key: "hours", label: "Hours" },
];

function compareBySortKey(a: UserActivity, b: UserActivity, key: SortKey): number {
  switch (key) {
    case "transactions":
      return b.transactionsProcessed - a.transactionsProcessed;
    case "sales":
      return b.salesTotal - a.salesTotal;
    case "logins":
      return b.loginCount - a.loginCount;
    case "hours":
      return b.totalSessionHours - a.totalSessionHours;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

interface SummaryCardProps {
  testID: string;
  icon: string;
  label: string;
  value: string;
  color: string;
}

/**
 * Individual KPI card rendered in the summary row.
 * Memoised because its props rarely change relative to re-renders of the list.
 */
const SummaryCard = React.memo(function SummaryCard({
  testID,
  icon,
  label,
  value,
  color,
}: SummaryCardProps) {
  return (
    <View style={styles.summaryCard} testID={testID}>
      <Ionicons name={icon as any} size={22} color={color} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
});

interface UserRowProps {
  item: UserActivity;
  onPress?: (userId: string) => void;
}

/**
 * A single row in the user activity list.
 * Memoised so that tapping one row doesn't re-render siblings.
 */
const UserRow = React.memo(function UserRow({ item, onPress }: UserRowProps) {
  const handlePress = useCallback(() => {
    if (!onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item.userId);
  }, [onPress, item.userId]);

  return (
    <TouchableOpacity
      style={styles.userRow}
      testID={`user-activity-row-${item.userId}`}
      onPress={handlePress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      {/* Top: name + role + active indicator */}
      <View style={styles.userRowHeader}>
        <View style={styles.userNameRow}>
          {item.isCurrentlyActive && <View style={styles.activeDot} />}
          <Text style={styles.userName} numberOfLines={1}>
            {item.userName}
          </Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{item.role}</Text>
        </View>
      </View>

      {/* Bottom: metrics grid */}
      <View style={styles.metricsRow}>
        <MetricCell icon="log-in-outline" value={String(item.loginCount)} label="Logins" />
        <MetricCell
          icon="time-outline"
          value={item.totalSessionHours.toFixed(1)}
          label="Hours"
        />
        <MetricCell
          icon="receipt-outline"
          value={String(item.transactionsProcessed)}
          label="Txns"
        />
        <MetricCell
          icon="cash-outline"
          value={formatCurrency(item.salesTotal)}
          label="Sales"
        />
      </View>
    </TouchableOpacity>
  );
});

interface MetricCellProps {
  icon: string;
  value: string;
  label: string;
}

const MetricCell = React.memo(function MetricCell({ icon, value, label }: MetricCellProps) {
  return (
    <View style={styles.metricCell}>
      <Ionicons name={icon as any} size={14} color="#9ca3af" />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

function UserActivityTab({
  activities,
  dateRange,
  onUserPress,
  isLoading = false,
}: UserActivityTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>("transactions");

  // ── Derived data ──────────────────────────────────────────────────────────

  const sorted = useMemo(
    () => [...activities].sort((a, b) => compareBySortKey(a, b, sortKey)),
    [activities, sortKey],
  );

  const activeNow = useMemo(
    () => activities.filter((a) => a.isCurrentlyActive).length,
    [activities],
  );

  const totalLogins = useMemo(
    () => activities.reduce((sum, a) => sum + a.loginCount, 0),
    [activities],
  );

  const avgHours = useMemo(() => {
    if (activities.length === 0) return 0;
    const total = activities.reduce((sum, a) => sum + a.totalSessionHours, 0);
    return total / activities.length;
  }, [activities]);

  const totalTxns = useMemo(
    () => activities.reduce((sum, a) => sum + a.transactionsProcessed, 0),
    [activities],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSortChange = useCallback((key: SortKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortKey(key);
  }, []);

  const keyExtractor = useCallback((item: UserActivity) => item.userId, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<UserActivity>) => (
      <UserRow item={item} onPress={onUserPress} />
    ),
    [onUserPress],
  );

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centered} testID="user-activity-loading">
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Loading activity…</Text>
      </View>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (activities.length === 0) {
    return (
      <View style={styles.centered} testID="user-activity-empty">
        <Ionicons name="people-outline" size={48} color="#4b5563" />
        <Text style={styles.emptyTitle}>No Activity</Text>
        <Text style={styles.emptySubtitle}>
          No user activity recorded for{"\n"}
          {dateRange.startDate} — {dateRange.endDate}
        </Text>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container} testID="user-activity-tab">
      {/* Summary cards */}
      <View style={styles.summaryRow} testID="user-activity-summary">
        <SummaryCard
          testID="user-activity-active-now"
          icon="radio-button-on"
          label="Active Now"
          value={String(activeNow)}
          color="#22c55e"
        />
        <SummaryCard
          testID="user-activity-total-logins"
          icon="log-in-outline"
          label="Total Logins"
          value={String(totalLogins)}
          color="#3b82f6"
        />
        <SummaryCard
          testID="user-activity-avg-hours"
          icon="time-outline"
          label="Avg Hours"
          value={avgHours.toFixed(1)}
          color="#fbbf24"
        />
        <SummaryCard
          testID="user-activity-total-txns"
          icon="receipt-outline"
          label="Transactions"
          value={String(totalTxns)}
          color="#a78bfa"
        />
      </View>

      {/* Sort pills */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort by</Text>
        {SORT_OPTIONS.map((opt) => {
          const isActive = opt.key === sortKey;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortPill, isActive && styles.sortPillActive]}
              onPress={() => handleSortChange(opt.key)}
            >
              <Text style={[styles.sortPillText, isActive && styles.sortPillTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* User list */}
      <FlatList
        data={sorted}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,

  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  } as ViewStyle,

  loadingText: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 12,
  } as TextStyle,

  emptyTitle: {
    color: "#f3f4f6",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
  } as TextStyle,

  emptySubtitle: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 20,
  } as TextStyle,

  // ── Summary cards ───────────────────────────────────────────────────────

  summaryRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  } as ViewStyle,

  summaryCard: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
  } as ViewStyle,

  summaryValue: {
    color: "#f3f4f6",
    fontSize: 18,
    fontWeight: "700",
  } as TextStyle,

  summaryLabel: {
    color: "#9ca3af",
    fontSize: 10,
    textAlign: "center",
  } as TextStyle,

  // ── Sort row ──────────────────────────────────────────────────────────────

  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  } as ViewStyle,

  sortLabel: {
    color: "#9ca3af",
    fontSize: 12,
    marginRight: 4,
  } as TextStyle,

  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#1f2937",
  } as ViewStyle,

  sortPillActive: {
    backgroundColor: "#22c55e",
  } as ViewStyle,

  sortPillText: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "500",
  } as TextStyle,

  sortPillTextActive: {
    color: "#ffffff",
  } as TextStyle,

  // ── User row ──────────────────────────────────────────────────────────────

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  } as ViewStyle,

  userRow: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  } as ViewStyle,

  userRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  } as ViewStyle,

  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  } as ViewStyle,

  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  } as ViewStyle,

  userName: {
    color: "#f3f4f6",
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  } as TextStyle,

  roleBadge: {
    backgroundColor: "#374151",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  } as ViewStyle,

  roleBadgeText: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "500",
    textTransform: "capitalize",
  } as TextStyle,

  // ── Metrics row ───────────────────────────────────────────────────────────

  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  } as ViewStyle,

  metricCell: {
    alignItems: "center",
    gap: 2,
    flex: 1,
  } as ViewStyle,

  metricValue: {
    color: "#f3f4f6",
    fontSize: 13,
    fontWeight: "600",
  } as TextStyle,

  metricLabel: {
    color: "#6b7280",
    fontSize: 10,
  } as TextStyle,
});

export default React.memo(UserActivityTab);
