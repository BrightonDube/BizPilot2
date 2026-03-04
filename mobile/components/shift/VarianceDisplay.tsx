/**
 * VarianceDisplay — shows expected vs counted cash and the resulting variance.
 * (shift-management task 6.5)
 *
 * Used in ShiftCloseModal during the cash count step.
 *
 * The component is intentionally "read-only" — it only displays data that
 * the parent has already computed. This separation of concerns means the
 * display logic is testable without any business logic.
 *
 * Colour coding:
 *   - Zero variance       → neutral grey (all good)
 *   - Positive variance   → green (over; staff put in more than expected)
 *   - Negative variance   → red (short; drawer is light)
 *   - Above threshold     → amber warning banner shown
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VarianceDisplayProps {
  /** Expected cash as calculated by the shift service */
  expectedCash: number;
  /** Cash physically counted by the staff member */
  countedCash: number;
  /** Pre-computed variance (countedCash - expectedCash) */
  variance: number;
  /**
   * Threshold above which a warning is shown and a reason becomes required.
   * Pass `0` to always show as balanced; pass `Infinity` to never warn.
   */
  threshold?: number;
  /** Optional container style override */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const VarianceDisplay: React.FC<VarianceDisplayProps> = React.memo(
  function VarianceDisplay({
    expectedCash,
    countedCash,
    variance,
    threshold = 50,
    style,
  }) {
    const absVariance = Math.abs(variance);
    const isOver = variance > 0;
    const isShort = variance < 0;
    const isBalanced = variance === 0;
    const isAboveThreshold = absVariance > threshold;

    // Colour and label based on variance direction
    const { color, icon, statusLabel } = useMemo<{
      color: string;
      icon: keyof typeof Ionicons.glyphMap;
      statusLabel: string;
    }>(() => {
      if (isBalanced) {
        return { color: "#9ca3af", icon: "checkmark-circle-outline", statusLabel: "Balanced" };
      }
      if (isOver) {
        return { color: "#22c55e", icon: "arrow-up-circle-outline", statusLabel: "Over" };
      }
      // isShort
      return { color: "#ef4444", icon: "arrow-down-circle-outline", statusLabel: "Short" };
    }, [isBalanced, isOver]);

    const varianceFormatted = useMemo(() => {
      const prefix = isOver ? "+" : isShort ? "-" : "";
      return `${prefix}${formatCurrency(absVariance)}`;
    }, [isOver, isShort, absVariance]);

    return (
      <View style={[styles.container, style]}>
        {/* Row: Expected vs Counted */}
        <View style={styles.comparisonRow}>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>Expected</Text>
            <Text style={styles.comparisonAmount}>
              {formatCurrency(expectedCash)}
            </Text>
          </View>

          <Ionicons name="remove-outline" size={22} color="#4b5563" />

          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>Counted</Text>
            <Text style={styles.comparisonAmount}>
              {formatCurrency(countedCash)}
            </Text>
          </View>

          <Ionicons name="remove-outline" size={22} color="#4b5563" />

          {/* Variance result */}
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>Variance</Text>
            <View style={styles.varianceRow}>
              <Ionicons name={icon} size={18} color={color} />
              <Text style={[styles.varianceAmount, { color }]}>
                {varianceFormatted}
              </Text>
            </View>
          </View>
        </View>

        {/* Status pill */}
        <View style={[styles.statusPill, { borderColor: color }]}>
          <Text style={[styles.statusText, { color }]}>{statusLabel}</Text>
        </View>

        {/* Above-threshold warning */}
        {isAboveThreshold && (
          <View style={styles.warningRow}>
            <Ionicons name="alert-circle-outline" size={16} color="#fbbf24" />
            <Text style={styles.warningText}>
              Variance exceeds {formatCurrency(threshold)} — a reason is required.
            </Text>
          </View>
        )}
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
    gap: 12,
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  comparisonItem: {
    alignItems: "center",
    minWidth: 80,
  },
  comparisonLabel: {
    fontSize: 11,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  comparisonAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  varianceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  varianceAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  warningText: {
    fontSize: 13,
    color: "#fbbf24",
    flex: 1,
    flexWrap: "wrap",
  },
});

export default VarianceDisplay;
