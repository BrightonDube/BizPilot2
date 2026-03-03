/**
 * BizPilot Mobile POS — RoomChargeModal Component
 *
 * Modal for posting a charge to a guest's room folio.
 * Shows the guest info, charge amount, and authorization step.
 *
 * Why require explicit authorization?
 * Hotels need proof of guest consent for room charges.
 * Without it, chargebacks and billing disputes increase.
 * The authorization step captures a PIN or signature.
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Modal, Button } from "@/components/ui";
import { formatCurrency } from "@/utils/formatters";
import { useRoomCharge } from "@/hooks/useRoomCharge";
import type { PMSGuest } from "@/types/pms";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RoomChargeModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Guest to charge */
  guest: PMSGuest | null;
  /** Amount to charge */
  amount: number;
  /** Charge description */
  description: string;
  /** Related POS order ID */
  orderId: string | null;
  /** Called when charge is successfully posted or queued */
  onChargeComplete: (result: { queued: boolean }) => void;
}

// ---------------------------------------------------------------------------
// Authorization step type
// ---------------------------------------------------------------------------

type AuthStep = "review" | "authorize" | "processing" | "complete";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const RoomChargeModal: React.FC<RoomChargeModalProps> = React.memo(
  function RoomChargeModal({
    visible,
    onClose,
    guest,
    amount,
    description,
    orderId,
    onChargeComplete,
  }) {
    const [step, setStep] = useState<AuthStep>("review");
    const [pinInput, setPinInput] = useState("");
    const { postCharge, loading } = useRoomCharge();

    // Reset state when modal opens/closes
    const handleClose = useCallback(() => {
      setStep("review");
      setPinInput("");
      onClose();
    }, [onClose]);

    // Check if amount exceeds limit
    const exceedsLimit = useMemo(() => {
      if (!guest) return false;
      return (
        guest.transactionChargeLimit !== null &&
        amount > guest.transactionChargeLimit
      );
    }, [guest, amount]);

    const handleProceedToAuth = useCallback(() => {
      if (exceedsLimit) {
        Alert.alert(
          "Limit Exceeded",
          `This charge exceeds the per-transaction limit of ${formatCurrency(guest!.transactionChargeLimit!)}.`,
          [{ text: "OK" }]
        );
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStep("authorize");
    }, [exceedsLimit, guest]);

    const handlePinDigit = useCallback(
      (digit: string) => {
        if (pinInput.length >= 4) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newPin = pinInput + digit;
        setPinInput(newPin);

        // Auto-submit when 4 digits entered
        if (newPin.length === 4) {
          handleSubmitCharge("pin");
        }
      },
      [pinInput]
    );

    const handlePinBackspace = useCallback(() => {
      setPinInput((prev) => prev.slice(0, -1));
    }, []);

    const handleSubmitCharge = useCallback(
      async (authType: "pin" | "bypass") => {
        if (!guest) return;

        setStep("processing");

        const result = await postCharge({
          guest,
          amount,
          description,
          orderId,
          authorizationType: authType,
        });

        if (result.success || result.queued) {
          setStep("complete");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          // Auto-close after showing success
          setTimeout(() => {
            onChargeComplete({ queued: result.queued });
            handleClose();
          }, 1500);
        } else {
          Alert.alert("Charge Failed", result.error ?? "Unknown error");
          setStep("review");
          setPinInput("");
        }
      },
      [guest, amount, description, orderId, postCharge, onChargeComplete, handleClose]
    );

    if (!guest) return null;

    return (
      <Modal visible={visible} onClose={handleClose} title="Room Charge">
        {/* Guest info header */}
        <View style={styles.guestHeader}>
          <View style={styles.guestHeaderLeft}>
            <Ionicons name="bed-outline" size={24} color="#3b82f6" />
            <View>
              <Text style={styles.guestName}>{guest.name}</Text>
              <Text style={styles.guestRoom}>Room {guest.roomNumber}</Text>
            </View>
          </View>
          <View style={styles.chargeAmount}>
            <Text style={styles.chargeAmountLabel}>Charge</Text>
            <Text style={styles.chargeAmountValue}>
              {formatCurrency(amount)}
            </Text>
          </View>
        </View>

        {/* Step: Review */}
        {step === "review" && (
          <View style={styles.stepContainer}>
            <Text style={styles.descriptionLabel}>Description</Text>
            <Text style={styles.descriptionText}>{description}</Text>

            {guest.transactionChargeLimit !== null && (
              <View style={styles.limitInfo}>
                <Ionicons name="information-circle-outline" size={16} color="#6b7280" />
                <Text style={styles.limitText}>
                  Per-transaction limit: {formatCurrency(guest.transactionChargeLimit)}
                </Text>
              </View>
            )}

            <View style={styles.actionButtons}>
              <Button
                label="Proceed to Authorization"
                onPress={handleProceedToAuth}
                size="lg"
                disabled={exceedsLimit}
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

        {/* Step: Authorize (PIN entry) */}
        {step === "authorize" && (
          <View style={styles.stepContainer}>
            <Text style={styles.authTitle}>Guest Authorization</Text>
            <Text style={styles.authSubtitle}>
              Ask the guest to enter their PIN
            </Text>

            {/* PIN dots */}
            <View style={styles.pinDots}>
              {[0, 1, 2, 3].map((i) => (
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
                  if (key === "") return <View key="empty" style={styles.numpadKey} />;
                  if (key === "⌫") {
                    return (
                      <Pressable
                        key="backspace"
                        onPress={handlePinBackspace}
                        style={({ pressed }) => [
                          styles.numpadKey,
                          pressed && styles.numpadKeyPressed,
                        ]}
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

            <Pressable
              onPress={() => handleSubmitCharge("bypass")}
              style={styles.bypassLink}
            >
              <Text style={styles.bypassText}>Bypass authorization (manager)</Text>
            </Pressable>
          </View>
        )}

        {/* Step: Processing */}
        {step === "processing" && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.processingText}>Posting charge to PMS...</Text>
          </View>
        )}

        {/* Step: Complete */}
        {step === "complete" && (
          <View style={styles.completeContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
            <Text style={styles.completeText}>Charge Posted</Text>
            <Text style={styles.completeSubtext}>
              {formatCurrency(amount)} charged to Room {guest.roomNumber}
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
  guestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  guestHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  guestName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  guestRoom: {
    color: "#9ca3af",
    fontSize: 13,
  },
  chargeAmount: {
    alignItems: "flex-end",
  },
  chargeAmountLabel: {
    color: "#6b7280",
    fontSize: 11,
    textTransform: "uppercase",
  },
  chargeAmountValue: {
    color: "#3b82f6",
    fontSize: 20,
    fontWeight: "700",
  },
  stepContainer: {
    gap: 12,
  },
  descriptionLabel: {
    color: "#9ca3af",
    fontSize: 12,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  descriptionText: {
    color: "#ffffff",
    fontSize: 15,
  },
  limitInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    backgroundColor: "#1f2937",
    borderRadius: 6,
  },
  limitText: {
    color: "#6b7280",
    fontSize: 13,
  },
  actionButtons: {
    gap: 8,
    marginTop: 8,
  },
  authTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  authSubtitle: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
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
  bypassLink: {
    alignSelf: "center",
    paddingVertical: 8,
    marginTop: 8,
  },
  bypassText: {
    color: "#6b7280",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  processingContainer: {
    alignItems: "center",
    padding: 40,
    gap: 16,
  },
  processingText: {
    color: "#9ca3af",
    fontSize: 16,
  },
  completeContainer: {
    alignItems: "center",
    padding: 32,
    gap: 8,
  },
  completeText: {
    color: "#22c55e",
    fontSize: 22,
    fontWeight: "700",
  },
  completeSubtext: {
    color: "#9ca3af",
    fontSize: 14,
  },
});

export default RoomChargeModal;
