/**
 * FloorPlanReadOnly — Read-only floor plan for embedding during order taking.
 *
 * Why a separate component instead of a "readOnly" prop on FloorPlanCanvas?
 * This view is intentionally lightweight — no headers, no tabs, no callbacks.
 * Keeping it isolated means it ships less JS and re-renders faster when
 * embedded inside a busy order screen.
 */

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  type ViewStyle,
} from "react-native";

import {
  type RestaurantTable,
  getStatusColor,
} from "@/services/tables/TableService";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Canvas aspect ratio matches FloorPlanCanvas so layouts look identical. */
const CANVAS_ASPECT_RATIO = 4 / 3;

/** Default dot size for tables in full mode. */
const TABLE_DOT_SIZE = 36;

/** Smaller dot size when compact mode is active. */
const TABLE_DOT_SIZE_COMPACT = 24;

/**
 * Glow ring size for the highlighted table.
 * Why 1.8×? Enough to be visible without overlapping neighbours on a
 * dense floor plan.
 */
const HIGHLIGHT_RING_SCALE = 1.8;

// ─── Props ──────────────────────────────────────────────────────────────────

export interface FloorPlanReadOnlyProps {
  tables: RestaurantTable[];
  /** ID of the table to visually emphasise (pulse/glow). */
  highlightTableId?: string;
  /** Shrink the canvas for embedding inside tight layouts. */
  compact?: boolean;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

// ── Table Dot ───────────────────────────────────────────────────────────────

interface TableDotProps {
  table: RestaurantTable;
  isHighlighted: boolean;
  dotSize: number;
}

/**
 * A single table rendered as a small coloured dot/square.
 *
 * Why dots instead of full table nodes? This component is read-only and
 * often displayed at a small scale — detailed labels would be illegible.
 */
const TableDot = React.memo<TableDotProps>(function TableDot({
  table,
  isHighlighted,
  dotSize,
}) {
  const color = getStatusColor(table.status);
  const isRound = table.shape === "round";
  const halfDot = dotSize / 2;
  const highlightRingSize = dotSize * HIGHLIGHT_RING_SCALE;
  const halfRing = highlightRingSize / 2;

  const dotStyle: ViewStyle = {
    position: "absolute",
    left: `${table.position.x}%` as unknown as number,
    top: `${table.position.y}%` as unknown as number,
    width: dotSize,
    height: dotSize,
    // Centre the dot on its coordinate.
    marginLeft: -halfDot,
    marginTop: -halfDot,
    borderRadius: isRound ? halfDot : 4,
    backgroundColor: color + "50", // 31 % opacity tint
    borderWidth: 1.5,
    borderColor: color,
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <View
      testID={`floor-view-table-${table.id}`}
      style={dotStyle}
      accessibilityLabel={`Table ${table.number}, ${table.status}`}
    >
      {/* Table number — only shown at larger sizes */}
      {dotSize >= TABLE_DOT_SIZE && (
        <Text style={styles.dotLabel}>{table.number}</Text>
      )}

      {/* Highlight glow ring */}
      {isHighlighted && (
        <View
          testID="floor-view-highlight"
          style={[
            styles.highlightRing,
            {
              width: highlightRingSize,
              height: highlightRingSize,
              borderRadius: isRound ? halfRing : 8,
              marginLeft: -halfRing,
              marginTop: -halfRing,
              borderColor: "#3b82f6",
            },
          ]}
        />
      )}
    </View>
  );
});

// ─── Main Component ─────────────────────────────────────────────────────────

/**
 * Read-only bird's-eye floor plan.
 *
 * Renders every table as a coloured dot at its percentage position.
 * The optionally highlighted table receives a pulsing blue glow ring
 * to draw the user's eye during order-taking.
 *
 * @example
 * // Inline within an order screen
 * <FloorPlanReadOnly
 *   tables={allTables}
 *   highlightTableId={activeTableId}
 *   compact
 * />
 */
function FloorPlanReadOnly({
  tables,
  highlightTableId,
  compact = false,
}: FloorPlanReadOnlyProps) {
  const dotSize = compact ? TABLE_DOT_SIZE_COMPACT : TABLE_DOT_SIZE;

  /**
   * Pre-compute unique section names so we can optionally show a
   * subtle label inside the canvas.
   */
  const sectionNames = useMemo(() => {
    const names = new Set(tables.map((t) => t.section));
    return Array.from(names);
  }, [tables]);

  return (
    <View
      style={[styles.container, compact && styles.containerCompact]}
      testID="floor-view"
      accessibilityLabel="Floor plan overview"
    >
      {/* Canvas */}
      <View style={[styles.canvas, compact && styles.canvasCompact]}>
        {/* Faint grid lines for spatial reference */}
        <View style={styles.gridOverlay}>
          {[25, 50, 75].map((pct) => (
            <React.Fragment key={pct}>
              <View
                style={[
                  styles.gridLineVertical,
                  { left: `${pct}%` as unknown as number },
                ]}
              />
              <View
                style={[
                  styles.gridLineHorizontal,
                  { top: `${pct}%` as unknown as number },
                ]}
              />
            </React.Fragment>
          ))}
        </View>

        {/* Section watermarks — helps orient the viewer */}
        {!compact && sectionNames.length > 0 && (
          <Text style={styles.sectionWatermark} numberOfLines={1}>
            {sectionNames.join(" · ")}
          </Text>
        )}

        {/* Table dots */}
        {tables.map((table) => (
          <TableDot
            key={table.id}
            table={table}
            isHighlighted={table.id === highlightTableId}
            dotSize={dotSize}
          />
        ))}

        {/* Empty state */}
        {tables.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No tables</Text>
          </View>
        )}
      </View>

      {/* Compact mode omits the status bar to save space */}
      {!compact && (
        <View style={styles.statusRow}>
          <StatusCount
            label="Avail"
            count={tables.filter((t) => t.status === "available").length}
            color="#22c55e"
          />
          <StatusCount
            label="Occ"
            count={tables.filter((t) => t.status === "occupied").length}
            color="#ef4444"
          />
          <StatusCount
            label="Res"
            count={tables.filter((t) => t.status === "reserved").length}
            color="#fbbf24"
          />
        </View>
      )}
    </View>
  );
}

// ── Status Count Chip ───────────────────────────────────────────────────────

interface StatusCountProps {
  label: string;
  count: number;
  color: string;
}

const StatusCount = React.memo<StatusCountProps>(function StatusCount({
  label,
  count,
  color,
}) {
  return (
    <View style={styles.statusChip}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, { color }]}>{count}</Text>
    </View>
  );
});

export default React.memo(FloorPlanReadOnly);

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Layout
  container: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#374151",
  },
  containerCompact: {
    borderRadius: 8,
  },

  // Canvas
  canvas: {
    aspectRatio: CANVAS_ASPECT_RATIO,
    width: "100%",
    backgroundColor: "#111827",
    position: "relative",
    overflow: "hidden",
  },
  canvasCompact: {
    // Let the parent control sizing in compact mode.
  },

  // Grid
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#1f293730",
  },
  gridLineHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#1f293730",
  },

  // Section watermark
  sectionWatermark: {
    position: "absolute",
    bottom: 6,
    right: 8,
    fontSize: 10,
    fontWeight: "600",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Table dot
  dotLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#f3f4f6",
  },

  // Highlight ring — absolute positioning centred on the dot.
  highlightRing: {
    position: "absolute",
    top: "50%",
    left: "50%",
    borderWidth: 2,
    opacity: 0.6,
  },

  // Empty
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 12,
    color: "#6b7280",
  },

  // Status row
  statusRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#1f2937",
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "500",
  },
  statusValue: {
    fontSize: 12,
    fontWeight: "700",
  },
});
