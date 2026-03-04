/**
 * TenderLineCard — individual payment tender display card.
 * (integrated-payments task 7.2)
 *
 * Extracted as a separate component so the FlatList in SplitPaymentScreen
 * can use React.memo on individual tender rows, preventing re-render of
 * all cards when only one tender's amount changes.
 *
 * Why a separate file?
 * In a busy POS environment, the cashier may add 3-4 tender lines.
 * Isolating the card lets React skip diffing unchanged cards.
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import {
  TenderLine,
  TENDER_METHODS,
} from "@/services/payment/SplitPaymentService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TenderLineCardProps {
  tender: TenderLine;
  index: number;
  onUpdateAmount: (tenderId: string, text: string) => void;
  onUpdateCashTendered: (tenderId: string, text: string) => void;
  onRemove: (tenderId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TenderLineCardInner({
  tender,
  index,
  onUpdateAmount,
  onUpdateCashTendered,
  onRemove,
}: TenderLineCardProps) {
  const methodInfo = TENDER_METHODS.find((m) => m.value === tender.method);

  const handleAmountEnd = useCallback(
    (e: { nativeEvent: { text: string } }) =>
      onUpdateAmount(tender.id, e.nativeEvent.text),
    [tender.id, onUpdateAmount]
  );

  const handleCashEnd = useCallback(
    (e: { nativeEvent: { text: string } }) =>
      onUpdateCashTendered(tender.id, e.nativeEvent.text),
    [tender.id, onUpdateCashTendered]
  );

  const handleRemove = useCallback(
    () => onRemove(tender.id),
    [tender.id, onRemove]
  );

  return (
    <View style={styles.card} testID={`tender-card-${index}`}>
      {/* Header: method badge + remove button */}
      <View style={styles.header}>
        <View style={styles.badge}>
          <Ionicons
            name={(methodInfo?.icon ?? "card-outline") as keyof typeof Ionicons.glyphMap}
            size={18}
            color="#3b82f6"
          />
          <Text style={styles.badgeText}>{methodInfo?.label ?? tender.method}</Text>
        </View>

        {tender.processed ? (
          <View style={styles.processedBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
            <Text style={styles.processedText}>Paid</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleRemove}
            testID={`remove-tender-card-${index}`}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close-circle" size={24} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* Amount field */}
      <View style={styles.row}>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          defaultValue={tender.amount.toFixed(2)}
          onEndEditing={handleAmountEnd}
          editable={!tender.processed}
          testID={`tender-amount-${index}`}
          placeholderTextColor="#6b7280"
        />
      </View>

      {/* Cash tendered (cash method only) */}
      {tender.method === "cash" && (
        <View style={styles.row}>
          <Text style={styles.label}>Cash Tendered</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            defaultValue={tender.cashTendered?.toFixed(2) ?? ""}
            onEndEditing={handleCashEnd}
            placeholder="0.00"
            editable={!tender.processed}
            testID={`tender-cash-${index}`}
            placeholderTextColor="#6b7280"
          />
        </View>
      )}

      {/* Change indicator for cash */}
      {tender.method === "cash" &&
        tender.cashTendered != null &&
        tender.cashTendered > tender.amount && (
          <View style={styles.changeRow}>
            <Ionicons name="arrow-undo" size={16} color="#fbbf24" />
            <Text style={styles.changeText}>
              Change: {formatCurrency(tender.cashTendered - tender.amount)}
            </Text>
          </View>
        )}
    </View>
  );
}

/**
 * Memoised card: only re-renders when the tender object or callbacks change.
 */
export const TenderLineCard = React.memo(TenderLineCardInner);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    color: "#3b82f6",
    fontWeight: "600",
    fontSize: 14,
  },
  processedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#14532d",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  processedText: {
    color: "#22c55e",
    fontWeight: "600",
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    color: "#9ca3af",
    fontSize: 14,
  },
  input: {
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
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  changeText: {
    color: "#fbbf24",
    fontSize: 14,
    fontWeight: "600",
  },
});
