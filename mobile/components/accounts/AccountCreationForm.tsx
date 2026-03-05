/**
 * AccountCreationForm — form for opening a new customer credit account.
 * (customer-accounts task 13.3)
 *
 * Collects customer details, credit limit, and payment terms, validates
 * inline, then hands the payload to the parent via `onSubmit`.
 *
 * Why ScrollView instead of a flat View?
 * On tablets the keyboard can obscure lower fields; ScrollView lets the
 * user scroll to the submit button without dismissing the keyboard.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  PaymentTerms,
  PAYMENT_TERMS_LABELS,
} from "@/services/accounts/CustomerAccountService";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Payload handed to the parent when the form is submitted. */
export interface AccountCreationData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  creditLimit: number;
  paymentTerms: PaymentTerms;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AccountCreationFormProps {
  /** Called with validated form data when the user taps "Create Account". */
  onSubmit: (data: AccountCreationData) => void;
  /** Called when the user cancels the form. */
  onCancel: () => void;
  /** When true the submit button shows a spinner and is non-interactive. */
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CREDIT_LIMIT_MAX = 500_000;

const PAYMENT_TERMS_OPTIONS: PaymentTerms[] = [
  "cod",
  "net_7",
  "net_14",
  "net_30",
  "net_60",
];

/** Simple RFC-5322-ish check — intentionally lenient for mobile entry. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Why this regex?
 * Allows optional leading +, digits, spaces, hyphens and parentheses —
 * covers most international formats without being overly strict.
 */
const PHONE_REGEX = /^\+?[\d\s\-()]{7,20}$/;

// ---------------------------------------------------------------------------
// Per-field validation
// ---------------------------------------------------------------------------

interface FieldErrors {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  creditLimit?: string;
}

function validateFields(
  name: string,
  email: string,
  phone: string,
  creditLimitRaw: string,
  /** Track which fields the user has interacted with so we only show
   *  errors for "dirty" fields — avoids a wall of red on first render. */
  touched: Record<string, boolean>
): FieldErrors {
  const errors: FieldErrors = {};

  if (touched.customerName) {
    if (!name.trim()) {
      errors.customerName = "Customer name is required";
    } else if (name.trim().length < 2) {
      errors.customerName = "Name must be at least 2 characters";
    }
  }

  if (touched.customerEmail && email.trim()) {
    if (!EMAIL_REGEX.test(email.trim())) {
      errors.customerEmail = "Enter a valid email address";
    }
  }

  if (touched.customerPhone && phone.trim()) {
    if (!PHONE_REGEX.test(phone.trim())) {
      errors.customerPhone = "Enter a valid phone number";
    }
  }

  if (touched.creditLimit) {
    const n = parseFloat(creditLimitRaw);
    if (!creditLimitRaw.trim() || isNaN(n)) {
      errors.creditLimit = "Credit limit is required";
    } else if (n <= 0) {
      errors.creditLimit = "Credit limit must be greater than 0";
    } else if (n > CREDIT_LIMIT_MAX) {
      errors.creditLimit = `Credit limit cannot exceed ${CREDIT_LIMIT_MAX.toLocaleString()}`;
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function AccountCreationFormInner({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: AccountCreationFormProps) {
  // --- field state ---
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [creditLimitRaw, setCreditLimitRaw] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>("net_30");

  // --- track which fields have been touched ---
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }, []);

  // --- validation (recomputed when inputs change) ---
  const fieldErrors = useMemo(
    () =>
      validateFields(
        customerName,
        customerEmail,
        customerPhone,
        creditLimitRaw,
        touched
      ),
    [customerName, customerEmail, customerPhone, creditLimitRaw, touched]
  );

  /**
   * Why a separate "all-fields" check?
   * `fieldErrors` only includes errors for touched fields (UX-friendly),
   * but the submit button must be disabled until *every* required field
   * passes validation regardless of touch state.
   */
  const isFormComplete = useMemo(() => {
    const allTouched: Record<string, boolean> = {
      customerName: true,
      creditLimit: true,
    };
    const fullErrors = validateFields(
      customerName,
      customerEmail,
      customerPhone,
      creditLimitRaw,
      allTouched
    );
    return Object.keys(fullErrors).length === 0;
  }, [customerName, customerEmail, customerPhone, creditLimitRaw]);

  const canSubmit = isFormComplete && !isSubmitting;

  // --- handlers ---

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    const data: AccountCreationData = {
      customerName: customerName.trim(),
      creditLimit: parseFloat(creditLimitRaw),
      paymentTerms,
      ...(customerEmail.trim()
        ? { customerEmail: customerEmail.trim() }
        : undefined),
      ...(customerPhone.trim()
        ? { customerPhone: customerPhone.trim() }
        : undefined),
    };
    onSubmit(data);
  }, [
    canSubmit,
    customerName,
    customerEmail,
    customerPhone,
    creditLimitRaw,
    paymentTerms,
    onSubmit,
  ]);

  // --- render ---

  return (
    <View style={styles.container} testID="account-creation-form">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Account</Text>
        <TouchableOpacity
          onPress={onCancel}
          hitSlop={12}
          testID="account-creation-cancel"
        >
          <Ionicons name="close" size={28} color="#f3f4f6" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---- Customer Name ---- */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>
            Customer Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              fieldErrors.customerName && styles.inputError,
            ]}
            value={customerName}
            onChangeText={setCustomerName}
            onBlur={() => markTouched("customerName")}
            placeholder="Full name or business name"
            placeholderTextColor="#6b7280"
            autoCapitalize="words"
            returnKeyType="next"
            testID="account-name-input"
          />
          {fieldErrors.customerName && (
            <Text style={styles.errorText}>{fieldErrors.customerName}</Text>
          )}
        </View>

        {/* ---- Email ---- */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={[
              styles.input,
              fieldErrors.customerEmail && styles.inputError,
            ]}
            value={customerEmail}
            onChangeText={setCustomerEmail}
            onBlur={() => markTouched("customerEmail")}
            placeholder="customer@example.com"
            placeholderTextColor="#6b7280"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            testID="account-email-input"
          />
          {fieldErrors.customerEmail && (
            <Text style={styles.errorText}>{fieldErrors.customerEmail}</Text>
          )}
        </View>

        {/* ---- Phone ---- */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Phone</Text>
          <TextInput
            style={[
              styles.input,
              fieldErrors.customerPhone && styles.inputError,
            ]}
            value={customerPhone}
            onChangeText={setCustomerPhone}
            onBlur={() => markTouched("customerPhone")}
            placeholder="+27 82 123 4567"
            placeholderTextColor="#6b7280"
            keyboardType="phone-pad"
            returnKeyType="next"
            testID="account-phone-input"
          />
          {fieldErrors.customerPhone && (
            <Text style={styles.errorText}>{fieldErrors.customerPhone}</Text>
          )}
        </View>

        {/* ---- Credit Limit ---- */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>
            Credit Limit (ZAR) <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.creditInput,
              fieldErrors.creditLimit && styles.inputError,
            ]}
            value={creditLimitRaw}
            onChangeText={setCreditLimitRaw}
            onBlur={() => markTouched("creditLimit")}
            placeholder="0.00"
            placeholderTextColor="#6b7280"
            keyboardType="decimal-pad"
            returnKeyType="done"
            testID="account-credit-limit-input"
          />
          {fieldErrors.creditLimit && (
            <Text style={styles.errorText}>{fieldErrors.creditLimit}</Text>
          )}
        </View>

        {/* ---- Payment Terms (pill selector) ---- */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Payment Terms</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            {PAYMENT_TERMS_OPTIONS.map((term) => {
              const isActive = paymentTerms === term;
              return (
                <TouchableOpacity
                  key={term}
                  style={[styles.pill, isActive && styles.pillActive]}
                  onPress={() => setPaymentTerms(term)}
                  testID={`payment-term-${term}`}
                >
                  <Text
                    style={[
                      styles.pillText,
                      isActive && styles.pillTextActive,
                    ]}
                  >
                    {PAYMENT_TERMS_LABELS[term]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          testID="account-creation-footer-cancel"
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          testID="account-creation-submit"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Create Account</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const AccountCreationForm = React.memo(AccountCreationFormInner);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },

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
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#f3f4f6" },

  /* Scroll area */
  scrollArea: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  /* Sections & fields */
  section: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, color: "#9ca3af", marginBottom: 8, fontWeight: "500" },
  required: { color: "#ef4444" },

  input: {
    backgroundColor: "#111827",
    color: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#374151",
    minHeight: 48,
  },
  inputError: { borderColor: "#ef4444" },
  creditInput: { fontSize: 20, fontWeight: "700", textAlign: "center" },

  errorText: { color: "#ef4444", fontSize: 12, marginTop: 4 },

  /* Payment terms pill selector */
  pillRow: { gap: 8, paddingVertical: 4 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    minHeight: 48,
    justifyContent: "center",
  },
  pillActive: { borderColor: "#3b82f6", backgroundColor: "#1e3a5f" },
  pillText: { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  pillTextActive: { color: "#3b82f6" },

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
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4b5563",
    minHeight: 48,
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
    backgroundColor: "#3b82f6",
    minHeight: 48,
  },
  submitDisabled: { backgroundColor: "#374151", opacity: 0.6 },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
