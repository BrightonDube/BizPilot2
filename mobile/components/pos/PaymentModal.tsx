/**
 * BizPilot Mobile POS — PaymentModal Component
 *
 * Full checkout flow: payment method selection → amount entry → confirmation.
 *
 * Why a modal instead of a separate screen?
 * The POS screen (with its product grid and cart) must remain immediately
 * accessible. If a payment is cancelled, the cashier returns to the exact
 * cart state. A modal preserves this context; navigating away could lose it.
 *
 * Why a custom numpad instead of the system keyboard?
 * 1. System keyboards are optimized for text, not money entry
 * 2. A custom numpad has larger buttons for faster, error-free entry
 * 3. We can add quick-amount buttons (e.g., exact change, round up)
 * 4. No keyboard dismissal animation delay between entries
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Button, Badge } from "@/components/ui";
import { formatCurrency } from "@/utils/formatters";
import {
  calculateChange,
  isPaymentSufficient,
  getQuickAmounts,
  roundTo2,
} from "@/utils/priceCalculator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaymentMethod = "cash" | "card" | "eft" | "split" | "room_charge";

interface PaymentMethodOption {
  method: PaymentMethod;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { method: "cash", label: "Cash", icon: "cash-outline" },
  { method: "card", label: "Card", icon: "card-outline" },
  { method: "eft", label: "EFT", icon: "swap-horizontal-outline" },
  { method: "split", label: "Split", icon: "git-branch-outline" },
  { method: "room_charge", label: "Room", icon: "bed-outline" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PaymentModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Total amount due for the order */
  totalDue: number;
  /** Called when payment is confirmed */
  onConfirmPayment: (payment: {
    method: PaymentMethod;
    amountTendered: number;
    change: number;
  }) => void;
  /** Called when room charge is selected — opens guest search flow */
  onRoomCharge?: () => void;
  /** Whether PMS/room charge is available (requires active PMS connection) */
  roomChargeEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Numpad sub-component
// ---------------------------------------------------------------------------

interface NumpadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

const NUMPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

function Numpad({ onDigit, onBackspace, onClear }: NumpadProps) {
  return (
    <View style={styles.numpad}>
      {NUMPAD_KEYS.map((key, i) => {
        const isBackspace = key === "⌫";

        return (
          <Pressable
            key={i}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (isBackspace) {
                onBackspace();
              } else {
                onDigit(key);
              }
            }}
            onLongPress={isBackspace ? onClear : undefined}
            style={({ pressed }) => [
              styles.numpadKey,
              pressed && styles.numpadKeyPressed,
            ]}
            accessibilityLabel={isBackspace ? "Backspace" : `Digit ${key}`}
            accessibilityRole="button"
          >
            <Text style={styles.numpadKeyText}>
              {key}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PaymentModal: React.FC<PaymentModalProps> = React.memo(
  function PaymentModal({
    visible,
    onClose,
    totalDue,
    onConfirmPayment,
    onRoomCharge,
    roomChargeEnabled = false,
  }) {
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("cash");
    const [amountString, setAmountString] = useState("");

    // Split payment state
    type SplitLine = { method: Exclude<PaymentMethod, "split">; amount: number };
    const [splitLines, setSplitLines] = useState<SplitLine[]>([]);
    const [splitActiveMethod, setSplitActiveMethod] = useState<Exclude<PaymentMethod, "split">>("cash");

    // Parse the entered amount
    const amountTendered = useMemo(() => {
      const parsed = parseFloat(amountString);
      return isNaN(parsed) ? 0 : roundTo2(parsed);
    }, [amountString]);

    // Calculate change
    const change = useMemo(
      () => calculateChange(totalDue, amountTendered),
      [totalDue, amountTendered]
    );

    // Quick amount suggestions
    const quickAmounts = useMemo(
      () => getQuickAmounts(totalDue),
      [totalDue]
    );

    // Split payment calculated values
    const splitTotal = useMemo(
      () => roundTo2(splitLines.reduce((sum, l) => sum + l.amount, 0)),
      [splitLines]
    );
    const splitRemaining = useMemo(
      () => roundTo2(Math.max(0, totalDue - splitTotal)),
      [totalDue, splitTotal]
    );

    // Whether the entered amount is sufficient
    const canConfirm = useMemo(() => {
      if (selectedMethod === "split") {
        return splitTotal >= totalDue;
      }
      if (selectedMethod === "room_charge") {
        return roomChargeEnabled;
      }
      if (selectedMethod === "cash") {
        return isPaymentSufficient(totalDue, amountTendered);
      }
      // Card and EFT always charge exact amount
      return true;
    }, [selectedMethod, totalDue, amountTendered, splitTotal, roomChargeEnabled]);

    // Numpad handlers
    const handleDigit = useCallback((digit: string) => {
      setAmountString((prev) => {
        // Prevent multiple decimal points
        if (digit === "." && prev.includes(".")) return prev;
        // Limit to 2 decimal places
        const parts = (prev + digit).split(".");
        if (parts[1] && parts[1].length > 2) return prev;
        // Limit total length
        if (prev.length >= 10) return prev;
        return prev + digit;
      });
    }, []);

    const handleBackspace = useCallback(() => {
      setAmountString((prev) => prev.slice(0, -1));
    }, []);

    const handleClear = useCallback(() => {
      setAmountString("");
    }, []);

    const handleQuickAmount = useCallback((amount: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setAmountString(amount.toFixed(2));
    }, []);

    const handleSelectMethod = useCallback((method: PaymentMethod) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedMethod(method);
      // For non-cash, auto-fill exact amount
      if (method === "split") {
        setAmountString("");
        setSplitLines([]);
        setSplitActiveMethod("cash");
      } else if (method !== "cash") {
        setAmountString(totalDue.toFixed(2));
      } else {
        setAmountString("");
      }
    }, [totalDue]);

    // Split payment handlers
    const handleAddSplitLine = useCallback(() => {
      if (amountTendered <= 0) {
        Alert.alert("Enter Amount", "Enter the amount for this payment method.");
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSplitLines((prev) => [
        ...prev,
        { method: splitActiveMethod, amount: amountTendered },
      ]);
      setAmountString("");
    }, [splitActiveMethod, amountTendered]);

    const handleRemoveSplitLine = useCallback((index: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSplitLines((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleConfirm = useCallback(() => {
      // Room charge — delegate to parent via onRoomCharge callback
      if (selectedMethod === "room_charge") {
        if (!roomChargeEnabled) {
          Alert.alert("Unavailable", "PMS connection is not active.");
          return;
        }
        if (onRoomCharge) {
          onRoomCharge();
        }
        return;
      }

      if (selectedMethod === "split") {
        if (splitTotal < totalDue) {
          Alert.alert("Insufficient", "Split payments must cover the total amount.");
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // For split, report as "split" method with the sum as amountTendered
        const cashLine = splitLines.find((l) => l.method === "cash");
        const cashChange = cashLine
          ? roundTo2(Math.max(0, splitTotal - totalDue))
          : 0;
        onConfirmPayment({
          method: "split",
          amountTendered: splitTotal,
          change: cashChange,
        });
        setSplitLines([]);
        setAmountString("");
        setSelectedMethod("cash");
        return;
      }

      const finalAmount =
        selectedMethod === "cash" ? amountTendered : totalDue;

      if (selectedMethod === "cash" && !isPaymentSufficient(totalDue, finalAmount)) {
        Alert.alert("Insufficient Amount", "The tendered amount is less than the total due.");
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      onConfirmPayment({
        method: selectedMethod,
        amountTendered: finalAmount,
        change: selectedMethod === "cash" ? calculateChange(totalDue, finalAmount) : 0,
      });

      // Reset state
      setAmountString("");
      setSelectedMethod("cash");
      setSplitLines([]);
    }, [selectedMethod, amountTendered, totalDue, onConfirmPayment, splitTotal, splitLines, roomChargeEnabled, onRoomCharge]);

    const handleModalClose = useCallback(() => {
      setAmountString("");
      setSelectedMethod("cash");
      setSplitLines([]);
      onClose();
    }, [onClose]);

    return (
      <Modal visible={visible} onClose={handleModalClose} title="Payment">
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Total due display */}
          <View style={styles.totalDueContainer}>
            <Text style={styles.totalDueLabel}>Amount Due</Text>
            <Text style={styles.totalDueAmount}>
              {formatCurrency(totalDue)}
            </Text>
          </View>

          {/* Payment method selector */}
          <View style={styles.methodSelector}>
            {PAYMENT_METHODS.map((option) => (
              <Pressable
                key={option.method}
                onPress={() => handleSelectMethod(option.method)}
                style={[
                  styles.methodButton,
                  selectedMethod === option.method && styles.methodButtonSelected,
                ]}
                accessibilityRole="radio"
                accessibilityState={{
                  selected: selectedMethod === option.method,
                }}
              >
                <Ionicons
                  name={option.icon}
                  size={24}
                  color={
                    selectedMethod === option.method ? "#3b82f6" : "#6b7280"
                  }
                />
                <Text
                  style={[
                    styles.methodLabel,
                    selectedMethod === option.method && styles.methodLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Cash payment section */}
          {selectedMethod === "cash" && (
            <>
              {/* Amount display */}
              <View style={styles.amountDisplay}>
                <Text style={styles.amountLabel}>Amount Tendered</Text>
                <Text style={styles.amountValue}>
                  {amountString ? formatCurrency(amountTendered) : "R 0.00"}
                </Text>
              </View>

              {/* Quick amount buttons */}
              <View style={styles.quickAmounts}>
                {quickAmounts.map((amount) => (
                  <Pressable
                    key={amount}
                    onPress={() => handleQuickAmount(amount)}
                    style={styles.quickAmountButton}
                  >
                    <Text style={styles.quickAmountText}>
                      {formatCurrency(amount)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Numpad */}
              <Numpad
                onDigit={handleDigit}
                onBackspace={handleBackspace}
                onClear={handleClear}
              />

              {/* Change display */}
              {amountTendered > 0 && (
                <View style={styles.changeContainer}>
                  <Text style={styles.changeLabel}>Change</Text>
                  <Text
                    style={[
                      styles.changeAmount,
                      !canConfirm && styles.changeAmountInsufficient,
                    ]}
                  >
                    {canConfirm
                      ? formatCurrency(change)
                      : `Short ${formatCurrency(totalDue - amountTendered)}`}
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Card/EFT confirmation */}
          {(selectedMethod === "card" || selectedMethod === "eft") && (
            <View style={styles.cardSection}>
              <Ionicons
                name={selectedMethod === "card" ? "card" : "swap-horizontal"}
                size={48}
                color="#3b82f6"
              />
              <Text style={styles.cardMessage}>
                {selectedMethod === "card"
                  ? "Present card to payment terminal"
                  : "Process EFT payment"}
              </Text>
              <Text style={styles.cardAmount}>
                {formatCurrency(totalDue)}
              </Text>
            </View>
          )}

          {/* Room charge section */}
          {selectedMethod === "room_charge" && (
            <View style={styles.cardSection}>
              <Ionicons name="bed" size={48} color="#8b5cf6" />
              {roomChargeEnabled ? (
                <>
                  <Text style={styles.cardMessage}>
                    Charge {formatCurrency(totalDue)} to guest room
                  </Text>
                  <Text style={styles.roomChargeHint}>
                    Tap "Process ROOM_CHARGE Payment" to search for a guest
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.cardMessage}>
                    Room charge unavailable
                  </Text>
                  <Text style={styles.roomChargeHint}>
                    PMS connection is not active. Check Settings → PMS.
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Split payment section */}
          {selectedMethod === "split" && (
            <View style={styles.splitSection}>
              {/* Split lines already added */}
              {splitLines.length > 0 && (
                <View style={styles.splitLinesContainer}>
                  {splitLines.map((line, index) => (
                    <View key={index} style={styles.splitLineRow}>
                      <Ionicons
                        name={
                          line.method === "cash"
                            ? "cash-outline"
                            : line.method === "card"
                            ? "card-outline"
                            : "swap-horizontal-outline"
                        }
                        size={18}
                        color="#9ca3af"
                      />
                      <Text style={styles.splitLineMethod}>
                        {line.method.toUpperCase()}
                      </Text>
                      <Text style={styles.splitLineAmount}>
                        {formatCurrency(line.amount)}
                      </Text>
                      <Pressable
                        onPress={() => handleRemoveSplitLine(index)}
                        hitSlop={8}
                        accessibilityLabel={`Remove ${line.method} payment`}
                      >
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {/* Remaining amount */}
              <View style={styles.splitRemainingContainer}>
                <Text style={styles.splitRemainingLabel}>Remaining</Text>
                <Text
                  style={[
                    styles.splitRemainingAmount,
                    splitRemaining <= 0 && styles.splitRemainingZero,
                  ]}
                >
                  {formatCurrency(splitRemaining)}
                </Text>
              </View>

              {/* Add new split line */}
              {splitRemaining > 0 && (
                <>
                  {/* Method selector for this split line */}
                  <View style={styles.splitMethodSelector}>
                    {(["cash", "card", "eft"] as const).map((method) => (
                      <Pressable
                        key={method}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSplitActiveMethod(method);
                        }}
                        style={[
                          styles.splitMethodChip,
                          splitActiveMethod === method && styles.splitMethodChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.splitMethodText,
                            splitActiveMethod === method && styles.splitMethodTextActive,
                          ]}
                        >
                          {method.toUpperCase()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Amount input */}
                  <View style={styles.amountDisplay}>
                    <Text style={styles.amountLabel}>
                      {splitActiveMethod.toUpperCase()} Amount
                    </Text>
                    <Text style={styles.amountValue}>
                      {amountString ? formatCurrency(amountTendered) : "R 0.00"}
                    </Text>
                  </View>

                  {/* Quick fill remaining */}
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setAmountString(splitRemaining.toFixed(2));
                    }}
                    style={styles.quickAmountButton}
                  >
                    <Text style={styles.quickAmountText}>
                      Fill remaining: {formatCurrency(splitRemaining)}
                    </Text>
                  </Pressable>

                  {/* Numpad */}
                  <Numpad
                    onDigit={handleDigit}
                    onBackspace={handleBackspace}
                    onClear={handleClear}
                  />

                  {/* Add button */}
                  <Button
                    label={`Add ${splitActiveMethod.toUpperCase()} Payment`}
                    onPress={handleAddSplitLine}
                    disabled={amountTendered <= 0}
                    size="lg"
                  />
                </>
              )}
            </View>
          )}

          {/* Confirm button */}
          <View style={styles.confirmContainer}>
            <Button
              label={
                selectedMethod === "room_charge"
                  ? roomChargeEnabled
                    ? "Search Guest & Charge Room"
                    : "PMS Not Connected"
                  : selectedMethod === "split"
                  ? splitTotal >= totalDue
                    ? `Confirm Split Payment — ${formatCurrency(totalDue)}`
                    : `Add more (${formatCurrency(splitRemaining)} remaining)`
                  : selectedMethod === "cash"
                  ? `Confirm Payment — ${formatCurrency(totalDue)}`
                  : `Process ${selectedMethod.toUpperCase()} Payment`
              }
              onPress={handleConfirm}
              size="lg"
              disabled={!canConfirm}
            />
          </View>
        </ScrollView>
      </Modal>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  totalDueContainer: {
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    marginBottom: 16,
  },
  totalDueLabel: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 4,
  },
  totalDueAmount: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "800",
  },
  methodSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  methodButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#374151",
    borderWidth: 2,
    borderColor: "transparent",
  },
  methodButtonSelected: {
    backgroundColor: "#1e3a5f",
    borderColor: "#3b82f6",
  },
  methodLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  methodLabelSelected: {
    color: "#3b82f6",
  },
  amountDisplay: {
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 12,
  },
  amountLabel: {
    color: "#9ca3af",
    fontSize: 13,
    marginBottom: 4,
  },
  amountValue: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
  },
  quickAmounts: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  quickAmountButton: {
    backgroundColor: "#374151",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  quickAmountText: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
  },
  numpad: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  numpadKey: {
    width: "30%",
    height: 56,
    backgroundColor: "#374151",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  numpadKeyPressed: {
    backgroundColor: "#4b5563",
  },
  numpadKeyText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "600",
  },
  changeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#1f2937",
    borderRadius: 10,
    marginBottom: 16,
  },
  changeLabel: {
    color: "#9ca3af",
    fontSize: 16,
  },
  changeAmount: {
    color: "#22c55e",
    fontSize: 22,
    fontWeight: "700",
  },
  changeAmountInsufficient: {
    color: "#ef4444",
  },
  cardSection: {
    alignItems: "center",
    paddingVertical: 40,
  },
  cardMessage: {
    color: "#9ca3af",
    fontSize: 16,
    marginTop: 16,
  },
  cardAmount: {
    color: "#3b82f6",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 8,
  },
  roomChargeHint: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  confirmContainer: {
    paddingTop: 8,
  },
  // Split payment styles
  splitSection: {
    marginBottom: 8,
  },
  splitLinesContainer: {
    marginBottom: 12,
    gap: 8,
  },
  splitLineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1f2937",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  splitLineMethod: {
    color: "#d1d5db",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  splitLineAmount: {
    color: "#22c55e",
    fontSize: 16,
    fontWeight: "700",
    marginRight: 8,
  },
  splitRemainingContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#374151",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    marginBottom: 16,
  },
  splitRemainingLabel: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
  },
  splitRemainingAmount: {
    color: "#f59e0b",
    fontSize: 20,
    fontWeight: "700",
  },
  splitRemainingZero: {
    color: "#22c55e",
  },
  splitMethodSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  splitMethodChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#374151",
    borderWidth: 2,
    borderColor: "transparent",
  },
  splitMethodChipActive: {
    backgroundColor: "#1e3a5f",
    borderColor: "#3b82f6",
  },
  splitMethodText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
  },
  splitMethodTextActive: {
    color: "#3b82f6",
  },
});

export default PaymentModal;
