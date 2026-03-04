/**
 * LazyScreen — Suspense boundary for lazily-loaded route components. (task 14.3)
 *
 * Why lazy-load POS screens?
 * The POS app has many feature screens (Reports, Layby, Loyalty, Staff, etc.)
 * that staff rarely access during a typical sale.  Bundling them all eagerly
 * delays cold-start time and increases the initial JS parse cost on lower-end
 * tablets.  Wrapping infrequently-used screens in LazyScreen means the JS for
 * those routes is only downloaded and parsed when a user actually navigates
 * there — keeping the critical POS sale path snappy.
 *
 * Why a wrapper component instead of React.lazy at each call site?
 * - Consistent loading UI (spinner + accessible label) across all lazy screens
 * - One place to change the suspense fallback app-wide
 * - Prevents forgetting the Suspense boundary when adding new lazy screens
 *
 * Usage with Expo Router (dynamic import):
 * ```tsx
 * // app/(tabs)/reports.tsx
 * import { LazyScreen } from "@/components/common/LazyScreen";
 * const ReportsContent = React.lazy(() => import("@/features/reports/ReportsScreen"));
 *
 * export default function ReportsRoute() {
 *   return (
 *     <LazyScreen label="Loading Reports…">
 *       <ReportsContent />
 *     </LazyScreen>
 *   );
 * }
 * ```
 */

import React, { Suspense, memo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

/**
 * Full-screen loading indicator shown while the lazy chunk downloads.
 *
 * Why ActivityIndicator over Skeleton?
 * We don't know the screen's layout until the chunk loads, so a skeleton
 * would require duplicating the layout structure.  A centred spinner is
 * intentionally generic — it's visible for < 1 second on a good connection.
 */
const ScreenLoadingFallback = memo(function ScreenLoadingFallback({
  label,
}: {
  label: string;
}) {
  return (
    <View
      style={styles.container}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
    >
      <ActivityIndicator
        size="large"
        color="#6366f1" // indigo-500 — matches POS brand colour
        testID="lazy-screen-spinner"
      />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// LazyScreen
// ---------------------------------------------------------------------------

export interface LazyScreenProps {
  /** The lazy-loaded screen component(s) */
  children: React.ReactNode;
  /**
   * Human-readable loading message shown while the chunk downloads.
   * Default: "Loading…"
   */
  label?: string;
  /**
   * Custom fallback to render instead of the default spinner.
   * Pass your own skeleton or placeholder if needed.
   */
  fallback?: React.ReactNode;
}

/**
 * Wraps children in a React.Suspense boundary with a consistent loading UI.
 * Compose with React.lazy() for route-level code splitting.
 */
export const LazyScreen = memo(function LazyScreen({
  children,
  label = "Loading…",
  fallback,
}: LazyScreenProps) {
  return (
    <Suspense fallback={fallback ?? <ScreenLoadingFallback label={label} />}>
      {children}
    </Suspense>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f2937", // gray-800 — POS dark background
    gap: 12,
  },
  label: {
    color: "#9ca3af", // gray-400
    fontSize: 14,
    fontWeight: "500",
  },
});
