/**
 * PaymentBreakdownView — receipt-style breakdown of all payment tenders.
 * (integrated-payments task 7.2)
 *
 * Displayed after a split payment is confirmed, or on the receipt screen.
 * Shows each tender method, amount, reference, and the total + change.
 *
 * Why a dedicated breakdown component?
 * The POS receipt must display the exact payment breakdown for the customer.
 * This component is reusable in both the confirmation modal and the
 * printed/emailed receipt flow.
 */

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import {
  TenderLine,
  SplitPaymentState,
  TENDER_METHODS,
  calculateSplitSummary,
} from "@/services/payment/SplitPaymentService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PaymentBreakdownViewProps {
  /** Order total. */
  orderTotal: number;
  /** The completed tender lines. */
  tenders: TenderLine[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PaymentBreakdownViewInner({
  orderTotal,
  tenders,
}: PaymentBreakdownViewProps) {
  const summary = useMemo(
    () =>
      calculateSplitSummary({
        orderTotal,
        tenders,
      }),
    [orderTotal, tenders]
  );

  return (
    <View style={styles.container} testID="payment-breakdown">
      <Text style={styles.title}>Payment Breakdown</Text>

      {/* Tender lines */}
      {tenders.map((tender, index) => {
        const methodInfo = TENDER_METHODS.find((m) => m.value === tender.method);
        return (
          <View key={tender.id} style={styles.line} testID={`breakdown-line-${index}`}>
            <View style={styles.lineLeft}>
              <Ionicons
                name={(methodInfo?.icon ?? "card-outline") as keyof typeof Ionicons.glyphMap}
                size={16}
                color="#3b82f6"
              />
              <Text style={styles.lineMethod}>{methodInfo?.label ?? tender.method}</Text>
              {tender.reference && (
                <Text style={styles.lineRef}>#{tender.reference.slice(-6)}</Text>
              )}
            </View>
            <Text style={styles.lineAmount}>{formatCurrency(tender.amount)}</Text>
          </View>
        );
      })}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Totals */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Order Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(summary.orderTotal)}</Text>
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Paid</Text>
        <Text style={styles.totalValue}>
          {formatCurrency(summary.totalAllocated)}
        </Text>
      </View>
      {summary.changeDue > 0 && (
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, styles.changeLabel]}>Change Due</Text>
          <Text style={[styles.totalValue, styles.changeValue]}>
            {formatCurrency(summary.changeDue)}
          </Text>
        </View>
      )}
    </View>
  );
}

export const PaymentBreakdownView = React.memo(PaymentBreakdownViewInner);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 16,
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  lineLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lineMethod: {
    color: "#d1d5db",
    fontSize: 14,
    fontWeight: "500",
  },
  lineRef: {
    color: "#6b7280",
    fontSize: 12,
  },
  lineAmount: {
    color: "#f3f4f6",
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#374151",
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalLabel: {
    color: "#9ca3af",
    fontSize: 14,
  },
  totalValue: {
    color: "#f3f4f6",
    fontSize: 16,
    fontWeight: "700",
  },
  changeLabel: { color: "#fbbf24" },
  changeValue: { color: "#fbbf24" },
});
