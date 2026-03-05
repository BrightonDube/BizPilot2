/**
 * QuoteCreationForm — form for creating a new proforma invoice / quote.
 *
 * Collects customer, line items (from a product catalogue), validity period,
 * and notes. Totals auto-update as items are added or adjusted.
 *
 * Why ScrollView instead of FlatList?
 * The form has mixed content (selectors, inputs, dynamic item rows, totals).
 * ScrollView handles keyboard avoidance on tablets and keeps the submit
 * button reachable without dismissing the keyboard.
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
  Modal,
  FlatList,
  ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { triggerHaptic } from "@/utils/haptics";
import {
  calculateLineItem,
  calculateQuoteTotals,
  QuoteLineItem,
} from "@/services/quotes/QuoteService";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Product {
  id: string;
  name: string;
  price: number;
  taxRate: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
}

export interface QuoteCreationFormProps {
  customers: Customer[];
  products: Product[];
  onSubmit: (data: {
    customerId: string;
    items: Array<{ productId: string; quantity: number; discount: number }>;
    notes: string;
    validDays: number;
  }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface LineItemState {
  productId: string;
  productName: string;
  unitPrice: number;
  taxRate: number;
  quantity: number;
  discountRaw: string; // raw text so the user can type freely
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALIDITY_OPTIONS = [7, 14, 30, 60, 90] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function QuoteCreationFormInner({
  customers,
  products,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: QuoteCreationFormProps) {
  // --- State ---
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  const [lineItems, setLineItems] = useState<LineItemState[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const [validDays, setValidDays] = useState<number>(30);
  const [notes, setNotes] = useState("");

  // --- Derived ---

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase().trim();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  /** Calculated line items for totals display. */
  const calculatedItems: QuoteLineItem[] = useMemo(
    () =>
      lineItems.map((li) => {
        const discount = parseFloat(li.discountRaw) || 0;
        return {
          ...calculateLineItem(
            li.productName,
            li.quantity,
            li.unitPrice,
            Math.min(100, Math.max(0, discount)),
            li.taxRate
          ),
          id: li.productId,
          productId: li.productId,
        };
      }),
    [lineItems]
  );

  const totals = useMemo(
    () => calculateQuoteTotals(calculatedItems),
    [calculatedItems]
  );

  const canSubmit =
    !!selectedCustomerId && lineItems.length > 0 && !isSubmitting;

  // --- Handlers ---

  const handleSelectCustomer = useCallback(
    (customer: Customer) => {
      triggerHaptic("selection");
      setSelectedCustomerId(customer.id);
      setShowCustomerPicker(false);
      setCustomerSearch("");
    },
    []
  );

  const handleAddProduct = useCallback(
    (product: Product) => {
      triggerHaptic("tap");
      setLineItems((prev) => [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          taxRate: product.taxRate,
          quantity: 1,
          discountRaw: "0",
        },
      ]);
      setShowProductPicker(false);
      setProductSearch("");
    },
    []
  );

  const handleRemoveItem = useCallback((index: number) => {
    triggerHaptic("warning");
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleQuantityChange = useCallback(
    (index: number, delta: number) => {
      triggerHaptic("selection");
      setLineItems((prev) =>
        prev.map((item, i) =>
          i === index
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item
        )
      );
    },
    []
  );

  const handleDiscountChange = useCallback(
    (index: number, value: string) => {
      setLineItems((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, discountRaw: value } : item
        )
      );
    },
    []
  );

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    triggerHaptic("success");

    onSubmit({
      customerId: selectedCustomerId,
      items: lineItems.map((li) => ({
        productId: li.productId,
        quantity: li.quantity,
        discount: Math.min(100, Math.max(0, parseFloat(li.discountRaw) || 0)),
      })),
      notes: notes.trim(),
      validDays,
    });
  }, [canSubmit, selectedCustomerId, lineItems, notes, validDays, onSubmit]);

  const handleCancel = useCallback(() => {
    triggerHaptic("tap");
    onCancel();
  }, [onCancel]);

  // --- Sub-renders ---

  const renderCustomerOption = useCallback(
    ({ item }: ListRenderItemInfo<Customer>) => (
      <TouchableOpacity
        style={styles.pickerOption}
        onPress={() => handleSelectCustomer(item)}
      >
        <Text style={styles.pickerOptionText}>{item.name}</Text>
        {item.email && (
          <Text style={styles.pickerOptionSub}>{item.email}</Text>
        )}
      </TouchableOpacity>
    ),
    [handleSelectCustomer]
  );

  const renderProductOption = useCallback(
    ({ item }: ListRenderItemInfo<Product>) => (
      <TouchableOpacity
        style={styles.pickerOption}
        onPress={() => handleAddProduct(item)}
      >
        <Text style={styles.pickerOptionText}>{item.name}</Text>
        <Text style={styles.pickerOptionSub}>
          {formatCurrency(item.price)}
        </Text>
      </TouchableOpacity>
    ),
    [handleAddProduct]
  );

  // --- Render ---

  return (
    <View style={styles.container} testID="quote-form">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Quote</Text>
        <TouchableOpacity onPress={handleCancel} hitSlop={12}>
          <Ionicons name="close" size={28} color="#f3f4f6" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---- Customer Selector ---- */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>
            Customer <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.selectorButton}
            onPress={() => setShowCustomerPicker(true)}
            testID="quote-customer-select"
          >
            <Text
              style={
                selectedCustomer
                  ? styles.selectorValue
                  : styles.selectorPlaceholder
              }
            >
              {selectedCustomer?.name ?? "Select a customer…"}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* ---- Line Items ---- */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>
            Items <Text style={styles.required}>*</Text>
          </Text>

          {lineItems.map((li, index) => {
            const calc = calculatedItems[index];
            return (
              <View
                key={`${li.productId}-${index}`}
                style={styles.lineItemCard}
                testID={`quote-line-item-${index}`}
              >
                <View style={styles.lineHeader}>
                  <View style={styles.lineHeaderLeft}>
                    <Text style={styles.lineProductName}>{li.productName}</Text>
                    <Text style={styles.lineUnitPrice}>
                      {formatCurrency(li.unitPrice)} each
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveItem(index)}
                    hitSlop={12}
                    testID={`quote-line-remove-${index}`}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                <View style={styles.lineControls}>
                  {/* Quantity stepper */}
                  <View
                    style={styles.stepperContainer}
                    testID={`quote-line-qty-${index}`}
                  >
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleQuantityChange(index, -1)}
                    >
                      <Ionicons name="remove" size={18} color="#f3f4f6" />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{li.quantity}</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleQuantityChange(index, 1)}
                    >
                      <Ionicons name="add" size={18} color="#f3f4f6" />
                    </TouchableOpacity>
                  </View>

                  {/* Discount input */}
                  <View style={styles.discountContainer}>
                    <TextInput
                      style={styles.discountInput}
                      value={li.discountRaw}
                      onChangeText={(v) => handleDiscountChange(index, v)}
                      keyboardType="decimal-pad"
                      maxLength={5}
                      testID={`quote-line-discount-${index}`}
                    />
                    <Text style={styles.discountLabel}>% off</Text>
                  </View>

                  {/* Line total */}
                  <Text style={styles.lineTotal}>
                    {calc ? formatCurrency(calc.lineTotal + calc.lineTax) : "—"}
                  </Text>
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.addItemButton}
            onPress={() => setShowProductPicker(true)}
            testID="quote-add-item-btn"
          >
            <Ionicons name="add-circle-outline" size={20} color="#3b82f6" />
            <Text style={styles.addItemText}>Add Item</Text>
          </TouchableOpacity>
        </View>

        {/* ---- Totals ---- */}
        <View style={styles.totalsCard} testID="quote-totals">
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(totals.subtotal)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Discount</Text>
            <Text style={[styles.totalsValue, { color: "#f59e0b" }]}>
              −{formatCurrency(totals.totalDiscount)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Tax</Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(totals.totalTax)}
            </Text>
          </View>
          <View style={[styles.totalsRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(totals.grandTotal)}
            </Text>
          </View>
        </View>

        {/* ---- Validity Picker ---- */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Valid For</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            {VALIDITY_OPTIONS.map((days) => {
              const isActive = validDays === days;
              return (
                <TouchableOpacity
                  key={days}
                  style={[styles.pill, isActive && styles.pillActive]}
                  onPress={() => {
                    triggerHaptic("selection");
                    setValidDays(days);
                  }}
                  testID="quote-validity-select"
                >
                  <Text
                    style={[
                      styles.pillText,
                      isActive && styles.pillTextActive,
                    ]}
                  >
                    {days} days
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ---- Notes ---- */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes for this quote…"
            placeholderTextColor="#6b7280"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            testID="quote-notes-input"
          />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          testID="quote-cancel-btn"
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          testID="quote-submit-btn"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Create Quote</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ---- Customer Picker Modal ---- */}
      <Modal
        visible={showCustomerPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCustomerPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity
                onPress={() => setShowCustomerPicker(false)}
                hitSlop={12}
              >
                <Ionicons name="close" size={24} color="#f3f4f6" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={18} color="#6b7280" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search customers…"
                placeholderTextColor="#6b7280"
                value={customerSearch}
                onChangeText={setCustomerSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredCustomers}
              renderItem={renderCustomerOption}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>No customers found</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* ---- Product Picker Modal ---- */}
      <Modal
        visible={showProductPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowProductPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Product</Text>
              <TouchableOpacity
                onPress={() => setShowProductPicker(false)}
                hitSlop={12}
              >
                <Ionicons name="close" size={24} color="#f3f4f6" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={18} color="#6b7280" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search products…"
                placeholderTextColor="#6b7280"
                value={productSearch}
                onChangeText={setProductSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredProducts}
              renderItem={renderProductOption}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>No products found</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const QuoteCreationForm = React.memo(QuoteCreationFormInner);
export default QuoteCreationForm;

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
  fieldLabel: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 8,
    fontWeight: "500",
  },
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
  notesInput: { minHeight: 80 },

  /* Customer selector */
  selectorButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#374151",
    minHeight: 48,
  },
  selectorValue: { color: "#f3f4f6", fontSize: 16 },
  selectorPlaceholder: { color: "#6b7280", fontSize: 16 },

  /* Line items */
  lineItemCard: {
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  lineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  lineHeaderLeft: { flex: 1, marginRight: 12 },
  lineProductName: { color: "#f3f4f6", fontSize: 15, fontWeight: "600" },
  lineUnitPrice: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  lineControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  /* Quantity stepper */
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 8,
    overflow: "hidden",
  },
  stepperBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    color: "#f3f4f6",
    fontSize: 16,
    fontWeight: "700",
    minWidth: 32,
    textAlign: "center",
  },

  /* Discount */
  discountContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  discountInput: {
    backgroundColor: "#1f2937",
    color: "#f3f4f6",
    borderRadius: 8,
    width: 56,
    height: 36,
    textAlign: "center",
    fontSize: 14,
  },
  discountLabel: { color: "#6b7280", fontSize: 12 },

  lineTotal: { color: "#f3f4f6", fontSize: 16, fontWeight: "700" },

  /* Add item button */
  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderStyle: "dashed",
    minHeight: 48,
  },
  addItemText: { color: "#3b82f6", fontSize: 14, fontWeight: "600" },

  /* Totals */
  totalsCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  totalsLabel: { color: "#9ca3af", fontSize: 14 },
  totalsValue: { color: "#f3f4f6", fontSize: 14 },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 10,
    marginBottom: 0,
  },
  grandTotalLabel: { color: "#f3f4f6", fontSize: 16, fontWeight: "700" },
  grandTotalValue: { color: "#22c55e", fontSize: 20, fontWeight: "700" },

  /* Validity pills */
  pillRow: { gap: 8, paddingVertical: 4 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    minHeight: 44,
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

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  modalTitle: { color: "#f3f4f6", fontSize: 18, fontWeight: "700" },
  modalSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 12,
    margin: 16,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 15,
    paddingVertical: 10,
  },
  modalEmpty: {
    color: "#6b7280",
    textAlign: "center",
    paddingVertical: 24,
    fontSize: 14,
  },
  pickerOption: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  pickerOptionText: { color: "#f3f4f6", fontSize: 16 },
  pickerOptionSub: { color: "#6b7280", fontSize: 13, marginTop: 2 },
});
