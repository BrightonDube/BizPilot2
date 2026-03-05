/**
 * MapView — Delivery tracking component with list-based fallback.
 *
 * Provides a visual representation of active deliveries without depending on
 * a native maps SDK (react-native-maps). This is intentional — the component
 * needs to work across all platforms including web/Windows where native maps
 * aren't available. Actual map integration would wrap react-native-maps when
 * detected at runtime.
 *
 * Why a placeholder instead of embedding maps directly?
 * 1. react-native-maps requires native module linking and platform config
 * 2. BizPilot runs on web/Windows kiosks where maps SDKs aren't available
 * 3. The delivery list below is fully functional on all platforms
 * 4. Map integration can be progressively enhanced when running on mobile
 *
 * @module MapView
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
import { triggerHaptic } from "@/utils/haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

type DeliveryStatus = "pending" | "in_transit" | "delivered" | "failed";

interface DeliveryLocation {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  status: DeliveryStatus;
  driverName?: string;
  estimatedArrival?: string;
}

interface MapViewProps {
  deliveries: DeliveryLocation[];
  onDeliveryPress: (deliveryId: string) => void;
  selectedDeliveryId?: string;
  isLoading?: boolean;
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
  mapPlaceholder: "#1e293b",
} as const;

// ─── Status config ───────────────────────────────────────────────────────────

/** Maps each delivery status to a display label, color, and icon. */
const STATUS_CONFIG: Record<
  DeliveryStatus,
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: { label: "Pending", color: COLORS.amber, icon: "time-outline" },
  in_transit: { label: "In Transit", color: COLORS.blue, icon: "bicycle-outline" },
  delivered: { label: "Delivered", color: COLORS.green, icon: "checkmark-circle-outline" },
  failed: { label: "Failed", color: COLORS.red, icon: "alert-circle-outline" },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Status badge — colored pill showing the delivery's current state.
 */
const StatusBadge = React.memo(function StatusBadge({
  status,
}: {
  status: DeliveryStatus;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: `${config.color}20` }]}>
      <Ionicons name={config.icon} size={13} color={config.color} />
      <Text style={[styles.statusBadgeText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
});

/**
 * Single delivery card in the list.
 * Shows address, status, driver, ETA, and coordinates.
 */
const DeliveryCard = React.memo(function DeliveryCard({
  delivery,
  isSelected,
  onPress,
}: {
  delivery: DeliveryLocation;
  isSelected: boolean;
  onPress: (id: string) => void;
}) {
  const handlePress = useCallback(() => {
    triggerHaptic("tap");
    onPress(delivery.id);
  }, [delivery.id, onPress]);

  return (
    <TouchableOpacity
      testID={`delivery-card-${delivery.id}`}
      onPress={handlePress}
      activeOpacity={0.7}
      style={[
        styles.deliveryCard,
        isSelected && styles.deliveryCardSelected,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={16} color={COLORS.text} />
          <Text style={styles.addressText} numberOfLines={2}>
            {delivery.address}
          </Text>
        </View>
        <StatusBadge status={delivery.status} />
      </View>

      {/* Driver + ETA */}
      <View style={styles.cardDetails}>
        {delivery.driverName && (
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.detailText}>{delivery.driverName}</Text>
          </View>
        )}
        {delivery.estimatedArrival && (
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.detailText}>ETA: {delivery.estimatedArrival}</Text>
          </View>
        )}
      </View>

      {/* Coordinates — muted, useful for debugging and dispatch */}
      <Text style={styles.coordsText}>
        {delivery.latitude.toFixed(4)}, {delivery.longitude.toFixed(4)}
      </Text>
    </TouchableOpacity>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

function DeliveryMapView({
  deliveries,
  onDeliveryPress,
  selectedDeliveryId,
  isLoading = false,
}: MapViewProps) {
  // ── Derived counts ───────────────────────────────────────────────────────
  const activeCount = useMemo(
    () =>
      deliveries.filter(
        (d) => d.status === "pending" || d.status === "in_transit"
      ).length,
    [deliveries]
  );

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderDelivery = useCallback(
    ({ item }: ListRenderItemInfo<DeliveryLocation>) => (
      <DeliveryCard
        delivery={item}
        isSelected={item.id === selectedDeliveryId}
        onPress={onDeliveryPress}
      />
    ),
    [selectedDeliveryId, onDeliveryPress]
  );

  const keyExtractor = useCallback((item: DeliveryLocation) => item.id, []);

  // ── Empty state ──────────────────────────────────────────────────────────

  const EmptyComponent = useMemo(
    () => (
      <View testID="delivery-empty" style={styles.emptyState}>
        <Ionicons name="bicycle-outline" size={48} color={COLORS.textMuted} />
        <Text style={styles.emptyTitle}>No Deliveries</Text>
        <Text style={styles.emptySubtitle}>
          Active deliveries will appear here
        </Text>
      </View>
    ),
    []
  );

  // ── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View testID="delivery-loading" style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.blue} />
        <Text style={styles.loadingText}>Loading deliveries…</Text>
      </View>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <View testID="delivery-map-view" style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="map-outline" size={22} color={COLORS.blue} />
          <Text style={styles.title}>Delivery Map</Text>
        </View>
        <View testID="delivery-count" style={styles.countBadge}>
          <Text style={styles.countText}>{activeCount} active</Text>
        </View>
      </View>

      {/* Map placeholder area */}
      <View testID="delivery-map-placeholder" style={styles.mapPlaceholder}>
        <Ionicons name="map" size={48} color={COLORS.textMuted} />
        <Text style={styles.placeholderTitle}>Map View</Text>
        <Text style={styles.placeholderSubtitle}>
          Map view requires a native device with maps SDK
        </Text>
        <Text style={styles.placeholderHint}>
          Use the delivery list below for tracking
        </Text>
      </View>

      {/* Delivery list */}
      <View style={styles.listSection}>
        <Text style={styles.sectionLabel}>
          {deliveries.length} {deliveries.length === 1 ? "Delivery" : "Deliveries"}
        </Text>
        <FlatList
          data={deliveries}
          renderItem={renderDelivery}
          keyExtractor={keyExtractor}
          ListEmptyComponent={EmptyComponent}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: `${COLORS.blue}20`,
  },
  countText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: "600",
  },

  // Map placeholder
  mapPlaceholder: {
    margin: 16,
    padding: 32,
    borderRadius: 12,
    backgroundColor: COLORS.mapPlaceholder,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textMuted,
    marginTop: 4,
  },
  placeholderSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  placeholderHint: {
    fontSize: 12,
    color: COLORS.blue,
    fontWeight: "500",
    marginTop: 4,
  },

  // List section
  listSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  listContent: {
    paddingBottom: 24,
  },

  // Delivery card
  deliveryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.border,
  },
  deliveryCardSelected: {
    borderLeftColor: COLORS.blue,
    borderColor: `${COLORS.blue}40`,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  addressText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cardDetails: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  coordsText: {
    color: `${COLORS.textMuted}80`,
    fontSize: 11,
    fontFamily: "monospace",
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
});

export default React.memo(DeliveryMapView);
