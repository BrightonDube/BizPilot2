/**
 * BizPilot Mobile POS — VoidOrderModal Component
 *
 * Handles the complete order void workflow:
 * 1. Select a void reason (required)
 * 2. Enter manager/supervisor PIN for authorization
 * 3. Confirm void action
 *
 * Why require a reason AND a PIN?
 * Order voids are high-risk actions (potential fraud, revenue loss).
 * The reason creates an audit trail; the PIN ensures only authorized
 * staff can void. This matches Square/Toast/Lightspeed patterns.
 *
 * Why a modal instead of a separate screen?
 * Void is a quick action initiated from the order detail view.
 * A modal keeps the context (you can see the order behind it)
 * and is dismissable if the operator changes their mind.
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Modal, Button } from "@/components/ui";
import { formatCurrency } from "@/utils/formatters";
import { PIN_LENGTH } from "@/utils/constants";
import type { MobileOrder } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Standard void reasons — keeps reporting consistent. */
const VOID_REASONS = [
  { id: "wrong_items", label: "Wrong items ordered", icon: "alert-circle-outline" as const },
  { id: "customer_changed_mind", label: "Customer changed mind", icon: "person-outline" as const },
  { id: "duplicate_order", label: "Duplicate order", icon: "copy-outline" as const },
  { id: "pricing_error", label: "Pricing error", icon: "pricetag-outline" as const },
  { id: "system_error", label: "System error", icon: "bug-outline" as const },
  { id: "other", label: "Other", icon: "ellipsis-horizontal-outline" as const },
] as const;

type VoidReasonId = (typeof VOID_REASONS)[number]["id"];

/** Step in the void workflow */
type VoidStep = "reason" | "pin" | "confirm" | "processing" | "done";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VoidOrderModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** The order being voided */
  order: MobileOrder | null;
  /** Called when void is confirmed with reason and authorized PIN */
  onConfirmVoid: (params: {
    orderId: string;
    reason: string;
    authorizedBy: string;
  }) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const VoidOrderModal: React.FC<VoidOrderModalProps> = React.memo(
  function VoidOrderModal({ visible, onClose, order, onConfirmVoid }) {
    const [step, setStep] = useState<VoidStep>("reason");
    const [selectedReason, setSelectedReason] = useState<VoidReasonId | null>(null);
    const [pinInput, setPinInput] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    // Reset state when modal opens/closes
    const handleClose = useCallback(() => {
      setStep("reason");
      setSelectedReason(null);
      setPinInput("");
      setIsProcessing(false);
      onClose();
    }, [onClose]);

    const handleSelectReason = useCallback((reasonId: VoidReasonId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedReason(reasonId);
    }, []);

    const handleProceedToPin = useCallback(() => {
      if (!selectedReason) {
        Alert.alert("Select Reason", "Please select a void reason.");
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStep("pin");
    }, [selectedReason]);

    const handlePinDigit = useCallback(
      (digit: string) => {
        if (pinInput.length >= PIN_LENGTH) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newPin = pinInput + digit;
        setPinInput(newPin);

        if (newPin.length === PIN_LENGTH) {
          // PIN complete — move to confirmation step
          setStep("confirm");
        }
      },
      [pinInput]
    );

    const handlePinBackspace = useCallback(() => {
      setPinInput((prev) => prev.slice(0, -1));
    }, []);

    const handleConfirmVoid = useCallback(async () => {
      if (!order || !selectedReason) return;

      setStep("processing");
      setIsProcessing(true);

      try {
        const reasonLabel = VOID_REASONS.find((r) => r.id === selectedReason)?.label ?? selectedReason;
        await onConfirmVoid({
          orderId: order.id,
          reason: reasonLabel,
          authorizedBy: `pin:${pinInput}`,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep("done");

        // Auto-close after success animation
        setTimeout(handleClose, 1500);
      } catch (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "Void Failed",
          error instanceof Error ? error.message : "Could not void order. Try again."
        );
        setStep("confirm");
      } finally {
        setIsProcessing(false);
      }
    }, [order, selectedReason, pinInput, onConfirmVoid, handleClose]);

    const reasonLabel = useMemo(
      () => VOID_REASONS.find((r) => r.id === selectedReason)?.label ?? "",
      [selectedReason]
    );

    if (!order) return null;

    return (
      <Modal visible={visible} onClose={handleClose} title="Void Order">
        {/* Order summary header */}
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
            <Text style={styles.orderDate}>
              {new Date(order.createdAt).toLocaleString("en-ZA")}
            </Text>
          </View>
          <View style={styles.orderTotalBadge}>
            <Text style={styles.orderTotalLabel}>Total</Text>
            <Text style={styles.orderTotalValue}>
              {formatCurrency(order.total)}
            </Text>
          </View>
        </View>

        {/* Step 1: Reason selection */}
        {step === "reason" && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Why is this order being voided?</Text>
            <ScrollView style={styles.reasonList}>
              {VOID_REASONS.map((reason) => (
                <Pressable
                  key={reason.id}
                  onPress={() => handleSelectReason(reason.id)}
                  style={[
                    styles.reasonRow,
                    selectedReason === reason.id && styles.reasonRowSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedReason === reason.id }}
                >
                  <Ionicons
                    name={reason.icon}
                    size={20}
                    color={selectedReason === reason.id ? "#3b82f6" : "#6b7280"}
                  />
                  <Text
                    style={[
                      styles.reasonText,
                      selectedReason === reason.id && styles.reasonTextSelected,
                    ]}
                  >
                    {reason.label}
                  </Text>
                  {selectedReason === reason.id && (
                    <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
            <Button
              label="Continue"
              onPress={handleProceedToPin}
              disabled={!selectedReason}
              size="lg"
            />
          </View>
        )}

        {/* Step 2: Manager PIN */}
        {step === "pin" && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Manager Authorization</Text>
            <Text style={styles.stepSubtitle}>
              Enter manager PIN to authorize this void
            </Text>

            {/* PIN dots */}
            <View style={styles.pinDots}>
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pinDot,
                    i < pinInput.length && styles.pinDotFilled,
                  ]}
                />
              ))}
            </View>

            {/* Numpad */}
            <View style={styles.numpad}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
                (key) => {
                  if (key === "") {
                    return <View key="empty" style={styles.numpadKey} />;
                  }
                  if (key === "⌫") {
                    return (
                      <Pressable
                        key="backspace"
                        onPress={handlePinBackspace}
                        style={({ pressed }) => [
                          styles.numpadKey,
                          pressed && styles.numpadKeyPressed,
                        ]}
                        accessibilityLabel="Backspace"
                      >
                        <Ionicons name="backspace-outline" size={24} color="#ffffff" />
                      </Pressable>
                    );
                  }
                  return (
                    <Pressable
                      key={key}
                      onPress={() => handlePinDigit(key)}
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

            <Pressable onPress={() => setStep("reason")} style={styles.backLink}>
              <Text style={styles.backLinkText}>← Back to reason</Text>
            </Pressable>
          </View>
        )}

        {/* Step 3: Confirm */}
        {step === "confirm" && (
          <View style={styles.stepContainer}>
            <View style={styles.confirmIcon}>
              <Ionicons name="warning" size={48} color="#f59e0b" />
            </View>
            <Text style={styles.confirmTitle}>Confirm Void</Text>
            <Text style={styles.confirmDetail}>
              Order #{order.orderNumber} · {formatCurrency(order.total)}
            </Text>
            <Text style={styles.confirmReason}>Reason: {reasonLabel}</Text>
            <Text style={styles.confirmWarning}>
              This action cannot be undone. The order total will be removed from today's sales.
            </Text>
            <View style={styles.confirmActions}>
              <Button
                label="Void This Order"
                onPress={handleConfirmVoid}
                variant="danger"
                size="lg"
              />
              <Button
                label="Cancel"
                onPress={handleClose}
                variant="secondary"
                size="sm"
              />
            </View>
          </View>
        )}

        {/* Step 4: Processing */}
        {step === "processing" && (
          <View style={styles.centeredContainer}>
            <ActivityIndicator size="large" color="#ef4444" />
            <Text style={styles.processingText}>Voiding order...</Text>
          </View>
        )}

        {/* Step 5: Done */}
        {step === "done" && (
          <View style={styles.centeredContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
            <Text style={styles.doneText}>Order Voided</Text>
            <Text style={styles.doneSubtext}>
              #{order.orderNumber} has been voided successfully
            </Text>
          </View>
        )}
      </Modal>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  orderNumber: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  orderDate: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  orderTotalBadge: {
    alignItems: "flex-end",
  },
  orderTotalLabel: {
    color: "#6b7280",
    fontSize: 11,
    textTransform: "uppercase",
  },
  orderTotalValue: {
    color: "#ef4444",
    fontSize: 20,
    fontWeight: "700",
  },
  stepContainer: {
    gap: 12,
  },
  stepTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  stepSubtitle: {
    color: "#9ca3af",
    fontSize: 14,
  },
  reasonList: {
    maxHeight: 280,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
    marginBottom: 8,
  },
  reasonRowSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#1e3a5f",
  },
  reasonText: {
    flex: 1,
    color: "#d1d5db",
    fontSize: 15,
  },
  reasonTextSelected: {
    color: "#ffffff",
    fontWeight: "600",
  },
  pinDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginVertical: 16,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#4b5563",
  },
  pinDotFilled: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  numpad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  numpadKey: {
    width: 72,
    height: 56,
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
    fontSize: 22,
    fontWeight: "600",
  },
  backLink: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  backLinkText: {
    color: "#6b7280",
    fontSize: 14,
  },
  confirmIcon: {
    alignSelf: "center",
    marginBottom: 4,
  },
  confirmTitle: {
    color: "#f59e0b",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  confirmDetail: {
    color: "#ffffff",
    fontSize: 16,
    textAlign: "center",
  },
  confirmReason: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
  },
  confirmWarning: {
    color: "#ef4444",
    fontSize: 13,
    textAlign: "center",
    fontStyle: "italic",
    paddingHorizontal: 16,
  },
  confirmActions: {
    gap: 8,
    marginTop: 8,
  },
  centeredContainer: {
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  processingText: {
    color: "#ef4444",
    fontSize: 16,
  },
  doneText: {
    color: "#22c55e",
    fontSize: 22,
    fontWeight: "700",
  },
  doneSubtext: {
    color: "#9ca3af",
    fontSize: 14,
  },
});

export default VoidOrderModal;
