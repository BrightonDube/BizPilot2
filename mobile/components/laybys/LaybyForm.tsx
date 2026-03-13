/**
 * LaybyForm — form for creating a new layby (lay-away) arrangement.
 *
 * Captures customer details, shows the item summary, and lets staff
 * configure a deposit percentage + instalment plan before submission.
 *
 * Why deposit as a percentage rather than a fixed amount?
 * Businesses set policy in terms of percentages (e.g. "minimum 20% deposit").
 * Displaying the percentage keeps the form aligned with business rules
 * while the calculated rand amount gives the cashier immediate clarity.
 *
 * Why show a payment schedule preview?
 * Customers often ask "how much per month?" before committing.
 * Showing the breakdown avoids back-and-forth and speeds up the sale.
 */

import React, { useMemo, useCallback } from "react";
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

interface LaybyItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LaybyFormProps {
  customerName: string;
  onCustomerNameChange: (name: string) => void;
  customerPhone: string;
  onCustomerPhoneChange: (phone: string) => void;
  customerEmail: string;
  onCustomerEmailChange: (email: string) => void;
  items: LaybyItem[];
  totalAmount: number;
  depositPercentage: number;
  onDepositPercentageChange: (pct: number) => void;
  instalmentCount: number;
  onInstalmentCountChange: (count: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  errors?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard instalment options offered to customers. */
const INSTALMENT_OPTIONS = [3, 6, 9, 12] as const;

/**
 * Quick deposit percentage presets.
 * Why these values? 10/20/30/50 cover the most common business policies
 * and give staff a one-tap shortcut instead of typing.
 */
const DEPOSIT_PRESETS = [10, 20, 30, 50] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function LaybyFormInner({
  customerName,
  onCustomerNameChange,
  customerPhone,
  onCustomerPhoneChange,
  customerEmail,
  onCustomerEmailChange,
  items,
  totalAmount,
  depositPercentage,
  onDepositPercentageChange,
  instalmentCount,
  onInstalmentCountChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
  errors = {},
}: LaybyFormProps) {
  // -- Derived values -------------------------------------------------------

  const depositAmount = useMemo(
    () => Math.round((totalAmount * depositPercentage) / 100 * 100) / 100,
    [totalAmount, depositPercentage],
  );

  const balanceAfterDeposit = useMemo(
    () => Math.max(totalAmount - depositAmount, 0),
    [totalAmount, depositAmount],
  );

  const monthlyInstalment = useMemo(
    () =>
      instalmentCount > 0
        ? Math.round((balanceAfterDeposit / instalmentCount) * 100) / 100
        : 0,
    [balanceAfterDeposit, instalmentCount],
  );

  /**
   * Build the payment schedule preview so the customer can see exactly
   * what they owe each month. The last instalment absorbs any rounding.
   */
  const schedulePreview = useMemo(() => {
    if (instalmentCount <= 0) return [];
    const entries: Array<{ month: number; amount: number }> = [];
    let remaining = balanceAfterDeposit;
    for (let i = 1; i <= instalmentCount; i++) {
      const isLast = i === instalmentCount;
      const amt = isLast ? remaining : monthlyInstalment;
      entries.push({ month: i, amount: Math.round(amt * 100) / 100 });
      remaining -= amt;
    }
    return entries;
  }, [instalmentCount, balanceAfterDeposit, monthlyInstalment]);

  // -- Handlers -------------------------------------------------------------

  const handleDepositPreset = useCallback(
    (pct: number) => {
      triggerHaptic("selection");
      onDepositPercentageChange(pct);
    },
    [onDepositPercentageChange],
  );

  const handleInstalmentSelect = useCallback(
    (count: number) => {
      triggerHaptic("selection");
      onInstalmentCountChange(count);
    },
    [onInstalmentCountChange],
  );

  const handleDepositTextChange = useCallback(
    (text: string) => {
      const parsed = parseFloat(text);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        onDepositPercentageChange(parsed);
      } else if (text === "") {
        onDepositPercentageChange(0);
      }
    },
    [onDepositPercentageChange],
  );

  const handleSubmit = useCallback(() => {
    if (isSubmitting) return;
    triggerHaptic("success");
    onSubmit();
  }, [isSubmitting, onSubmit]);

  const handleCancel = useCallback(() => {
    triggerHaptic("tap");
    onCancel();
  }, [onCancel]);

  // -- Render ---------------------------------------------------------------

  return (
    <View style={styles.root} testID="layby-form">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="layers-outline" size={22} color="#8b5cf6" />
            <Text style={styles.headerTitle}>New Layby</Text>
          </View>
          <TouchableOpacity
            onPress={handleCancel}
            hitSlop={12}
            testID="layby-cancel"
          >
            <Ionicons name="close" size={28} color="#f3f4f6" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ---- Customer Details ---- */}
          <Text style={styles.sectionTitle}>Customer Details</Text>

          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput
            style={[styles.textInput, errors.customerName && styles.inputError]}
            value={customerName}
            onChangeText={onCustomerNameChange}
            placeholder="Customer full name"
            placeholderTextColor="#6b7280"
            testID="layby-customer-name"
          />
          {errors.customerName && (
            <Text style={styles.errorText}>{errors.customerName}</Text>
          )}

          <Text style={styles.fieldLabel}>Phone *</Text>
          <TextInput
            style={[styles.textInput, errors.customerPhone && styles.inputError]}
            value={customerPhone}
            onChangeText={onCustomerPhoneChange}
            placeholder="e.g. 082 123 4567"
            placeholderTextColor="#6b7280"
            keyboardType="phone-pad"
            testID="layby-customer-phone"
          />
          {errors.customerPhone && (
            <Text style={styles.errorText}>{errors.customerPhone}</Text>
          )}

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={[styles.textInput, errors.customerEmail && styles.inputError]}
            value={customerEmail}
            onChangeText={onCustomerEmailChange}
            placeholder="customer@example.com"
            placeholderTextColor="#6b7280"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="layby-customer-email"
          />
          {errors.customerEmail && (
            <Text style={styles.errorText}>{errors.customerEmail}</Text>
          )}

          {/* ---- Item Summary ---- */}
          <Text style={[styles.sectionTitle, styles.sectionGap]}>
            Item Summary
          </Text>
          <View style={styles.itemsCard}>
            {items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemQty}>
                    {item.quantity} × {formatCurrency(item.price)}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>
                  {formatCurrency(item.quantity * item.price)}
                </Text>
              </View>
            ))}
            <View style={styles.itemsTotalRow}>
              <Text style={styles.itemsTotalLabel}>Total</Text>
              <Text style={styles.itemsTotalValue} testID="layby-total">
                {formatCurrency(totalAmount)}
              </Text>
            </View>
          </View>

          {/* ---- Payment Plan ---- */}
          <Text style={[styles.sectionTitle, styles.sectionGap]}>
            Payment Plan
          </Text>

          {/* Deposit percentage */}
          <Text style={styles.fieldLabel}>Deposit Percentage</Text>
          <View style={styles.depositRow}>
            <View style={styles.depositInputWrap}>
              <TextInput
                style={styles.depositInput}
                value={String(depositPercentage)}
                onChangeText={handleDepositTextChange}
                keyboardType="decimal-pad"
                selectTextOnFocus
                testID="layby-deposit-pct"
              />
              <Text style={styles.depositSuffix}>%</Text>
            </View>
            <View style={styles.depositPresets}>
              {DEPOSIT_PRESETS.map((pct) => {
                const isActive = depositPercentage === pct;
                return (
                  <TouchableOpacity
                    key={pct}
                    style={[
                      styles.presetPill,
                      isActive && styles.presetPillActive,
                    ]}
                    onPress={() => handleDepositPreset(pct)}
                  >
                    <Text
                      style={[
                        styles.presetPillText,
                        isActive && styles.presetPillTextActive,
                      ]}
                    >
                      {pct}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <Text style={styles.depositHint} testID="layby-deposit-amount">
            Deposit: {formatCurrency(depositAmount)}
          </Text>

          {/* Instalment count */}
          <Text style={styles.fieldLabel}>Number of Instalments</Text>
          <View style={styles.instalmentRow}>
            {INSTALMENT_OPTIONS.map((count) => {
              const isActive = instalmentCount === count;
              return (
                <TouchableOpacity
                  key={count}
                  style={[
                    styles.instalmentPill,
                    isActive && styles.instalmentPillActive,
                  ]}
                  onPress={() => handleInstalmentSelect(count)}
                  testID={
                    isActive ? "layby-instalment-count" : undefined
                  }
                >
                  <Text
                    style={[
                      styles.instalmentPillText,
                      isActive && styles.instalmentPillTextActive,
                    ]}
                  >
                    {count} mo
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {/* Expose a stable testID for the selected count */}
          <Text
            style={styles.instalmentHint}
            testID="layby-instalment-count"
          >
            {instalmentCount} monthly payments of{" "}
            <Text style={styles.instalmentHintBold} testID="layby-monthly-amount">
              {formatCurrency(monthlyInstalment)}
            </Text>
          </Text>

          {/* Payment schedule preview */}
          {schedulePreview.length > 0 && (
            <View style={styles.scheduleCard}>
              <Text style={styles.scheduleTitle}>Payment Schedule</Text>
              <View style={styles.scheduleHeader}>
                <Text style={styles.scheduleHeaderText}>Month</Text>
                <Text style={styles.scheduleHeaderText}>Amount</Text>
              </View>
              {/* Deposit row */}
              <View style={styles.scheduleRow}>
                <View style={styles.scheduleMonthWrap}>
                  <Ionicons
                    name="flag-outline"
                    size={14}
                    color="#22c55e"
                  />
                  <Text style={styles.scheduleMonthText}>Deposit</Text>
                </View>
                <Text style={[styles.scheduleAmount, { color: "#22c55e" }]}>
                  {formatCurrency(depositAmount)}
                </Text>
              </View>
              {schedulePreview.map((entry) => (
                <View key={entry.month} style={styles.scheduleRow}>
                  <Text style={styles.scheduleMonthText}>
                    Month {entry.month}
                  </Text>
                  <Text style={styles.scheduleAmount}>
                    {formatCurrency(entry.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* ---- Totals ---- */}
          <View style={styles.totalsCard}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Total Amount</Text>
              <Text style={styles.totalsValue}>
                {formatCurrency(totalAmount)}
              </Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Deposit Due</Text>
              <Text style={[styles.totalsValue, { color: "#22c55e" }]}>
                {formatCurrency(depositAmount)}
              </Text>
            </View>
            <View style={[styles.totalsRow, styles.totalsDivider]}>
              <Text style={styles.totalsLabelBold}>Monthly Instalment</Text>
              <Text style={styles.totalsValueBold}>
                {formatCurrency(monthlyInstalment)}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitting && styles.submitDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            testID="layby-submit"
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color="#fff"
            />
            <Text style={styles.submitButtonText}>
              {isSubmitting ? "Creating…" : "Create Layby"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const LaybyForm = React.memo(LaybyFormInner);
export default LaybyForm;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a" },
  flex: { flex: 1 },

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
  bodyContent: { padding: 20, gap: 10 },

  /* Section titles */
  sectionTitle: { color: "#f3f4f6", fontSize: 16, fontWeight: "700" },
  sectionGap: { marginTop: 12 },

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
  inputError: { borderColor: "#ef4444" },
  errorText: { color: "#ef4444", fontSize: 12 },

  /* Items card */
  itemsCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemInfo: { flex: 1, marginRight: 12 },
  itemName: { color: "#f3f4f6", fontSize: 14, fontWeight: "600" },
  itemQty: { color: "#9ca3af", fontSize: 12 },
  itemTotal: { color: "#f3f4f6", fontSize: 14, fontWeight: "600" },
  itemsTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 10,
    marginTop: 4,
  },
  itemsTotalLabel: { color: "#f3f4f6", fontSize: 15, fontWeight: "700" },
  itemsTotalValue: { color: "#f3f4f6", fontSize: 18, fontWeight: "700" },

  /* Deposit */
  depositRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  depositInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 14,
    minWidth: 90,
  },
  depositInput: {
    color: "#f3f4f6",
    fontSize: 18,
    fontWeight: "700",
    paddingVertical: 10,
    minWidth: 40,
    textAlign: "center",
  },
  depositSuffix: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 2,
  },
  depositPresets: { flexDirection: "row", gap: 6, flex: 1 },
  depositHint: { color: "#22c55e", fontSize: 13, fontWeight: "600" },

  /* Preset pills (shared shape for deposit + instalment) */
  presetPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    minHeight: 42,
  },
  presetPillActive: { borderColor: "#8b5cf6", backgroundColor: "#2e1065" },
  presetPillText: { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  presetPillTextActive: { color: "#8b5cf6" },

  /* Instalment pills */
  instalmentRow: { flexDirection: "row", gap: 8 },
  instalmentPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    minHeight: 48,
  },
  instalmentPillActive: { borderColor: "#3b82f6", backgroundColor: "#1e3a5f" },
  instalmentPillText: { color: "#6b7280", fontSize: 14, fontWeight: "600" },
  instalmentPillTextActive: { color: "#3b82f6" },
  instalmentHint: { color: "#9ca3af", fontSize: 13 },
  instalmentHintBold: { color: "#f3f4f6", fontWeight: "700" },

  /* Schedule preview */
  scheduleCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    gap: 6,
    marginTop: 4,
  },
  scheduleTitle: { color: "#f3f4f6", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  scheduleHeaderText: { color: "#6b7280", fontSize: 12, fontWeight: "600" },
  scheduleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  scheduleMonthWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  scheduleMonthText: { color: "#d1d5db", fontSize: 13 },
  scheduleAmount: { color: "#f3f4f6", fontSize: 13, fontWeight: "600" },

  /* Totals */
  totalsCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 4,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalsLabel: { color: "#9ca3af", fontSize: 13 },
  totalsValue: { color: "#f3f4f6", fontSize: 14, fontWeight: "600" },
  totalsDivider: {
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 8,
    marginTop: 4,
  },
  totalsLabelBold: { color: "#f3f4f6", fontSize: 15, fontWeight: "700" },
  totalsValueBold: { color: "#f3f4f6", fontSize: 20, fontWeight: "700" },

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
  submitButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#8b5cf6",
    minHeight: 48,
  },
  submitDisabled: { backgroundColor: "#374151", opacity: 0.6 },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
