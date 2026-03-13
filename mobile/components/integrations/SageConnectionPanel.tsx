/**
 * BizPilot Mobile — SageConnectionPanel Component
 *
 * Panel for managing the Sage Business Cloud accounting integration.
 *
 * Why this exists:
 * South African SMEs heavily rely on Sage for statutory accounting.
 * This panel surfaces connection health, pending sync counts, and
 * one-tap sync so the owner never has to leave the POS to reconcile
 * books. The "pending transactions" badge creates urgency — stale
 * data means stale financials.
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

type SyncStatus = "idle" | "syncing" | "error";

interface SageConnectionPanelProps {
  /** Whether the Sage integration is currently authenticated. */
  isConnected: boolean;
  /** ISO-8601 timestamp of the last successful sync. */
  lastSyncAt: string | null;
  /** Sage company name returned after OAuth handshake. */
  companyName: string | null;
  /** Current sync-engine state. */
  syncStatus: SyncStatus;
  /** Human-readable error surfaced by the sync engine. */
  errorMessage: string | null;
  /** Initiate OAuth connection flow. */
  onConnect: () => void;
  /** Revoke tokens and disconnect. */
  onDisconnect: () => void;
  /** Trigger an immediate full sync. */
  onSync: () => void;
  /** Navigate to the sync-log viewer. */
  onViewLogs: () => void;
  /** Number of POS transactions awaiting push to Sage. */
  pendingTransactions: number;
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

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

/**
 * Formats an ISO-8601 string into a short local date/time.
 * Falls back to "Never" so the UI always has a value.
 */
function formatSyncTime(iso: string | null): string {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Unknown";
  }
}

// ────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────

/** Status dot + label shown at the top of the card. */
const ConnectionBadge = React.memo(function ConnectionBadge({
  connected,
}: {
  connected: boolean;
}) {
  const dotColor = connected ? COLORS.green : COLORS.red;
  const label = connected ? "Connected" : "Disconnected";

  return (
    <View style={styles.badgeRow} testID="sage-status">
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      <Text style={[styles.badgeText, { color: dotColor }]}>{label}</Text>
    </View>
  );
});

/** Rounded pill that displays a count + label. */
const CountBadge = React.memo(function CountBadge({
  count,
  label,
  color,
  testID,
}: {
  count: number;
  label: string;
  color: string;
  testID?: string;
}) {
  return (
    <View
      style={[styles.countBadge, { borderColor: color }]}
      testID={testID}
    >
      <Text style={[styles.countBadgeNumber, { color }]}>{count}</Text>
      <Text style={styles.countBadgeLabel}>{label}</Text>
    </View>
  );
});

/** Primary / secondary action button used across the panel. */
const ActionButton = React.memo(function ActionButton({
  label,
  icon,
  color,
  onPress,
  disabled = false,
  testID,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.actionBtn,
        { borderColor: color, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.actionBtnLabel, { color }]}>{label}</Text>
    </Pressable>
  );
});

// ────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────

const SageConnectionPanel: React.FC<SageConnectionPanelProps> = React.memo(
  function SageConnectionPanel({
    isConnected,
    lastSyncAt,
    companyName,
    syncStatus,
    errorMessage,
    onConnect,
    onDisconnect,
    onSync,
    onViewLogs,
    pendingTransactions,
  }) {
    // ── Derived state ────────────────────────
    const isSyncing = syncStatus === "syncing";
    const hasError = syncStatus === "error" && !!errorMessage;
    const syncTimeLabel = formatSyncTime(lastSyncAt);

    // ── Handlers (stable refs via useCallback) ──
    const handleConnect = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onConnect();
    }, [onConnect]);

    const handleDisconnect = useCallback(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onDisconnect();
    }, [onDisconnect]);

    return (
      <View style={styles.container} testID="sage-connection">
        {/* ── Header ─────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="cloud-outline" size={24} color={COLORS.purple} />
            <Text style={styles.title}>Sage</Text>
          </View>
          <ConnectionBadge connected={isConnected} />
        </View>

        {/* ── Company name ───────────────────── */}
        {isConnected && companyName ? (
          <View style={styles.infoRow} testID="sage-company">
            <Ionicons
              name="business-outline"
              size={16}
              color={COLORS.textMuted}
            />
            <Text style={styles.infoText}>{companyName}</Text>
          </View>
        ) : null}

        {/* ── Last sync ──────────────────────── */}
        <View style={styles.infoRow} testID="sage-last-sync">
          <Ionicons
            name="time-outline"
            size={16}
            color={COLORS.textMuted}
          />
          <Text style={styles.infoText}>Last sync: {syncTimeLabel}</Text>
          {isSyncing && (
            <ActivityIndicator
              size="small"
              color={COLORS.blue}
              style={styles.spinner}
            />
          )}
        </View>

        {/* ── Pending transactions ────────────── */}
        {isConnected && (
          <View style={styles.statsRow}>
            <CountBadge
              count={pendingTransactions}
              label="Pending"
              color={pendingTransactions > 0 ? COLORS.amber : COLORS.green}
              testID="sage-pending"
            />
          </View>
        )}

        {/* ── Error message ──────────────────── */}
        {hasError && (
          <View style={styles.errorBox} testID="sage-error">
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.red}
            />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* ── Actions ────────────────────────── */}
        <View style={styles.divider} />

        <View style={styles.actionsRow}>
          {isConnected ? (
            <>
              <ActionButton
                label="Disconnect"
                icon="log-out-outline"
                color={COLORS.red}
                onPress={handleDisconnect}
                testID="sage-disconnect-btn"
              />
              <ActionButton
                label="Sync Now"
                icon="sync-outline"
                color={COLORS.blue}
                onPress={onSync}
                disabled={isSyncing}
                testID="sage-sync-btn"
              />
            </>
          ) : (
            <ActionButton
              label="Connect"
              icon="log-in-outline"
              color={COLORS.green}
              onPress={handleConnect}
              testID="sage-connect-btn"
            />
          )}
          <ActionButton
            label="View Logs"
            icon="document-text-outline"
            color={COLORS.textMuted}
            onPress={onViewLogs}
            testID="sage-logs-btn"
          />
        </View>
      </View>
    );
  },
);

// ────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────

const styles: Record<string, ViewStyle | TextStyle> = {
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },

  // Status badge
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Info rows
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  spinner: {
    marginLeft: 8,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },

  // Count badge
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countBadgeNumber: {
    fontSize: 16,
    fontWeight: "700",
  },
  countBadgeLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.red,
    lineHeight: 18,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },

  // Action buttons
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    // 44dp minimum touch target maintained by padding
  },
  actionBtnLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
};

export default SageConnectionPanel;
