/**
 * WidgetLibrary — Catalog of available dashboard widgets.
 *
 * Renders a searchable, filterable grid of widget templates that the user can
 * browse and select to add to a dashboard.
 *
 * Why a 2-column grid instead of a list?
 * Widgets are a visual concept — the grid gives more surface area for the icon
 * and description, making it easier to scan and compare templates at a glance
 * on both phone and tablet form factors.
 *
 * Why category pills instead of a dropdown filter?
 * There are only six categories (including "All"). Pills expose every option
 * in a single tap without hiding choices behind a menu. This matches the
 * speed expectations of a POS/back-office operator.
 *
 * Why React.memo?  The parent dashboard-builder screen may re-render when
 * other panels update; memo prevents the library from repainting unless its
 * own props change.
 */

import React, { memo, useCallback, useMemo } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WidgetTemplate {
  id: string;
  name: string;
  description: string;
  category: "sales" | "inventory" | "staff" | "financial" | "custom";
  icon: string;
  previewImageUrl: string | null;
  isPopular: boolean;
}

interface WidgetLibraryProps {
  widgets: WidgetTemplate[];
  onSelectWidget: (widgetId: string) => void;
  filterCategory: string;
  onFilterChange: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

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
  grey: "#6b7280",
  border: "#374151",
} as const;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Category filter options with associated colours. */
const CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: "all", label: "All", color: COLORS.blue },
  { key: "sales", label: "Sales", color: COLORS.green },
  { key: "inventory", label: "Inventory", color: COLORS.amber },
  { key: "staff", label: "Staff", color: COLORS.purple },
  { key: "financial", label: "Financial", color: COLORS.blue },
  { key: "custom", label: "Custom", color: COLORS.grey },
];

/** Icon mapping per category for the widget cards. */
const CATEGORY_ICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  sales: "cart-outline",
  inventory: "cube-outline",
  staff: "people-outline",
  financial: "wallet-outline",
  custom: "construct-outline",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single category filter pill. */
const CategoryPill = memo(function CategoryPill({
  label,
  categoryKey,
  color,
  isActive,
  onPress,
}: {
  label: string;
  categoryKey: string;
  color: string;
  isActive: boolean;
  onPress: (key: string) => void;
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(categoryKey);
  }, [onPress, categoryKey]);

  return (
    <TouchableOpacity
      testID={`widget-filter-${categoryKey}`}
      style={[styles.pill, isActive && { backgroundColor: color + "22", borderColor: color }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.pillText, isActive && { color }]}>{label}</Text>
    </TouchableOpacity>
  );
});

/** Single widget template card in the grid. */
const WidgetCard = memo(function WidgetCard({
  widget,
  onSelect,
}: {
  widget: WidgetTemplate;
  onSelect: (id: string) => void;
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(widget.id);
  }, [onSelect, widget.id]);

  /**
   * Resolve the Ionicons name — the widget.icon string may already be a valid
   * Ionicons name; fall back to the category icon otherwise.
   */
  const iconName = (widget.icon || CATEGORY_ICONS[widget.category] || "apps-outline") as React.ComponentProps<typeof Ionicons>["name"];
  const categoryColor = CATEGORIES.find((c) => c.key === widget.category)?.color ?? COLORS.grey;

  return (
    <TouchableOpacity
      testID={`widget-template-${widget.id}`}
      style={styles.widgetCard}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Popular badge */}
      {widget.isPopular && (
        <View style={styles.popularBadge}>
          <Ionicons name="star" size={10} color={COLORS.amber} />
          <Text style={styles.popularText}>Popular</Text>
        </View>
      )}

      {/* Icon */}
      <View style={[styles.iconCircle, { backgroundColor: categoryColor + "22" }]}>
        <Ionicons name={iconName} size={24} color={categoryColor} />
      </View>

      {/* Name */}
      <Text style={styles.widgetName} numberOfLines={1}>
        {widget.name}
      </Text>

      {/* Description — capped at 2 lines */}
      <Text style={styles.widgetDesc} numberOfLines={2}>
        {widget.description}
      </Text>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const WidgetLibrary: React.FC<WidgetLibraryProps> = ({
  widgets,
  onSelectWidget,
  filterCategory,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onClose,
}) => {
  // ------- derived data -------

  /** Filter widgets by category and search query. */
  const filtered = useMemo(() => {
    let list = widgets;
    if (filterCategory && filterCategory !== "all") {
      list = list.filter((w) => w.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [widgets, filterCategory, searchQuery]);

  const keyExtractor = useCallback((item: WidgetTemplate) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: WidgetTemplate }) => (
      <WidgetCard widget={item} onSelect={onSelectWidget} />
    ),
    [onSelectWidget],
  );

  /** Empty search state. */
  const ListEmpty = useMemo(
    () => (
      <View testID="widget-empty" style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={48} color={COLORS.grey} />
        <Text style={styles.emptyTitle}>No widgets found</Text>
        <Text style={styles.emptySubtitle}>
          Try adjusting your search or category filter
        </Text>
      </View>
    ),
    [],
  );

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  // ------- render -------

  return (
    <View testID="widget-library" style={styles.container}>
      {/* ---- Header ---- */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Widget Library</Text>
        <TouchableOpacity
          testID="widget-close"
          onPress={handleClose}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={28} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ---- Search bar ---- */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={COLORS.grey} style={styles.searchIcon} />
        <TextInput
          testID="widget-search"
          style={styles.searchInput}
          placeholder="Search widgets…"
          placeholderTextColor={COLORS.grey}
          value={searchQuery}
          onChangeText={onSearchChange}
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange("")} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={COLORS.grey} />
          </TouchableOpacity>
        )}
      </View>

      {/* ---- Category filter pills ---- */}
      <View style={styles.pillRow}>
        {CATEGORIES.map((cat) => (
          <CategoryPill
            key={cat.key}
            label={cat.label}
            categoryKey={cat.key}
            color={cat.color}
            isActive={filterCategory === cat.key || (cat.key === "all" && !filterCategory)}
            onPress={onFilterChange}
          />
        ))}
      </View>

      {/* ---- Widget grid (2 columns) ---- */}
      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.input,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: COLORS.text,
  },

  // Pills
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textMuted,
  },

  // Grid
  gridRow: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 32,
  },

  // Widget card
  widgetCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    position: "relative",
  },
  popularBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: COLORS.amber + "22",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.amber,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  widgetName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  widgetDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 16,
  },

  // Empty
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default memo(WidgetLibrary);
export type { WidgetLibraryProps, WidgetTemplate };
