/**
 * KPIWidget – Single KPI metric card with trend indicator.
 *
 * Renders a formatted numeric value (currency / number / percentage) alongside
 * an optional trend arrow that compares to a previous period.  Supports a
 * loading skeleton so the card can be placed before data arrives.
 *
 * Why React.memo?  Dashboard screens typically hold many KPI cards and the
 * parent re-renders on every poll interval; memo prevents needless repaints
 * when the props haven't actually changed.
 */

import React, { memo, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
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

type TrendDirection = "up" | "down" | "flat";

interface KPIWidgetProps {
  title: string;
  value: number;
  format: "currency" | "number" | "percentage";
  previousValue?: number;
  trendDirection?: TrendDirection;
  trendPercentage?: number;
  subtitle?: string;
  /** Ionicons icon name rendered beside the title. */
  icon?: string;
  onPress?: () => void;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Centralised currency / number / percentage formatter. */
const formatValue = (value: number, format: KPIWidgetProps["format"]): string => {
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

/**
 * Format a number as South-African Rand.
 * Keeping this as a standalone so it can be extracted into a shared util later.
 */
const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

/** Derive trend metadata (icon, colour) from direction. */
const getTrendMeta = (
  direction: TrendDirection
): { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string } => {
  switch (direction) {
    case "up":
      return { icon: "arrow-up", color: COLORS.green };
    case "down":
      return { icon: "arrow-down", color: COLORS.red };
    case "flat":
    default:
      return { icon: "remove-outline", color: COLORS.grey };
  }
};

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const COLORS = {
  bg: "#0f172a",
  card: "#1f2937",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#fbbf24",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  grey: "#6b7280",
  skeleton: "#374151",
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const KPIWidget: React.FC<KPIWidgetProps> = ({
  title,
  value,
  format,
  previousValue,
  trendDirection,
  trendPercentage,
  subtitle,
  icon,
  onPress,
  isLoading = false,
}) => {
  // Compute the trend direction automatically when the caller supplies a
  // previousValue but no explicit direction – keeps the API ergonomic.
  const resolvedDirection = useMemo<TrendDirection>(() => {
    if (trendDirection) return trendDirection;
    if (previousValue === undefined) return "flat";
    if (value > previousValue) return "up";
    if (value < previousValue) return "down";
    return "flat";
  }, [trendDirection, previousValue, value]);

  const resolvedPercentage = useMemo<number | undefined>(() => {
    if (trendPercentage !== undefined) return trendPercentage;
    if (previousValue === undefined || previousValue === 0) return undefined;
    return Math.abs(((value - previousValue) / previousValue) * 100);
  }, [trendPercentage, previousValue, value]);

  const trendMeta = useMemo(() => getTrendMeta(resolvedDirection), [resolvedDirection]);

  const formattedValue = useMemo(() => formatValue(value, format), [value, format]);

  /** Light haptic on press for tactile feedback. */
  const handlePress = useCallback(() => {
    if (!onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  // -------------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------------
  if (isLoading) {
    return (
      <View style={styles.card} testID="kpi-loading">
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonValue} />
        <View style={styles.skeletonTrend} />
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress
    ? { onPress: handlePress, activeOpacity: 0.75 }
    : {};

  return (
    <Wrapper style={styles.card} testID="kpi-widget" {...(wrapperProps as any)}>
      {/* Header: icon + title */}
      <View style={styles.header}>
        {icon && (
          <Ionicons
            name={icon as any}
            size={18}
            color={COLORS.blue}
            style={styles.headerIcon}
          />
        )}
        <Text style={styles.title} testID="kpi-title" numberOfLines={1}>
          {title}
        </Text>
      </View>

      {/* Large formatted value */}
      <Text style={styles.value} testID="kpi-value" numberOfLines={1} adjustsFontSizeToFit>
        {formattedValue}
      </Text>

      {/* Trend indicator */}
      <View style={styles.trendRow} testID="kpi-trend">
        <Ionicons name={trendMeta.icon} size={16} color={trendMeta.color} />
        {resolvedPercentage !== undefined && (
          <Text style={[styles.trendText, { color: trendMeta.color }]}>
            {resolvedPercentage.toFixed(1)}%
          </Text>
        )}
      </View>

      {/* Optional subtitle */}
      {subtitle && (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </Wrapper>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  headerIcon: {
    marginRight: 6,
  },
  title: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 6,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trendText: {
    fontSize: 13,
    fontWeight: "600",
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  // Skeleton placeholders
  skeletonTitle: {
    width: 80,
    height: 12,
    borderRadius: 4,
    backgroundColor: COLORS.skeleton,
    marginBottom: 12,
  },
  skeletonValue: {
    width: 140,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.skeleton,
    marginBottom: 10,
  },
  skeletonTrend: {
    width: 60,
    height: 12,
    borderRadius: 4,
    backgroundColor: COLORS.skeleton,
  },
});

export default memo(KPIWidget);
