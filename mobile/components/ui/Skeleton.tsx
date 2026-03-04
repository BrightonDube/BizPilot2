/**
 * BizPilot Mobile POS — Skeleton Component
 *
 * Animated placeholder shown while content is loading.
 * Provides a better UX than blank space or spinners for list/grid views.
 *
 * Why Skeleton over ActivityIndicator?
 * Skeleton loading communicates the layout of incoming content,
 * reducing perceived wait time. For a POS product grid, seeing
 * card-shaped skeletons is more informative than a spinner.
 *
 * Uses a shimmer animation via react-native-reanimated for
 * smooth 60fps rendering without blocking the JS thread.
 */

import React, { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkeletonProps {
  /** Width of the placeholder (number or string like "100%") */
  width: number | string;
  /** Height of the placeholder */
  height: number;
  /** Border radius (defaults to 8) */
  borderRadius?: number;
  /** Additional styles */
  style?: ViewStyle;
}

interface SkeletonGroupProps {
  /** Number of skeleton rows to render */
  count: number;
  /** Height of each skeleton row */
  rowHeight?: number;
  /** Spacing between rows */
  gap?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHIMMER_DURATION = 1200;
const BASE_COLOR = "#374151";
const HIGHLIGHT_COLOR = "#4b5563";

// ---------------------------------------------------------------------------
// Single Skeleton Element
// ---------------------------------------------------------------------------

const Skeleton: React.FC<SkeletonProps> = React.memo(function Skeleton({
  width,
  height,
  borderRadius = 8,
  style,
}) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, {
        duration: SHIMMER_DURATION,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // infinite repeats
      true // reverse on each cycle
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: BASE_COLOR,
        },
        animatedStyle,
        style,
      ]}
    />
  );
});

// ---------------------------------------------------------------------------
// Skeleton Group (multiple rows)
// ---------------------------------------------------------------------------

const SkeletonGroup: React.FC<SkeletonGroupProps> = React.memo(
  function SkeletonGroup({ count, rowHeight = 20, gap = 12 }) {
    return (
      <View>
        {Array.from({ length: count }, (_, index) => (
          <Skeleton
            key={index}
            width="100%"
            height={rowHeight}
            style={{ marginBottom: index < count - 1 ? gap : 0 }}
          />
        ))}
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Skeleton Card (product-card shaped)
// ---------------------------------------------------------------------------

const SkeletonCard: React.FC<{ style?: ViewStyle }> = React.memo(
  function SkeletonCard({ style }) {
    return (
      <View
        style={[
          {
            backgroundColor: "#111827",
            borderRadius: 12,
            padding: 12,
            gap: 8,
          },
          style,
        ]}
      >
        {/* Image placeholder */}
        <Skeleton width="100%" height={100} borderRadius={8} />
        {/* Title placeholder */}
        <Skeleton width="80%" height={16} />
        {/* Price placeholder */}
        <Skeleton width="40%" height={14} />
      </View>
    );
  }
);

export default Skeleton;
export { Skeleton, SkeletonGroup, SkeletonCard };
