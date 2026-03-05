/**
 * PaymentEntryForm — form for recording a payment against a customer account.
 * (customer-accounts task 14.2)
 *
 * Shows current balance, allows entering payment amount and method,
 * validates, and shows the resulting new balance preview.
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
  PaymentRequest,
  validatePayment,
} from "@/services/accounts/CustomerAccountService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PaymentEntryFormProps {
  account: CustomerAccount;
  onSubmit: (request: PaymentRequest) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Payment method options
// ---------------------------------------------------------------------------

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: "cash-outline" },
  { value: "card", label: "Card", icon: "card-outline" },
  { value: "eft", label: "EFT", icon: "swap-horizontal" },
  { value: "cheque", label: "Cheque", icon: "document-outline" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PaymentEntryFormInner({
  account,
  onSubmit,
  onCancel,
}: PaymentEntryFormProps) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reference, setReference] = useState("");

  const parsedAmount = useMemo(() => {
    const n = parseFloat(amount);
    return isNaN(n) ? 0 : n;
  }, [amount]);

  const paymentRequest: PaymentRequest = useMemo(
    () => ({
      accountId: account.id,
      amount: parsedAmount,
      paymentMethod,
      reference: reference || undefined,
    }),
    [account.id, parsedAmount, paymentMethod, reference]
  );

  const validationErrors = useMemo(
    () => validatePayment(account, paymentRequest),
    [account, paymentRequest]
  );

  const isValid = validationErrors.length === 0 && parsedAmount > 0;

  const newBalance = useMemo(
    () => Math.max(0, account.currentBalance - parsedAmount),
    [account.currentBalance, parsedAmount]
  );

  const handleSubmit = useCallback(() => {
    if (!isValid) {
      Alert.alert("Validation Error", validationErrors.join("\n"));
      return;
    }
    onSubmit(paymentRequest);
  }, [isValid, validationErrors, paymentRequest, onSubmit]);

  return (
    <View style={styles.container} testID="payment-entry-form">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Record Payment</Text>
        <TouchableOpacity onPress={onCancel} testID="payment-cancel">
          <Ionicons name="close" size={28} color="#f3f4f6" />
        </TouchableOpacity>
      </View>

      {/* Account info */}
      <View style={styles.accountRow}>
        <Text style={styles.accountName}>{account.customerName}</Text>
        <View>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>
            {formatCurrency(account.currentBalance)}
          </Text>
        </View>
      </View>

      {/* Amount input */}
      <View style={styles.section}>
        <Text style={styles.fieldLabel}>Payment Amount</Text>
        <TextInput
          style={styles.amountInput}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor="#6b7280"
          testID="payment-amount-input"
        />
        {/* Quick amount buttons */}
        <View style={styles.quickAmounts}>
          {[
            { label: "Full", value: account.currentBalance },
            { label: "50%", value: account.currentBalance / 2 },
          ].map((btn) => (
            <TouchableOpacity
              key={btn.label}
              style={styles.quickButton}
              onPress={() => setAmount(btn.value.toFixed(2))}
              testID={`quick-${btn.label.toLowerCase()}`}
            >
              <Text style={styles.quickButtonText}>
                {btn.label} ({formatCurrency(btn.value)})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Payment method */}
      <View style={styles.section}>
        <Text style={styles.fieldLabel}>Payment Method</Text>
        <View style={styles.methodRow}>
          {PAYMENT_METHODS.map((m) => (
            <TouchableOpacity
              key={m.value}
              style={[
                styles.methodButton,
                paymentMethod === m.value && styles.methodActive,
              ]}
              onPress={() => setPaymentMethod(m.value)}
              testID={`method-${m.value}`}
            >
              <Ionicons
                name={m.icon as keyof typeof Ionicons.glyphMap}
                size={18}
                color={paymentMethod === m.value ? "#3b82f6" : "#6b7280"}
              />
              <Text
                style={[
                  styles.methodText,
                  paymentMethod === m.value && styles.methodTextActive,
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Reference */}
      <View style={styles.section}>
        <Text style={styles.fieldLabel}>Reference (optional)</Text>
        <TextInput
          style={styles.referenceInput}
          value={reference}
          onChangeText={setReference}
          placeholder="e.g. receipt number"
          placeholderTextColor="#6b7280"
          testID="payment-reference"
        />
      </View>

      {/* New balance preview */}
      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>New Balance After Payment</Text>
        <Text style={styles.previewValue}>{formatCurrency(newBalance)}</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          testID="payment-footer-cancel"
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, !isValid && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!isValid}
          testID="payment-submit"
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.submitButtonText}>Record Payment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const PaymentEntryForm = React.memo(PaymentEntryFormInner);

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
  accountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    margin: 16,
    backgroundColor: "#1f2937",
    borderRadius: 12,
  },
  accountName: { color: "#f3f4f6", fontSize: 18, fontWeight: "600" },
  balanceLabel: { fontSize: 12, color: "#9ca3af" },
  balanceValue: { fontSize: 20, fontWeight: "700", color: "#f3f4f6" },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: "#9ca3af", marginBottom: 8 },
  amountInput: {
    backgroundColor: "#111827",
    color: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  quickAmounts: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 8,
  },
  quickButtonText: { color: "#3b82f6", fontSize: 13, fontWeight: "600" },
  methodRow: { flexDirection: "row", gap: 8 },
  methodButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
  },
  methodActive: { borderColor: "#3b82f6", backgroundColor: "#1e3a5f" },
  methodText: { color: "#6b7280", fontSize: 13, fontWeight: "500" },
  methodTextActive: { color: "#3b82f6" },
  referenceInput: {
    backgroundColor: "#111827",
    color: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  previewCard: {
    alignItems: "center",
    padding: 20,
    margin: 16,
    backgroundColor: "#14532d",
    borderRadius: 12,
  },
  previewLabel: { fontSize: 13, color: "#86efac", marginBottom: 4 },
  previewValue: { fontSize: 24, fontWeight: "700", color: "#22c55e" },
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
  submitButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#22c55e",
  },
  submitDisabled: { backgroundColor: "#374151", opacity: 0.6 },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
