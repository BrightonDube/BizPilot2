/**
 * TableWidget – Sortable data table for dashboard screens.
 *
 * Renders a horizontally-scrollable table with tappable column headers for
 * sorting.  Rows alternate between two dark shades so the eye can track
 * across long rows.  Each cell is auto-formatted based on its column's
 * `format` prop (currency, number, percentage, date, text).
 *
 * Why ScrollView instead of FlatList for the body?  Most dashboard tables
 * contain ≤ 20 rows so virtualisation overhead isn't justified; a plain
 * ScrollView keeps the implementation simple and avoids nesting VirtualizedList
 * warnings.
 */

import React, { memo, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TableColumn {
  key: string;
  label: string;
  /** Fixed width for the column (defaults to 120). */
  width?: number;
  align?: "left" | "center" | "right";
  format?: "currency" | "number" | "percentage" | "text" | "date";
}

interface TableWidgetProps {
  title: string;
  columns: TableColumn[];
  data: Record<string, any>[];
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (columnKey: string) => void;
  onRowPress?: (row: Record<string, any>) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const COLORS = {
  bg: "#0f172a",
  card: "#1f2937",
  cardAlt: "#111827",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#fbbf24",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  border: "#374151",
  skeleton: "#374151",
} as const;

const DEFAULT_COL_WIDTH = 120;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a raw cell value according to the column's declared format. */
const formatCell = (
  value: any,
  format: TableColumn["format"] = "text"
): string => {
  if (value === null || value === undefined) return "—";

  switch (format) {
    case "currency":
      return formatCurrency(Number(value));
    case "number":
      return Number(value).toLocaleString("en-ZA", { maximumFractionDigits: 1 });
    case "percentage":
      return `${Number(value).toFixed(1)}%`;
    case "date":
      return new Date(value).toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    case "text":
    default:
      return String(value);
  }
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Column header cell – tappable when `onSort` is provided.
 */
const HeaderCell: React.FC<{
  column: TableColumn;
  isSorted: boolean;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
}> = ({ column, isSorted, sortDirection, onSort }) => {
  const width = column.width ?? DEFAULT_COL_WIDTH;
  const align = column.align ?? "left";

  const handlePress = useCallback(() => {
    if (!onSort) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSort(column.key);
  }, [onSort, column.key]);

  const sortIcon: React.ComponentProps<typeof Ionicons>["name"] = isSorted
    ? sortDirection === "asc"
      ? "chevron-up"
      : "chevron-down"
    : "swap-vertical-outline";

  return (
    <TouchableOpacity
      style={[styles.headerCell, { width }]}
      onPress={handlePress}
      disabled={!onSort}
      activeOpacity={0.7}
      testID={`table-header-${column.key}`}
    >
      <Text
        style={[
          styles.headerText,
          { textAlign: align },
          isSorted && styles.headerTextActive,
        ]}
        numberOfLines={1}
      >
        {column.label}
      </Text>
      {onSort && (
        <Ionicons
          name={sortIcon}
          size={12}
          color={isSorted ? COLORS.blue : COLORS.textMuted}
          style={styles.sortIcon}
        />
      )}
    </TouchableOpacity>
  );
};

/**
 * A single data row.
 */
const TableRow: React.FC<{
  row: Record<string, any>;
  columns: TableColumn[];
  index: number;
  onRowPress?: (row: Record<string, any>) => void;
}> = ({ row, columns, index, onRowPress }) => {
  // Alternate row colours for readability.
  const bgColor = index % 2 === 0 ? COLORS.card : COLORS.cardAlt;

  const handlePress = useCallback(() => {
    if (!onRowPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRowPress(row);
  }, [onRowPress, row]);

  const Wrapper = onRowPress ? TouchableOpacity : View;
  const wrapperProps = onRowPress
    ? { onPress: handlePress, activeOpacity: 0.7 }
    : {};

  return (
    <Wrapper
      style={[styles.row, { backgroundColor: bgColor }]}
      testID={`table-row-${index}`}
      {...(wrapperProps as any)}
    >
      {columns.map((col) => {
        const width = col.width ?? DEFAULT_COL_WIDTH;
        const align = col.align ?? "left";
        return (
          <View
            key={col.key}
            style={[styles.cell, { width }]}
            testID={`table-cell-${index}-${col.key}`}
          >
            <Text
              style={[styles.cellText, { textAlign: align }]}
              numberOfLines={1}
            >
              {formatCell(row[col.key], col.format)}
            </Text>
          </View>
        );
      })}
    </Wrapper>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const TableWidget: React.FC<TableWidgetProps> = ({
  title,
  columns,
  data,
  sortColumn,
  sortDirection,
  onSort,
  onRowPress,
  isLoading = false,
  emptyMessage = "No data available",
}) => {
  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------
  if (isLoading) {
    return (
      <View style={styles.card} testID="table-loading">
        <Text style={styles.title}>{title}</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.blue} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Empty
  // -----------------------------------------------------------------------
  if (data.length === 0) {
    return (
      <View style={styles.card} testID="table-empty">
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyContainer}>
          <Ionicons name="file-tray-outline" size={32} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <View style={styles.card} testID="table-widget">
      <Text style={styles.title} testID="table-title">
        {title}
      </Text>

      {/* Horizontal scroll lets wide tables remain usable on narrow screens. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Column headers */}
          <View style={styles.headerRow}>
            {columns.map((col) => (
              <HeaderCell
                key={col.key}
                column={col}
                isSorted={sortColumn === col.key}
                sortDirection={sortDirection}
                onSort={onSort}
              />
            ))}
          </View>

          {/* Body rows – plain ScrollView (see JSDoc for rationale). */}
          <ScrollView
            style={styles.body}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {data.map((row, index) => (
              <TableRow
                key={index}
                row={row}
                columns={columns}
                index={index}
                onRowPress={onRowPress}
              />
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
    marginBottom: 4,
  },
  headerCell: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    flex: 1,
  },
  headerTextActive: {
    color: COLORS.blue,
  },
  sortIcon: {
    marginLeft: 2,
  },

  // Body
  body: {
    maxHeight: 300,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  cell: {
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  cellText: {
    color: COLORS.text,
    fontSize: 13,
  },

  // States
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
});

export default memo(TableWidget);
