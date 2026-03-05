/**
 * LoginHistoryTab — Audit trail of login/logout events for the POS system.
 *
 * Provides filterable, paginated list of authentication events with
 * colour-coded action badges and device/IP metadata.
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

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface LoginEvent {
  id: string;
  userId: string;
  userName: string;
  action: "login" | "logout" | "session_timeout" | "failed_login";
  timestamp: string;
  ipAddress: string;
  deviceInfo: string;
  success: boolean;
}

export interface LoginHistoryTabProps {
  events: LoginEvent[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

type FilterKey = "all" | "login" | "logout" | "failed";

interface FilterOption {
  key: FilterKey;
  label: string;
  testID: string;
}

const FILTERS: FilterOption[] = [
  { key: "all", label: "All", testID: "login-filter-all" },
  { key: "login", label: "Login", testID: "login-filter-login" },
  { key: "logout", label: "Logout", testID: "login-filter-logout" },
  { key: "failed", label: "Failed", testID: "login-filter-failed" },
];

/** Map each action to its display colour so badges are consistent. */
const ACTION_COLORS: Record<LoginEvent["action"], string> = {
  login: "#22c55e",
  logout: "#3b82f6",
  failed_login: "#ef4444",
  session_timeout: "#fbbf24",
};

const ACTION_LABELS: Record<LoginEvent["action"], string> = {
  login: "Login",
  logout: "Logout",
  failed_login: "Failed",
  session_timeout: "Timeout",
};

const ACTION_ICONS: Record<LoginEvent["action"], string> = {
  login: "log-in-outline",
  logout: "log-out-outline",
  failed_login: "close-circle-outline",
  session_timeout: "timer-outline",
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Formats an ISO-8601 timestamp into a human-friendly string.
 * We format inline rather than pulling in a library to keep the bundle small.
 */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date}, ${time}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

interface EventRowProps {
  event: LoginEvent;
}

/** A single event row. Memoised to avoid re-renders when filters change. */
const EventRow = React.memo(function EventRow({ event }: EventRowProps) {
  const color = ACTION_COLORS[event.action];
  const label = ACTION_LABELS[event.action];
  const icon = ACTION_ICONS[event.action];

  return (
    <View style={styles.eventRow} testID={`login-event-${event.id}`}>
      {/* Left: icon circle */}
      <View style={[styles.iconCircle, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>

      {/* Centre: details */}
      <View style={styles.eventDetails}>
        <View style={styles.eventTopRow}>
          <Text style={styles.eventUserName} numberOfLines={1}>
            {event.userName}
          </Text>
          <View style={[styles.actionBadge, { backgroundColor: color + "1A" }]}>
            <Text style={[styles.actionBadgeText, { color }]}>{label}</Text>
          </View>
        </View>

        <Text style={styles.eventTimestamp}>{formatTimestamp(event.timestamp)}</Text>

        <Text style={styles.eventMeta} numberOfLines={1}>
          {event.deviceInfo} · {event.ipAddress}
        </Text>
      </View>
    </View>
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

function LoginHistoryTab({
  events,
  onLoadMore,
  hasMore = false,
  isLoading = false,
}: LoginHistoryTabProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (activeFilter === "all") return events;
    if (activeFilter === "login") return events.filter((e) => e.action === "login");
    if (activeFilter === "logout")
      return events.filter((e) => e.action === "logout" || e.action === "session_timeout");
    // "failed"
    return events.filter((e) => e.action === "failed_login");
  }, [events, activeFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFilterChange = useCallback((key: FilterKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilter(key);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!onLoadMore) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLoadMore();
  }, [onLoadMore]);

  const keyExtractor = useCallback((item: LoginEvent) => item.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<LoginEvent>) => <EventRow event={item} />,
    [],
  );

  // ── Footer (load-more / loading spinner) ──────────────────────────────────

  const renderFooter = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.footerLoader} testID="login-loading">
          <ActivityIndicator size="small" color="#22c55e" />
          <Text style={styles.footerLoaderText}>Loading…</Text>
        </View>
      );
    }
    if (hasMore && onLoadMore) {
      return (
        <TouchableOpacity
          style={styles.loadMoreBtn}
          testID="login-load-more"
          onPress={handleLoadMore}
        >
          <Text style={styles.loadMoreText}>Load More</Text>
          <Ionicons name="chevron-down" size={16} color="#3b82f6" />
        </TouchableOpacity>
      );
    }
    return null;
  }, [isLoading, hasMore, onLoadMore, handleLoadMore]);

  // ── Loading (initial) ─────────────────────────────────────────────────────

  if (isLoading && events.length === 0) {
    return (
      <View style={styles.centered} testID="login-loading">
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Loading history…</Text>
      </View>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (events.length === 0) {
    return (
      <View style={styles.centered} testID="login-empty">
        <Ionicons name="shield-checkmark-outline" size={48} color="#4b5563" />
        <Text style={styles.emptyTitle}>No Login Events</Text>
        <Text style={styles.emptySubtitle}>
          No authentication events have been recorded yet.
        </Text>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container} testID="login-history-tab">
      {/* Filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const isActive = f.key === activeFilter;
          return (
            <TouchableOpacity
              key={f.key}
              testID={f.testID}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => handleFilterChange(f.key)}
            >
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Filtered-empty state – shown when filters remove all results */}
      {filtered.length === 0 ? (
        <View style={styles.centered} testID="login-empty">
          <Ionicons name="filter-outline" size={40} color="#4b5563" />
          <Text style={styles.emptyTitle}>No Matches</Text>
          <Text style={styles.emptySubtitle}>
            No events match the selected filter.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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

  // ── Filter row ────────────────────────────────────────────────────────────

  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  } as ViewStyle,

  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#1f2937",
  } as ViewStyle,

  filterPillActive: {
    backgroundColor: "#3b82f6",
  } as ViewStyle,

  filterPillText: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "500",
  } as TextStyle,

  filterPillTextActive: {
    color: "#ffffff",
  } as TextStyle,

  // ── Event row ─────────────────────────────────────────────────────────────

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  } as ViewStyle,

  eventRow: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    gap: 12,
  } as ViewStyle,

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  } as ViewStyle,

  eventDetails: {
    flex: 1,
    gap: 3,
  } as ViewStyle,

  eventTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,

  eventUserName: {
    color: "#f3f4f6",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  } as TextStyle,

  actionBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  } as ViewStyle,

  actionBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  } as TextStyle,

  eventTimestamp: {
    color: "#9ca3af",
    fontSize: 12,
  } as TextStyle,

  eventMeta: {
    color: "#6b7280",
    fontSize: 11,
  } as TextStyle,

  // ── Footer ────────────────────────────────────────────────────────────────

  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  } as ViewStyle,

  footerLoaderText: {
    color: "#9ca3af",
    fontSize: 13,
  } as TextStyle,

  loadMoreBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    gap: 6,
  } as ViewStyle,

  loadMoreText: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
  } as TextStyle,
});

export default React.memo(LoginHistoryTab);
