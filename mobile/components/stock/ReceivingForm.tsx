/**
 * ReceivingForm — Form for receiving goods against a purchase order.
 *
 * Why FlatList instead of ScrollView + .map()?
 * Purchase orders can contain hundreds of line items. FlatList virtualises
 * the list so only visible rows are mounted, keeping memory usage constant
 * regardless of PO size. This matters on warehouse tablets with limited RAM.
 *
 * Why "Receive All" at the top?
 * In practice most deliveries are complete — the common-case action should
 * be the most accessible. Staff can then correct individual discrepancies.
 *
 * @module ReceivingForm
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { triggerHaptic } from "@/utils/haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReceivingItem {
  id: string;
  productName: string;
  sku: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
}

interface ReceivingFormProps {
  purchaseOrderNumber: string;
  supplierName: string;
  items: ReceivingItem[];
  onUpdateReceivedQty: (itemId: string, qty: number) => void;
  onReceiveAll: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  deliveryNote: string;
  onDeliveryNoteChange: (note: string) => void;
  isSubmitting?: boolean;
}

// ─── Theme ───────────────────────────────────────────────────────────────────

const COLORS = {
  bg: "#0f172a",
  card: "#1f2937",
  input: "#111827",
  text: "#f3f4f6",
  muted: "#9ca3af",
  border: "#374151",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#fbbf24",
  blue: "#3b82f6",
  purple: "#8b5cf6",
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Row status colour based on how much has been received.
 * Green = full, amber = partial, red = nothing received yet.
 */
function rowColor(received: number, ordered: number): string {
  if (received >= ordered) return COLORS.green;
  if (received > 0) return COLORS.amber;
  return COLORS.red;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Individual receiving line item.
 * Memoised so typing into one row doesn't re-render the entire list.
 */
const ReceivingItemRow = React.memo(function ReceivingItemRow({
  item,
  onUpdateReceivedQty,
}: {
  item: ReceivingItem;
  onUpdateReceivedQty: (itemId: string, qty: number) => void;
}) {
  const statusColor = rowColor(item.receivedQty, item.orderedQty);
  const rowTotal = item.receivedQty * item.unitCost;

  const handleQtyChange = useCallback(
    (text: string) => {
      const parsed = parseInt(text, 10);
      // Allow clearing the field — treat empty/NaN as 0
      onUpdateReceivedQty(item.id, Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
    },
    [item.id, onUpdateReceivedQty]
  );

  return (
    <View
      testID={`receiving-item-${item.id}`}
      style={[styles.itemRow, { borderLeftColor: statusColor }]}
    >
      {/* Product info */}
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.productName}
          </Text>
          <Text style={styles.itemSku}>SKU: {item.sku}</Text>
        </View>
        <View style={styles.orderedBadge}>
          <Text style={styles.orderedBadgeText}>
            Ordered: {item.orderedQty}
          </Text>
        </View>
      </View>

      {/* Input row */}
      <View style={styles.itemInputRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputGroupLabel}>Received</Text>
          <TextInput
            testID={`receiving-qty-${item.id}`}
            style={styles.qtyInput}
            value={item.receivedQty > 0 ? String(item.receivedQty) : ""}
            onChangeText={handleQtyChange}
            placeholder="0"
            placeholderTextColor={COLORS.muted}
            keyboardType="number-pad"
            returnKeyType="done"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputGroupLabel}>Unit Cost</Text>
          <Text style={styles.costText}>{formatCurrency(item.unitCost)}</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputGroupLabel}>Row Total</Text>
          <Text style={[styles.rowTotal, { color: statusColor }]}>
            {formatCurrency(rowTotal)}
          </Text>
        </View>
      </View>
    </View>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

function ReceivingForm({
  purchaseOrderNumber,
  supplierName,
  items,
  onUpdateReceivedQty,
  onReceiveAll,
  onSubmit,
  onCancel,
  deliveryNote,
  onDeliveryNoteChange,
  isSubmitting = false,
}: ReceivingFormProps) {
  // ── Summary calculations ───────────────────────────────────────────────────

  const summary = useMemo(() => {
    let totalItems = items.length;
    let totalReceived = 0;
    let totalValue = 0;

    for (const item of items) {
      if (item.receivedQty > 0) totalReceived++;
      totalValue += item.receivedQty * item.unitCost;
    }

    return { totalItems, totalReceived, totalValue };
  }, [items]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleReceiveAll = useCallback(() => {
    triggerHaptic("success");
    onReceiveAll();
  }, [onReceiveAll]);

  const handleSubmit = useCallback(() => {
    triggerHaptic("success");
    onSubmit();
  }, [onSubmit]);

  const handleCancel = useCallback(() => {
    triggerHaptic("tap");
    onCancel();
  }, [onCancel]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ReceivingItem>) => (
      <ReceivingItemRow
        item={item}
        onUpdateReceivedQty={onUpdateReceivedQty}
      />
    ),
    [onUpdateReceivedQty]
  );

  const keyExtractor = useCallback(
    (item: ReceivingItem) => item.id,
    []
  );

  // ── List header (PO info + Receive All) ────────────────────────────────────

  const ListHeader = useMemo(
    () => (
      <View>
        {/* PO header card */}
        <View style={styles.poHeader}>
          <View style={styles.poIcon}>
            <Ionicons name="document-text-outline" size={24} color={COLORS.blue} />
          </View>
          <View style={styles.poInfo}>
            <Text
              testID="receiving-po-number"
              style={styles.poNumber}
              numberOfLines={1}
            >
              {purchaseOrderNumber}
            </Text>
            <Text
              testID="receiving-supplier"
              style={styles.supplierName}
              numberOfLines={1}
            >
              {supplierName}
            </Text>
          </View>
        </View>

        {/* Receive All button */}
        <TouchableOpacity
          testID="receiving-receive-all"
          onPress={handleReceiveAll}
          style={styles.receiveAllButton}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark-done-outline" size={20} color={COLORS.text} />
          <Text style={styles.receiveAllText}>Receive All Items</Text>
        </TouchableOpacity>

        {/* Column header */}
        <Text style={styles.listSectionLabel}>LINE ITEMS</Text>
      </View>
    ),
    [purchaseOrderNumber, supplierName, handleReceiveAll, isSubmitting]
  );

  // ── List footer (delivery note + summary + actions) ────────────────────────

  const ListFooter = useMemo(
    () => (
      <View style={styles.footerContainer}>
        {/* Delivery note */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DELIVERY NOTE</Text>
          <TextInput
            testID="receiving-delivery-note"
            style={styles.notesInput}
            value={deliveryNote}
            onChangeText={onDeliveryNoteChange}
            placeholder="Delivery reference, condition notes…"
            placeholderTextColor={COLORS.muted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!isSubmitting}
          />
        </View>

        {/* Summary card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>RECEIVING SUMMARY</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Line Items</Text>
            <Text style={styles.summaryValue}>{summary.totalItems}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items Received</Text>
            <Text
              style={[
                styles.summaryValue,
                {
                  color:
                    summary.totalReceived === summary.totalItems
                      ? COLORS.green
                      : COLORS.amber,
                },
              ]}
            >
              {summary.totalReceived} / {summary.totalItems}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryRowLast]}>
            <Text style={styles.summaryLabel}>Total Value</Text>
            <Text style={[styles.summaryValue, { color: COLORS.green }]}>
              {formatCurrency(summary.totalValue)}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            testID="receiving-cancel"
            onPress={handleCancel}
            style={styles.cancelButton}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Ionicons name="close-outline" size={20} color={COLORS.text} />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="receiving-submit"
            onPress={handleSubmit}
            style={[
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled,
            ]}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color={COLORS.text}
                />
                <Text style={styles.submitButtonText}>Confirm Receiving</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    ),
    [
      deliveryNote,
      onDeliveryNoteChange,
      isSubmitting,
      summary,
      handleCancel,
      handleSubmit,
    ]
  );

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <View testID="receiving-form" style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },

  // PO header
  poHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  poIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${COLORS.blue}20`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  poInfo: {
    flex: 1,
  },
  poNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 2,
  },
  supplierName: {
    fontSize: 14,
    color: COLORS.muted,
  },

  // Receive All
  receiveAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: COLORS.green,
    marginBottom: 16,
  },
  receiveAllText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },

  // List section label
  listSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 8,
  },

  // Item row
  itemRow: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  itemSku: {
    fontSize: 12,
    color: COLORS.muted,
    fontFamily: "monospace",
    marginTop: 2,
  },
  orderedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: `${COLORS.blue}20`,
  },
  orderedBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.blue,
  },

  // Item input row
  itemInputRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputGroupLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.muted,
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  qtyInput: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 48,
  },
  costText: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.muted,
    textAlign: "center",
    paddingVertical: 12,
  },
  rowTotal: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 12,
  },

  // Footer
  footerContainer: {
    marginTop: 8,
  },

  // Section
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    fontSize: 15,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 80,
  },

  // Summary
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.muted,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },

  // Actions
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  submitButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: COLORS.blue,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
});

export default React.memo(ReceivingForm);
