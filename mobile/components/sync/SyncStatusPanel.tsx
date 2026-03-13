/**
 * SyncStatusPanel — offline sync status dashboard panel.
 *
 * Shows real-time connection status (online/offline), a summary of pending
 * changes, and per-entity sync details. Cashiers and managers can trigger
 * a manual sync or retry failed entities directly from this panel.
 *
 * Why surface sync status prominently?
 * BizPilot targets South African SMEs where connectivity is unreliable.
 * Staff need clear, at-a-glance confirmation that their sales are synced
 * to the cloud. A hidden or ambiguous sync indicator leads to duplicate
 * entries and lost revenue.
 *
 * Why per-entity rows instead of a single sync bar?
 * Different entities (sales, stock, customers) sync independently.
 * Showing each entity lets staff and support pinpoint which data is
 * stuck without digging through logs.
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Sync status for a single data entity (e.g. Sales, Products). */
export interface SyncEntity {
  /** Human-readable entity label (e.g. "Sales") */
  name: string;
  /** Number of records waiting to be synced */
  pendingCount: number;
  /** ISO timestamp of the last successful sync, or null if never synced */
  lastSyncAt: string | null;
  /** Current sync state */
  status: "synced" | "syncing" | "pending" | "error";
  /** Optional error message when status is "error" */
  errorMessage?: string;
}

export interface SyncStatusPanelProps {
  /** Whether the device currently has network connectivity */
  isOnline: boolean;
  /** List of data entities with their sync states */
  entities: SyncEntity[];
  /** Aggregate count of all pending records across entities */
  totalPending: number;
  /** ISO timestamp of the last full (all-entity) sync, or null */
  lastFullSyncAt: string | null;
  /** Trigger a manual sync of all entities */
  onSyncNow: () => void;
  /** Retry only the entities in "error" status */
  onRetryFailed: () => void;
  /** Whether a sync operation is currently in progress */
  isSyncing: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map sync status to a colour for badges and indicators.
 * Why not a simple ternary? Four states map to four colours; a lookup
 * is easier to extend when new states are added.
 */
const STATUS_COLOURS: Record<SyncEntity["status"], string> = {
  synced: "#22c55e",
  syncing: "#3b82f6",
  pending: "#fbbf24",
  error: "#ef4444",
};

const STATUS_ICONS: Record<SyncEntity["status"], string> = {
  synced: "checkmark-circle",
  syncing: "sync-circle",
  pending: "time-outline",
  error: "alert-circle",
};

const STATUS_LABELS: Record<SyncEntity["status"], string> = {
  synced: "Synced",
  syncing: "Syncing…",
  pending: "Pending",
  error: "Error",
};

/**
 * Format a nullable ISO timestamp into a short human-readable string.
 * Returns "Never" when null so the UI always has a value to display.
 */
function formatTimestamp(iso: string | null): string {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
    });
    const time = d.toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date}, ${time}`;
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface EntityRowProps {
  entity: SyncEntity;
}

/**
 * Row displaying one syncable entity's status, pending count, and last sync.
 * Memoised so the list only re-renders rows whose data actually changed.
 */
const EntityRow = React.memo(function EntityRow({ entity }: EntityRowProps) {
  const colour = STATUS_COLOURS[entity.status];
  const icon = STATUS_ICONS[entity.status];
  const label = STATUS_LABELS[entity.status];

  return (
    <View
      testID={`sync-entity-${entity.name}`}
      style={styles.entityCard}
    >
      {/* Top row: name + status badge */}
      <View style={styles.entityHeader}>
        <Text style={styles.entityName}>{entity.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: colour }]}>
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={14}
            color="#fff"
            style={styles.badgeIcon}
          />
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      </View>

      {/* Detail row: pending count + last sync */}
      <View style={styles.entityDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="cloud-upload-outline" size={14} color="#9ca3af" />
          <Text style={styles.detailText}>
            {entity.pendingCount} pending
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={14} color="#9ca3af" />
          <Text style={styles.detailText}>
            {formatTimestamp(entity.lastSyncAt)}
          </Text>
        </View>
      </View>

      {/* Error message (only when status is "error") */}
      {entity.status === "error" && entity.errorMessage && (
        <View style={styles.errorRow}>
          <Ionicons name="warning-outline" size={14} color="#ef4444" />
          <Text style={styles.errorText} numberOfLines={2}>
            {entity.errorMessage}
          </Text>
        </View>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Connection status bar
// ---------------------------------------------------------------------------

interface ConnectionBarProps {
  isOnline: boolean;
}

const ConnectionBar = React.memo(function ConnectionBar({
  isOnline,
}: ConnectionBarProps) {
  return (
    <View
      testID="sync-online-status"
      style={[
        styles.connectionBar,
        { backgroundColor: isOnline ? "#22c55e" : "#ef4444" },
      ]}
    >
      <Ionicons
        name={isOnline ? "wifi" : "cloud-offline-outline"}
        size={18}
        color="#fff"
      />
      <Text style={styles.connectionText}>
        {isOnline ? "Online" : "Offline"}
      </Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * SyncStatusPanel provides a full overview of the device's data-sync
 * health: connection bar → last-sync timestamp → pending badge →
 * per-entity list → action buttons.
 */
const SyncStatusPanel: React.FC<SyncStatusPanelProps> = React.memo(
  function SyncStatusPanel({
    isOnline,
    entities,
    totalPending,
    lastFullSyncAt,
    onSyncNow,
    onRetryFailed,
    isSyncing,
  }) {
    const hasErrors = entities.some((e) => e.status === "error");

    const handleSyncNow = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSyncNow();
    }, [onSyncNow]);

    const handleRetry = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onRetryFailed();
    }, [onRetryFailed]);

    return (
      <ScrollView
        testID="sync-status-panel"
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Connection status ---- */}
        <ConnectionBar isOnline={isOnline} />

        {/* ---- Summary row: last full sync + total pending ---- */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Last Full Sync</Text>
            <Text testID="sync-last-full" style={styles.summaryValue}>
              {formatTimestamp(lastFullSyncAt)}
            </Text>
          </View>

          <View style={styles.pendingBadge}>
            <Text
              testID="sync-total-pending"
              style={styles.pendingCount}
            >
              {totalPending}
            </Text>
            <Text style={styles.pendingLabel}>Pending</Text>
          </View>
        </View>

        {/* ---- Entity list ---- */}
        <Text style={styles.sectionTitle}>Sync Details</Text>

        {entities.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-outline" size={36} color="#22c55e" />
            <Text style={styles.emptyText}>All data is synced.</Text>
          </View>
        )}

        {entities.map((entity) => (
          <EntityRow key={entity.name} entity={entity} />
        ))}

        {/* ---- Action buttons ---- */}
        <View style={styles.actions}>
          {/* Sync Now */}
          <Pressable
            testID="sync-now-btn"
            accessibilityRole="button"
            accessibilityLabel="Sync now"
            accessibilityState={{ disabled: isSyncing || !isOnline }}
            onPress={handleSyncNow}
            style={[
              styles.syncNowBtn,
              (isSyncing || !isOnline) && styles.buttonDisabled,
            ]}
            disabled={isSyncing || !isOnline}
          >
            {isSyncing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons
                  name="sync-outline"
                  size={20}
                  color="#fff"
                  style={styles.btnIcon}
                />
                <Text style={styles.btnText}>Sync Now</Text>
              </>
            )}
          </Pressable>

          {/* Retry Failed */}
          <Pressable
            testID="sync-retry-btn"
            accessibilityRole="button"
            accessibilityLabel="Retry failed syncs"
            accessibilityState={{ disabled: !hasErrors || isSyncing || !isOnline }}
            onPress={handleRetry}
            style={[
              styles.retryBtn,
              (!hasErrors || isSyncing || !isOnline) && styles.buttonDisabled,
            ]}
            disabled={!hasErrors || isSyncing || !isOnline}
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color="#fff"
              style={styles.btnIcon}
            />
            <Text style={styles.btnText}>Retry Failed</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  },
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },

  // -- Connection bar --
  connectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  connectionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  // -- Summary row --
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  pendingBadge: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fbbf24",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 64,
  },
  pendingCount: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  pendingLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#111827",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // -- Section title --
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f3f4f6",
    marginBottom: 12,
  },

  // -- Empty state --
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
  },

  // -- Entity card --
  entityCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  entityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  entityName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f3f4f6",
  },

  // -- Status badge --
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  badgeIcon: {},
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },

  // -- Entity details --
  entityDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: "#9ca3af",
  },

  // -- Error row --
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 10,
    backgroundColor: "#1c1117",
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#ef4444",
    lineHeight: 17,
  },

  // -- Action buttons --
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  syncNowBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
  },
  retryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
    borderRadius: 12,
    paddingVertical: 14,
  },
  buttonDisabled: {
    backgroundColor: "#374151",
  },
  btnIcon: {
    marginRight: 8,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default SyncStatusPanel;
