/**
 * DisplayCard — Represents a single digital display/screen in the signage system.
 *
 * Shows live status, resolution, current content, uptime, and optional power
 * control for each connected display. Designed for tablet dashboards where
 * operators monitor many screens at a glance.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ─── Types ──────────────────────────────────────────────────────────────────

export type DisplayStatus = "online" | "offline" | "standby" | "error";

export interface DisplayInfo {
  id: string;
  name: string;
  location: string;
  status: DisplayStatus;
  resolution: string;
  orientation: "landscape" | "portrait";
  currentContent: string | null;
  lastPingAt: string | null;
  /** Percentage 0–100 representing display availability over the last 30 days. */
  uptime: number;
}

export interface DisplayCardProps {
  display: DisplayInfo;
  onPress: (displayId: string) => void;
  onPowerToggle?: (displayId: string) => void;
  isSelected?: boolean;
}

// ─── Status helpers ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  DisplayStatus,
  { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  online: { color: "#22c55e", icon: "checkmark-circle", label: "Online" },
  offline: { color: "#ef4444", icon: "close-circle", label: "Offline" },
  standby: { color: "#fbbf24", icon: "pause-circle", label: "Standby" },
  error: { color: "#8b5cf6", icon: "warning", label: "Error" },
};

/**
 * Format an ISO-8601 date string into a human-readable "time ago" label.
 * Falls back to "Never" when the timestamp is missing so the UI is never blank.
 */
function formatLastPing(iso: string | null): string {
  if (!iso) return "Never";

  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Pick a colour for the uptime bar so operators can immediately spot
 * displays with poor availability without reading the number.
 */
function uptimeBarColor(pct: number): string {
  if (pct >= 95) return "#22c55e";
  if (pct >= 80) return "#fbbf24";
  return "#ef4444";
}

// ─── Component ──────────────────────────────────────────────────────────────

const DisplayCard: React.FC<DisplayCardProps> = ({
  display,
  onPress,
  onPowerToggle,
  isSelected = false,
}) => {
  const { id, name, location, status, resolution, orientation, currentContent, lastPingAt, uptime } =
    display;

  const statusCfg = STATUS_CONFIG[status];

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(id);
  }, [onPress, id]);

  const handlePowerToggle = useCallback(() => {
    if (!onPowerToggle) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPowerToggle(id);
  }, [onPowerToggle, id]);

  /** Clamp uptime so the bar never overflows its container. */
  const clampedUptime = useMemo(() => Math.min(100, Math.max(0, uptime)), [uptime]);

  const cardStyle: ViewStyle = isSelected
    ? { ...styles.card, borderColor: "#3b82f6", borderWidth: 2 }
    : styles.card;

  return (
    <TouchableOpacity
      testID={`display-card-${id}`}
      style={cardStyle}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Display ${name}, status ${statusCfg.label}`}
    >
      {/* ── Header row: name + status badge ─────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.displayName} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color="#9ca3af" />
            <Text style={styles.locationLabel}>{location}</Text>
          </View>
        </View>

        <View
          testID={`display-status-${id}`}
          style={[styles.statusBadge, { backgroundColor: `${statusCfg.color}20` }]}
        >
          <Ionicons name={statusCfg.icon} size={14} color={statusCfg.color} />
          <Text style={[styles.statusText, { color: statusCfg.color }]}>
            {statusCfg.label}
          </Text>
        </View>
      </View>

      {/* ── Resolution & orientation ────────────────────────────────── */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="resize-outline" size={14} color="#9ca3af" />
          <Text style={styles.metaText}>{resolution}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons
            name={orientation === "landscape" ? "tablet-landscape-outline" : "tablet-portrait-outline"}
            size={14}
            color="#9ca3af"
          />
          <Text style={styles.metaText}>
            {orientation.charAt(0).toUpperCase() + orientation.slice(1)}
          </Text>
        </View>
      </View>

      {/* ── Current content ─────────────────────────────────────────── */}
      <View testID={`display-content-${id}`} style={styles.contentRow}>
        <Ionicons
          name={currentContent ? "film-outline" : "alert-circle-outline"}
          size={14}
          color={currentContent ? "#3b82f6" : "#9ca3af"}
        />
        <Text
          style={[
            styles.contentText,
            !currentContent && styles.contentTextEmpty,
          ]}
          numberOfLines={1}
        >
          {currentContent ?? "No content"}
        </Text>
      </View>

      {/* ── Last ping ───────────────────────────────────────────────── */}
      <View style={styles.pingRow}>
        <Ionicons name="pulse-outline" size={14} color="#9ca3af" />
        <Text style={styles.pingText}>Last ping: {formatLastPing(lastPingAt)}</Text>
      </View>

      {/* ── Uptime bar ──────────────────────────────────────────────── */}
      <View style={styles.uptimeContainer}>
        <View style={styles.uptimeLabelRow}>
          <Text style={styles.uptimeLabel}>Uptime</Text>
          <Text style={[styles.uptimeValue, { color: uptimeBarColor(clampedUptime) }]}>
            {clampedUptime.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.uptimeTrack}>
          <View
            style={[
              styles.uptimeFill,
              {
                width: `${clampedUptime}%` as unknown as number,
                backgroundColor: uptimeBarColor(clampedUptime),
              },
            ]}
          />
        </View>
      </View>

      {/* ── Power toggle ────────────────────────────────────────────── */}
      {onPowerToggle && (
        <TouchableOpacity
          testID={`display-power-${id}`}
          style={[
            styles.powerButton,
            status === "online"
              ? styles.powerButtonOn
              : styles.powerButtonOff,
          ]}
          onPress={handlePowerToggle}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            status === "online" ? "Turn display off" : "Turn display on"
          }
        >
          <Ionicons
            name="power"
            size={18}
            color={status === "online" ? "#22c55e" : "#ef4444"}
          />
          <Text
            style={[
              styles.powerLabel,
              { color: status === "online" ? "#22c55e" : "#ef4444" },
            ]}
          >
            {status === "online" ? "On" : "Off"}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },

  /* Header */
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  displayName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationLabel: {
    fontSize: 13,
    color: "#9ca3af",
  },

  /* Status badge */
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },

  /* Meta row */
  metaRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: "#9ca3af",
  },

  /* Content */
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#111827",
    borderRadius: 8,
  },
  contentText: {
    fontSize: 13,
    color: "#f3f4f6",
    flex: 1,
  },
  contentTextEmpty: {
    color: "#6b7280",
    fontStyle: "italic",
  },

  /* Last ping */
  pingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  pingText: {
    fontSize: 12,
    color: "#9ca3af",
  },

  /* Uptime */
  uptimeContainer: {
    marginBottom: 12,
  },
  uptimeLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  uptimeLabel: {
    fontSize: 12,
    color: "#9ca3af",
  },
  uptimeValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  uptimeTrack: {
    height: 6,
    backgroundColor: "#111827",
    borderRadius: 3,
    overflow: "hidden",
  },
  uptimeFill: {
    height: "100%",
    borderRadius: 3,
  },

  /* Power button */
  powerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  powerButtonOn: {
    backgroundColor: "#22c55e15",
    borderColor: "#22c55e40",
  },
  powerButtonOff: {
    backgroundColor: "#ef444415",
    borderColor: "#ef444440",
  },
  powerLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default React.memo(DisplayCard);
