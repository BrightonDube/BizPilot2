/**
 * BizPilot Mobile POS — Receipt Component
 *
 * Digital receipt display shown after a successful payment.
 * Can be shared via email or printed via Bluetooth thermal printer.
 *
 * Why a digital receipt as a component?
 * Even without a physical printer, the cashier needs visual confirmation
 * that the sale was processed. This receipt doubles as:
 * 1. Immediate visual confirmation for the cashier
 * 2. Share-able digital receipt (email, WhatsApp)
 * 3. Print template for Bluetooth thermal printers
 */

import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Button } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import type { MobileOrder, MobileOrderItem } from "@/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReceiptProps {
  /** Whether the receipt modal is visible */
  visible: boolean;
  /** Called when the receipt modal should close */
  onClose: () => void;
  /** The completed order to display */
  order: MobileOrder;
  /** Order line items */
  items: MobileOrderItem[];
  /** Customer name (null for walk-in) */
  customerName?: string | null;
  /** Business name for receipt header */
  businessName?: string;
  /** Receipt footer text */
  footerText?: string;
  /** Change given (cash payments) */
  change?: number;
  /** Called when "New Sale" is tapped */
  onNewSale: () => void;
  /** Called when "Email Receipt" is tapped */
  onEmailReceipt?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Receipt: React.FC<ReceiptProps> = React.memo(function Receipt({
  visible,
  onClose,
  order,
  items,
  customerName = null,
  businessName = "BizPilot POS",
  footerText = "Thank you for your purchase!",
  change = 0,
  onNewSale,
  onEmailReceipt,
}) {
  return (
    <Modal visible={visible} onClose={onClose} title="Receipt">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Success indicator */}
        <View style={styles.successHeader}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
          </View>
          <Text style={styles.successText}>Payment Successful</Text>
        </View>

        {/* Receipt content */}
        <View style={styles.receiptCard}>
          {/* Business header */}
          <View style={styles.businessHeader}>
            <Text style={styles.businessName}>{businessName}</Text>
            <Text style={styles.receiptDate}>
              {formatDateTime(order.createdAt)}
            </Text>
          </View>

          {/* Order info */}
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>
              Order: {order.orderNumber}
            </Text>
            <Text style={styles.customerLabel}>
              Customer: {customerName ?? "Walk-in"}
            </Text>
            <Text style={styles.paymentMethodLabel}>
              Payment: {order.paymentMethod?.toUpperCase() ?? "—"}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Line items */}
          <View style={styles.itemsSection}>
            {items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.productName}
                  </Text>
                  <Text style={styles.itemDetail}>
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                    {item.discount > 0 &&
                      ` (−${formatCurrency(item.discount)})`}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>
                  {formatCurrency(item.total)}
                </Text>
              </View>
            ))}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Totals */}
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(order.subtotal)}
              </Text>
            </View>

            {order.discountAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.discountLabel}>Discount</Text>
                <Text style={styles.discountValue}>
                  −{formatCurrency(order.discountAmount)}
                </Text>
              </View>
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>VAT (incl.)</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(order.taxAmount)}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>
                {formatCurrency(order.total)}
              </Text>
            </View>

            {change > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.changeLabel}>Change</Text>
                <Text style={styles.changeValue}>
                  {formatCurrency(change)}
                </Text>
              </View>
            )}
          </View>

          {/* Footer */}
          {footerText && (
            <View style={styles.footerSection}>
              <Text style={styles.footerText}>{footerText}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <Button
            label="New Sale"
            onPress={onNewSale}
            size="lg"
          />
          {onEmailReceipt && (
            <Button
              label="Email Receipt"
              onPress={onEmailReceipt}
              variant="secondary"
              size="lg"
            />
          )}
        </View>
      </ScrollView>
    </Modal>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  successHeader: {
    alignItems: "center",
    paddingVertical: 16,
  },
  successIcon: {
    marginBottom: 8,
  },
  successText: {
    color: "#22c55e",
    fontSize: 20,
    fontWeight: "700",
  },
  receiptCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  businessHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  businessName: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  receiptDate: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 4,
  },
  orderInfo: {
    gap: 4,
    marginBottom: 12,
  },
  orderNumber: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  customerLabel: {
    color: "#9ca3af",
    fontSize: 13,
  },
  paymentMethodLabel: {
    color: "#9ca3af",
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: "#374151",
    marginVertical: 12,
  },
  itemsSection: {
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },
  itemDetail: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
  itemTotal: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  totalsSection: {
    gap: 6,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: {
    color: "#9ca3af",
    fontSize: 14,
  },
  totalValue: {
    color: "#ffffff",
    fontSize: 14,
  },
  discountLabel: {
    color: "#f59e0b",
    fontSize: 14,
  },
  discountValue: {
    color: "#f59e0b",
    fontSize: 14,
  },
  grandTotalLabel: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  grandTotalValue: {
    color: "#3b82f6",
    fontSize: 18,
    fontWeight: "700",
  },
  changeLabel: {
    color: "#22c55e",
    fontSize: 14,
  },
  changeValue: {
    color: "#22c55e",
    fontSize: 14,
    fontWeight: "600",
  },
  footerSection: {
    alignItems: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  footerText: {
    color: "#6b7280",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
  },
  actionsContainer: {
    gap: 10,
    paddingBottom: 16,
  },
});

export default Receipt;
