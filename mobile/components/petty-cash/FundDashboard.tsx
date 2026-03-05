/**
 * BizPilot Mobile POS — Petty Cash Fund Dashboard
 *
 * Overview screen showing all petty cash funds with balances, utilisation,
 * and quick-action buttons. Tablet-first layout with a FlatList of fund
 * cards beneath aggregate summary tiles.
 *
 * Why a utilisation bar?
 * Custodians need an at-a-glance feel for how much of each fund has been
 * consumed so they can request top-ups before running dry.
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PettyCashFund {
  id: string;
  name: string;
  currentBalance: number;
  availableBalance: number;
  initialBalance: number;
  singleExpenseLimit: number;
  dailyExpenseLimit: number;
  status: "active" | "frozen" | "closed";
  custodianName: string;
  lastReconciledAt: string | null;
}

interface FundDashboardProps {
  funds: PettyCashFund[];
  totalBalance: number;
  pendingRequestsCount: number;
  onFundPress: (fundId: string) => void;
  onNewRequest: () => void;
  onReconcile: (fundId: string) => void;
  onBack: () => void;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<PettyCashFund["status"], string> = {
  active: "#22c55e",
  frozen: "#fbbf24",
  closed: "#ef4444",
};

const STATUS_LABELS: Record<PettyCashFund["status"], string> = {
  active: "Active",
  frozen: "Frozen",
  closed: "Closed",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Coloured pill showing fund status. */
const StatusBadge = React.memo(function StatusBadge({
  status,
}: {
  status: PettyCashFund["status"];
}) {
  return (
    <View style={[styles.badge, { backgroundColor: `${STATUS_COLORS[status]}20` }]}>
      <View style={[styles.badgeDot, { backgroundColor: STATUS_COLORS[status] }]} />
      <Text style={[styles.badgeText, { color: STATUS_COLORS[status] }]}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
});

/** Thin horizontal bar showing balance utilisation. */
const UtilisationBar = React.memo(function UtilisationBar({
  current,
  initial,
}: {
  current: number;
  initial: number;
}) {
  // Why clamp? Rounding or manual adjustments can push ratio beyond 0-1.
  const ratio = initial > 0 ? Math.min(Math.max(current / initial, 0), 1) : 0;
  const color = ratio > 0.5 ? "#22c55e" : ratio > 0.2 ? "#fbbf24" : "#ef4444";

  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * @param props {@link FundDashboardProps}
 * @returns Fund overview dashboard with summary cards and fund list
 */
function FundDashboardComponent({
  funds,
  totalBalance,
  pendingRequestsCount,
  onFundPress,
  onNewRequest,
  onReconcile,
  onBack,
  isLoading = false,
}: FundDashboardProps) {
  // ---- callbacks ----

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  const handleNewRequest = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNewRequest();
  }, [onNewRequest]);

  const handleFundPress = useCallback(
    (fundId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onFundPress(fundId);
    },
    [onFundPress],
  );

  const handleReconcile = useCallback(
    (fundId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onReconcile(fundId);
    },
    [onReconcile],
  );

  // ---- renderers ----

  const renderFund = useCallback(
    ({ item }: { item: PettyCashFund }) => {
      const reconciledLabel = item.lastReconciledAt
        ? new Date(item.lastReconciledAt).toLocaleDateString()
        : "Never reconciled";

      return (
        <View testID={`fund-card-${item.id}`} style={styles.card}>
          {/* Top row: name + status */}
          <View style={styles.cardHeader}>
            <Text style={styles.fundName} numberOfLines={1}>
              {item.name}
            </Text>
            <StatusBadge status={item.status} />
          </View>

          {/* Balance + utilisation */}
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceValue}>{formatCurrency(item.currentBalance)}</Text>
          <UtilisationBar current={item.currentBalance} initial={item.initialBalance} />

          {/* Available balance */}
          <View style={styles.row}>
            <Text style={styles.detailLabel}>Available</Text>
            <Text style={styles.detailValue}>{formatCurrency(item.availableBalance)}</Text>
          </View>

          {/* Custodian */}
          <View style={styles.row}>
            <Text style={styles.detailLabel}>Custodian</Text>
            <Text style={styles.detailValue}>{item.custodianName}</Text>
          </View>

          {/* Last reconciled */}
          <View style={styles.row}>
            <Text style={styles.detailLabel}>Last Reconciled</Text>
            <Text
              style={[
                styles.detailValue,
                !item.lastReconciledAt && { color: "#fbbf24" },
              ]}
            >
              {reconciledLabel}
            </Text>
          </View>

          {/* Limits */}
          <View style={styles.limitsRow}>
            <View style={styles.limitChip}>
              <Ionicons name="card-outline" size={12} color="#9ca3af" />
              <Text style={styles.limitText}>
                Single: {formatCurrency(item.singleExpenseLimit)}
              </Text>
            </View>
            <View style={styles.limitChip}>
              <Ionicons name="calendar-outline" size={12} color="#9ca3af" />
              <Text style={styles.limitText}>
                Daily: {formatCurrency(item.dailyExpenseLimit)}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => handleFundPress(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="eye-outline" size={16} color="#3b82f6" />
              <Text style={styles.viewBtnText}>View</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`fund-reconcile-${item.id}`}
              style={styles.reconcileBtn}
              onPress={() => handleReconcile(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-done-outline" size={16} color="#22c55e" />
              <Text style={styles.reconcileBtnText}>Reconcile</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [handleFundPress, handleReconcile],
  );

  const keyExtractor = useCallback((item: PettyCashFund) => item.id, []);

  // ---- header / summary ----

  const ListHeader = (
    <View style={styles.summaryContainer}>
      <View testID="fund-total-balance" style={styles.summaryCard}>
        <Ionicons name="wallet-outline" size={24} color="#22c55e" />
        <Text style={styles.summaryLabel}>Total Balance</Text>
        <Text style={styles.summaryValue}>{formatCurrency(totalBalance)}</Text>
      </View>
      <View style={styles.summaryCard}>
        <Ionicons name="time-outline" size={24} color="#fbbf24" />
        <Text style={styles.summaryLabel}>Pending Requests</Text>
        <Text style={styles.summaryValue}>{pendingRequestsCount}</Text>
      </View>
    </View>
  );

  // ---- loading state ----

  if (isLoading) {
    return (
      <View testID="fund-loading" style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading funds…</Text>
      </View>
    );
  }

  // ---- empty state ----

  const ListEmpty = (
    <View testID="fund-empty" style={styles.centered}>
      <Ionicons name="folder-open-outline" size={48} color="#6b7280" />
      <Text style={styles.emptyText}>No petty cash funds</Text>
      <Text style={styles.emptySubtext}>Create a fund to get started.</Text>
    </View>
  );

  // ---- main render ----

  return (
    <View testID="fund-dashboard" style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="fund-back-btn"
          onPress={handleBack}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#f3f4f6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Petty Cash</Text>
        <TouchableOpacity
          testID="fund-new-request-btn"
          style={styles.newRequestBtn}
          onPress={handleNewRequest}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={18} color="#ffffff" />
          <Text style={styles.newRequestBtnText}>New Request</Text>
        </TouchableOpacity>
      </View>

      {/* Fund list */}
      <FlatList
        data={funds}
        renderItem={renderFund}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#1f2937",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  newRequestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newRequestBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },

  // Summary
  summaryContainer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#374151",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },

  // List
  listContent: {
    paddingBottom: 32,
  },

  // Card
  card: {
    backgroundColor: "#1f2937",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  fundName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
    flex: 1,
    marginRight: 8,
  },

  // Badge
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Balance
  balanceLabel: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 2,
  },
  balanceValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 8,
  },

  // Utilisation bar
  barTrack: {
    height: 6,
    backgroundColor: "#374151",
    borderRadius: 3,
    marginBottom: 12,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Detail rows
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: "#9ca3af",
  },
  detailValue: {
    fontSize: 13,
    color: "#f3f4f6",
    fontWeight: "500",
  },

  // Limits
  limitsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  limitChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#111827",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  limitText: {
    fontSize: 11,
    color: "#9ca3af",
  },

  // Actions
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 12,
  },
  viewBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#3b82f620",
    paddingVertical: 10,
    borderRadius: 8,
  },
  viewBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
  },
  reconcileBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#22c55e20",
    paddingVertical: 10,
    borderRadius: 8,
  },
  reconcileBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#22c55e",
  },

  // States
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  emptySubtext: {
    fontSize: 13,
    color: "#6b7280",
  },
});

export default React.memo(FundDashboardComponent) as typeof FundDashboardComponent;
