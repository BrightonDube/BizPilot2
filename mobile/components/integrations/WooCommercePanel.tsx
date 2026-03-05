/**
 * BizPilot Mobile — WooCommercePanel Component
 *
 * Panel for managing the WooCommerce e-commerce integration.
 *
 * Why this exists:
 * Many SA small retailers run a WooCommerce storefront alongside
 * their physical POS. This panel gives them granular control over
 * what syncs — products, orders, or stock — because a full sync
 * can be expensive on mobile data. Separate sync buttons let the
 * user push only what changed (e.g. stock after a busy Saturday)
 * without pulling the entire product catalogue.
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

interface WooCommercePanelProps {
  /** Whether the WooCommerce REST API keys are configured. */
  isConnected: boolean;
  /** Root URL of the WooCommerce store. */
  storeUrl: string | null;
  /** ISO-8601 timestamp of the last successful sync. */
  lastSyncAt: string | null;
  /** Current sync-engine state. */
  syncStatus: SyncStatus;
  /** Number of products successfully synced. */
  productsSynced: number;
  /** Number of orders successfully synced. */
  ordersSynced: number;
  /** Number of stock-level updates synced. */
  stockSynced: number;
  /** Human-readable error from the sync engine. */
  errorMessage: string | null;
  /** Open the store-connection / API-key flow. */
  onConnect: () => void;
  /** Remove stored API keys and disconnect. */
  onDisconnect: () => void;
  /** Sync only the product catalogue. */
  onSyncProducts: () => void;
  /** Sync only orders. */
  onSyncOrders: () => void;
  /** Sync only stock levels. */
  onSyncStock: () => void;
  /** Navigate to the sync-log viewer. */
  onViewLogs: () => void;
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

/** Formats an ISO-8601 string to a concise local date/time. */
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

/** Status dot + label. */
const ConnectionBadge = React.memo(function ConnectionBadge({
  connected,
}: {
  connected: boolean;
}) {
  const dotColor = connected ? COLORS.green : COLORS.red;
  const label = connected ? "Connected" : "Disconnected";

  return (
    <View style={styles.badgeRow} testID="woo-status">
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      <Text style={[styles.badgeText, { color: dotColor }]}>{label}</Text>
    </View>
  );
});

/** Single stat tile used in the sync-stats grid. */
const StatTile = React.memo(function StatTile({
  count,
  label,
  icon,
  color,
  testID,
}: {
  count: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  testID?: string;
}) {
  return (
    <View style={styles.statTile} testID={testID}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.statCount, { color }]}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

/** Entity-specific sync button (Products / Orders / Stock). */
const SyncEntityButton = React.memo(function SyncEntityButton({
  label,
  icon,
  onPress,
  disabled = false,
  testID,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
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
      accessibilityLabel={`Sync ${label}`}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.syncEntityBtn,
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={COLORS.blue} />
      <Text style={styles.syncEntityBtnText}>{label}</Text>
    </Pressable>
  );
});

/** Generic action button (Connect / Disconnect / View Logs). */
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

const WooCommercePanel: React.FC<WooCommercePanelProps> = React.memo(
  function WooCommercePanel({
    isConnected,
    storeUrl,
    lastSyncAt,
    syncStatus,
    productsSynced,
    ordersSynced,
    stockSynced,
    errorMessage,
    onConnect,
    onDisconnect,
    onSyncProducts,
    onSyncOrders,
    onSyncStock,
    onViewLogs,
  }) {
    const isSyncing = syncStatus === "syncing";
    const hasError = syncStatus === "error" && !!errorMessage;
    const syncTimeLabel = formatSyncTime(lastSyncAt);

    const handleConnect = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onConnect();
    }, [onConnect]);

    const handleDisconnect = useCallback(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onDisconnect();
    }, [onDisconnect]);

    return (
      <View style={styles.container} testID="woocommerce-panel">
        {/* ── Header ─────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="cart-outline" size={24} color={COLORS.purple} />
            <Text style={styles.title}>WooCommerce</Text>
          </View>
          <ConnectionBadge connected={isConnected} />
        </View>

        {/* ── Store URL ──────────────────────── */}
        {isConnected && storeUrl ? (
          <View style={styles.infoRow} testID="woo-store-url">
            <Ionicons
              name="globe-outline"
              size={16}
              color={COLORS.textMuted}
            />
            <Text style={styles.infoText} numberOfLines={1}>
              {storeUrl}
            </Text>
          </View>
        ) : null}

        {/* ── Last sync ──────────────────────── */}
        <View style={styles.infoRow}>
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

        {/* ── Sync stats grid ────────────────── */}
        {isConnected && (
          <View style={styles.statsGrid}>
            <StatTile
              count={productsSynced}
              label="Products"
              icon="pricetag-outline"
              color={COLORS.blue}
              testID="woo-products-synced"
            />
            <StatTile
              count={ordersSynced}
              label="Orders"
              icon="receipt-outline"
              color={COLORS.green}
              testID="woo-orders-synced"
            />
            <StatTile
              count={stockSynced}
              label="Stock"
              icon="cube-outline"
              color={COLORS.amber}
              testID="woo-stock-synced"
            />
          </View>
        )}

        {/* ── Entity sync buttons ────────────── */}
        {isConnected && (
          <>
            <Text style={styles.sectionLabel}>Sync Individual Entities</Text>
            <View style={styles.entitySyncRow}>
              <SyncEntityButton
                label="Products"
                icon="pricetag-outline"
                onPress={onSyncProducts}
                disabled={isSyncing}
                testID="woo-sync-products"
              />
              <SyncEntityButton
                label="Orders"
                icon="receipt-outline"
                onPress={onSyncOrders}
                disabled={isSyncing}
                testID="woo-sync-orders"
              />
              <SyncEntityButton
                label="Stock"
                icon="cube-outline"
                onPress={onSyncStock}
                disabled={isSyncing}
                testID="woo-sync-stock"
              />
            </View>
          </>
        )}

        {/* ── Error message ──────────────────── */}
        {hasError && (
          <View style={styles.errorBox}>
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
            <ActionButton
              label="Disconnect"
              icon="log-out-outline"
              color={COLORS.red}
              onPress={handleDisconnect}
              testID="woo-disconnect-btn"
            />
          ) : (
            <ActionButton
              label="Connect"
              icon="log-in-outline"
              color={COLORS.green}
              onPress={handleConnect}
              testID="woo-connect-btn"
            />
          )}
          <ActionButton
            label="View Logs"
            icon="document-text-outline"
            color={COLORS.textMuted}
            onPress={onViewLogs}
            testID="woo-logs-btn"
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
    flex: 1,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  spinner: {
    marginLeft: 8,
  },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    marginBottom: 12,
  },
  statTile: {
    flex: 1,
    alignItems: "center",
    backgroundColor: COLORS.input,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 4,
  },
  statCount: {
    fontSize: 22,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "500",
  },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Entity sync buttons
  entitySyncRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  syncEntityBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.input,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  syncEntityBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.blue,
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
  },
  actionBtnLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
};

export default WooCommercePanel;
