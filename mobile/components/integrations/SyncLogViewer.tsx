/**
 * BizPilot Mobile — SyncLogViewer Component
 *
 * Full-screen log viewer for integration sync operations.
 *
 * Why this exists:
 * When a sync fails at 2 AM (scheduled) or mid-rush (manual),
 * the owner needs to diagnose the root cause without opening a
 * laptop. This viewer lets them filter by integration and status,
 * expand individual entries for raw detail, and page through
 * history — all from the POS device itself. The filter pills
 * use the same colour language as the connection panels so the
 * mental model transfers directly.
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

interface SyncLogEntry {
  id: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  integration: "sage" | "xero" | "woocommerce";
  /** Human-readable operation name, e.g. "Push Invoices". */
  operation: string;
  status: "success" | "error" | "warning";
  /** One-line summary of what happened. */
  message: string;
  /** Optional verbose payload (stack trace, API response). */
  details?: string;
}

interface SyncLogViewerProps {
  logs: SyncLogEntry[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  /** Currently active integration filter value (empty = all). */
  filterIntegration: string;
  onFilterChange: (integration: string) => void;
  /** Currently active status filter value (empty = all). */
  filterStatus: string;
  onStatusFilterChange: (status: string) => void;
  isLoading?: boolean;
  /** Navigate back to the previous screen. */
  onBack: () => void;
}

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const COLORS = {
  bg: "#0f172a",
  card: "#1f2937",
  input: "#111827",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#fbbf24",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  border: "#374151",
} as const;

/** Filter options for the integration filter row. */
const INTEGRATION_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "sage", label: "Sage" },
  { key: "xero", label: "Xero" },
  { key: "woocommerce", label: "WooCommerce" },
];

/** Filter options for the status filter row. */
const STATUS_FILTERS: { key: string; label: string; color: string }[] = [
  { key: "", label: "All", color: COLORS.text },
  { key: "success", label: "Success", color: COLORS.green },
  { key: "error", label: "Error", color: COLORS.red },
  { key: "warning", label: "Warning", color: COLORS.amber },
];

/** Map status to icon + color for log entries. */
const STATUS_ICON_MAP: Record<
  SyncLogEntry["status"],
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  success: { icon: "checkmark-circle", color: COLORS.green },
  error: { icon: "close-circle", color: COLORS.red },
  warning: { icon: "warning", color: COLORS.amber },
};

/** Map integration names to display colours. */
const INTEGRATION_COLOR_MAP: Record<SyncLogEntry["integration"], string> = {
  sage: COLORS.purple,
  xero: COLORS.blue,
  woocommerce: COLORS.amber,
};

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

/** Short timestamp for log entries. */
function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-ZA", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Capitalise first letter of a string (for integration labels). */
function capitalise(s: string): string {
  if (s === "woocommerce") return "WooCommerce";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────

/** Horizontal scrollable row of filter pills. */
const FilterPillRow = React.memo(function FilterPillRow<
  T extends { key: string; label: string; color?: string },
>({
  items,
  activeKey,
  onSelect,
  testIDPrefix,
}: {
  items: T[];
  activeKey: string;
  onSelect: (key: string) => void;
  testIDPrefix: string;
}) {
  return (
    <View style={styles.pillRow}>
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(item.key);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Filter ${item.label}`}
            accessibilityState={{ selected: isActive }}
            testID={`${testIDPrefix}${item.key || "all"}`}
            style={[
              styles.pill,
              isActive && styles.pillActive,
            ]}
          >
            <Text
              style={[
                styles.pillText,
                isActive && styles.pillTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

/**
 * Single log entry row. Tapping expands/collapses the detail
 * section when `details` is present.
 */
const LogEntryRow = React.memo(function LogEntryRow({
  entry,
}: {
  entry: SyncLogEntry;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusMeta = STATUS_ICON_MAP[entry.status];
  const integrationColor = INTEGRATION_COLOR_MAP[entry.integration];
  const hasDetails = !!entry.details;

  const toggle = useCallback(() => {
    if (!hasDetails) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded((prev) => !prev);
  }, [hasDetails]);

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole={hasDetails ? "button" : "text"}
      accessibilityLabel={`${entry.operation} — ${entry.status}`}
      testID={`sync-log-entry-${entry.id}`}
      style={({ pressed }) => [
        styles.logEntry,
        hasDetails && pressed && { opacity: 0.8 },
      ]}
    >
      {/* Top row: timestamp + integration badge + status icon */}
      <View style={styles.logTopRow}>
        <Text style={styles.logTimestamp}>{formatTimestamp(entry.timestamp)}</Text>

        <View
          style={[
            styles.integrationBadge,
            { borderColor: integrationColor },
          ]}
        >
          <Text style={[styles.integrationBadgeText, { color: integrationColor }]}>
            {capitalise(entry.integration)}
          </Text>
        </View>

        <View style={styles.logStatusIcon}>
          <Ionicons
            name={statusMeta.icon}
            size={18}
            color={statusMeta.color}
          />
        </View>
      </View>

      {/* Operation + message */}
      <Text style={styles.logOperation}>{entry.operation}</Text>
      <Text style={styles.logMessage}>{entry.message}</Text>

      {/* Expandable details */}
      {hasDetails && expanded && (
        <View style={styles.logDetailsBox}>
          <Text style={styles.logDetailsText}>{entry.details}</Text>
        </View>
      )}

      {/* Expand hint */}
      {hasDetails && (
        <View style={styles.expandHint}>
          <Ionicons
            name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
            size={14}
            color={COLORS.textMuted}
          />
          <Text style={styles.expandHintText}>
            {expanded ? "Collapse" : "Show details"}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

// ────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────

const SyncLogViewer: React.FC<SyncLogViewerProps> = React.memo(
  function SyncLogViewer({
    logs,
    onLoadMore,
    hasMore = false,
    filterIntegration,
    onFilterChange,
    filterStatus,
    onStatusFilterChange,
    isLoading = false,
    onBack,
  }) {
    // ── Render helpers ───────────────────────
    const renderItem = useCallback(
      ({ item }: ListRenderItemInfo<SyncLogEntry>) => (
        <LogEntryRow entry={item} />
      ),
      [],
    );

    const keyExtractor = useCallback(
      (item: SyncLogEntry) => item.id,
      [],
    );

    const renderEmpty = useCallback(() => {
      if (isLoading) return null;
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="document-text-outline"
            size={48}
            color={COLORS.textMuted}
          />
          <Text style={styles.emptyText}>No logs match your filters</Text>
        </View>
      );
    }, [isLoading]);

    const renderFooter = useCallback(() => {
      if (isLoading) {
        return (
          <View style={styles.footerLoader} testID="sync-log-loading">
            <ActivityIndicator size="small" color={COLORS.blue} />
            <Text style={styles.footerText}>Loading…</Text>
          </View>
        );
      }

      if (hasMore && onLoadMore) {
        return (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onLoadMore();
            }}
            accessibilityRole="button"
            accessibilityLabel="Load more logs"
            testID="sync-log-load-more"
            style={({ pressed }) => [
              styles.loadMoreBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.loadMoreText}>Load More</Text>
          </Pressable>
        );
      }

      return null;
    }, [isLoading, hasMore, onLoadMore]);

    // ── Render ───────────────────────────────
    return (
      <View style={styles.screen} testID="sync-log-viewer">
        {/* ── Header ─────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onBack();
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="sync-log-back"
            hitSlop={12}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Sync Logs</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* ── Integration filter ─────────────── */}
        <FilterPillRow
          items={INTEGRATION_FILTERS}
          activeKey={filterIntegration}
          onSelect={onFilterChange}
          testIDPrefix="sync-log-filter-"
        />

        {/* ── Status filter ──────────────────── */}
        <FilterPillRow
          items={STATUS_FILTERS}
          activeKey={filterStatus}
          onSelect={onStatusFilterChange}
          testIDPrefix="sync-log-status-"
        />

        {/* ── Log list ───────────────────────── */}
        <FlatList
          data={logs}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  },
);

// ────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────

const styles: Record<string, ViewStyle | TextStyle> = {
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  headerSpacer: {
    width: 32,
  },

  // Filter pills
  pillRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillActive: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textMuted,
  },
  pillTextActive: {
    color: COLORS.text,
    fontWeight: "600",
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Log entry card
  logEntry: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  logTimestamp: {
    fontSize: 11,
    color: COLORS.textMuted,
    flex: 1,
  },
  integrationBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  integrationBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  logStatusIcon: {
    width: 22,
    alignItems: "center",
  },
  logOperation: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  logMessage: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },

  // Expandable details
  logDetailsBox: {
    backgroundColor: COLORS.input,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  logDetailsText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: "monospace",
    lineHeight: 17,
  },
  expandHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  expandHintText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textMuted,
  },

  // Footer
  footerLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  loadMoreBtn: {
    alignSelf: "center",
    backgroundColor: COLORS.input,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.blue,
  },
};

export default SyncLogViewer;
