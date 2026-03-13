/**
 * StatusUpdatePanel — Panel for updating order statuses in online ordering.
 *
 * Displays order info (number, customer, type, ETA) alongside a visual
 * status timeline and action buttons for allowed next transitions. Only
 * transitions the backend permits are shown, preventing invalid state jumps.
 *
 * Why a timeline instead of a simple dropdown?
 * Order status is inherently sequential (new → confirmed → preparing → …).
 * A visual timeline gives staff immediate spatial awareness of where the
 * order sits in the workflow — especially valuable during a lunch rush
 * when 30+ orders are in flight and quick scanning beats reading labels.
 *
 * @module StatusUpdatePanel
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { triggerHaptic } from "@/utils/haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

type OrderStatus =
  | "new"
  | "confirmed"
  | "preparing"
  | "ready"
  | "dispatched"
  | "delivered"
  | "cancelled";

interface StatusUpdatePanelProps {
  orderId: string;
  orderNumber: string;
  currentStatus: OrderStatus;
  customerName: string;
  orderType: "delivery" | "pickup" | "dine_in";
  estimatedTime: string;
  onUpdateStatus: (newStatus: OrderStatus) => void;
  onCancel: () => void;
  isUpdating?: boolean;
  allowedTransitions: OrderStatus[];
}

// ─── Theme ───────────────────────────────────────────────────────────────────

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

// ─── Status metadata ─────────────────────────────────────────────────────────

/**
 * Ordered progression for the timeline.
 * "cancelled" is excluded — it's a terminal branch, not a step in the flow.
 */
const STATUS_PROGRESSION: OrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "dispatched",
  "delivered",
];

/** Display labels, colors, and icons for each status. */
const STATUS_META: Record<
  OrderStatus,
  { label: string; color: string; icon: string }
> = {
  new: { label: "New", color: COLORS.blue, icon: "alert-circle" },
  confirmed: { label: "Confirmed", color: COLORS.purple, icon: "checkmark-circle" },
  preparing: { label: "Preparing", color: COLORS.amber, icon: "flame" },
  ready: { label: "Ready", color: COLORS.green, icon: "checkmark-done-circle" },
  dispatched: { label: "Dispatched", color: COLORS.blue, icon: "bicycle" },
  delivered: { label: "Delivered", color: COLORS.green, icon: "home" },
  cancelled: { label: "Cancelled", color: COLORS.red, icon: "close-circle" },
};

/** Map order types to human-readable labels + Ionicons. */
const ORDER_TYPE_META: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  delivery: { label: "Delivery", icon: "car-outline", color: COLORS.blue },
  pickup: { label: "Pickup", icon: "storefront-outline", color: COLORS.purple },
  dine_in: { label: "Dine-in", icon: "restaurant-outline", color: COLORS.amber },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Single step in the status timeline.
 * Completed steps are green, current is highlighted, future is muted.
 */
const TimelineStep = React.memo(function TimelineStep({
  status,
  currentIndex,
  stepIndex,
  isLast,
}: {
  status: OrderStatus;
  currentIndex: number;
  stepIndex: number;
  isLast: boolean;
}) {
  const meta = STATUS_META[status];
  const isCompleted = stepIndex < currentIndex;
  const isCurrent = stepIndex === currentIndex;

  // Choose dot color based on progression
  const dotColor = isCurrent
    ? meta.color
    : isCompleted
    ? COLORS.green
    : COLORS.border;

  const labelColor = isCurrent
    ? COLORS.text
    : isCompleted
    ? COLORS.textMuted
    : COLORS.border;

  return (
    <View style={styles.timelineStep}>
      <View style={styles.timelineDotColumn}>
        <View
          style={[
            styles.timelineDot,
            { backgroundColor: dotColor },
            isCurrent && styles.timelineDotCurrent,
          ]}
        >
          {isCompleted && (
            <Ionicons name="checkmark" size={10} color={COLORS.bg} />
          )}
          {isCurrent && (
            <Ionicons
              name={meta.icon as any}
              size={12}
              color={COLORS.bg}
            />
          )}
        </View>
        {/* Connector line — hidden on the last step */}
        {!isLast && (
          <View
            style={[
              styles.timelineLine,
              {
                backgroundColor:
                  stepIndex < currentIndex ? COLORS.green : COLORS.border,
              },
            ]}
          />
        )}
      </View>
      <Text style={[styles.timelineLabel, { color: labelColor }]}>
        {meta.label}
      </Text>
    </View>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

function StatusUpdatePanel({
  orderId,
  orderNumber,
  currentStatus,
  customerName,
  orderType,
  estimatedTime,
  onUpdateStatus,
  onCancel,
  isUpdating = false,
  allowedTransitions,
}: StatusUpdatePanelProps) {
  // ── Derived values ────────────────────────────────────────────────────────

  const currentMeta = STATUS_META[currentStatus];
  const typeMeta = ORDER_TYPE_META[orderType] ?? ORDER_TYPE_META.pickup;

  /** Index of current status in the progression for timeline highlighting. */
  const currentIndex = useMemo(
    () => STATUS_PROGRESSION.indexOf(currentStatus),
    [currentStatus]
  );

  /**
   * Allowed transitions excluding "cancelled" — shown as primary action buttons.
   * "cancelled" gets its own red button at the bottom.
   */
  const primaryTransitions = useMemo(
    () => allowedTransitions.filter((s) => s !== "cancelled"),
    [allowedTransitions]
  );

  const canCancel = useMemo(
    () => allowedTransitions.includes("cancelled"),
    [allowedTransitions]
  );

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleStatusPress = useCallback(
    (status: OrderStatus) => {
      triggerHaptic("success");
      onUpdateStatus(status);
    },
    [onUpdateStatus]
  );

  const handleCancel = useCallback(() => {
    triggerHaptic("heavy");
    onCancel();
  }, [onCancel]);

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View testID="status-update-panel" style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — order number + type badge */}
        <View style={styles.header}>
          <View style={styles.orderNumberRow}>
            <Ionicons name="receipt-outline" size={22} color={COLORS.text} />
            <Text testID="status-order-number" style={styles.orderNumber}>
              #{orderNumber}
            </Text>
          </View>
          <View
            style={[styles.typeBadge, { backgroundColor: `${typeMeta.color}20` }]}
          >
            <Ionicons
              name={typeMeta.icon as any}
              size={16}
              color={typeMeta.color}
            />
            <Text style={[styles.typeBadgeText, { color: typeMeta.color }]}>
              {typeMeta.label}
            </Text>
          </View>
        </View>

        {/* Customer info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoText}>{customerName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoText}>{estimatedTime}</Text>
          </View>
        </View>

        {/* Current status — large colored badge */}
        <View style={styles.currentStatusSection}>
          <Text style={styles.currentStatusLabel}>Current Status</Text>
          <View
            testID="status-current"
            style={[
              styles.currentStatusBadge,
              { backgroundColor: `${currentMeta.color}20` },
            ]}
          >
            <Ionicons
              name={currentMeta.icon as any}
              size={24}
              color={currentMeta.color}
            />
            <Text
              style={[styles.currentStatusText, { color: currentMeta.color }]}
            >
              {currentMeta.label}
            </Text>
          </View>
        </View>

        {/* Status timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Order Progress</Text>
          <View style={styles.timeline}>
            {STATUS_PROGRESSION.map((status, index) => (
              <TimelineStep
                key={status}
                status={status}
                currentIndex={currentIndex}
                stepIndex={index}
                isLast={index === STATUS_PROGRESSION.length - 1}
              />
            ))}
          </View>
        </View>

        {/* Updating indicator */}
        {isUpdating && (
          <View testID="status-updating" style={styles.updatingBanner}>
            <ActivityIndicator size="small" color={COLORS.blue} />
            <Text style={styles.updatingText}>Updating status…</Text>
          </View>
        )}

        {/* Action buttons — only allowed transitions */}
        {primaryTransitions.length > 0 && !isUpdating && (
          <View style={styles.actionsSection}>
            <Text style={styles.actionsTitle}>Next Step</Text>
            {primaryTransitions.map((status) => {
              const meta = STATUS_META[status];
              return (
                <TouchableOpacity
                  key={status}
                  testID={`status-btn-${status}`}
                  onPress={() => handleStatusPress(status)}
                  style={[
                    styles.actionButton,
                    { backgroundColor: meta.color },
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={meta.icon as any}
                    size={20}
                    color={COLORS.text}
                  />
                  <Text style={styles.actionButtonText}>
                    Mark as {meta.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Cancel order — destructive, always at bottom */}
        {canCancel && !isUpdating && (
          <TouchableOpacity
            testID="status-cancel"
            onPress={handleCancel}
            style={styles.cancelButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={20} color={COLORS.red} />
            <Text style={styles.cancelText}>Cancel Order</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
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
  orderNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orderNumber: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "700",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Info card
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    color: COLORS.text,
    fontSize: 15,
  },

  // Current status
  currentStatusSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  currentStatusLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  currentStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  currentStatusText: {
    fontSize: 20,
    fontWeight: "700",
  },

  // Timeline
  timelineCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timelineTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 14,
  },
  timeline: {
    paddingLeft: 4,
  },
  timelineStep: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timelineDotColumn: {
    alignItems: "center",
    width: 24,
    marginRight: 12,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotCurrent: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  timelineLine: {
    width: 2,
    height: 22,
    marginVertical: 2,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: "500",
    paddingTop: 2,
  },

  // Updating banner
  updatingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.blue,
  },
  updatingText: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: "600",
  },

  // Action buttons
  actionsSection: {
    marginBottom: 16,
  },
  actionsTitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  actionButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },

  // Cancel
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.red,
    marginTop: 4,
  },
  cancelText: {
    color: COLORS.red,
    fontSize: 15,
    fontWeight: "700",
  },
});

export default React.memo(StatusUpdatePanel);
