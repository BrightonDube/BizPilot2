/**
 * PaymentMethodSelector — checkout payment method picker.
 *
 * Displays the order total prominently and a 2-column grid of available
 * payment methods. Each tile shows its icon, name, and optional processing
 * fee. Tapping a tile selects it (blue border + check badge); disabled
 * methods are visually muted and non-interactive.
 *
 * Why a grid instead of a list?
 * In a busy POS environment, cashiers need to tap-and-go. A 2-column
 * grid keeps all common methods visible without scrolling and reduces
 * the number of taps vs. a dropdown or bottom-sheet list.
 *
 * Why haptic feedback on selection?
 * Tactile confirmation helps cashiers working at speed — they know the
 * tap registered without having to look away from the customer.
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single payment method option available at checkout. */
export interface PaymentMethod {
  /** Unique identifier */
  id: string;
  /** Human-readable label (e.g. "Cash", "Card") */
  name: string;
  /** Determines icon tinting & badge colour */
  type: "cash" | "card" | "eft" | "mobile" | "account" | "split";
  /** Ionicons glyph name */
  icon: string;
  /** Whether the method is currently available */
  isEnabled: boolean;
  /** Optional fee percentage (0-100) applied to the order total */
  processingFee?: number;
}

export interface PaymentMethodSelectorProps {
  /** Available payment methods to display */
  methods: PaymentMethod[];
  /** Currently selected method id, or null if none selected */
  selectedMethodId: string | null;
  /** Called when the user taps an enabled method tile */
  onSelectMethod: (methodId: string) => void;
  /** The total amount due for the current order */
  orderTotal: number;
  /** Called when the user taps the "Proceed to Payment" button */
  onProceed: () => void;
  /** When true, shows a spinner and disables the proceed button */
  isProcessing?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return a short fee label such as "+1.5% fee".
 * Why format inline? Avoids an extra utility for a one-off string.
 */
function feeLabel(fee: number): string {
  return `+${fee}% fee`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MethodTileProps {
  method: PaymentMethod;
  isSelected: boolean;
  onPress: (id: string) => void;
}

/**
 * Individual method tile rendered inside the grid.
 * Memoised so only the tile whose selection state changes re-renders.
 */
const MethodTile = React.memo(function MethodTile({
  method,
  isSelected,
  onPress,
}: MethodTileProps) {
  const handlePress = useCallback(() => {
    if (!method.isEnabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(method.id);
  }, [method.id, method.isEnabled, onPress]);

  return (
    <Pressable
      testID={`payment-method-${method.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${method.name} payment method`}
      accessibilityState={{ selected: isSelected, disabled: !method.isEnabled }}
      onPress={handlePress}
      style={[
        styles.tile,
        isSelected && styles.tileSelected,
        !method.isEnabled && styles.tileDisabled,
      ]}
    >
      {/* Selection check badge */}
      {isSelected && (
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
        </View>
      )}

      <Ionicons
        name={method.icon as keyof typeof Ionicons.glyphMap}
        size={32}
        color={method.isEnabled ? "#f3f4f6" : "#4b5563"}
      />

      <Text
        style={[styles.tileName, !method.isEnabled && styles.tileNameDisabled]}
        numberOfLines={1}
      >
        {method.name}
      </Text>

      {/* Processing fee hint */}
      {method.processingFee != null && method.processingFee > 0 && (
        <Text style={styles.feeText}>{feeLabel(method.processingFee)}</Text>
      )}

      {!method.isEnabled && (
        <Text style={styles.unavailableText}>Unavailable</Text>
      )}
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * PaymentMethodSelector renders the order total, a 2-column method grid,
 * and a "Proceed to Payment" CTA.
 */
const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = React.memo(
  function PaymentMethodSelector({
    methods,
    selectedMethodId,
    onSelectMethod,
    orderTotal,
    onProceed,
    isProcessing = false,
  }) {
    const canProceed = selectedMethodId !== null && !isProcessing;

    const handleProceed = useCallback(() => {
      if (!canProceed) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onProceed();
    }, [canProceed, onProceed]);

    return (
      <ScrollView
        testID="payment-method-selector"
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Order total ---- */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Order Total</Text>
          <Text testID="payment-total" style={styles.totalAmount}>
            {formatCurrency(orderTotal)}
          </Text>
        </View>

        {/* ---- Method grid ---- */}
        <Text style={styles.sectionTitle}>Select Payment Method</Text>

        <View style={styles.grid}>
          {methods.map((method) => (
            <MethodTile
              key={method.id}
              method={method}
              isSelected={method.id === selectedMethodId}
              onPress={onSelectMethod}
            />
          ))}
        </View>

        {/* ---- Proceed button ---- */}
        <Pressable
          testID="payment-proceed"
          accessibilityRole="button"
          accessibilityLabel="Proceed to payment"
          accessibilityState={{ disabled: !canProceed }}
          onPress={handleProceed}
          style={[styles.proceedButton, !canProceed && styles.proceedDisabled]}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons
                name="arrow-forward-circle-outline"
                size={22}
                color="#fff"
                style={styles.proceedIcon}
              />
              <Text style={styles.proceedText}>Proceed to Payment</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    );
  },
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },

  // -- Total section --
  totalSection: {
    alignItems: "center",
    paddingVertical: 24,
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: "700",
    color: "#f3f4f6",
  },

  // -- Section title --
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f3f4f6",
    marginBottom: 12,
  },

  // -- Grid --
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  // -- Tile --
  tile: {
    width: "48%",
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  tileSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#1e293b",
  },
  tileDisabled: {
    opacity: 0.45,
  },
  checkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  tileName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f3f4f6",
    marginTop: 10,
  },
  tileNameDisabled: {
    color: "#4b5563",
  },
  feeText: {
    fontSize: 11,
    color: "#fbbf24",
    marginTop: 4,
  },
  unavailableText: {
    fontSize: 11,
    color: "#ef4444",
    marginTop: 4,
  },

  // -- Proceed button --
  proceedButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22c55e",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  proceedDisabled: {
    backgroundColor: "#374151",
  },
  proceedIcon: {
    marginRight: 8,
  },
  proceedText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default PaymentMethodSelector;
