/**
 * SplitPaymentScreen — multi-tender split payment modal for BizPilot POS.
 * (integrated-payments task 7.1)
 *
 * Layout: Full-screen modal with a vertical layout:
 *   Top: Order total & remaining balance banner
 *   Middle: Scrollable list of tender lines (each editable)
 *   Bottom: Add tender button + confirm/cancel actions
 *
 * Why a full-screen modal instead of an inline panel?
 * Split payments require the cashier's full attention. A distracted
 * cashier mis-keying amounts can cause cash drawer variance. The modal
 * blocks all other interactions until the payment is resolved.
 *
 * Performance: useMemo recalculates summary on every tender change
 * (pure function, sub-ms). useCallback prevents child re-renders.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import {
  TenderMethod,
  TenderLine,
  SplitPaymentState,
  TENDER_METHODS,
  calculateSplitSummary,
  addTender,
  updateTenderAmount,
  updateCashTendered,
  removeTender,
  validateSplitPayment,
} from "@/services/payment/SplitPaymentService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SplitPaymentScreenProps {
  /** Total amount of the order. */
  orderTotal: number;
  /** Called when all tenders are confirmed and order is fully paid. */
  onConfirm: (tenders: TenderLine[]) => void;
  /** Called when user cancels the split payment. */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SplitPaymentScreenInner({
  orderTotal,
  onConfirm,
  onCancel,
}: SplitPaymentScreenProps) {
  // -------------------------------------------------------------------------
  // State: the split payment model
  // -------------------------------------------------------------------------
  const [state, setState] = useState<SplitPaymentState>({
    orderTotal,
    tenders: [],
  });

  /** Counter to generate unique tender IDs. */
  const [nextId, setNextId] = useState(1);

  // -------------------------------------------------------------------------
  // Derived: summary recalculated on every state change
  // -------------------------------------------------------------------------
  const summary = useMemo(() => calculateSplitSummary(state), [state]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleAddTender = useCallback(
    (method: TenderMethod) => {
      const id = `tender-${nextId}`;
      setNextId((prev) => prev + 1);
      setState((prev) => addTender(prev, method, id));
    },
    [nextId]
  );

  const handleUpdateAmount = useCallback(
    (tenderId: string, text: string) => {
      const parsed = parseFloat(text);
      if (!isNaN(parsed)) {
        setState((prev) => updateTenderAmount(prev, tenderId, parsed));
      }
    },
    []
  );

  const handleUpdateCashTendered = useCallback(
    (tenderId: string, text: string) => {
      const parsed = parseFloat(text);
      if (!isNaN(parsed)) {
        setState((prev) => updateCashTendered(prev, tenderId, parsed));
      }
    },
    []
  );

  const handleRemoveTender = useCallback(
    (tenderId: string) => {
      setState((prev) => removeTender(prev, tenderId));
    },
    []
  );

  const handleConfirm = useCallback(() => {
    const errors = validateSplitPayment(state);
    if (errors.length > 0) {
      Alert.alert("Validation Error", errors.join("\n"));
      return;
    }
    onConfirm(state.tenders);
  }, [state, onConfirm]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderTenderLine = useCallback(
    (tender: TenderLine, index: number) => {
      const methodInfo = TENDER_METHODS.find((m) => m.value === tender.method);
      return (
        <View key={tender.id} style={styles.tenderCard} testID={`tender-line-${index}`}>
          {/* Header */}
          <View style={styles.tenderHeader}>
            <View style={styles.tenderMethodBadge}>
              <Ionicons
                name={methodInfo?.icon as keyof typeof Ionicons.glyphMap ?? "card-outline"}
                size={18}
                color="#3b82f6"
              />
              <Text style={styles.tenderMethodText}>
                {methodInfo?.label ?? tender.method}
              </Text>
            </View>
            {!tender.processed && (
              <TouchableOpacity
                onPress={() => handleRemoveTender(tender.id)}
                testID={`remove-tender-${index}`}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close-circle" size={24} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>

          {/* Amount input */}
          <View style={styles.tenderRow}>
            <Text style={styles.tenderLabel}>Amount</Text>
            <TextInput
              style={styles.tenderInput}
              keyboardType="decimal-pad"
              defaultValue={tender.amount.toFixed(2)}
              onEndEditing={(e) => handleUpdateAmount(tender.id, e.nativeEvent.text)}
              editable={!tender.processed}
              testID={`amount-input-${index}`}
              placeholderTextColor="#6b7280"
            />
          </View>

          {/* Cash tendered (only for cash method) */}
          {tender.method === "cash" && (
            <View style={styles.tenderRow}>
              <Text style={styles.tenderLabel}>Cash Tendered</Text>
              <TextInput
                style={styles.tenderInput}
                keyboardType="decimal-pad"
                defaultValue={tender.cashTendered?.toFixed(2) ?? ""}
                onEndEditing={(e) =>
                  handleUpdateCashTendered(tender.id, e.nativeEvent.text)
                }
                placeholder="0.00"
                editable={!tender.processed}
                testID={`cash-tendered-input-${index}`}
                placeholderTextColor="#6b7280"
              />
            </View>
          )}
        </View>
      );
    },
    [handleRemoveTender, handleUpdateAmount, handleUpdateCashTendered]
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <View style={styles.container} testID="split-payment-screen">
      {/* Header banner */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Split Payment</Text>
        <TouchableOpacity onPress={onCancel} testID="cancel-button">
          <Ionicons name="close" size={28} color="#f3f4f6" />
        </TouchableOpacity>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Order Total</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary.orderTotal)}</Text>
        </View>
        <View
          style={[
            styles.summaryCard,
            summary.isFullyPaid ? styles.cardGreen : styles.cardAmber,
          ]}
        >
          <Text style={styles.summaryLabel}>Remaining</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(summary.remainingBalance)}
          </Text>
        </View>
        {summary.changeDue > 0 && (
          <View style={[styles.summaryCard, styles.cardBlue]}>
            <Text style={styles.summaryLabel}>Change Due</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(summary.changeDue)}
            </Text>
          </View>
        )}
      </View>

      {/* Tender lines */}
      <ScrollView style={styles.tenderList} contentContainerStyle={styles.tenderListContent}>
        {state.tenders.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={48} color="#4b5563" />
            <Text style={styles.emptyText}>
              Add a payment method below to start splitting
            </Text>
          </View>
        )}
        {state.tenders.map((t, i) => renderTenderLine(t, i))}
      </ScrollView>

      {/* Add tender buttons */}
      <View style={styles.addTenderRow}>
        {TENDER_METHODS.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={styles.addTenderButton}
            onPress={() => handleAddTender(m.value)}
            testID={`add-${m.value}`}
          >
            <Ionicons
              name={m.icon as keyof typeof Ionicons.glyphMap}
              size={20}
              color="#f3f4f6"
            />
            <Text style={styles.addTenderLabel}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Footer: confirm/cancel */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          testID="footer-cancel"
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            !summary.isFullyPaid && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={!summary.isFullyPaid}
          testID="confirm-button"
        >
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.confirmButtonText}>Confirm Payment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const SplitPaymentScreen = React.memo(SplitPaymentScreenInner);

// ---------------------------------------------------------------------------
// Styles — dark POS theme, large touch targets for tablet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
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
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  /* Summary cards */
  summaryRow: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  cardGreen: { backgroundColor: "#14532d" },
  cardAmber: { backgroundColor: "#78350f" },
  cardBlue: { backgroundColor: "#1e3a5f" },
  summaryLabel: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  /* Tender list */
  tenderList: {
    flex: 1,
  },
  tenderListContent: {
    padding: 16,
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 16,
    marginTop: 12,
  },
  /* Tender card */
  tenderCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tenderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tenderMethodBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tenderMethodText: {
    color: "#3b82f6",
    fontWeight: "600",
    fontSize: 14,
  },
  tenderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  tenderLabel: {
    color: "#9ca3af",
    fontSize: 14,
  },
  tenderInput: {
    backgroundColor: "#111827",
    color: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: "600",
    minWidth: 140,
    textAlign: "right",
    borderWidth: 1,
    borderColor: "#374151",
  },
  /* Add tender row */
  addTenderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  addTenderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#374151",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addTenderLabel: {
    color: "#f3f4f6",
    fontSize: 14,
    fontWeight: "500",
  },
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
  },
  cancelButtonText: {
    color: "#9ca3af",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#22c55e",
  },
  confirmButtonDisabled: {
    backgroundColor: "#374151",
    opacity: 0.6,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
