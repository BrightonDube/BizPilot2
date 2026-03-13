/**
 * CollectionModal — modal for recording when a customer collects layby items.
 *
 * Shows the payment summary, items being collected, and lets staff add
 * notes before confirming the hand-over.
 *
 * Why block collection when there's an outstanding balance?
 * Allowing collection with unpaid balance defeats the purpose of a layby.
 * The warning + disabled confirm button enforces the business rule at
 * the UI level so mistakes don't happen during a busy shift.
 *
 * Why a separate modal instead of inline?
 * Collection is a distinct, confirmatory action (stock leaves the shop).
 * A modal forces focus and prevents accidental navigation mid-process.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { triggerHaptic } from "@/utils/haptics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LaybyCollectionItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CollectionModalProps {
  visible: boolean;
  onClose: () => void;
  laybyId: string;
  customerName: string;
  items: LaybyCollectionItem[];
  totalPaid: number;
  totalAmount: number;
  outstandingBalance: number;
  onConfirmCollection: (notes: string) => void;
  isProcessing?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function CollectionModalInner({
  visible,
  onClose,
  laybyId,
  customerName,
  items,
  totalPaid,
  totalAmount,
  outstandingBalance,
  onConfirmCollection,
  isProcessing = false,
}: CollectionModalProps) {
  const [notes, setNotes] = useState("");

  const hasBalance = useMemo(() => outstandingBalance > 0, [outstandingBalance]);

  const totalItemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );

  const handleConfirm = useCallback(() => {
    if (hasBalance || isProcessing) return;
    triggerHaptic("success");
    onConfirmCollection(notes.trim());
  }, [hasBalance, isProcessing, notes, onConfirmCollection]);

  const handleClose = useCallback(() => {
    triggerHaptic("tap");
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} testID="collection-modal">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="bag-check-outline" size={22} color="#22c55e" />
              <Text style={styles.headerTitle}>Collect Layby Items</Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={12}
              testID="collection-cancel"
            >
              <Ionicons name="close" size={28} color="#f3f4f6" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Customer info */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Customer</Text>
                <Text style={styles.infoValue} testID="collection-customer">
                  {customerName}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Layby Ref</Text>
                <Text style={styles.infoValueMono}>{laybyId}</Text>
              </View>
            </View>

            {/* Payment summary */}
            <View style={styles.paymentCard}>
              <Text style={styles.cardTitle}>Payment Summary</Text>

              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Total Amount</Text>
                <Text style={styles.paymentValue}>
                  {formatCurrency(totalAmount)}
                </Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Total Paid</Text>
                <Text
                  style={[styles.paymentValue, { color: "#22c55e" }]}
                  testID="collection-total-paid"
                >
                  {formatCurrency(totalPaid)}
                </Text>
              </View>
              <View style={[styles.paymentRow, styles.paymentDivider]}>
                <Text style={styles.paymentLabelBold}>Outstanding Balance</Text>
                <Text
                  style={[
                    styles.paymentValueBold,
                    { color: hasBalance ? "#ef4444" : "#22c55e" },
                  ]}
                  testID="collection-balance"
                >
                  {formatCurrency(outstandingBalance)}
                </Text>
              </View>
            </View>

            {/* Outstanding balance warning */}
            {hasBalance && (
              <View style={styles.warningBox} testID="collection-warning">
                <Ionicons name="alert-circle" size={18} color="#fbbf24" />
                <Text style={styles.warningText}>
                  Customer has an unpaid balance of{" "}
                  {formatCurrency(outstandingBalance)}. Collection cannot
                  proceed until the balance is settled.
                </Text>
              </View>
            )}

            {/* Items checklist */}
            <View style={styles.itemsCard}>
              <Text style={styles.cardTitle}>
                Items to Collect ({totalItemCount})
              </Text>
              {items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemCheck}>
                    <Ionicons
                      name="checkbox"
                      size={20}
                      color={hasBalance ? "#6b7280" : "#22c55e"}
                    />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemMeta}>
                      Qty: {item.quantity} · {formatCurrency(item.price)} each
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>
                    {formatCurrency(item.quantity * item.price)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Notes */}
            <Text style={styles.fieldLabel}>Collection Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Customer ID verified, bag number…"
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={3}
              testID="collection-notes"
            />

            {/* Fully paid confirmation badge */}
            {!hasBalance && (
              <View style={styles.paidBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#22c55e"
                />
                <Text style={styles.paidBadgeText}>
                  Fully paid — ready for collection
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              testID="collection-cancel"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                (hasBalance || isProcessing) && styles.confirmDisabled,
              ]}
              onPress={handleConfirm}
              disabled={hasBalance || isProcessing}
              testID="collection-confirm"
            >
              <Ionicons name="bag-check-outline" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>
                {isProcessing ? "Processing…" : "Confirm Collection"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const CollectionModal = React.memo(CollectionModalInner);
export default CollectionModal;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  keyboardView: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    width: "90%",
    maxWidth: 520,
    maxHeight: "90%",
    overflow: "hidden",
  },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#f3f4f6" },

  /* Body */
  body: { flex: 1 },
  bodyContent: { padding: 20, gap: 12 },

  /* Customer info */
  infoCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: { color: "#9ca3af", fontSize: 13 },
  infoValue: { color: "#f3f4f6", fontSize: 14, fontWeight: "600" },
  infoValueMono: {
    color: "#d1d5db",
    fontSize: 13,
    fontWeight: "500",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  /* Payment summary */
  paymentCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  cardTitle: { color: "#f3f4f6", fontSize: 15, fontWeight: "700", marginBottom: 2 },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentLabel: { color: "#9ca3af", fontSize: 13 },
  paymentValue: { color: "#f3f4f6", fontSize: 14, fontWeight: "600" },
  paymentDivider: {
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 8,
    marginTop: 4,
  },
  paymentLabelBold: { color: "#f3f4f6", fontSize: 14, fontWeight: "700" },
  paymentValueBold: { fontSize: 18, fontWeight: "700" },

  /* Warning */
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#78350f",
    borderRadius: 10,
    padding: 14,
  },
  warningText: { color: "#fde68a", fontSize: 13, flex: 1 },

  /* Items */
  itemsCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemCheck: { width: 24, alignItems: "center" },
  itemInfo: { flex: 1 },
  itemName: { color: "#f3f4f6", fontSize: 14, fontWeight: "600" },
  itemMeta: { color: "#9ca3af", fontSize: 12 },
  itemTotal: { color: "#f3f4f6", fontSize: 14, fontWeight: "600" },

  /* Fields */
  fieldLabel: { color: "#9ca3af", fontSize: 13, marginTop: 4 },
  textInput: {
    backgroundColor: "#111827",
    color: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#374151",
  },
  notesInput: { minHeight: 80, textAlignVertical: "top" },

  /* Paid badge */
  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#052e16",
    borderRadius: 10,
    padding: 14,
  },
  paidBadgeText: { color: "#86efac", fontSize: 13, fontWeight: "600" },

  /* Footer */
  footer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    backgroundColor: "#1e293b",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4b5563",
    minHeight: 48,
    justifyContent: "center",
  },
  cancelButtonText: { color: "#9ca3af", fontSize: 16, fontWeight: "600" },
  confirmButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#22c55e",
    minHeight: 48,
  },
  confirmDisabled: { backgroundColor: "#374151", opacity: 0.6 },
  confirmButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
