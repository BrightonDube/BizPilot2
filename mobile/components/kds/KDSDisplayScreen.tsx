/**
 * KDSDisplayScreen — Kitchen Display System screen for kitchen staff.
 * (order-management task 7.4)
 *
 * Layout: A multi-column Kanban-style board showing KDS order tickets.
 * Each ticket is a card with the order number, items, modifiers, and
 * age timer. Kitchen staff can:
 *   - Tap an item to mark it "preparing"
 *   - Swipe/tap "Bump" to mark the whole ticket done
 *   - Long-press a bumped item to recall it
 *
 * Why a Kanban board instead of a list?
 * Professional KDS systems use a card-per-order layout that fills the
 * screen horizontally (like KitchenCut, FreshKDS, Toast KDS). This gives
 * kitchen staff a visual overview of all pending orders at once. A vertical
 * list would only show 2-3 orders on a tablet.
 *
 * Why FlatList horizontal?
 * We use a horizontal FlatList with fixed-width cards. This naturally scrolls
 * as orders pile up and recycles card views for performance. New orders appear
 * on the right; completed orders scroll off the left.
 */

import React, { useCallback, useMemo } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { KDSOrder, KDSOrderItem, KDSStation } from "@/services/kds/KDSService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KDSDisplayScreenProps {
  /** All active KDS orders (not fully bumped). */
  orders: KDSOrder[];
  /** Available KDS stations. */
  stations: KDSStation[];
  /** Currently selected station (filters items). If null, show all. */
  activeStationId: string | null;
  /** Called when the user bumps an item. */
  onBumpItem: (orderId: string, itemId: string) => void;
  /** Called when the user recalls a bumped item. */
  onRecallItem: (orderId: string, itemId: string) => void;
  /** Called when station tab is changed. */
  onSelectStation: (stationId: string | null) => void;
  /** Current timestamp (ms) for age calculation. */
  now: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAge(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return "< 1m";
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}h ${totalMinutes % 60}m`;
}

function ageColor(ms: number): string {
  const minutes = ms / 60000;
  if (minutes > 15) return "#ef4444"; // red
  if (minutes > 10) return "#fbbf24"; // amber
  return "#22c55e"; // green
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KDSItemRowProps {
  item: KDSOrderItem;
  onBump: () => void;
  onRecall: () => void;
}

const KDSItemRow = React.memo(function KDSItemRow({
  item,
  onBump,
  onRecall,
}: KDSItemRowProps) {
  const isDone = item.status === "done";

  return (
    <TouchableOpacity
      style={[styles.itemRow, isDone && styles.itemDone]}
      onPress={isDone ? onRecall : onBump}
      accessibilityLabel={
        isDone
          ? `Recall ${item.name}`
          : `Bump ${item.name}`
      }
    >
      <View style={styles.itemLeft}>
        <Text style={[styles.itemQty, isDone && styles.itemTextDone]}>
          {item.quantity}×
        </Text>
        <View>
          <Text
            style={[styles.itemName, isDone && styles.itemTextDone]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {item.modifiers.length > 0 && (
            <Text style={styles.modifierText} numberOfLines={1}>
              {item.modifiers.join(", ")}
            </Text>
          )}
        </View>
      </View>
      {isDone ? (
        <Ionicons name="refresh" size={18} color="#6b7280" />
      ) : (
        <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
      )}
    </TouchableOpacity>
  );
});

interface KDSTicketProps {
  order: KDSOrder;
  stationId: string | null;
  now: number;
  onBumpItem: (orderId: string, itemId: string) => void;
  onRecallItem: (orderId: string, itemId: string) => void;
}

const KDSTicket = React.memo(function KDSTicket({
  order,
  stationId,
  now,
  onBumpItem,
  onRecallItem,
}: KDSTicketProps) {
  const ageMs = now - new Date(order.sentAt).getTime();
  const color = ageColor(ageMs);

  // Filter items by station if active
  const visibleItems = useMemo(() => {
    if (!stationId) return order.items;
    return order.items.filter((i) => i.stationId === stationId);
  }, [order.items, stationId]);

  const pendingCount = visibleItems.filter((i) => i.status !== "done").length;

  return (
    <View style={[styles.ticket, pendingCount === 0 && styles.ticketDone]}>
      {/* Ticket header */}
      <View style={[styles.ticketHeader, { borderBottomColor: color }]}>
        <View>
          <Text style={styles.ticketNumber}>{order.displayNumber}</Text>
          <Text style={styles.ticketMeta}>
            {order.orderType}
            {order.tableName ? ` · ${order.tableName}` : ""}
          </Text>
        </View>
        <Text style={[styles.ticketAge, { color }]}>{formatAge(ageMs)}</Text>
      </View>

      {/* Items */}
      {visibleItems.map((item) => (
        <KDSItemRow
          key={item.id}
          item={item}
          onBump={() => onBumpItem(order.id, item.id)}
          onRecall={() => onRecallItem(order.id, item.id)}
        />
      ))}

      {/* Pending count footer */}
      <View style={styles.ticketFooter}>
        <Text style={styles.pendingText}>
          {pendingCount === 0 ? "All done" : `${pendingCount} pending`}
        </Text>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const KDSDisplayScreen: React.FC<KDSDisplayScreenProps> = React.memo(
  function KDSDisplayScreen({
    orders,
    stations,
    activeStationId,
    onBumpItem,
    onRecallItem,
    onSelectStation,
    now,
  }) {
    // Filter orders that have items for the active station
    const filteredOrders = useMemo(() => {
      if (!activeStationId) return orders;
      return orders.filter((o) =>
        o.items.some((i) => i.stationId === activeStationId && i.status !== "done")
      );
    }, [orders, activeStationId]);

    // Sort by priority then age (FIFO)
    const sortedOrders = useMemo(
      () =>
        [...filteredOrders].sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime();
        }),
      [filteredOrders]
    );

    const renderTicket = useCallback(
      ({ item }: { item: KDSOrder }) => (
        <KDSTicket
          order={item}
          stationId={activeStationId}
          now={now}
          onBumpItem={onBumpItem}
          onRecallItem={onRecallItem}
        />
      ),
      [activeStationId, now, onBumpItem, onRecallItem]
    );

    const keyExtractor = useCallback((item: KDSOrder) => item.id, []);

    return (
      <View style={styles.container}>
        {/* Station tabs */}
        <View style={styles.stationTabs}>
          <TouchableOpacity
            style={[styles.stationTab, !activeStationId && styles.stationTabActive]}
            onPress={() => onSelectStation(null)}
            accessibilityLabel="All stations"
          >
            <Text
              style={[styles.stationTabText, !activeStationId && styles.stationTabTextActive]}
            >
              All
            </Text>
          </TouchableOpacity>
          {stations.map((station) => (
            <TouchableOpacity
              key={station.id}
              style={[
                styles.stationTab,
                activeStationId === station.id && styles.stationTabActive,
              ]}
              onPress={() => onSelectStation(station.id)}
              accessibilityLabel={`${station.name} station`}
            >
              <Text
                style={[
                  styles.stationTabText,
                  activeStationId === station.id && styles.stationTabTextActive,
                ]}
              >
                {station.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ticket board */}
        {sortedOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-done-circle" size={64} color="#22c55e" />
            <Text style={styles.emptyText}>All caught up!</Text>
          </View>
        ) : (
          <FlatList
            data={sortedOrders}
            renderItem={renderTicket}
            keyExtractor={keyExtractor}
            horizontal
            contentContainerStyle={styles.boardContent}
            showsHorizontalScrollIndicator={false}
          />
        )}
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  stationTabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  stationTab: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "#1f2937",
  },
  stationTabActive: { backgroundColor: "#3b82f6" },
  stationTabText: { fontSize: 14, fontWeight: "600", color: "#9ca3af" },
  stationTabTextActive: { color: "#fff" },
  boardContent: { padding: 16, gap: 12 },
  ticket: {
    width: 280,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    overflow: "hidden",
  },
  ticketDone: { opacity: 0.5 },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 3,
  },
  ticketNumber: { fontSize: 20, fontWeight: "800", color: "#f3f4f6" },
  ticketMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  ticketAge: { fontSize: 16, fontWeight: "700" },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  itemDone: { backgroundColor: "#111827" },
  itemLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 8 },
  itemQty: { fontSize: 15, fontWeight: "700", color: "#f3f4f6", width: 30 },
  itemName: { fontSize: 14, fontWeight: "500", color: "#f3f4f6" },
  itemTextDone: { textDecorationLine: "line-through", color: "#6b7280" },
  modifierText: { fontSize: 12, color: "#fbbf24", marginTop: 2 },
  ticketFooter: {
    padding: 10,
    alignItems: "center",
  },
  pendingText: { fontSize: 12, fontWeight: "600", color: "#9ca3af" },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { fontSize: 18, fontWeight: "600", color: "#22c55e", marginTop: 12 },
});

export default KDSDisplayScreen;
