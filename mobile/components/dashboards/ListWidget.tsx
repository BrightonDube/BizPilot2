/**
 * ListWidget – Ranked "top N" list for dashboard screens.
 *
 * Shows a FlatList of items ordered by rank.  The top three positions receive
 * gold / silver / bronze badge colours to draw attention.  Each row optionally
 * displays a change indicator (green ↑ / red ↓) and an Ionicons icon.
 *
 * Why FlatList over ScrollView?  Unlike the compact table widget the list may
 * display dozens of items (e.g. top 50 products), so virtualisation matters.
 */

import React, { memo, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
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

interface ListItem {
  id: string;
  rank: number;
  label: string;
  value: number;
  format: "currency" | "number" | "percentage";
  /** Positive = up, negative = down, zero/undefined = hidden. */
  change?: number;
  /** Ionicons name. */
  icon?: string;
}

interface ListWidgetProps {
  title: string;
  items: ListItem[];
  /** Cap the visible items (default: show all). */
  maxItems?: number;
  onItemPress?: (itemId: string) => void;
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
  skeleton: "#374151",
  border: "#374151",
} as const;

/** Gold / silver / bronze colours for the top-3 badges. */
const RANK_BADGE_COLORS: Record<number, string> = {
  1: "#facc15", // gold
  2: "#a8a29e", // silver
  3: "#d97706", // bronze
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatValue = (value: number, format: ListItem["format"]): string => {
  switch (format) {
    case "currency":
      return formatCurrency(value);
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "number":
    default:
      return value.toLocaleString("en-ZA", { maximumFractionDigits: 1 });
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

/** Single ranked row. */
const ListRow: React.FC<{
  item: ListItem;
  onItemPress?: (id: string) => void;
}> = ({ item, onItemPress }) => {
  const handlePress = useCallback(() => {
    if (!onItemPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onItemPress(item.id);
  }, [onItemPress, item.id]);

  const badgeColor = RANK_BADGE_COLORS[item.rank];
  const formattedValue = useMemo(
    () => formatValue(item.value, item.format),
    [item.value, item.format]
  );

  const changeColor =
    item.change !== undefined && item.change !== 0
      ? item.change > 0
        ? COLORS.green
        : COLORS.red
      : undefined;

  const changeIcon: React.ComponentProps<typeof Ionicons>["name"] | undefined =
    item.change !== undefined && item.change !== 0
      ? item.change > 0
        ? "arrow-up"
        : "arrow-down"
      : undefined;

  const Wrapper = onItemPress ? TouchableOpacity : View;
  const wrapperProps = onItemPress
    ? { onPress: handlePress, activeOpacity: 0.7 }
    : {};

  return (
    <Wrapper
      style={styles.row}
      testID={`list-item-${item.id}`}
      {...(wrapperProps as any)}
    >
      {/* Rank badge */}
      <View
        style={[
          styles.rankBadge,
          badgeColor ? { backgroundColor: badgeColor } : styles.rankBadgeDefault,
        ]}
        testID={`list-rank-${item.id}`}
      >
        <Text
          style={[
            styles.rankText,
            badgeColor ? styles.rankTextHighlight : undefined,
          ]}
        >
          {item.rank}
        </Text>
      </View>

      {/* Optional icon */}
      {item.icon && (
        <Ionicons
          name={item.icon as any}
          size={18}
          color={COLORS.blue}
          style={styles.itemIcon}
        />
      )}

      {/* Label (fills remaining space) */}
      <Text style={styles.label} numberOfLines={1}>
        {item.label}
      </Text>

      {/* Value */}
      <Text style={styles.value} testID={`list-value-${item.id}`}>
        {formattedValue}
      </Text>

      {/* Change indicator */}
      {changeIcon && changeColor && (
        <View style={styles.changeContainer}>
          <Ionicons name={changeIcon} size={12} color={changeColor} />
          <Text style={[styles.changeText, { color: changeColor }]}>
            {Math.abs(item.change!).toFixed(1)}%
          </Text>
        </View>
      )}
    </Wrapper>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ListWidget: React.FC<ListWidgetProps> = ({
  title,
  items,
  maxItems,
  onItemPress,
  isLoading = false,
  emptyMessage = "No items to display",
}) => {
  const visibleItems = useMemo(() => {
    if (maxItems === undefined) return items;
    return items.slice(0, maxItems);
  }, [items, maxItems]);

  const keyExtractor = useCallback((item: ListItem) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => (
      <ListRow item={item} onItemPress={onItemPress} />
    ),
    [onItemPress]
  );

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------
  if (isLoading) {
    return (
      <View style={styles.card} testID="list-loading">
        <Text style={styles.title}>{title}</Text>
        <View style={styles.stateContainer}>
          <ActivityIndicator size="small" color={COLORS.blue} />
          <Text style={styles.stateText}>Loading…</Text>
        </View>
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Empty
  // -----------------------------------------------------------------------
  if (visibleItems.length === 0) {
    return (
      <View style={styles.card} testID="list-empty">
        <Text style={styles.title}>{title}</Text>
        <View style={styles.stateContainer}>
          <Ionicons name="list-outline" size={32} color={COLORS.textMuted} />
          <Text style={styles.stateText}>{emptyMessage}</Text>
        </View>
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <View style={styles.card} testID="list-widget">
      <Text style={styles.title} testID="list-title">
        {title}
      </Text>

      <FlatList
        data={visibleItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      />
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

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },

  // Rank badge
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  rankBadgeDefault: {
    backgroundColor: COLORS.cardAlt,
  },
  rankText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  rankTextHighlight: {
    color: "#0f172a",
  },

  // Icon
  itemIcon: {
    marginRight: 8,
  },

  // Label + value
  label: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
  },
  value: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 8,
  },

  // Change
  changeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    gap: 2,
  },
  changeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // States
  stateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  stateText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
});

export default memo(ListWidget);
