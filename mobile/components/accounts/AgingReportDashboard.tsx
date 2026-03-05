/**
 * AgingReportDashboard — Accounts-receivable aging report for the POS system.
 *
 * Layout (top → bottom, inside a FlatList with ListHeaderComponent):
 *   1. Header — back button, "Aging Report" title, report date, refresh button
 *   2. Summary Cards Row — horizontal ScrollView of five bucket cards
 *      (Current / 1-30 / 31-60 / 61-90 / 90+) with percentage bars
 *   3. Total AR Banner — full-width card showing total accounts receivable
 *   4. Accounts Table — virtualised FlatList of AccountAgingRow cards
 *   5. Empty / Loading states
 *
 * Why FlatList instead of ScrollView for the accounts list?
 * Customer bases can be large; FlatList gives us virtualisation so only
 * visible rows are rendered, keeping the UI smooth on tablets with hundreds
 * of accounts.
 *
 * Why ListHeaderComponent for header + summary + banner?
 * Nesting a ScrollView inside another ScrollView causes scroll-jank on
 * Android. Putting the non-repeating UI into ListHeaderComponent keeps
 * everything in one scrollable surface.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import * as Haptics from "expo-haptics";

// ────────────────────────────── Types ──────────────────────────────

export interface AgingBucket {
  label: string; // "Current", "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days"
  amount: number;
  count: number; // number of accounts in this bucket
  percentage: number; // percentage of total AR
}

export interface AccountAgingRow {
  id: string;
  accountName: string;
  accountNumber: string;
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
  totalOwed: number;
  paymentTerms: number;
  lastPaymentDate: string | null;
}

export interface AgingReportDashboardProps {
  buckets: AgingBucket[];
  accounts: AccountAgingRow[];
  totalAR: number;
  reportDate: string;
  onBack: () => void;
  onAccountPress?: (accountId: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

// ────────────────────────────── Colour Helpers ──────────────────────────────

/**
 * Map each bucket index to a semantic colour so that overdue severity is
 * instantly visible: green → blue → amber → red.
 */
const BUCKET_COLORS: string[] = [
  "#22c55e", // Current — green (healthy)
  "#3b82f6", // 1-30 Days — blue (primary)
  "#fbbf24", // 31-60 Days — amber (warning)
  "#ef4444", // 61-90 Days — red (negative)
  "#ef4444", // 90+ Days — red (negative)
];

/** Returns the colour for a bucket by its position in the array. */
const getBucketColor = (index: number): string =>
  BUCKET_COLORS[index] ?? "#94a3b8";

// ────────────────────────────── Sub-Components ──────────────────────────────

/**
 * BucketCard — a single summary card inside the horizontal ScrollView.
 *
 * Why a separate memo'd component instead of inline JSX?
 * The horizontal list re-renders when any parent state changes; memo prevents
 * unnecessary re-renders of cards whose bucket data hasn't changed.
 */
const BucketCard = React.memo(function BucketCard({
  bucket,
  index,
}: {
  bucket: AgingBucket;
  index: number;
}) {
  const color = getBucketColor(index);

  return (
    <View style={[styles.bucketCard, { borderTopColor: color }]}>
      <Text style={styles.bucketLabel}>{bucket.label}</Text>
      <Text style={[styles.bucketAmount, { color }]}>
        {formatCurrency(bucket.amount)}
      </Text>
      <Text style={styles.bucketCount}>
        {bucket.count} {bucket.count === 1 ? "account" : "accounts"}
      </Text>

      {/* Percentage bar — visual weight of this bucket relative to total AR */}
      <View style={styles.percentageBarTrack}>
        <View
          style={[
            styles.percentageBarFill,
            {
              width: `${Math.min(bucket.percentage, 100)}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text style={[styles.percentageText, { color }]}>
        {bucket.percentage.toFixed(1)}%
      </Text>
    </View>
  );
});

/**
 * AccountRow — a single account card rendered by the FlatList.
 *
 * Why TouchableOpacity with 48 px minHeight?
 * Tablet-first design requires large touch targets per platform guidelines
 * (minimum 48 × 48 dp).
 */
const AccountRow = React.memo(function AccountRow({
  account,
  onPress,
}: {
  account: AccountAgingRow;
  onPress?: (accountId: string) => void;
}) {
  const handlePress = useCallback(() => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress(account.id);
    }
  }, [onPress, account.id]);

  return (
    <TouchableOpacity
      style={styles.accountCard}
      onPress={handlePress}
      disabled={!onPress}
      activeOpacity={0.7}
      testID={`aging-account-${account.id}`}
    >
      {/* ── Name + Account Number ── */}
      <View style={styles.accountHeader}>
        <View style={styles.accountInfo}>
          <Text style={styles.accountName} numberOfLines={1}>
            {account.accountName}
          </Text>
          <Text style={styles.accountNumber}>#{account.accountNumber}</Text>
        </View>
        <View style={styles.accountTotalContainer}>
          <Text style={styles.accountTotalLabel}>Total</Text>
          <Text style={styles.accountTotal}>
            {formatCurrency(account.totalOwed)}
          </Text>
        </View>
      </View>

      {/* ── Aging Breakdown Columns ── */}
      <View style={styles.agingColumns}>
        <AgingColumn label="Current" amount={account.current} colorIndex={0} />
        <AgingColumn label="1-30" amount={account.days30} colorIndex={1} />
        <AgingColumn label="31-60" amount={account.days60} colorIndex={2} />
        <AgingColumn
          label="90+"
          amount={account.days90Plus}
          colorIndex={3}
        />
      </View>

      {/* ── Footer: payment terms + last payment ── */}
      <View style={styles.accountFooter}>
        <Text style={styles.mutedText}>
          Terms: {account.paymentTerms} days
        </Text>
        <Text style={styles.mutedText}>
          {account.lastPaymentDate
            ? `Last paid: ${account.lastPaymentDate}`
            : "No payments recorded"}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

/** AgingColumn — a single column inside the aging breakdown row. */
const AgingColumn = React.memo(function AgingColumn({
  label,
  amount,
  colorIndex,
}: {
  label: string;
  amount: number;
  colorIndex: number;
}) {
  const color = amount > 0 ? getBucketColor(colorIndex) : "#6b7280";

  return (
    <View style={styles.agingColumn}>
      <Text style={styles.agingColumnLabel}>{label}</Text>
      <Text style={[styles.agingColumnAmount, { color }]}>
        {formatCurrency(amount)}
      </Text>
    </View>
  );
});

// ────────────────────────────── Main Component ──────────────────────────────

function AgingReportDashboardComponent({
  buckets,
  accounts,
  totalAR,
  reportDate,
  onBack,
  onAccountPress,
  onRefresh,
  isLoading = false,
}: AgingReportDashboardProps) {
  // ── Handlers ──

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onRefresh();
    }
  }, [onRefresh]);

  // ── Render helpers ──

  const renderAccountRow = useCallback(
    ({ item }: { item: AccountAgingRow }) => (
      <AccountRow account={item} onPress={onAccountPress} />
    ),
    [onAccountPress],
  );

  const keyExtractor = useCallback(
    (item: AccountAgingRow) => item.id,
    [],
  );

  /**
   * ListHeaderComponent contains everything above the virtualised account
   * list: header bar, bucket summary cards, and total-AR banner.
   *
   * Why useMemo? This JSX tree only needs to rebuild when the summary
   * data (buckets / totalAR / reportDate) or loading state changes.
   */
  const listHeader = useMemo(
    () => (
      <View>
        {/* ── 1. Header Bar ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.headerButton}
            testID="aging-back-btn"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="#f3f4f6" />
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Aging Report</Text>
            <Text style={styles.headerDate}>{reportDate}</Text>
          </View>

          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.headerButton}
            disabled={!onRefresh || isLoading}
            testID="aging-refresh-btn"
            accessibilityLabel="Refresh report"
          >
            <Ionicons
              name="refresh"
              size={22}
              color={isLoading ? "#4b5563" : "#f3f4f6"}
            />
          </TouchableOpacity>
        </View>

        {/* ── 2. Summary Bucket Cards ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bucketScrollContent}
          style={styles.bucketScroll}
          testID="aging-summary-cards"
        >
          {buckets.map((bucket, idx) => (
            <BucketCard key={bucket.label} bucket={bucket} index={idx} />
          ))}
        </ScrollView>

        {/* ── 3. Total AR Banner ── */}
        <View style={styles.totalBanner} testID="aging-total-ar">
          <Text style={styles.totalBannerLabel}>Total Accounts Receivable</Text>
          <Text style={styles.totalBannerAmount}>
            {formatCurrency(totalAR)}
          </Text>
        </View>

        {/* Section heading for accounts list */}
        <View style={styles.sectionHeader}>
          <Ionicons name="people-outline" size={18} color="#9ca3af" />
          <Text style={styles.sectionHeaderText}>Account Details</Text>
        </View>
      </View>
    ),
    [buckets, totalAR, reportDate, isLoading, handleBack, handleRefresh, onRefresh],
  );

  // ── Empty & Loading States ──

  const listEmptyComponent = useMemo(
    () =>
      isLoading ? (
        <View style={styles.centeredState} testID="aging-loading">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.stateText}>Loading aging data…</Text>
        </View>
      ) : (
        <View style={styles.centeredState} testID="aging-empty-state">
          <Ionicons name="document-text-outline" size={48} color="#4b5563" />
          <Text style={styles.stateText}>No aging data available</Text>
        </View>
      ),
    [isLoading],
  );

  // ── Root Render ──

  return (
    <View style={styles.container} testID="aging-report-dashboard">
      <FlatList
        data={accounts}
        renderItem={renderAccountRow}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmptyComponent}
        contentContainerStyle={styles.listContent}
        testID="aging-accounts-list"
        /**
         * Why removeClippedSubviews on Android?
         * It detaches off-screen views from the native view hierarchy,
         * reducing memory pressure on large account lists.
         */
        removeClippedSubviews
      />
    </View>
  );
}

// ────────────────────────────── Styles ──────────────────────────────

const styles = StyleSheet.create({
  /* ── Layout ── */
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  listContent: {
    paddingBottom: 32,
  },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    gap: 12,
  },
  headerButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  headerDate: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 2,
  },

  /* ── Bucket Summary Cards ── */
  bucketScroll: {
    marginTop: 12,
  },
  bucketScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  bucketCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    minWidth: 160,
    borderTopWidth: 3,
  },
  bucketLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 4,
  },
  bucketAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  bucketCount: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  percentageBarTrack: {
    height: 6,
    backgroundColor: "#111827",
    borderRadius: 3,
    marginTop: 10,
    overflow: "hidden",
  },
  percentageBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },

  /* ── Total AR Banner ── */
  totalBanner: {
    backgroundColor: "#1f2937",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  totalBannerLabel: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 6,
  },
  totalBannerAmount: {
    fontSize: 28,
    fontWeight: "800",
    color: "#f3f4f6",
  },

  /* ── Section Header ── */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9ca3af",
  },

  /* ── Account Row Card ── */
  accountCard: {
    backgroundColor: "#1f2937",
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    padding: 16,
    minHeight: 48,
  },
  accountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  accountInfo: {
    flex: 1,
    marginRight: 12,
  },
  accountName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  accountNumber: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  accountTotalContainer: {
    alignItems: "flex-end",
  },
  accountTotalLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 2,
  },
  accountTotal: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f3f4f6",
  },

  /* ── Aging Breakdown Columns ── */
  agingColumns: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  agingColumn: {
    flex: 1,
    alignItems: "center",
  },
  agingColumnLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 4,
  },
  agingColumnAmount: {
    fontSize: 13,
    fontWeight: "600",
  },

  /* ── Account Footer ── */
  accountFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  mutedText: {
    fontSize: 12,
    color: "#6b7280",
  },

  /* ── Empty / Loading State ── */
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    gap: 12,
  },
  stateText: {
    fontSize: 15,
    color: "#6b7280",
  },
});

// ────────────────────────────── Export ──────────────────────────────

/**
 * Wrap in React.memo so the dashboard only re-renders when its props
 * actually change — important when the parent navigates between tabs.
 */
export default React.memo(
  AgingReportDashboardComponent,
) as typeof AgingReportDashboardComponent;
