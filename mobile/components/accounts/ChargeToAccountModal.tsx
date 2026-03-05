/**
 * ChargeToAccountModal — modal for charging an order to a customer account.
 * (customer-accounts task 14.1)
 *
 * Shows account summary, validates credit limit, allows adding a charge.
 *
 * Why a modal?
 * The charge-to-account action happens mid-checkout. A modal overlay
 * lets the cashier confirm the charge without losing context of the
 * current order screen.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import {
  CustomerAccount,
  ChargeRequest,
  calculateBalanceSummary,
  validateCharge,
  PAYMENT_TERMS_LABELS,
} from "@/services/accounts/CustomerAccountService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChargeToAccountModalProps {
  account: CustomerAccount;
  orderId: string;
  orderTotal: number;
  onConfirm: (request: ChargeRequest) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ChargeToAccountModalInner({
  account,
  orderId,
  orderTotal,
  onConfirm,
  onCancel,
}: ChargeToAccountModalProps) {
  const [description, setDescription] = useState(`Order #${orderId}`);

  const now = useMemo(() => new Date().toISOString(), []);
  const summary = useMemo(
    () => calculateBalanceSummary(account, now),
    [account, now]
  );

  const chargeRequest: ChargeRequest = useMemo(
    () => ({
      accountId: account.id,
      orderId,
      amount: orderTotal,
      description,
    }),
    [account.id, orderId, orderTotal, description]
  );

  const validationErrors = useMemo(
    () => validateCharge(account, chargeRequest),
    [account, chargeRequest]
  );

  const isValid = validationErrors.length === 0;

  const handleConfirm = useCallback(() => {
    if (!isValid) {
      Alert.alert("Cannot Charge", validationErrors.join("\n"));
      return;
    }
    onConfirm(chargeRequest);
  }, [isValid, validationErrors, chargeRequest, onConfirm]);

  return (
    <View style={styles.container} testID="charge-to-account-modal">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Charge to Account</Text>
        <TouchableOpacity onPress={onCancel} testID="charge-cancel">
          <Ionicons name="close" size={28} color="#f3f4f6" />
        </TouchableOpacity>
      </View>

      {/* Account info */}
      <View style={styles.accountInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {account.customerName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.accountName}>{account.customerName}</Text>
          <Text style={styles.accountTerms}>
            {PAYMENT_TERMS_LABELS[account.paymentTerms]}
          </Text>
        </View>
      </View>

      {/* Balance summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Current Balance</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(summary.currentBalance)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Available Credit</Text>
          <Text
            style={[
              styles.summaryValue,
              summary.availableCredit < orderTotal && styles.valueWarning,
            ]}
          >
            {formatCurrency(summary.availableCredit)}
          </Text>
        </View>
      </View>

      {/* Charge amount */}
      <View style={styles.chargeSection}>
        <Text style={styles.chargeLabel}>Charge Amount</Text>
        <Text style={styles.chargeAmount}>{formatCurrency(orderTotal)}</Text>
      </View>

      {/* New balance preview */}
      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>New Balance</Text>
        <Text
          style={[
            styles.previewValue,
            account.currentBalance + orderTotal > account.creditLimit &&
              styles.valueWarning,
          ]}
        >
          {formatCurrency(account.currentBalance + orderTotal)}
        </Text>
      </View>

      {/* Description */}
      <View style={styles.descriptionRow}>
        <Text style={styles.descriptionLabel}>Description</Text>
        <TextInput
          style={styles.descriptionInput}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Order #123"
          placeholderTextColor="#6b7280"
          testID="charge-description"
        />
      </View>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <View style={styles.errorBox} testID="charge-errors">
          {validationErrors.map((err, i) => (
            <Text key={i} style={styles.errorText}>
              • {err}
            </Text>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          testID="footer-cancel"
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmButton, !isValid && styles.confirmDisabled]}
          onPress={handleConfirm}
          disabled={!isValid}
          testID="charge-confirm"
        >
          <Ionicons name="card-outline" size={20} color="#fff" />
          <Text style={styles.confirmButtonText}>Charge Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const ChargeToAccountModal = React.memo(ChargeToAccountModalInner);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
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
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#f3f4f6" },
  accountInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    backgroundColor: "#1f2937",
    margin: 16,
    borderRadius: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#f3f4f6", fontSize: 20, fontWeight: "700" },
  accountName: { color: "#f3f4f6", fontSize: 18, fontWeight: "600" },
  accountTerms: { color: "#9ca3af", fontSize: 13 },
  summaryRow: { flexDirection: "row", paddingHorizontal: 16, gap: 12 },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  summaryLabel: { fontSize: 12, color: "#9ca3af", marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#f3f4f6" },
  valueWarning: { color: "#ef4444" },
  chargeSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  chargeLabel: { fontSize: 14, color: "#9ca3af", marginBottom: 8 },
  chargeAmount: { fontSize: 32, fontWeight: "700", color: "#f3f4f6" },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  previewLabel: { fontSize: 14, color: "#9ca3af" },
  previewValue: { fontSize: 16, fontWeight: "600", color: "#f3f4f6" },
  descriptionRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  descriptionLabel: { fontSize: 13, color: "#9ca3af", marginBottom: 6 },
  descriptionInput: {
    backgroundColor: "#111827",
    color: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  errorBox: {
    margin: 16,
    padding: 12,
    backgroundColor: "#7f1d1d",
    borderRadius: 10,
  },
  errorText: { color: "#fca5a5", fontSize: 13, marginBottom: 2 },
  footer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    backgroundColor: "#1e293b",
    marginTop: "auto",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4b5563",
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
    backgroundColor: "#3b82f6",
  },
  confirmDisabled: { backgroundColor: "#374151", opacity: 0.6 },
  confirmButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
