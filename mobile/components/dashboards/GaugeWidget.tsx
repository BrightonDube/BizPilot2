/**
 * GaugeWidget – Progress-bar gauge showing current vs target value.
 *
 * Uses a horizontal bar (thick View with animated width) because React Native
 * doesn't include SVG out of the box and adding a dependency for a single
 * gauge would be overkill.  Colour transitions through green → amber → red
 * based on configurable thresholds.
 *
 * Why thresholds default to 80 / 50?  Those are sensible business defaults:
 * ≥ 80 % of target is "on track", 50-79 % is "warning", < 50 % is "critical".
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

interface GaugeWidgetProps {
  title: string;
  currentValue: number;
  targetValue: number;
  format: "currency" | "number" | "percentage";
  /** Thresholds expressed as percentages of the target (0-100). */
  thresholds?: { warning: number; critical: number };
  subtitle?: string;
  onPress?: () => void;
  isLoading?: boolean;
}

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
  skeleton: "#374151",
  trackBg: "#111827",
} as const;

const DEFAULT_THRESHOLDS = { warning: 80, critical: 50 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatValue = (value: number, format: GaugeWidgetProps["format"]): string => {
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

/** Pick a colour based on how far current is toward target. */
const getBarColor = (
  percentage: number,
  thresholds: { warning: number; critical: number }
): string => {
  if (percentage >= thresholds.warning) return COLORS.green;
  if (percentage >= thresholds.critical) return COLORS.amber;
  return COLORS.red;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const GaugeWidget: React.FC<GaugeWidgetProps> = ({
  title,
  currentValue,
  targetValue,
  format,
  thresholds = DEFAULT_THRESHOLDS,
  subtitle,
  onPress,
  isLoading = false,
}) => {
  // Guard against division by zero when target is 0.
  const percentage = useMemo(() => {
    if (targetValue === 0) return 0;
    return (currentValue / targetValue) * 100;
  }, [currentValue, targetValue]);

  // Clamp visual width to 100 % so the bar never overflows the track.
  const clampedPct = useMemo(() => Math.min(percentage, 100), [percentage]);

  const barColor = useMemo(
    () => getBarColor(percentage, thresholds),
    [percentage, thresholds]
  );

  const formattedCurrent = useMemo(
    () => formatValue(currentValue, format),
    [currentValue, format]
  );
  const formattedTarget = useMemo(
    () => formatValue(targetValue, format),
    [targetValue, format]
  );

  const handlePress = useCallback(() => {
    if (!onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  // -----------------------------------------------------------------------
  // Loading skeleton
  // -----------------------------------------------------------------------
  if (isLoading) {
    return (
      <View style={styles.card} testID="gauge-loading">
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonBar} />
        <View style={styles.skeletonValue} />
      </View>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress
    ? { onPress: handlePress, activeOpacity: 0.75 }
    : {};

  return (
    <Wrapper style={styles.card} testID="gauge-widget" {...(wrapperProps as any)}>
      {/* Title */}
      <Text style={styles.title} testID="gauge-title" numberOfLines={1}>
        {title}
      </Text>

      {/* Current value (large) */}
      <Text
        style={[styles.currentValue, { color: barColor }]}
        testID="gauge-value"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formattedCurrent}
      </Text>

      {/* Progress bar */}
      <View style={styles.track} testID="gauge-progress">
        <View
          style={[
            styles.bar,
            {
              width: `${clampedPct}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>

      {/* Labels row: percentage achieved + target */}
      <View style={styles.labelsRow}>
        <Text
          style={[styles.percentageText, { color: barColor }]}
          testID="gauge-percentage"
        >
          {percentage.toFixed(1)}%
        </Text>
        <Text style={styles.targetText} testID="gauge-target">
          Target: {formattedTarget}
        </Text>
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
  title: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  currentValue: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
  },

  // Progress bar
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.trackBg,
    overflow: "hidden",
    marginBottom: 8,
  },
  bar: {
    height: "100%",
    borderRadius: 5,
  },

  // Labels
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  percentageText: {
    fontSize: 14,
    fontWeight: "700",
  },
  targetText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 8,
  },

  // Skeleton
  skeletonTitle: {
    width: 100,
    height: 12,
    borderRadius: 4,
    backgroundColor: COLORS.skeleton,
    marginBottom: 12,
  },
  skeletonBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.skeleton,
    marginBottom: 10,
  },
  skeletonValue: {
    width: 60,
    height: 14,
    borderRadius: 4,
    backgroundColor: COLORS.skeleton,
  },
});

export default memo(GaugeWidget);
