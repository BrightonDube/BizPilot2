/**
 * BizPilot Mobile POS — RoomChargeModal Component
 *
 * Confirmation modal for posting a POS order to a hotel guest's room folio.
 * Shows guest info, order summary, PMS connection status, and handles
 * authorization requirements (signature / PIN) based on charge amount.
 *
 * Why separate from GuestSearchModal?
 * Single-responsibility: GuestSearchModal picks the guest, this modal
 * confirms and posts the charge. Keeps each component focused and testable.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";
import type {
  GuestProfile,
  PMSConnectionStatus,
  RoomChargeRequest,
} from "@/services/pms/PMSService";
import {
  calculateGuestAvailableCredit,
  formatChargeDescription,
  getConnectionStatusColor,
  requiresAuthorization,
} from "@/services/pms/PMSService";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Amount above which guest authorization is required. */
const AUTH_THRESHOLD = 500;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RoomChargeModalProps {
  visible: boolean;
  guest: GuestProfile;
  orderTotal: number;
  orderItems: Array<{ name: string; quantity: number; price: number }>;
  connectionStatus: PMSConnectionStatus;
  onConfirmCharge: (request: RoomChargeRequest) => void;
  onClose: () => void;
  isPosting?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function connectionLabel(status: PMSConnectionStatus): string {
  switch (status) {
    case "connected":
      return "PMS Connected";
    case "disconnected":
      return "PMS Offline";
    case "error":
      return "PMS Error";
    case "syncing":
      return "Syncing…";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const RoomChargeModal: React.FC<RoomChargeModalProps> = React.memo(
  function RoomChargeModal({
    visible,
    guest,
    orderTotal,
    orderItems,
    connectionStatus,
    onConfirmCharge,
    onClose,
    isPosting = false,
  }) {
    const [pin, setPin] = useState("");

    const authType = useMemo(
      () => requiresAuthorization(orderTotal, AUTH_THRESHOLD),
      [orderTotal]
    );

    const availableCredit = useMemo(
      () => calculateGuestAvailableCredit(guest),
      [guest]
    );

    const isOffline = connectionStatus === "disconnected";
    const exceedsCredit = orderTotal > availableCredit;

    // -- Handlers -------------------------------------------------------------

    const handleConfirm = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const request: RoomChargeRequest = {
        orderId: `pos-${Date.now()}`,
        roomNumber: guest.roomNumber,
        guestId: guest.id,
        amount: orderTotal,
        description: formatChargeDescription(orderItems),
        items: orderItems,
        authorizationType: authType,
      };

      onConfirmCharge(request);
    }, [guest, orderTotal, orderItems, authType, onConfirmCharge]);

    const handleClose = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPin("");
      onClose();
    }, [onClose]);

    // -- Render ---------------------------------------------------------------

    return (
      <Modal
        testID="room-charge-modal"
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleClose}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Room Charge</Text>
            <Pressable
              testID="room-charge-cancel-btn"
              onPress={handleClose}
              hitSlop={12}
            >
              <Ionicons name="close" size={28} color="#f3f4f6" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Guest info */}
            <View testID="room-charge-guest-info" style={styles.section}>
              <View style={styles.guestRow}>
                <View style={styles.roomBadge}>
                  <Ionicons name="bed-outline" size={18} color="#93c5fd" />
                  <Text style={styles.roomNumber}>{guest.roomNumber}</Text>
                </View>

                <Text style={styles.guestName} numberOfLines={1}>
                  {guest.guestName}
                </Text>

                {guest.vipStatus && (
                  <View style={styles.vipBadge}>
                    <Ionicons name="star" size={12} color="#fbbf24" />
                    <Text style={styles.vipText}>VIP</Text>
                  </View>
                )}
              </View>

              <Text style={styles.creditText}>
                Available credit:{" "}
                <Text
                  style={[
                    styles.creditAmount,
                    exceedsCredit && styles.creditExceeded,
                  ]}
                >
                  {formatCurrency(availableCredit)}
                </Text>
              </Text>
            </View>

            {/* Connection status */}
            <View testID="room-charge-connection" style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: getConnectionStatusColor(connectionStatus),
                  },
                ]}
              />
              <Text style={styles.statusLabel}>
                {connectionLabel(connectionStatus)}
              </Text>
            </View>

            {/* Order summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Summary</Text>

              {orderItems.map((item, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.quantity}× {item.name}
                  </Text>
                  <Text style={styles.itemPrice}>
                    {formatCurrency(item.quantity * item.price)}
                  </Text>
                </View>
              ))}

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text testID="room-charge-total" style={styles.totalAmount}>
                  {formatCurrency(orderTotal)}
                </Text>
              </View>
            </View>

            {/* Authorization section */}
            {authType !== "none" && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {authType === "signature"
                    ? "Guest Signature"
                    : "Guest PIN Verification"}
                </Text>

                {authType === "signature" ? (
                  <View style={styles.signaturePlaceholder}>
                    <Ionicons
                      name="pencil-outline"
                      size={24}
                      color="#6b7280"
                    />
                    <Text style={styles.signatureText}>Signature capture</Text>
                  </View>
                ) : (
                  <TextInput
                    style={styles.pinInput}
                    placeholder="Enter guest PIN"
                    placeholderTextColor="#6b7280"
                    value={pin}
                    onChangeText={setPin}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                  />
                )}
              </View>
            )}

            {/* Offline warning */}
            {isOffline && (
              <View
                testID="room-charge-offline-warning"
                style={styles.offlineWarning}
              >
                <Ionicons name="cloud-offline-outline" size={20} color="#f59e0b" />
                <Text style={styles.offlineText}>
                  Charge will be queued and posted when connection is restored
                </Text>
              </View>
            )}

            {/* Exceeds credit warning */}
            {exceedsCredit && (
              <View style={styles.offlineWarning}>
                <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
                <Text style={[styles.offlineText, { color: "#ef4444" }]}>
                  Order total exceeds available credit
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.footer}>
            {isPosting ? (
              <View testID="room-charge-posting" style={styles.postingRow}>
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text style={styles.postingText}>Posting to room…</Text>
              </View>
            ) : (
              <View style={styles.buttonRow}>
                <Pressable
                  testID="room-charge-confirm-btn"
                  style={({ pressed }) => [
                    styles.confirmButton,
                    pressed && styles.confirmButtonPressed,
                    exceedsCredit && styles.buttonDisabled,
                  ]}
                  onPress={handleConfirm}
                  disabled={exceedsCredit || isPosting}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                  <Text style={styles.confirmText}>
                    {isOffline ? "Queue Charge" : "Post to Room"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  }
);

export default RoomChargeModal;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    color: "#f3f4f6",
    fontSize: 20,
    fontWeight: "700",
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Sections
  section: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4b5563",
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  // Guest info
  guestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  roomBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e3a5f",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  roomNumber: {
    color: "#93c5fd",
    fontSize: 20,
    fontWeight: "800",
  },
  guestName: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 17,
    fontWeight: "600",
  },
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#422006",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  vipText: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "700",
  },
  creditText: {
    color: "#9ca3af",
    fontSize: 14,
  },
  creditAmount: {
    color: "#22c55e",
    fontWeight: "700",
  },
  creditExceeded: {
    color: "#ef4444",
  },

  // Connection status
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "600",
  },

  // Order items
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  itemName: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 15,
  },
  itemPrice: {
    color: "#f3f4f6",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#4b5563",
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    color: "#f3f4f6",
    fontSize: 17,
    fontWeight: "700",
  },
  totalAmount: {
    color: "#3b82f6",
    fontSize: 20,
    fontWeight: "800",
  },

  // Authorization — signature
  signaturePlaceholder: {
    height: 120,
    backgroundColor: "#374151",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4b5563",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  signatureText: {
    color: "#6b7280",
    fontSize: 14,
  },

  // Authorization — PIN
  pinInput: {
    backgroundColor: "#374151",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4b5563",
    color: "#f3f4f6",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 14,
    letterSpacing: 8,
  },

  // Offline warning
  offlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#422006",
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  offlineText: {
    flex: 1,
    color: "#f59e0b",
    fontSize: 13,
    fontWeight: "600",
  },

  // Footer
  footer: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  confirmButtonPressed: {
    backgroundColor: "#2563eb",
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  confirmText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  postingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  postingText: {
    color: "#3b82f6",
    fontSize: 15,
    fontWeight: "600",
  },
});
