/**
 * StatementView — read-only statement view with download/email actions.
 * (customer-accounts task 13.5)
 *
 * Layout (top → bottom):
 *   1. Header with back button, "Statement" title, date, download & email
 *   2. Account info card (name, number, period)
 *   3. Balance summary card (opening → closing)
 *   4. Aging breakdown card (horizontal buckets, colour-coded)
 *   5. Transactions list (FlatList inside ScrollView, scrollEnabled=false)
 *   6. Footer summary (charges, payments, net change)
 *
 * Why a ScrollView wrapping a non-scrolling FlatList?
 * The statement is a "page" layout — header cards + transactions + footer
 * must scroll as a single unit.  Nesting a scrollable FlatList inside a
 * ScrollView causes gesture conflicts, so we disable FlatList's own
 * scroll and let the outer ScrollView drive everything.  This is safe
 * because statement transaction lists are bounded (typically < 200 rows
 * per period), so we don't need virtualisation.
 *
 * Why Haptics on action buttons?
 * Haptic feedback on download/email gives the user confidence that the
 * tap registered, which is important for actions that trigger async work
 * with no immediate visual result (e.g. a PDF being generated).
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import * as Haptics from "expo-haptics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single line item on the statement. */
export interface StatementTransaction {
  id: string;
  /** ISO-8601 date string. */
  date: string;
  type: "charge" | "payment" | "adjustment" | "write_off";
  description: string;
  /** Absolute amount (always positive). */
  amount: number;
  /** Account balance after this transaction was applied. */
  runningBalance: number;
}

/** Aging bucket breakdown attached to the statement. */
export interface AgingBreakdown {
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
  total: number;
}

/** Complete statement object rendered by this component. */
export interface Statement {
  id: string;
  accountId: string;
  accountName: string;
  accountNumber: string;
  /** ISO-8601 date the statement was generated. */
  statementDate: string;
  /** ISO-8601 start of the statement period. */
  periodStart: string;
  /** ISO-8601 end of the statement period. */
  periodEnd: string;
  openingBalance: number;
  totalCharges: number;
  totalPayments: number;
  closingBalance: number;
  aging: AgingBreakdown;
  transactions: StatementTransaction[];
}

export interface StatementViewProps {
  statement: Statement;
  onBack: () => void;
  /** Called when the user taps the download button. */
  onDownload?: (statementId: string) => void;
  /** Called when the user taps the email button. */
  onEmail?: (statementId: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Colour per transaction type — matches the palette established in
 * TransactionHistoryView so users see consistent visual language.
 */
const TX_TYPE_COLORS: Record<StatementTransaction["type"], string> = {
  charge: "#ef4444",
  payment: "#22c55e",
  adjustment: "#3b82f6",
  write_off: "#6b7280",
};

/**
 * Sign convention: charges and write-offs increase what the customer
 * owes (debit), while payments and adjustments reduce it (credit).
 */
const TX_DEBIT_TYPES = new Set<StatementTransaction["type"]>(["charge", "write_off"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats an ISO-8601 string to a short locale date (e.g. "15 Jan 2025"). */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Formats an ISO-8601 string to a compact date for transaction rows. */
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Header — back button, title, statement date, action buttons. */
const Header = React.memo(function Header({
  statementDate,
  onBack,
  onDownload,
  onEmail,
}: {
  statementDate: string;
  onBack: () => void;
  onDownload?: () => void;
  onEmail?: () => void;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        testID="statement-back-btn"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="arrow-back" size={24} color="#f3f4f6" />
      </TouchableOpacity>

      <View style={styles.headerTitleBlock}>
        <Text style={styles.headerTitle}>Statement</Text>
        <Text style={styles.headerSubtitle}>{formatDate(statementDate)}</Text>
      </View>

      {/* Action buttons grouped on the right */}
      <View style={styles.headerActions}>
        {onDownload && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onDownload}
            testID="statement-download-btn"
          >
            <Ionicons name="download-outline" size={22} color="#3b82f6" />
          </TouchableOpacity>
        )}
        {onEmail && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onEmail}
            testID="statement-email-btn"
          >
            <Ionicons name="mail-outline" size={22} color="#3b82f6" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

/** Account information card — name, number, period. */
const AccountInfoCard = React.memo(function AccountInfoCard({
  accountName,
  accountNumber,
  periodStart,
  periodEnd,
}: {
  accountName: string;
  accountNumber: string;
  periodStart: string;
  periodEnd: string;
}) {
  return (
    <View style={styles.card} testID="statement-account-info">
      <Text style={styles.cardTitle}>Account Information</Text>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Account Name</Text>
        <Text style={styles.infoValue}>{accountName}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Account Number</Text>
        <Text style={styles.infoValue}>{accountNumber}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Statement Period</Text>
        <Text style={styles.infoValue}>
          {formatDate(periodStart)} — {formatDate(periodEnd)}
        </Text>
      </View>
    </View>
  );
});

/** Balance summary card — opening, charges, payments, closing. */
const BalanceSummaryCard = React.memo(function BalanceSummaryCard({
  openingBalance,
  totalCharges,
  totalPayments,
  closingBalance,
}: {
  openingBalance: number;
  totalCharges: number;
  totalPayments: number;
  closingBalance: number;
}) {
  return (
    <View style={styles.card} testID="statement-balance-summary">
      <Text style={styles.cardTitle}>Balance Summary</Text>

      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Opening Balance</Text>
        <Text style={styles.balanceValue}>{formatCurrency(openingBalance)}</Text>
      </View>

      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Total Charges</Text>
        <Text style={[styles.balanceValue, { color: "#ef4444" }]}>
          +{formatCurrency(totalCharges)}
        </Text>
      </View>

      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Total Payments</Text>
        <Text style={[styles.balanceValue, { color: "#22c55e" }]}>
          −{formatCurrency(totalPayments)}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.balanceRow}>
        <Text style={styles.closingLabel}>Closing Balance</Text>
        <Text style={styles.closingValue}>{formatCurrency(closingBalance)}</Text>
      </View>
    </View>
  );
});

/**
 * Aging breakdown card — horizontal buckets.
 *
 * Why colour-code older buckets warmer?
 * Operators need to spot overdue amounts at a glance; the progression
 * from green (current) → amber (30 days) → orange (60 days) → red (90+)
 * mirrors traffic-light intuition.
 */
const AgingBreakdownCard = React.memo(function AgingBreakdownCard({
  aging,
}: {
  aging: AgingBreakdown;
}) {
  const buckets: Array<{ label: string; value: number; color: string }> = [
    { label: "Current", value: aging.current, color: "#22c55e" },
    { label: "30 Days", value: aging.days30, color: "#fbbf24" },
    { label: "60 Days", value: aging.days60, color: "#f97316" },
    { label: "90+ Days", value: aging.days90Plus, color: "#ef4444" },
  ];

  return (
    <View style={styles.card} testID="statement-aging-breakdown">
      <Text style={styles.cardTitle}>Aging Breakdown</Text>
      <View style={styles.agingRow}>
        {buckets.map((bucket) => (
          <View key={bucket.label} style={styles.agingBucket}>
            <Text style={styles.agingLabel}>{bucket.label}</Text>
            <Text style={[styles.agingValue, { color: bucket.color }]}>
              {formatCurrency(bucket.value)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.divider} />

      <View style={styles.agingTotalRow}>
        <Text style={styles.agingTotalLabel}>Total Outstanding</Text>
        <Text style={styles.agingTotalValue}>{formatCurrency(aging.total)}</Text>
      </View>
    </View>
  );
});

/** Single transaction row inside the statement. */
const TransactionRow = React.memo(function TransactionRow({
  transaction,
}: {
  transaction: StatementTransaction;
}) {
  const color = TX_TYPE_COLORS[transaction.type];
  const isDebit = TX_DEBIT_TYPES.has(transaction.type);
  const sign = isDebit ? "+" : "−";

  return (
    <View style={styles.txRow}>
      {/* Date column */}
      <Text style={styles.txDate}>{formatShortDate(transaction.date)}</Text>

      {/* Description column — takes remaining horizontal space */}
      <Text style={styles.txDescription} numberOfLines={1}>
        {transaction.description}
      </Text>

      {/* Amount column — colour-coded by type */}
      <Text style={[styles.txAmount, { color }]}>
        {sign}{formatCurrency(transaction.amount)}
      </Text>

      {/* Running balance column — muted so it doesn't compete visually */}
      <Text style={styles.txRunningBalance}>
        {formatCurrency(transaction.runningBalance)}
      </Text>
    </View>
  );
});

/** Footer summary — total charges, total payments, net change. */
const FooterSummary = React.memo(function FooterSummary({
  totalCharges,
  totalPayments,
}: {
  totalCharges: number;
  totalPayments: number;
}) {
  const netChange = totalCharges - totalPayments;

  return (
    <View style={styles.footer} testID="statement-footer">
      <Text style={styles.footerTitle}>Statement Summary</Text>
      <View style={styles.footerGrid}>
        <View style={styles.footerCell}>
          <Text style={styles.footerCellLabel}>Total Charges</Text>
          <Text style={[styles.footerCellValue, { color: "#ef4444" }]}>
            {formatCurrency(totalCharges)}
          </Text>
        </View>

        <View style={styles.footerCell}>
          <Text style={styles.footerCellLabel}>Total Payments</Text>
          <Text style={[styles.footerCellValue, { color: "#22c55e" }]}>
            {formatCurrency(totalPayments)}
          </Text>
        </View>

        <View style={styles.footerCell}>
          <Text style={styles.footerCellLabel}>Net Change</Text>
          <Text
            style={[
              styles.footerCellValue,
              /*
               * Green when net change favours the business (payments ≥ charges),
               * red when the balance increased over the period.
               */
              { color: netChange <= 0 ? "#22c55e" : "#ef4444" },
            ]}
          >
            {netChange > 0 ? "+" : ""}
            {formatCurrency(netChange)}
          </Text>
        </View>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Renders a complete customer-account statement as a scrollable page.
 *
 * The component is read-only — it receives a fully-computed `Statement`
 * object and renders it.  Side-effectful actions (download, email) are
 * delegated to the parent via callback props.
 *
 * @param statement  The pre-computed statement to display.
 * @param onBack     Navigate back to the previous screen.
 * @param onDownload Optional — trigger a PDF download of this statement.
 * @param onEmail    Optional — email this statement to the account holder.
 */
function StatementViewComponent({
  statement,
  onBack,
  onDownload,
  onEmail,
}: StatementViewProps) {
  // ---- callbacks ----

  /**
   * Why fire haptics before the callback?
   * Download / email trigger async workflows with no instant UI feedback;
   * the haptic pulse tells the user "your tap was registered".
   */
  const handleDownload = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDownload?.(statement.id);
  }, [onDownload, statement.id]);

  const handleEmail = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onEmail?.(statement.id);
  }, [onEmail, statement.id]);

  // ---- FlatList plumbing ----

  const keyExtractor = useCallback(
    (item: StatementTransaction) => item.id,
    [],
  );

  const renderTransaction = useCallback(
    ({ item }: ListRenderItemInfo<StatementTransaction>) => (
      <TransactionRow transaction={item} />
    ),
    [],
  );

  /**
   * Thin line between rows so the eye can track across columns.
   * Using a dedicated separator keeps row rendering simpler.
   */
  const renderSeparator = useCallback(
    () => <View style={styles.txSeparator} />,
    [],
  );

  /** Column headings rendered above the first transaction row. */
  const listHeader = useMemo(
    () => (
      <View style={styles.txHeaderRow}>
        <Text style={styles.txHeaderCell}>Date</Text>
        <Text style={[styles.txHeaderCell, { flex: 1 }]}>Description</Text>
        <Text style={[styles.txHeaderCell, { textAlign: "right" }]}>Amount</Text>
        <Text style={[styles.txHeaderCell, { textAlign: "right" }]}>Balance</Text>
      </View>
    ),
    [],
  );

  // ---- render ----

  return (
    <View style={styles.container} testID="statement-view">
      <Header
        statementDate={statement.statementDate}
        onBack={onBack}
        onDownload={onDownload ? handleDownload : undefined}
        onEmail={onEmail ? handleEmail : undefined}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account info */}
        <AccountInfoCard
          accountName={statement.accountName}
          accountNumber={statement.accountNumber}
          periodStart={statement.periodStart}
          periodEnd={statement.periodEnd}
        />

        {/* Balance summary */}
        <BalanceSummaryCard
          openingBalance={statement.openingBalance}
          totalCharges={statement.totalCharges}
          totalPayments={statement.totalPayments}
          closingBalance={statement.closingBalance}
        />

        {/* Aging breakdown */}
        <AgingBreakdownCard aging={statement.aging} />

        {/* Transactions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transactions</Text>

          {/*
           * FlatList with scrollEnabled={false} — scroll is driven by the
           * outer ScrollView.  This avoids nested-scroll gesture conflicts
           * while still giving us keyExtractor and separator support.
           */}
          <FlatList<StatementTransaction>
            data={statement.transactions}
            keyExtractor={keyExtractor}
            renderItem={renderTransaction}
            ItemSeparatorComponent={renderSeparator}
            ListHeaderComponent={listHeader}
            scrollEnabled={false}
            testID="statement-transactions-list"
          />
        </View>

        {/* Footer summary */}
        <FooterSummary
          totalCharges={statement.totalCharges}
          totalPayments={statement.totalPayments}
        />
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Export — React.memo for referential-equality short-circuit
// ---------------------------------------------------------------------------

export default React.memo(StatementViewComponent) as typeof StatementViewComponent;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  /* Layout */
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },

  /* Header */
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
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 4,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Cards (shared) */
  card: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* Account info card */
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    minHeight: 48,
  },
  infoLabel: {
    fontSize: 13,
    color: "#9ca3af",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f3f4f6",
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 16,
  },

  /* Balance summary card */
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    minHeight: 48,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#9ca3af",
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  divider: {
    height: 1,
    backgroundColor: "#374151",
    marginVertical: 8,
  },
  closingLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  closingValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f3f4f6",
  },

  /* Aging breakdown card */
  agingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  agingBucket: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    minHeight: 48,
  },
  agingLabel: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 4,
    fontWeight: "600",
  },
  agingValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  agingTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
  },
  agingTotalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
  },
  agingTotalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
  },

  /* Transactions list — column header row */
  txHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    marginBottom: 4,
    gap: 8,
  },
  txHeaderCell: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    width: 56,
  },

  /* Transactions list — data rows */
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 8,
    minHeight: 48,
  },
  txDate: {
    fontSize: 12,
    color: "#9ca3af",
    width: 56,
    fontWeight: "500",
  },
  txDescription: {
    flex: 1,
    fontSize: 14,
    color: "#f3f4f6",
    fontWeight: "500",
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "700",
    width: 96,
    textAlign: "right",
  },
  txRunningBalance: {
    fontSize: 12,
    color: "#6b7280",
    width: 88,
    textAlign: "right",
  },
  txSeparator: {
    height: 1,
    backgroundColor: "#374151",
  },

  /* Footer summary */
  footer: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  footerGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerCell: {
    alignItems: "center",
    flex: 1,
  },
  footerCellLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 4,
  },
  footerCellValue: {
    fontSize: 15,
    fontWeight: "700",
  },
});
