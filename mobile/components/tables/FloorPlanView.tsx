/**
 * FloorPlanView — interactive grid of restaurant tables with status colours.
 * (order-management tasks 4.1, 4.2, 4.3, 4.4)
 *
 * Layout: A scrollable grid of table "tiles" arranged in a responsive wrap
 * layout. Each tile shows the table name, seat count, and current status
 * with colour-coded backgrounds. Tapping a tile fires onSelectTable.
 *
 * Why a flat grid rather than a draggable canvas?
 * A canvas with absolute positioning is fragile on different tablet sizes
 * and aspect ratios. A wrap-grid automatically reflows and works on iPad
 * (landscape), Android tablets, and even phones in portrait. The user can
 * reorder tables in a management screen — the POS floor plan is read-only.
 *
 * Status colours:
 *   - available: green (#22c55e)
 *   - occupied: blue (#3b82f6)
 *   - reserved: amber (#fbbf24)
 *   - dirty: grey (#6b7280)
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
import type { TableRecord, TableStatus } from "@/services/order/TableService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FloorPlanViewProps {
  /** All tables in the venue. */
  tables: TableRecord[];
  /** Called when a table is tapped. */
  onSelectTable: (table: TableRecord) => void;
  /** Optional: currently-selected table ID (highlights the tile). */
  selectedTableId?: string;
  /** Optional: number of columns in the grid. Default 4. */
  columns?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<TableStatus, string> = {
  available: "#22c55e",
  occupied: "#3b82f6",
  reserved: "#fbbf24",
  dirty: "#6b7280",
};

const STATUS_ICONS: Record<TableStatus, string> = {
  available: "checkmark-circle",
  occupied: "people",
  reserved: "time",
  dirty: "water",
};

const STATUS_LABELS: Record<TableStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  dirty: "Dirty",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TableTileProps {
  table: TableRecord;
  isSelected: boolean;
  onPress: (table: TableRecord) => void;
}

const TableTile = React.memo(function TableTile({
  table,
  isSelected,
  onPress,
}: TableTileProps) {
  const color = STATUS_COLORS[table.status];
  const icon = STATUS_ICONS[table.status];
  const label = STATUS_LABELS[table.status];

  return (
    <TouchableOpacity
      style={[
        styles.tile,
        { borderColor: color },
        isSelected && styles.tileSelected,
      ]}
      onPress={() => onPress(table)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Table ${table.name}, ${label}, ${table.capacity} seats`}
    >
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.tableName}>{table.name}</Text>
      <View style={styles.tileRow}>
        <Ionicons name={icon as any} size={16} color={color} />
        <Text style={[styles.statusText, { color }]}>{label}</Text>
      </View>
      <Text style={styles.seatCount}>
        <Ionicons name="person-outline" size={12} color="#9ca3af" /> {table.capacity}
      </Text>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const FloorPlanView: React.FC<FloorPlanViewProps> = React.memo(
  function FloorPlanView({ tables, onSelectTable, selectedTableId, columns = 4 }) {
    // Status summary counts
    const statusCounts = useMemo(() => {
      const counts: Record<TableStatus, number> = {
        available: 0,
        occupied: 0,
        reserved: 0,
        dirty: 0,
      };
      tables.forEach((t) => {
        counts[t.status] += 1;
      });
      return counts;
    }, [tables]);

    const handlePress = useCallback(
      (table: TableRecord) => onSelectTable(table),
      [onSelectTable]
    );

    const renderItem = useCallback(
      ({ item }: { item: TableRecord }) => (
        <TableTile
          table={item}
          isSelected={item.id === selectedTableId}
          onPress={handlePress}
        />
      ),
      [selectedTableId, handlePress]
    );

    const keyExtractor = useCallback((item: TableRecord) => item.id, []);

    return (
      <View style={styles.container}>
        {/* Header with status summary */}
        <View style={styles.header}>
          <Text style={styles.title}>Floor Plan</Text>
          <View style={styles.summaryRow}>
            {(Object.keys(STATUS_COLORS) as TableStatus[]).map((status) => (
              <View key={status} style={styles.summaryItem}>
                <View
                  style={[styles.summaryDot, { backgroundColor: STATUS_COLORS[status] }]}
                />
                <Text style={styles.summaryText}>
                  {statusCounts[status]} {STATUS_LABELS[status]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Table grid */}
        {tables.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="grid-outline" size={48} color="#4b5563" />
            <Text style={styles.emptyText}>No tables configured</Text>
          </View>
        ) : (
          <FlatList
            data={tables}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={columns}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
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
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#f3f4f6", marginBottom: 8 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  summaryItem: { flexDirection: "row", alignItems: "center" },
  summaryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  summaryText: { fontSize: 13, color: "#d1d5db" },
  grid: { paddingBottom: 24 },
  row: { gap: 12, marginBottom: 12 },
  tile: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: "#374151",
    minHeight: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  tileSelected: {
    backgroundColor: "#1e3a5f",
    borderWidth: 3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: "absolute",
    top: 8,
    right: 8,
  },
  tableName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 4,
  },
  tileRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusText: { fontSize: 12, fontWeight: "600" },
  seatCount: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: { fontSize: 16, color: "#6b7280", marginTop: 12 },
});

export default FloorPlanView;
