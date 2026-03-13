/**
 * BizPilot Mobile POS — ItemDiscountModal Component
 *
 * Allows staff to apply a per-item discount as either:
 * - A fixed amount (e.g., R20 off)
 * - A percentage (e.g., 10% off)
 *
 * Why both modes?
 * In hospitality, "R10 off" is common for manager-comps while
 * "15% off" is used for loyalty/promo discounts. Supporting both
 * avoids forcing staff to do mental math during a rush.
 *
 * Why a custom numpad instead of the system keyboard?
 * Same reason as PaymentModal: larger targets for POS use,
 * no keyboard dismiss animation delay, and the percentage/fixed
 * toggle is right next to the input.
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Modal, Button } from "@/components/ui";
import { formatCurrency } from "@/utils/formatters";
import { roundTo2 } from "@/utils/priceCalculator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DiscountMode = "fixed" | "percentage";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ItemDiscountModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Product name (displayed in header) */
  productName: string;
  /** Unit price of the item (used to calculate percentage discounts) */
  unitPrice: number;
  /** Current quantity in cart */
  quantity: number;
  /** Current discount amount on this item */
  currentDiscount: number;
  /** Called when discount is applied — receives the absolute discount amount */
  onApply: (discountAmount: number) => void;
}

// ---------------------------------------------------------------------------
// Quick percentage options
// ---------------------------------------------------------------------------

const QUICK_PERCENTAGES = [5, 10, 15, 20, 25, 50] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ItemDiscountModal: React.FC<ItemDiscountModalProps> = React.memo(
  function ItemDiscountModal({
    visible,
    onClose,
    productName,
    unitPrice,
    quantity,
    currentDiscount,
    onApply,
  }) {
    const [mode, setMode] = useState<DiscountMode>("percentage");
    const [inputValue, setInputValue] = useState("");

    const lineTotal = useMemo(
      () => roundTo2(unitPrice * quantity),
      [unitPrice, quantity]
    );

    /** The discount amount in ZAR based on current mode and input */
    const discountAmount = useMemo(() => {
      const numericValue = parseFloat(inputValue) || 0;
      if (mode === "percentage") {
        return roundTo2(lineTotal * (numericValue / 100));
      }
      return roundTo2(numericValue);
    }, [mode, inputValue, lineTotal]);

    const afterDiscount = useMemo(
      () => roundTo2(Math.max(0, lineTotal - discountAmount)),
      [lineTotal, discountAmount]
    );

    const isValid = discountAmount >= 0 && discountAmount <= lineTotal;

    const handleNumpadPress = useCallback((key: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (key === "⌫") {
        setInputValue((prev) => prev.slice(0, -1));
      } else if (key === ".") {
        setInputValue((prev) => {
          // Only allow one decimal point
          if (prev.includes(".")) return prev;
          return prev.length === 0 ? "0." : prev + ".";
        });
      } else {
        setInputValue((prev) => {
          const newVal = prev + key;
          // Limit to 2 decimal places
          const parts = newVal.split(".");
          if (parts[1] && parts[1].length > 2) return prev;
          return newVal;
        });
      }
    }, []);

    const handleModeSwitch = useCallback((newMode: DiscountMode) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setMode(newMode);
      setInputValue("");
    }, []);

    const handleQuickPercentage = useCallback((pct: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setMode("percentage");
      setInputValue(pct.toString());
    }, []);

    const handleApply = useCallback(() => {
      if (!isValid) {
        Alert.alert(
          "Invalid Discount",
          "Discount cannot exceed the line total."
        );
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onApply(discountAmount);
      onClose();
    }, [isValid, discountAmount, onApply, onClose]);

    const handleRemoveDiscount = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onApply(0);
      onClose();
    }, [onApply, onClose]);

    return (
      <Modal
        visible={visible}
        onClose={onClose}
        title={`Discount — ${productName}`}
      >
        <View style={styles.container}>
          {/* Item info */}
          <View style={styles.itemInfo}>
            <Text style={styles.itemPrice}>
              {formatCurrency(unitPrice)} × {quantity} = {formatCurrency(lineTotal)}
            </Text>
          </View>

          {/* Mode toggle: Fixed / Percentage */}
          <View style={styles.modeToggle}>
            <Pressable
              onPress={() => handleModeSwitch("fixed")}
              style={[
                styles.modeButton,
                mode === "fixed" && styles.modeButtonActive,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === "fixed" }}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === "fixed" && styles.modeButtonTextActive,
                ]}
              >
                R Fixed
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleModeSwitch("percentage")}
              style={[
                styles.modeButton,
                mode === "percentage" && styles.modeButtonActive,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === "percentage" }}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === "percentage" && styles.modeButtonTextActive,
                ]}
              >
                % Percentage
              </Text>
            </Pressable>
          </View>

          {/* Display input value */}
          <View style={styles.displayContainer}>
            <Text style={styles.displayValue}>
              {mode === "percentage" ? "" : "R "}
              {inputValue || "0"}
              {mode === "percentage" ? "%" : ""}
            </Text>
            <Text style={styles.displaySubtext}>
              Discount: {formatCurrency(discountAmount)} → New total:{" "}
              {formatCurrency(afterDiscount)}
            </Text>
            {!isValid && (
              <Text style={styles.errorText}>
                Discount cannot exceed {formatCurrency(lineTotal)}
              </Text>
            )}
          </View>

          {/* Quick percentage buttons */}
          {mode === "percentage" && (
            <View style={styles.quickRow}>
              {QUICK_PERCENTAGES.map((pct) => (
                <Pressable
                  key={pct}
                  onPress={() => handleQuickPercentage(pct)}
                  style={[
                    styles.quickButton,
                    inputValue === pct.toString() && styles.quickButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.quickButtonText,
                      inputValue === pct.toString() &&
                        styles.quickButtonTextActive,
                    ]}
                  >
                    {pct}%
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Numpad */}
          <View style={styles.numpad}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map(
              (key) => {
                if (key === "⌫") {
                  return (
                    <Pressable
                      key="backspace"
                      onPress={() => handleNumpadPress(key)}
                      style={({ pressed }) => [
                        styles.numpadKey,
                        pressed && styles.numpadKeyPressed,
                      ]}
                      accessibilityLabel="Backspace"
                    >
                      <Ionicons
                        name="backspace-outline"
                        size={22}
                        color="#ffffff"
                      />
                    </Pressable>
                  );
                }
                return (
                  <Pressable
                    key={key}
                    onPress={() => handleNumpadPress(key)}
                    style={({ pressed }) => [
                      styles.numpadKey,
                      pressed && styles.numpadKeyPressed,
                    ]}
                  >
                    <Text style={styles.numpadKeyText}>{key}</Text>
                  </Pressable>
                );
              }
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {currentDiscount > 0 && (
              <Pressable
                onPress={handleRemoveDiscount}
                style={styles.removeButton}
              >
                <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                <Text style={styles.removeText}>Remove Discount</Text>
              </Pressable>
            )}
            <Button
              label={`Apply ${mode === "percentage" ? `${inputValue || "0"}%` : formatCurrency(discountAmount)} Discount`}
              onPress={handleApply}
              disabled={!isValid || discountAmount <= 0}
              size="lg"
            />
          </View>
        </View>
      </Modal>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  itemInfo: {
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 12,
  },
  itemPrice: {
    color: "#d1d5db",
    fontSize: 15,
    textAlign: "center",
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: "#3b82f6",
  },
  modeButtonText: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "600",
  },
  modeButtonTextActive: {
    color: "#ffffff",
  },
  displayContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  displayValue: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "700",
  },
  displaySubtext: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 4,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 6,
  },
  quickButton: {
    flex: 1,
    backgroundColor: "#374151",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  quickButtonActive: {
    backgroundColor: "#3b82f6",
  },
  quickButtonText: {
    color: "#d1d5db",
    fontSize: 14,
    fontWeight: "600",
  },
  quickButtonTextActive: {
    color: "#ffffff",
  },
  numpad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  numpadKey: {
    width: 68,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#374151",
    borderRadius: 8,
  },
  numpadKeyPressed: {
    backgroundColor: "#4b5563",
  },
  numpadKeyText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "600",
  },
  actions: {
    gap: 8,
    marginTop: 4,
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  removeText: {
    color: "#ef4444",
    fontSize: 14,
  },
});

export default ItemDiscountModal;
