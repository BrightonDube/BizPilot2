/**
 * BizPilot Mobile POS — Customers Screen
 *
 * Customer directory with search, detail panel, and quick-add.
 * Used for customer lookup, loyalty points tracking, and order history.
 *
 * Why a split-pane on tablets?
 * Same rationale as Orders/Products screens: tapping a customer in
 * the list reveals their detail without leaving the screen. This is
 * faster than navigation and matches POS system conventions.
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Card, Badge, Button } from "@/components/ui";
import { formatCurrency } from "@/utils/formatters";
import { QuickAddCustomer } from "@/components/pos";
import { useCustomers } from "@/hooks";
import type { MobileCustomer } from "@/types";

// ---------------------------------------------------------------------------
// CustomerRow sub-component
// ---------------------------------------------------------------------------

interface CustomerRowProps {
  customer: MobileCustomer;
  isSelected: boolean;
  onSelect: (customer: MobileCustomer) => void;
}

const CustomerRow: React.FC<CustomerRowProps> = React.memo(
  function CustomerRow({ customer, isSelected, onSelect }) {
    const handlePress = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(customer);
    }, [customer, onSelect]);

    const initials = customer.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return (
      <Pressable onPress={handlePress}>
        <Card>
          <View
            style={[
              styles.customerRow,
              isSelected && styles.customerRowSelected,
            ]}
          >
            {/* Avatar */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            {/* Info */}
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{customer.name}</Text>
              <Text style={styles.customerContact}>
                {customer.email ?? customer.phone ?? "No contact info"}
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.customerStats}>
              <Badge label={`${customer.loyaltyPoints} pts`} variant="info" />
              <Text style={styles.customerOrders}>
                {customer.visitCount} orders
              </Text>
            </View>
          </View>
        </Card>
      </Pressable>
    );
  }
);

// ---------------------------------------------------------------------------
// CustomerDetail sub-component
// ---------------------------------------------------------------------------

interface CustomerDetailProps {
  customer: MobileCustomer;
}

const CustomerDetail: React.FC<CustomerDetailProps> = React.memo(
  function CustomerDetail({ customer }) {
    return (
      <View style={styles.detailContainer}>
        {/* Header */}
        <View style={styles.detailHeader}>
          <View style={styles.detailAvatar}>
            <Text style={styles.detailAvatarText}>
              {customer.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </Text>
          </View>
          <Text style={styles.detailName}>{customer.name}</Text>
        </View>

        <View style={styles.detailDivider} />

        {/* Contact */}
        {customer.email && (
          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={18} color="#6b7280" />
            <Text style={styles.detailValue}>{customer.email}</Text>
          </View>
        )}
        {customer.phone && (
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={18} color="#6b7280" />
            <Text style={styles.detailValue}>{customer.phone}</Text>
          </View>
        )}
        {customer.address && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={18} color="#6b7280" />
            <Text style={styles.detailValue}>{customer.address}</Text>
          </View>
        )}

        <View style={styles.detailDivider} />

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{customer.loyaltyPoints}</Text>
            <Text style={styles.statLabel}>Loyalty Points</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {formatCurrency(customer.totalSpent)}
            </Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{customer.visitCount}</Text>
            <Text style={styles.statLabel}>Visits</Text>
          </View>
        </View>

        {customer.notes && (
          <>
            <View style={styles.detailDivider} />
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesValue}>{customer.notes}</Text>
            </View>
          </>
        )}

        <View style={styles.detailDivider} />

        <Text style={styles.memberSince}>
          Customer since{" "}
          {new Date(customer.createdAt).toLocaleDateString("en-ZA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </Text>
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Main Customers Screen
// ---------------------------------------------------------------------------

export default function CustomersScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<MobileCustomer | null>(null);
  const [quickAddVisible, setQuickAddVisible] = useState(false);

  const { customers, loading: isLoading } = useCustomers({ searchQuery: search });

  const handleSelectCustomer = useCallback((customer: MobileCustomer) => {
    setSelectedCustomer(customer);
  }, []);

  const handleQuickAdd = useCallback(
    (data: { name: string; phone: string | null; email: string | null }) => {
      // TODO: Save to WatermelonDB + sync queue
      setQuickAddVisible(false);
    },
    []
  );

  const renderCustomer = useCallback(
    ({ item }: { item: MobileCustomer }) => (
      <CustomerRow
        customer={item}
        isSelected={selectedCustomer?.id === item.id}
        onSelect={handleSelectCustomer}
      />
    ),
    [selectedCustomer, handleSelectCustomer]
  );

  const keyExtractor = useCallback((item: MobileCustomer) => item.id, []);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Customers</Text>
          <Text style={styles.headerCount}>{customers.length} customers</Text>
        </View>
        <Button
          label="+ Add"
          onPress={() => setQuickAddVisible(true)}
          size="sm"
        />
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#6b7280" />
          <TextInput
            placeholder="Search by name, email, or phone..."
            placeholderTextColor="#6b7280"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#6b7280" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Content: list + detail */}
      <View style={styles.content}>
        <FlatList
          data={customers}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          style={isTablet ? styles.listTablet : styles.listFull}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#374151" />
              <Text style={styles.emptyText}>
                {isLoading ? "Loading customers..." : "No customers found"}
              </Text>
            </View>
          }
          renderItem={renderCustomer}
        />

        {/* Detail panel (tablet only) */}
        {isTablet && (
          <View style={styles.detailPanel}>
            {selectedCustomer ? (
              <CustomerDetail customer={selectedCustomer} />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="person-outline" size={48} color="#374151" />
                <Text style={styles.emptyText}>
                  Select a customer to view details
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Quick Add Customer Modal */}
      <QuickAddCustomer
        visible={quickAddVisible}
        onClose={() => setQuickAddVisible(false)}
        onSave={handleQuickAdd}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#1f2937",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  headerCount: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 2,
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  content: {
    flex: 1,
    flexDirection: "row",
  },
  listFull: {
    flex: 1,
  },
  listTablet: {
    flex: 1,
    maxWidth: 460,
  },
  listContent: {
    padding: 12,
    gap: 8,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  customerRowSelected: {
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 16,
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
  },
  customerStats: {
    alignItems: "flex-end",
    gap: 4,
  },
  customerOrders: {
    color: "#6b7280",
    fontSize: 12,
  },
  detailPanel: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: "#374151",
  },
  detailContainer: {
    padding: 20,
    gap: 16,
  },
  detailHeader: {
    alignItems: "center",
    gap: 12,
  },
  detailAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  detailAvatarText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
  },
  detailName: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailValue: {
    color: "#d1d5db",
    fontSize: 15,
  },
  detailDivider: {
    height: 1,
    backgroundColor: "#374151",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  statValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 4,
  },
  notesBox: {
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 12,
  },
  notesLabel: {
    color: "#6b7280",
    fontSize: 12,
    marginBottom: 4,
  },
  notesValue: {
    color: "#d1d5db",
    fontSize: 14,
  },
  memberSince: {
    color: "#4b5563",
    fontSize: 12,
    textAlign: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
  },
});
