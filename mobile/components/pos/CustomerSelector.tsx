/**
 * BizPilot Mobile POS — CustomerSelector Component
 *
 * Modal for searching and selecting a customer during checkout.
 * Also supports quick-add for new customers.
 *
 * Why a modal instead of inline in the cart?
 * Customer selection happens ~30% of transactions (many are walk-ins).
 * A modal keeps the cart panel clean and focused for the common case.
 * When a customer IS needed, the full-screen modal gives enough space
 * for search and customer details.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Button, Badge } from "@/components/ui";
import { formatCurrency } from "@/utils/formatters";
import type { MobileCustomer } from "@/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CustomerSelectorProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Called when a customer is selected */
  onSelect: (customer: MobileCustomer) => void;
  /** Called to add a new customer (opens a form) */
  onAddNew?: () => void;
  /** Available customers to search through */
  customers: MobileCustomer[];
  /** Currently selected customer ID (for highlighting) */
  selectedCustomerId?: string | null;
}

// ---------------------------------------------------------------------------
// Customer row
// ---------------------------------------------------------------------------

interface CustomerRowProps {
  customer: MobileCustomer;
  isSelected: boolean;
  onPress: (customer: MobileCustomer) => void;
}

const CustomerRow: React.FC<CustomerRowProps> = React.memo(
  function CustomerRow({ customer, isSelected, onPress }) {
    return (
      <Pressable
        onPress={() => onPress(customer)}
        style={[
          styles.customerRow,
          isSelected && styles.customerRowSelected,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`Select ${customer.name}`}
      >
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {customer.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </Text>
        </View>

        {/* Customer info */}
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{customer.name}</Text>
          <Text style={styles.customerContact}>
            {customer.email ?? customer.phone ?? "No contact info"}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.customerStats}>
          <Badge label={`${customer.loyaltyPoints} pts`} variant="info" />
          <Text style={styles.customerSpent}>
            {formatCurrency(customer.totalSpent)}
          </Text>
        </View>

        {/* Selected indicator */}
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />
        )}
      </Pressable>
    );
  }
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CustomerSelector: React.FC<CustomerSelectorProps> = React.memo(
  function CustomerSelector({
    visible,
    onClose,
    onSelect,
    onAddNew,
    customers,
    selectedCustomerId = null,
  }) {
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
      if (!search.trim()) return customers;
      const q = search.toLowerCase().trim();
      return customers.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q))
      );
    }, [customers, search]);

    const handleSelect = useCallback(
      (customer: MobileCustomer) => {
        onSelect(customer);
        onClose();
        setSearch("");
      },
      [onSelect, onClose]
    );

    const handleClose = useCallback(() => {
      onClose();
      setSearch("");
    }, [onClose]);

    return (
      <Modal visible={visible} onClose={handleClose} title="Select Customer">
        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#6b7280" />
          <TextInput
            placeholder="Search by name, email, or phone..."
            placeholderTextColor="#6b7280"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#6b7280" />
            </Pressable>
          )}
        </View>

        {/* Add new customer button */}
        {onAddNew && (
          <Pressable onPress={onAddNew} style={styles.addNewButton}>
            <Ionicons name="add-circle-outline" size={20} color="#3b82f6" />
            <Text style={styles.addNewText}>Add New Customer</Text>
          </Pressable>
        )}

        {/* Customer list */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={40} color="#374151" />
              <Text style={styles.emptyText}>No customers found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <CustomerRow
              customer={item}
              isSelected={item.id === selectedCustomerId}
              onPress={handleSelect}
            />
          )}
        />

        {/* Walk-in button (remove customer) */}
        <View style={styles.walkInContainer}>
          <Button
            label="Continue as Walk-in"
            onPress={handleClose}
            variant="secondary"
            size="lg"
          />
        </View>
      </Modal>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  addNewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    marginBottom: 8,
  },
  addNewText: {
    color: "#3b82f6",
    fontSize: 15,
    fontWeight: "600",
  },
  list: {
    flex: 1,
    maxHeight: 400,
  },
  listContent: {
    gap: 4,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#1f2937",
  },
  customerRowSelected: {
    backgroundColor: "#1e3a5f",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  customerContact: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 2,
  },
  customerStats: {
    alignItems: "flex-end",
    marginRight: 8,
  },
  customerSpent: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: "#6b7280",
    marginTop: 8,
    fontSize: 14,
  },
  walkInContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#374151",
    marginTop: 8,
  },
});

export default CustomerSelector;
