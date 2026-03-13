/**
 * BizPilot Mobile POS — Expense Request Form
 *
 * Allows a custodian to submit a new petty cash expense request.
 * The form enforces spending-limit guardrails inline so the user
 * gets immediate feedback before the server round-trip.
 *
 * Why a justification field?
 * South African SARS requires petty cash expenses to have documented
 * business purpose for audit compliance (IT14 schedule).
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
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

interface ExpenseCategory {
  id: string;
  name: string;
  spendingLimit: number | null;
}

interface ExpenseRequestFormProps {
  fundId: string;
  fundName: string;
  availableBalance: number;
  categories: ExpenseCategory[];
  onSubmit: (data: {
    categoryId: string;
    amount: number;
    description: string;
    justification: string;
  }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

interface ValidationErrors {
  categoryId?: string;
  amount?: string;
  description?: string;
  justification?: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * @param props {@link ExpenseRequestFormProps}
 * @returns Expense request form with inline validation and category picker
 */
function ExpenseRequestFormComponent({
  fundId: _fundId,
  fundName,
  availableBalance,
  categories,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ExpenseRequestFormProps) {
  // ---- form state ----

  const [categoryId, setCategoryId] = useState<string>("");
  const [amountText, setAmountText] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [justification, setJustification] = useState<string>("");
  const [errors, setErrors] = useState<ValidationErrors>({});

  // ---- derived values ----

  const parsedAmount = useMemo(() => {
    const n = parseFloat(amountText);
    return Number.isNaN(n) ? 0 : n;
  }, [amountText]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );

  /**
   * Show a warning when the entered amount is within 80 % of the category
   * spending limit — gives the user a heads-up before they actually exceed it.
   */
  const limitWarning = useMemo(() => {
    if (!selectedCategory?.spendingLimit) return null;
    if (parsedAmount > selectedCategory.spendingLimit) {
      return `Exceeds category limit of ${formatCurrency(selectedCategory.spendingLimit)}`;
    }
    if (parsedAmount >= selectedCategory.spendingLimit * 0.8) {
      return `Approaching category limit of ${formatCurrency(selectedCategory.spendingLimit)}`;
    }
    return null;
  }, [parsedAmount, selectedCategory]);

  // ---- handlers ----

  const handleCategorySelect = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCategoryId(id);
      setErrors((prev) => ({ ...prev, categoryId: undefined }));
    },
    [],
  );

  const validate = useCallback((): boolean => {
    const next: ValidationErrors = {};

    if (!categoryId) {
      next.categoryId = "Select a category";
    }
    if (parsedAmount <= 0) {
      next.amount = "Enter a valid amount";
    } else if (parsedAmount > availableBalance) {
      next.amount = "Amount exceeds available balance";
    } else if (
      selectedCategory?.spendingLimit &&
      parsedAmount > selectedCategory.spendingLimit
    ) {
      next.amount = `Exceeds category limit of ${formatCurrency(selectedCategory.spendingLimit)}`;
    }
    if (!description.trim()) {
      next.description = "Description is required";
    }
    if (!justification.trim()) {
      next.justification = "Justification is required";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [categoryId, parsedAmount, availableBalance, selectedCategory, description, justification]);

  const handleSubmit = useCallback(() => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit({
      categoryId,
      amount: parsedAmount,
      description: description.trim(),
      justification: justification.trim(),
    });
  }, [validate, onSubmit, categoryId, parsedAmount, description, justification]);

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  }, [onCancel]);

  // ---- render ----

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <ScrollView
      testID="expense-form"
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ---- Header ---- */}
      <Text style={styles.title}>New Expense Request</Text>
      <Text style={styles.subtitle}>{fundName}</Text>
      <View style={styles.balanceBadge}>
        <Ionicons name="wallet-outline" size={14} color="#22c55e" />
        <Text style={styles.balanceText}>
          Available: {formatCurrency(availableBalance)}
        </Text>
      </View>

      {/* ---- Category Picker ---- */}
      <Text style={styles.sectionLabel}>Category</Text>
      {errors.categoryId && (
        <Text testID="expense-error" style={styles.errorText}>
          {errors.categoryId}
        </Text>
      )}
      <View style={styles.categoryGrid}>
        {categories.map((cat) => {
          const selected = cat.id === categoryId;
          return (
            <TouchableOpacity
              key={cat.id}
              testID={`expense-category-${cat.id}`}
              style={[styles.categoryPill, selected && styles.categoryPillSelected]}
              onPress={() => handleCategorySelect(cat.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  selected && styles.categoryPillTextSelected,
                ]}
                numberOfLines={1}
              >
                {cat.name}
              </Text>
              {cat.spendingLimit !== null && (
                <Text style={styles.categoryLimit}>
                  {formatCurrency(cat.spendingLimit)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ---- Amount ---- */}
      <Text style={styles.sectionLabel}>Amount</Text>
      {errors.amount && (
        <Text testID="expense-error" style={styles.errorText}>
          {errors.amount}
        </Text>
      )}
      <View style={styles.amountRow}>
        <Text style={styles.currencyPrefix}>R</Text>
        <TextInput
          testID="expense-amount-input"
          style={styles.amountInput}
          value={amountText}
          onChangeText={setAmountText}
          placeholder="0.00"
          placeholderTextColor="#6b7280"
          keyboardType="decimal-pad"
          returnKeyType="next"
        />
      </View>
      {limitWarning && (
        <View style={styles.warningRow}>
          <Ionicons name="warning-outline" size={14} color="#fbbf24" />
          <Text style={styles.warningText}>{limitWarning}</Text>
        </View>
      )}

      {/* ---- Description ---- */}
      <Text style={styles.sectionLabel}>Description</Text>
      {errors.description && (
        <Text testID="expense-error" style={styles.errorText}>
          {errors.description}
        </Text>
      )}
      <TextInput
        testID="expense-description-input"
        style={[styles.textArea, { height: 64 }]}
        value={description}
        onChangeText={(t) => {
          setDescription(t);
          setErrors((prev) => ({ ...prev, description: undefined }));
        }}
        placeholder="What is this expense for?"
        placeholderTextColor="#6b7280"
        multiline
        numberOfLines={2}
        textAlignVertical="top"
      />

      {/* ---- Justification ---- */}
      <Text style={styles.sectionLabel}>Justification</Text>
      {errors.justification && (
        <Text testID="expense-error" style={styles.errorText}>
          {errors.justification}
        </Text>
      )}
      <TextInput
        testID="expense-justification-input"
        style={[styles.textArea, { height: 88 }]}
        value={justification}
        onChangeText={(t) => {
          setJustification(t);
          setErrors((prev) => ({ ...prev, justification: undefined }));
        }}
        placeholder="Why is this expense necessary?"
        placeholderTextColor="#6b7280"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* ---- Validation summary ---- */}
      {hasErrors && (
        <View testID="expense-error" style={styles.validationSummary}>
          <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
          <Text style={styles.validationSummaryText}>
            Please fix the errors above before submitting.
          </Text>
        </View>
      )}

      {/* ---- Actions ---- */}
      <TouchableOpacity
        testID="expense-submit-btn"
        style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        activeOpacity={0.7}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <Ionicons name="send-outline" size={18} color="#ffffff" />
            <Text style={styles.submitBtnText}>Submit Request</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        testID="expense-cancel-btn"
        style={styles.cancelBtn}
        onPress={handleCancel}
        activeOpacity={0.7}
      >
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

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
    paddingBottom: 40,
  },

  // Header
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 2,
  },
  balanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#22c55e15",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 20,
  },
  balanceText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#22c55e",
  },

  // Sections
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 8,
    marginTop: 16,
  },

  // Category grid
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryPill: {
    // Why 48.5%? Two-column grid with gap — ensures two pills per row on tablets.
    width: "48.5%",
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#374151",
    alignItems: "center",
  },
  categoryPillSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#3b82f615",
  },
  categoryPillText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  categoryPillTextSelected: {
    color: "#3b82f6",
  },
  categoryLimit: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },

  // Amount
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 14,
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: "700",
    color: "#9ca3af",
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
    color: "#f3f4f6",
    paddingVertical: 14,
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  warningText: {
    fontSize: 12,
    color: "#fbbf24",
  },

  // Text areas
  textArea: {
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#f3f4f6",
  },

  // Errors
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    marginBottom: 4,
  },
  validationSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ef444415",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  validationSummaryText: {
    fontSize: 13,
    color: "#ef4444",
    flex: 1,
  },

  // Buttons
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
});

export default React.memo(ExpenseRequestFormComponent) as typeof ExpenseRequestFormComponent;
