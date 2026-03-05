/**
 * AccountListScreen — searchable list of customer accounts for POS.
 * (customer-accounts task 13.1)
 *
 * Layout: Search bar at top, FlatList of account cards below.
 * Each card shows customer name, balance, credit utilisation, status.
 *
 * Why FlatList?
 * A business may have hundreds of credit accounts. FlatList virtualises
 * the list so only visible rows are rendered.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import {
  CustomerAccount,
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_COLORS,
  searchAccounts,
  sortAccountsByBalance,
} from "@/services/accounts/CustomerAccountService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AccountListScreenProps {
  accounts: CustomerAccount[];
  onSelectAccount: (account: CustomerAccount) => void;
  onCreateAccount?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function AccountListScreenInner({
  accounts,
  onSelectAccount,
  onCreateAccount,
}: AccountListScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAccounts = useMemo(() => {
    const searched = searchAccounts(accounts, searchQuery);
    return sortAccountsByBalance(searched);
  }, [accounts, searchQuery]);

  const renderAccount = useCallback(
    ({ item }: ListRenderItemInfo<CustomerAccount>) => {
      const statusColor = ACCOUNT_STATUS_COLORS[item.status];
      const utilisation =
        item.creditLimit > 0
          ? Math.min(100, Math.round((item.currentBalance / item.creditLimit) * 100))
          : 0;

      return (
        <TouchableOpacity
          style={styles.accountCard}
          onPress={() => onSelectAccount(item)}
          testID={`account-card-${item.id}`}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.customerName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.customerName}>{item.customerName}</Text>
                {item.customerPhone && (
                  <Text style={styles.customerPhone}>{item.customerPhone}</Text>
                )}
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {ACCOUNT_STATUS_LABELS[item.status]}
              </Text>
            </View>
          </View>

          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Balance</Text>
              <Text style={styles.balanceValue}>
                {formatCurrency(item.currentBalance)}
              </Text>
            </View>
            <View style={styles.creditBar}>
              <Text style={styles.creditLabel}>
                {utilisation}% of {formatCurrency(item.creditLimit)}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${utilisation}%` as unknown as number,
                      backgroundColor: utilisation > 80 ? "#ef4444" : utilisation > 50 ? "#fbbf24" : "#22c55e",
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [onSelectAccount]
  );

  const keyExtractor = useCallback((item: CustomerAccount) => item.id, []);

  return (
    <View style={styles.container} testID="account-list-screen">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Customer Accounts</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerCount}>{filteredAccounts.length} accounts</Text>
          {onCreateAccount && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={onCreateAccount}
              testID="create-account-button"
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or phone..."
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="account-search-input"
        />
      </View>

      {/* List */}
      <FlatList
        data={filteredAccounts}
        renderItem={renderAccount}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#4b5563" />
            <Text style={styles.emptyText}>No accounts found</Text>
          </View>
        }
        testID="account-list"
      />
    </View>
  );
}

export const AccountListScreen = React.memo(AccountListScreenInner);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerCount: { fontSize: 14, color: "#9ca3af" },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 10,
    paddingHorizontal: 14,
    margin: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 16,
    paddingVertical: 12,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyState: { alignItems: "center", paddingVertical: 64 },
  emptyText: { color: "#6b7280", fontSize: 16, marginTop: 12 },
  /* Account card */
  accountCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#f3f4f6", fontSize: 18, fontWeight: "700" },
  customerName: { color: "#f3f4f6", fontSize: 16, fontWeight: "600" },
  customerPhone: { color: "#6b7280", fontSize: 13 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  balanceLabel: { color: "#6b7280", fontSize: 12 },
  balanceValue: { color: "#f3f4f6", fontSize: 20, fontWeight: "700" },
  creditBar: { flex: 1, marginLeft: 24, gap: 4 },
  creditLabel: { color: "#9ca3af", fontSize: 12, textAlign: "right" },
  barTrack: {
    height: 6,
    backgroundColor: "#374151",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: { height: 6, borderRadius: 3 },
});
