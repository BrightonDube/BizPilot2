/**
 * FloorPlanCanvas — Interactive floor plan for table/floor management.
 *
 * Why a percentage-based coordinate system? It keeps the layout responsive
 * across tablet and phone form-factors without manual breakpoint logic.
 * Tables are positioned with `left: x%` and `top: y%` inside a container
 * whose aspect ratio is locked at 4:3.
 */

import React, { useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import {
  RestaurantTable,
  TableStatus,
  getStatusColor,
  calculateTableSummary,
  filterTablesBySection,
  getOccupiedDuration,
  isLongOccupied,
} from "@/services/tables/TableService";
import { formatCurrency } from "@/utils/formatters";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Threshold (minutes) after which an occupied table is flagged as long-running. */
const LONG_OCCUPIED_THRESHOLD = 90;

/** Aspect ratio of the canvas container (width / height). */
const CANVAS_ASPECT_RATIO = 4 / 3;

/** Minimum touch target size (dp) to satisfy accessibility guidelines. */
const MIN_TABLE_SIZE = 64;

/** All possible statuses shown in the legend. */
const LEGEND_ITEMS: { status: TableStatus; label: string }[] = [
  { status: "available", label: "Available" },
  { status: "occupied", label: "Occupied" },
  { status: "reserved", label: "Reserved" },
  { status: "cleaning", label: "Cleaning" },
  { status: "blocked", label: "Blocked" },
];

// ─── Props ──────────────────────────────────────────────────────────────────

export interface FloorPlanCanvasProps {
  tables: RestaurantTable[];
  selectedTableId?: string | null;
  onTablePress: (tableId: string) => void;
  onBack: () => void;
  sections: string[];
  activeSection?: string;
  onSectionChange?: (section: string) => void;
  isLoading?: boolean;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

// ── Header ──────────────────────────────────────────────────────────────────

interface HeaderProps {
  onBack: () => void;
  occupied: number;
  total: number;
}

/**
 * Top bar with back navigation and occupancy at a glance.
 *
 * Why show "X/Y tables occupied" here? Floor managers scan the header first —
 * an immediate occupancy reading lets them gauge capacity without scrolling.
 */
const Header = React.memo<HeaderProps>(function Header({
  onBack,
  occupied,
  total,
}) {
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  return (
    <View style={styles.header} testID="floor-plan-header">
      <TouchableOpacity
        testID="floor-back-btn"
        onPress={handleBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={24} color="#f3f4f6" />
      </TouchableOpacity>

      <Text style={styles.headerTitle}>Floor Plan</Text>

      <View style={styles.headerRight}>
        <Ionicons name="people-outline" size={18} color="#9ca3af" />
        <Text style={styles.headerStat}>
          {occupied}/{total} occupied
        </Text>
      </View>
    </View>
  );
});

// ── Section Tabs ────────────────────────────────────────────────────────────

interface SectionTabsProps {
  sections: string[];
  activeSection: string;
  onSectionChange: (section: string) => void;
}

/**
 * Horizontally-scrollable section pills.
 *
 * Why pills instead of a dropdown? On a tablet-first POS, single-tap
 * navigation is faster during a dinner rush than opening a picker.
 */
const SectionTabs = React.memo<SectionTabsProps>(function SectionTabs({
  sections,
  activeSection,
  onSectionChange,
}) {
  const handlePress = useCallback(
    (section: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSectionChange(section);
    },
    [onSectionChange],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.sectionTabsContent}
      style={styles.sectionTabs}
    >
      {sections.map((section) => {
        const isActive =
          section.toLowerCase() === activeSection.toLowerCase();

        return (
          <TouchableOpacity
            key={section}
            testID={`floor-section-${section.toLowerCase().replace(/\s+/g, "-")}`}
            onPress={() => handlePress(section)}
            style={[styles.sectionPill, isActive && styles.sectionPillActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${section} section`}
          >
            <Text
              style={[
                styles.sectionPillText,
                isActive && styles.sectionPillTextActive,
              ]}
            >
              {section}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

// ── Status Legend ────────────────────────────────────────────────────────────

/**
 * Compact row of colour dots explaining table status colours.
 *
 * Why always visible? New staff shouldn't have to guess colour meanings, and
 * the legend is small enough that it doesn't waste screen real-estate.
 */
const StatusLegend = React.memo(function StatusLegend() {
  return (
    <View style={styles.legend} testID="floor-legend">
      {LEGEND_ITEMS.map(({ status, label }) => (
        <View key={status} style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: getStatusColor(status) },
            ]}
          />
          <Text style={styles.legendLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
});

// ── Table Node (single table on the canvas) ─────────────────────────────────

interface TableNodeProps {
  table: RestaurantTable;
  isSelected: boolean;
  onPress: (id: string) => void;
  now: Date;
}

/**
 * An individual table rendered at its absolute position on the canvas.
 *
 * Why React.memo with a custom comparator isn't used here? The `now` prop
 * changes every render cycle (for elapsed-time display), so we let React's
 * default shallow compare handle it — the parent already filters by section,
 * keeping the list short enough that re-renders are cheap.
 */
const TableNode = React.memo<TableNodeProps>(function TableNode({
  table,
  isSelected,
  onPress,
  now,
}) {
  const statusColor = getStatusColor(table.status);
  const isOccupied = table.status === "occupied";
  const isLong =
    isOccupied &&
    table.occupiedSince != null &&
    isLongOccupied(table.occupiedSince, LONG_OCCUPIED_THRESHOLD, now);

  const duration =
    isOccupied && table.occupiedSince
      ? getOccupiedDuration(table.occupiedSince, now)
      : 0;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress(table.id);
  }, [onPress, table.id]);

  // Determine shape-specific styles.
  const shapeStyle =
    table.shape === "round"
      ? styles.tableNodeRound
      : table.shape === "rectangle"
        ? styles.tableNodeRectangle
        : table.shape === "bar"
          ? styles.tableNodeBar
          : styles.tableNodeSquare;

  /**
   * Format elapsed minutes into a human-friendly string.
   * Why not use a date library? We only need coarse hour:minute display —
   * a lightweight formatter avoids pulling in a heavy dependency.
   */
  const durationLabel =
    duration >= 60
      ? `${Math.floor(duration / 60)}h ${duration % 60}m`
      : `${duration}m`;

  return (
    <TouchableOpacity
      testID={`floor-table-${table.id}`}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Table ${table.number}, ${table.status}, ${table.seats} seats`}
      style={[
        styles.tableNode,
        shapeStyle,
        {
          left: `${table.position.x}%` as unknown as number,
          top: `${table.position.y}%` as unknown as number,
          backgroundColor: statusColor + "30", // 19 % opacity tint
          borderColor: isSelected ? "#3b82f6" : statusColor,
          borderWidth: isSelected ? 3 : 1.5,
        },
      ]}
    >
      {/* Table number — always visible */}
      <Text
        style={[styles.tableNumber, isSelected && styles.tableNumberSelected]}
      >
        {table.number}
      </Text>

      {/* Seat count badge */}
      <View style={styles.seatBadge}>
        <Ionicons name="person-outline" size={10} color="#9ca3af" />
        <Text style={styles.seatBadgeText}>{table.seats}</Text>
      </View>

      {/* Occupied details: server + elapsed time + order total */}
      {isOccupied && (
        <View style={styles.occupiedInfo}>
          {table.serverName && (
            <Text style={styles.serverName} numberOfLines={1}>
              {table.serverName}
            </Text>
          )}
          <Text
            style={[styles.durationText, isLong && styles.durationTextLong]}
          >
            {durationLabel}
          </Text>
          {table.currentOrderTotal > 0 && (
            <Text style={styles.orderTotal} numberOfLines={1}>
              {formatCurrency(table.currentOrderTotal)}
            </Text>
          )}
        </View>
      )}

      {/* Reserved details: guest name */}
      {table.status === "reserved" && table.reservedFor && (
        <Text style={styles.reservedFor} numberOfLines={1}>
          {table.reservedFor}
        </Text>
      )}

      {/* Long-occupied warning indicator */}
      {isLong && (
        <View style={styles.warningBadge}>
          <Ionicons name="warning" size={12} color="#fbbf24" />
        </View>
      )}

      {/* Shape icon hint in the corner */}
      <View style={styles.shapeHint}>
        <Ionicons
          name={
            table.shape === "round"
              ? "ellipse-outline"
              : table.shape === "bar"
                ? "remove-outline"
                : "square-outline"
          }
          size={10}
          color="#6b7280"
        />
      </View>
    </TouchableOpacity>
  );
});

// ── Summary Bar ─────────────────────────────────────────────────────────────

interface SummaryBarProps {
  available: number;
  occupied: number;
  reserved: number;
  cleaning: number;
}

/** Bottom-of-screen counts for quick status overview. */
const SummaryBar = React.memo<SummaryBarProps>(function SummaryBar({
  available,
  occupied,
  reserved,
  cleaning,
}) {
  return (
    <View style={styles.summaryBar} testID="floor-summary">
      <SummaryChip
        label="Available"
        count={available}
        color="#22c55e"
      />
      <SummaryChip label="Occupied" count={occupied} color="#ef4444" />
      <SummaryChip label="Reserved" count={reserved} color="#fbbf24" />
      <SummaryChip label="Cleaning" count={cleaning} color="#8b5cf6" />
    </View>
  );
});

interface SummaryChipProps {
  label: string;
  count: number;
  color: string;
}

const SummaryChip = React.memo<SummaryChipProps>(function SummaryChip({
  label,
  count,
  color,
}) {
  return (
    <View style={styles.summaryChip}>
      <View style={[styles.summaryDot, { backgroundColor: color }]} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryCount, { color }]}>{count}</Text>
    </View>
  );
});

// ─── Main Component ─────────────────────────────────────────────────────────

/**
 * FloorPlanCanvas renders an interactive bird's-eye view of all tables.
 *
 * @example
 * <FloorPlanCanvas
 *   tables={tables}
 *   selectedTableId={selectedId}
 *   onTablePress={handleSelect}
 *   onBack={() => navigation.goBack()}
 *   sections={['Main Floor', 'Patio', 'Bar']}
 *   activeSection="Main Floor"
 *   onSectionChange={setSection}
 * />
 */
function FloorPlanCanvas({
  tables,
  selectedTableId = null,
  onTablePress,
  onBack,
  sections,
  activeSection,
  onSectionChange,
  isLoading = false,
}: FloorPlanCanvasProps) {
  // Default to the first section when none is provided.
  const currentSection = activeSection ?? sections[0] ?? "";

  const handleSectionChange = useCallback(
    (section: string) => {
      onSectionChange?.(section);
    },
    [onSectionChange],
  );

  // Filter tables to the active section so the canvas isn't cluttered.
  const visibleTables = useMemo(() => {
    if (!currentSection) return tables;
    return filterTablesBySection(tables, currentSection);
  }, [tables, currentSection]);

  const summary = useMemo(
    () => calculateTableSummary(visibleTables),
    [visibleTables],
  );

  // Snapshot "now" once per render so every TableNode sees the same clock.
  const now = useMemo(() => new Date(), [visibleTables]);

  // ── Loading state ──
  if (isLoading) {
    return (
      <View style={styles.container} testID="floor-loading">
        <Header onBack={onBack} occupied={0} total={0} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading floor plan…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="floor-plan">
      {/* ── Header ── */}
      <Header
        onBack={onBack}
        occupied={summary.occupied}
        total={summary.total}
      />

      {/* ── Section tabs ── */}
      {sections.length > 1 && (
        <SectionTabs
          sections={sections}
          activeSection={currentSection}
          onSectionChange={handleSectionChange}
        />
      )}

      {/* ── Status legend ── */}
      <StatusLegend />

      {/* ── Canvas area ── */}
      <View style={styles.canvasWrapper}>
        <View style={styles.canvas}>
          {/* Grid lines for spatial reference */}
          <View style={styles.gridOverlay}>
            {[25, 50, 75].map((pct) => (
              <React.Fragment key={pct}>
                <View
                  style={[styles.gridLineVertical, { left: `${pct}%` as unknown as number }]}
                />
                <View
                  style={[styles.gridLineHorizontal, { top: `${pct}%` as unknown as number }]}
                />
              </React.Fragment>
            ))}
          </View>

          {/* Section label watermark */}
          {currentSection ? (
            <Text style={styles.sectionWatermark}>{currentSection}</Text>
          ) : null}

          {/* Table nodes */}
          {visibleTables.map((table) => (
            <TableNode
              key={table.id}
              table={table}
              isSelected={table.id === selectedTableId}
              onPress={onTablePress}
              now={now}
            />
          ))}

          {/* Empty state */}
          {visibleTables.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons
                name="grid-outline"
                size={48}
                color="#374151"
              />
              <Text style={styles.emptyStateText}>
                No tables in this section
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Summary bar ── */}
      <SummaryBar
        available={summary.available}
        occupied={summary.occupied}
        reserved={summary.reserved}
        cleaning={summary.cleaning}
      />

      {/* ── Selected table indicator ── */}
      {selectedTableId && (
        <View testID="floor-selected-table" style={styles.selectedIndicator}>
          <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
          <Text style={styles.selectedIndicatorText}>
            Table{" "}
            {visibleTables.find((t) => t.id === selectedTableId)?.number ??
              "—"}{" "}
            selected
          </Text>
        </View>
      )}
    </View>
  );
}

export default React.memo(FloorPlanCanvas);

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1f2937",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#374151",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerStat: {
    fontSize: 14,
    color: "#9ca3af",
    fontWeight: "500",
  },

  // ── Section Tabs ──
  sectionTabs: {
    maxHeight: 52,
    backgroundColor: "#1f2937",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  sectionTabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  sectionPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#374151",
  },
  sectionPillActive: {
    backgroundColor: "#3b82f6",
  },
  sectionPillText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#9ca3af",
  },
  sectionPillTextActive: {
    color: "#ffffff",
  },

  // ── Legend ──
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 16,
    backgroundColor: "#1f2937",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "500",
  },

  // ── Canvas ──
  canvasWrapper: {
    flex: 1,
    padding: 12,
  },
  canvas: {
    flex: 1,
    aspectRatio: CANVAS_ASPECT_RATIO,
    maxHeight: "100%",
    alignSelf: "center",
    width: "100%",
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    overflow: "hidden",
    position: "relative",
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#1f293740",
  },
  gridLineHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#1f293740",
  },
  sectionWatermark: {
    position: "absolute",
    top: 12,
    left: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // ── Table Node ──
  tableNode: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    minWidth: MIN_TABLE_SIZE,
    minHeight: MIN_TABLE_SIZE,
    padding: 4,
    // offset so the node centres on its coordinate rather than top-left
    marginLeft: -(MIN_TABLE_SIZE / 2),
    marginTop: -(MIN_TABLE_SIZE / 2),
  },
  tableNodeSquare: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  tableNodeRound: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  tableNodeRectangle: {
    width: 100,
    height: 64,
    borderRadius: 8,
  },
  tableNodeBar: {
    width: 110,
    height: 48,
    borderRadius: 24,
  },
  tableNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  tableNumberSelected: {
    color: "#3b82f6",
  },
  seatBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    backgroundColor: "#00000060",
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  seatBadgeText: {
    fontSize: 9,
    color: "#9ca3af",
    fontWeight: "600",
  },

  // ── Occupied info overlay ──
  occupiedInfo: {
    alignItems: "center",
    gap: 1,
  },
  serverName: {
    fontSize: 9,
    color: "#d1d5db",
    fontWeight: "500",
    maxWidth: 64,
  },
  durationText: {
    fontSize: 10,
    color: "#9ca3af",
    fontWeight: "600",
  },
  durationTextLong: {
    color: "#fbbf24",
  },
  orderTotal: {
    fontSize: 9,
    color: "#d1d5db",
    fontWeight: "600",
  },

  // ── Reserved overlay ──
  reservedFor: {
    fontSize: 9,
    color: "#fbbf24",
    fontWeight: "500",
    maxWidth: 64,
    marginTop: 2,
  },

  // ── Warning badge ──
  warningBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 2,
  },

  // ── Shape hint ──
  shapeHint: {
    position: "absolute",
    bottom: 2,
    left: 2,
  },

  // ── Empty state ──
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },

  // ── Summary bar ──
  summaryBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#1f2937",
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "500",
  },
  summaryCount: {
    fontSize: 14,
    fontWeight: "700",
  },

  // ── Selected indicator ──
  selectedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    backgroundColor: "#1e3a5f",
    borderTopWidth: 1,
    borderTopColor: "#3b82f6",
  },
  selectedIndicatorText: {
    fontSize: 13,
    color: "#93c5fd",
    fontWeight: "600",
  },

  // ── Loading ──
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#9ca3af",
    fontWeight: "500",
  },
});
