/**
 * LoyaltyRedemptionPanel
 *
 * Inline panel displayed during POS checkout that lets the cashier
 * apply loyalty points as a payment discount.
 *
 * Why a panel (not a modal)?
 * The redemption decision is part of the checkout flow — the cashier
 * sees the cart total, the available balance, and the resulting
 * discounted total all at once. A modal would hide context. This panel
 * sits above the payment buttons inside the existing PaymentModal.
 *
 * Design decisions:
 * - "Boring" stepper input (− / numeric / +) for easy fat-finger use on tablets
 * - Points are redeemed in 50-point increments to simplify the UX
 * - We show both the points being redeemed AND the ZAR discount value
 * - The component is stateless re: actual redemption — it calls onApply
 *   and the parent handles the LoyaltyService.validateRedemption check
 *
 * Validates: loyalty-programs Requirement 3 (Points Redemption) — Task 4.1
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";
import {
  calculateRedemptionDiscount,
  validateRedemption,
  DEFAULT_REDEMPTION_RATE,
} from "@/services/LoyaltyService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoyaltyRedemptionPanelProps {
  /** Customer's current loyalty point balance (0 = no balance / no customer) */
  availablePoints: number;
  /** Order total in ZAR — used to cap the max discount */
  orderTotal: number;
  /** Points currently queued for redemption (controlled from parent) */
  pointsToRedeem: number;
  /** Called with new points value when the cashier changes the amount */
  onPointsChange: (points: number) => void;
  /** Called when the cashier confirms the redemption amount */
  onApply: (points: number, discountAmount: number) => void;
  /** Called when the cashier cancels / removes the loyalty discount */
  onRemove: () => void;
  /**
   * Points-to-ZAR rate (default: DEFAULT_REDEMPTION_RATE).
   * Passed from business settings so different businesses can use
   * different rates without hard-coding.
   */
  redemptionRate?: number;
  /** Whether a loyalty discount is currently applied (shows remove button) */
  applied?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Increment/decrement step for the stepper control */
const STEP = 50;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * LoyaltyRedemptionPanel renders inline in the checkout flow.
 *
 * Layout (tablet, horizontal):
 *   [ ⭐ Balance: 1,250 pts ]  [ − ] [ 500 pts ] [ + ]  [ Redeem: R5.00 ] [Apply]
 */
const LoyaltyRedemptionPanel: React.FC<LoyaltyRedemptionPanelProps> =
  React.memo(function LoyaltyRedemptionPanel({
    availablePoints,
    orderTotal,
    pointsToRedeem,
    onPointsChange,
    onApply,
    onRemove,
    redemptionRate = DEFAULT_REDEMPTION_RATE,
    applied = false,
  }) {
    // ---------------------------------------------------------------------------
    // Derived values — memoised so they don't recalculate on every render
    // ---------------------------------------------------------------------------

    const discountAmount = useMemo(
      () => calculateRedemptionDiscount(pointsToRedeem, redemptionRate),
      [pointsToRedeem, redemptionRate]
    );

    /**
     * Maximum points the customer can redeem:
     * - Cannot exceed their balance (floored to nearest STEP)
     * - Cannot discount more than the order total
     *   (prevents using loyalty to "earn" money)
     *
     * We floor balance to nearest STEP so the stepper always starts
     * from a valid multiple — avoids an "Apply 175 pts" state when STEP=50.
     */
    const maxRedeemable = useMemo(() => {
      const maxByBalance = Math.floor(availablePoints / STEP) * STEP;
      // Convert order total to equivalent points and floor to nearest STEP
      const maxByOrder = Math.floor(orderTotal / redemptionRate / STEP) * STEP;
      return Math.min(maxByBalance, maxByOrder);
    }, [availablePoints, orderTotal, redemptionRate]);

    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------

    const handleDecrement = useCallback(() => {
      Haptics.selectionAsync();
      const next = Math.max(0, pointsToRedeem - STEP);
      onPointsChange(next);
    }, [pointsToRedeem, onPointsChange]);

    const handleIncrement = useCallback(() => {
      Haptics.selectionAsync();
      const next = Math.min(maxRedeemable, pointsToRedeem + STEP);
      onPointsChange(next);
    }, [pointsToRedeem, maxRedeemable, onPointsChange]);

    const handleApply = useCallback(() => {
      if (pointsToRedeem === 0) return;

      // Run the same validation the server will run
      const validation = validateRedemption(availablePoints, pointsToRedeem);
      if (!validation.valid) {
        Alert.alert("Cannot Redeem", validation.error ?? "Insufficient points");
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onApply(pointsToRedeem, discountAmount);
    }, [pointsToRedeem, availablePoints, discountAmount, onApply]);

    const handleRemove = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onRemove();
    }, [onRemove]);

    // ---------------------------------------------------------------------------
    // Guard: no customer selected or no balance
    // ---------------------------------------------------------------------------

    if (availablePoints <= 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="star-outline" size={16} color="#9CA3AF" />
          <Text style={styles.emptyText}>No loyalty balance</Text>
        </View>
      );
    }

    // ---------------------------------------------------------------------------
    // Applied state — shows a summary + remove button
    // ---------------------------------------------------------------------------

    if (applied) {
      return (
        <View style={styles.appliedRow}>
          <Ionicons name="star" size={16} color="#F59E0B" />
          <Text style={styles.appliedLabel}>
            {pointsToRedeem.toLocaleString()} pts redeemed
          </Text>
          <Text style={styles.appliedDiscount}>
            −{formatCurrency(discountAmount)}
          </Text>
          <Pressable
            onPress={handleRemove}
            style={styles.removeButton}
            accessibilityLabel="Remove loyalty discount"
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={20} color="#EF4444" />
          </Pressable>
        </View>
      );
    }

    // ---------------------------------------------------------------------------
    // Default: stepper + apply button
    // ---------------------------------------------------------------------------

    return (
      <View style={styles.container}>
        {/* Balance badge */}
        <View style={styles.balanceBadge}>
          <Ionicons name="star" size={14} color="#F59E0B" />
          <Text style={styles.balanceText}>
            {availablePoints.toLocaleString()} pts
          </Text>
        </View>

        {/* Stepper */}
        <View style={styles.stepper}>
          <Pressable
            onPress={handleDecrement}
            disabled={pointsToRedeem <= 0}
            style={[
              styles.stepperButton,
              pointsToRedeem <= 0 && styles.stepperButtonDisabled,
            ]}
            accessibilityLabel="Decrease points"
          >
            <Ionicons
              name="remove"
              size={20}
              color={pointsToRedeem <= 0 ? "#D1D5DB" : "#374151"}
            />
          </Pressable>

          <Text style={styles.stepperValue}>
            {pointsToRedeem.toLocaleString()}
          </Text>

          <Pressable
            onPress={handleIncrement}
            disabled={pointsToRedeem >= maxRedeemable}
            style={[
              styles.stepperButton,
              pointsToRedeem >= maxRedeemable && styles.stepperButtonDisabled,
            ]}
            accessibilityLabel="Increase points"
          >
            <Ionicons
              name="add"
              size={20}
              color={pointsToRedeem >= maxRedeemable ? "#D1D5DB" : "#374151"}
            />
          </Pressable>
        </View>

        {/* Discount preview */}
        <Text style={styles.discountPreview}>
          = {formatCurrency(discountAmount)} off
        </Text>

        {/* Apply button */}
        <Pressable
          onPress={handleApply}
          disabled={pointsToRedeem === 0}
          style={[
            styles.applyButton,
            pointsToRedeem === 0 && styles.applyButtonDisabled,
          ]}
          accessibilityLabel={`Apply ${pointsToRedeem} loyalty points`}
        >
          <Text
            style={[
              styles.applyButtonText,
              pointsToRedeem === 0 && styles.applyButtonTextDisabled,
            ]}
          >
            Apply
          </Text>
        </Pressable>
      </View>
    );
  });

export default LoyaltyRedemptionPanel;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFFBEB", // amber-50 — loyalty amber theme
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDE68A", // amber-200
  },
  balanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF3C7", // amber-100
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  balanceText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E", // amber-800
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    justifyContent: "center",
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    minWidth: 60,
    textAlign: "center",
  },
  discountPreview: {
    fontSize: 13,
    color: "#059669", // emerald-600
    fontWeight: "600",
    minWidth: 70,
    textAlign: "right",
  },
  applyButton: {
    backgroundColor: "#F59E0B", // amber-400
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  applyButtonTextDisabled: {
    color: "#9CA3AF",
  },
  emptyState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  emptyText: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  appliedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#ECFDF5", // emerald-50
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0", // emerald-200
  },
  appliedLabel: {
    flex: 1,
    fontSize: 14,
    color: "#065F46", // emerald-800
    fontWeight: "500",
  },
  appliedDiscount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#059669", // emerald-600
  },
  removeButton: {
    padding: 2,
  },
});
