/**
 * ReceiptView — post-payment receipt display and action screen.
 *
 * Renders a receipt card styled to resemble a printed POS slip: white
 * background, centred business header, dotted separators, line-item table,
 * totals block, payment info, and a "Thank you!" footer.
 *
 * Why white background on the receipt card?
 * Receipts are typically printed on white paper. Using a white card inside
 * the dark app chrome makes the receipt feel tangible and improves
 * readability of monetary figures during hand-off to the customer.
 *
 * Why separate Print / Email / New Sale buttons?
 * Post-payment is the decision point: the cashier either gives a physical
 * receipt, emails one, or starts the next sale. Showing all three as
 * equal-weight actions reduces taps for any workflow.
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
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

/** A single product/service line on the receipt. */
export interface ReceiptLineItem {
  /** Display name of the item */
  name: string;
  /** Number of units sold */
  quantity: number;
  /** Price per unit before any line-level discount */
  unitPrice: number;
  /** Line total (quantity × unitPrice, post-discount if applicable) */
  total: number;
}

export interface ReceiptViewProps {
  /** Unique receipt / invoice number */
  receiptNumber: string;
  /** Trading name displayed at the top */
  businessName: string;
  /** Physical or registered address */
  businessAddress: string;
  /** Date string (e.g. "2024-07-15") */
  date: string;
  /** Time string (e.g. "14:32") */
  time: string;
  /** Name of the cashier who processed the sale */
  cashierName: string;
  /** Line items on the receipt */
  items: ReceiptLineItem[];
  /** Sum of line totals before tax */
  subtotal: number;
  /** Tax amount in currency */
  taxAmount: number;
  /** Tax rate as a percentage (e.g. 15) */
  taxRate: number;
  /** Grand total (subtotal + tax) */
  total: number;
  /** Human-readable payment method label (e.g. "Cash") */
  paymentMethod: string;
  /** Amount tendered by the customer */
  amountPaid: number;
  /** Change returned to the customer */
  changeGiven: number;
  /** Called to trigger receipt printing */
  onPrint: () => void;
  /** Called to trigger emailing the receipt */
  onEmail: () => void;
  /** Called to clear the sale and start fresh */
  onNewSale: () => void;
  /** When true, shows a spinner on the print button */
  isPrinting?: boolean;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Dotted line separator mimicking a thermal-printer cut. */
const Separator: React.FC = () => <View style={styles.separator} />;

interface LineItemRowProps {
  item: ReceiptLineItem;
  index: number;
}

/**
 * Single line-item row.
 * Why show "qty × price" explicitly?
 * Staff and customers both glance at the receipt to verify quantities;
 * showing the breakdown prevents disputes.
 */
const LineItemRow = React.memo(function LineItemRow({
  item,
  index,
}: LineItemRowProps) {
  return (
    <View style={styles.lineItem} testID={`receipt-item-${index}`}>
      <View style={styles.lineItemLeft}>
        <Text style={styles.lineItemName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.lineItemQty}>
          {item.quantity} × {formatCurrency(item.unitPrice)}
        </Text>
      </View>
      <Text style={styles.lineItemTotal}>{formatCurrency(item.total)}</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ReceiptView: React.FC<ReceiptViewProps> = React.memo(
  function ReceiptView({
    receiptNumber,
    businessName,
    businessAddress,
    date,
    time,
    cashierName,
    items,
    subtotal,
    taxAmount,
    taxRate,
    total,
    paymentMethod,
    amountPaid,
    changeGiven,
    onPrint,
    onEmail,
    onNewSale,
    isPrinting = false,
  }) {
    const handlePrint = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPrint();
    }, [onPrint]);

    const handleEmail = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onEmail();
    }, [onEmail]);

    const handleNewSale = useCallback(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onNewSale();
    }, [onNewSale]);

    return (
      <ScrollView
        testID="receipt-view"
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ================ Receipt card ================ */}
        <View style={styles.receiptCard}>
          {/* -- Business header -- */}
          <View testID="receipt-business" style={styles.businessHeader}>
            <Text style={styles.businessName}>{businessName}</Text>
            <Text style={styles.businessAddress}>{businessAddress}</Text>
          </View>

          <Separator />

          {/* -- Receipt meta -- */}
          <View style={styles.metaSection}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Receipt #</Text>
              <Text testID="receipt-number" style={styles.metaValue}>
                {receiptNumber}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>
                {date}  {time}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Cashier</Text>
              <Text style={styles.metaValue}>{cashierName}</Text>
            </View>
          </View>

          <Separator />

          {/* -- Line items -- */}
          <View testID="receipt-items" style={styles.itemsSection}>
            {/* Column headings */}
            <View style={styles.itemHeader}>
              <Text style={styles.itemHeaderText}>Item</Text>
              <Text style={styles.itemHeaderText}>Total</Text>
            </View>

            {items.map((item, idx) => (
              <LineItemRow key={idx} item={item} index={idx} />
            ))}
          </View>

          <Separator />

          {/* -- Totals block -- */}
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Subtotal</Text>
              <Text testID="receipt-subtotal" style={styles.totalRowValue}>
                {formatCurrency(subtotal)}
              </Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>
                Tax ({taxRate}%)
              </Text>
              <Text testID="receipt-tax" style={styles.totalRowValue}>
                {formatCurrency(taxAmount)}
              </Text>
            </View>

            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>TOTAL</Text>
              <Text testID="receipt-total" style={styles.grandTotalValue}>
                {formatCurrency(total)}
              </Text>
            </View>
          </View>

          <Separator />

          {/* -- Payment info -- */}
          <View style={styles.paymentSection}>
            <View testID="receipt-payment" style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Payment</Text>
              <Text style={styles.totalRowValue}>
                {paymentMethod} — {formatCurrency(amountPaid)}
              </Text>
            </View>

            <View testID="receipt-change" style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Change</Text>
              <Text style={styles.totalRowValue}>
                {formatCurrency(changeGiven)}
              </Text>
            </View>
          </View>

          <Separator />

          {/* -- Thank you footer -- */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Thank you for your purchase!</Text>
          </View>
        </View>

        {/* ================ Action buttons ================ */}
        <View style={styles.actions}>
          {/* Print */}
          <Pressable
            testID="receipt-print"
            accessibilityRole="button"
            accessibilityLabel="Print receipt"
            onPress={handlePrint}
            style={[styles.actionBtn, styles.printBtn]}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons
                  name="print-outline"
                  size={20}
                  color="#fff"
                  style={styles.actionIcon}
                />
                <Text style={styles.actionText}>Print</Text>
              </>
            )}
          </Pressable>

          {/* Email */}
          <Pressable
            testID="receipt-email"
            accessibilityRole="button"
            accessibilityLabel="Email receipt"
            onPress={handleEmail}
            style={[styles.actionBtn, styles.emailBtn]}
          >
            <Ionicons
              name="mail-outline"
              size={20}
              color="#fff"
              style={styles.actionIcon}
            />
            <Text style={styles.actionText}>Email</Text>
          </Pressable>

          {/* New sale */}
          <Pressable
            testID="receipt-new-sale"
            accessibilityRole="button"
            accessibilityLabel="Start new sale"
            onPress={handleNewSale}
            style={[styles.actionBtn, styles.newSaleBtn]}
          >
            <Ionicons
              name="add-circle-outline"
              size={20}
              color="#fff"
              style={styles.actionIcon}
            />
            <Text style={styles.actionText}>New Sale</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  },
);

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
    paddingBottom: 32,
  },

  // -- Receipt card (white for readability) --
  receiptCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    /**
     * Why elevation + shadow?
     * Gives the card a lifted "paper" feel on both Android (elevation)
     * and iOS (shadow*) so it pops off the dark background.
     */
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },

  // -- Business header --
  businessHeader: {
    alignItems: "center",
    marginBottom: 12,
  },
  businessName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  businessAddress: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },

  // -- Separator --
  separator: {
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    marginVertical: 12,
  },

  // -- Meta --
  metaSection: {
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  metaValue: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "500",
  },

  // -- Line items --
  itemsSection: {},
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  itemHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  lineItemLeft: {
    flex: 1,
    marginRight: 12,
  },
  lineItemName: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "500",
  },
  lineItemQty: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  lineItemTotal: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
  },

  // -- Totals --
  totalsSection: {
    gap: 6,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalRowLabel: {
    fontSize: 13,
    color: "#6b7280",
  },
  totalRowValue: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "500",
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },

  // -- Payment info --
  paymentSection: {
    gap: 6,
  },

  // -- Footer --
  footer: {
    alignItems: "center",
    paddingTop: 4,
  },
  footerText: {
    fontSize: 13,
    color: "#6b7280",
    fontStyle: "italic",
  },

  // -- Action buttons --
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
  },
  printBtn: {
    backgroundColor: "#3b82f6",
  },
  emailBtn: {
    backgroundColor: "#8b5cf6",
  },
  newSaleBtn: {
    backgroundColor: "#22c55e",
  },
  actionIcon: {
    marginRight: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default ReceiptView;
