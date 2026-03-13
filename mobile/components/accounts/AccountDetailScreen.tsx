/**
 * AccountDetailScreen — full detail view for a single customer account.
 * (customer-accounts task 13.2)
 *
 * Layout (top → bottom):
 *   1. Header with back button + customer name
 *   2. Balance summary card with credit-utilisation progress bar
 *   3. Account info section (status, payment terms, dates)
 *   4. Recent transactions preview (last 5)
 *   5. Action buttons (Charge, Payment, Statements)
 *
 * Why `calculateBalanceSummary` instead of inline math?
 * The service function centralises balance/credit logic so that every
 * screen (list, detail, POS) uses identical calculations.
 */

import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import {
  CustomerAccount,
  AccountTransaction,
  calculateBalanceSummary,
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_COLORS,
  PAYMENT_TERMS_LABELS,
} from "@/services/accounts/CustomerAccountService";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of transactions shown in the preview list. */
const RECENT_TX_LIMIT = 5;

/** Icons mapped to each transaction type for quick visual scanning. */
const TRANSACTION_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  charge: "cart-outline",
  payment: "cash-outline",
  credit_note: "document-text-outline",
  write_off: "close-circle-outline",
};

/**
 * Colour per transaction type so the user can instantly distinguish
 * incoming payments (green) from charges (amber) at a glance.
 */
const TRANSACTION_TYPE_COLORS: Record<string, string> = {
  charge: "#fbbf24",
  payment: "#22c55e",
  credit_note: "#3b82f6",
  write_off: "#ef4444",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AccountDetailScreenProps {
  account: CustomerAccount;
  transactions: AccountTransaction[];
  onBack: () => void;
  onCharge: () => void;
  onPayment: () => void;
  onViewStatements: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the colour for the credit-utilisation bar.
 * Thresholds match AccountListScreen so visual language is consistent.
 */
function utilisationColor(percent: number): string {
  if (percent > 80) return "#ef4444";
  if (percent > 50) return "#fbbf24";
  return "#22c55e";
}

/** Formats an ISO-8601 date string into a short locale date. */
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Formats an ISO-8601 date string into date + time for transaction rows. */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Balance summary card with credit-utilisation progress bar. */
const BalanceSummaryCard = React.memo(function BalanceSummaryCard({
  account,
}: {
  account: CustomerAccount;
}) {
  const summary = useMemo(
    () => calculateBalanceSummary(account, new Date()),
    [account]
  );

  const barPercent = Math.min(100, Math.round(summary.creditUtilisation));
  const barColor = utilisationColor(barPercent);

  return (
    <View style={styles.card} testID="balance-summary-card">
      {/* Current balance — the most important number, so it's large */}
      <Text style={styles.balanceLabel}>Current Balance</Text>
      <Text
        style={[
          styles.balanceAmount,
          summary.isOverLimit && styles.balanceOverLimit,
        ]}
      >
        {formatCurrency(summary.currentBalance)}
      </Text>

      {/* Credit utilisation bar */}
      <View style={styles.barSection}>
        <View style={styles.barLabelRow}>
          <Text style={styles.barLabelText}>Credit Used</Text>
          <Text style={[styles.barLabelText, { color: barColor }]}>
            {barPercent}%
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                width: `${barPercent}%` as unknown as number,
                backgroundColor: barColor,
              },
            ]}
          />
        </View>
      </View>

      {/* Summary row */}
      <View style={styles.summaryRow}>
        <SummaryItem label="Credit Limit" value={formatCurrency(summary.creditLimit)} />
        <SummaryItem label="Available" value={formatCurrency(summary.availableCredit)} />
        <SummaryItem
          label="Last Payment"
          value={
            summary.daysSinceLastPayment !== null
              ? `${summary.daysSinceLastPayment}d ago`
              : "—"
          }
        />
      </View>

      {/* Warnings */}
      {summary.isOverLimit && (
        <View style={styles.warningBadge}>
          <Ionicons name="warning-outline" size={14} color="#ef4444" />
          <Text style={styles.warningText}>Over credit limit</Text>
        </View>
      )}
      {summary.isOverdue && (
        <View style={styles.warningBadge}>
          <Ionicons name="time-outline" size={14} color="#fbbf24" />
          <Text style={[styles.warningText, { color: "#fbbf24" }]}>
            Payment overdue
          </Text>
        </View>
      )}
    </View>
  );
});

/** Small label + value pair used inside the balance summary card. */
function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryItemLabel}>{label}</Text>
      <Text style={styles.summaryItemValue}>{value}</Text>
    </View>
  );
}

/** Account metadata section (status, terms, dates). */
const AccountInfoSection = React.memo(function AccountInfoSection({
  account,
}: {
  account: CustomerAccount;
}) {
  const statusColor = ACCOUNT_STATUS_COLORS[account.status];

  return (
    <View style={styles.card} testID="account-info-section">
      <Text style={styles.sectionTitle}>Account Information</Text>

      <InfoRow label="Status">
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
            {ACCOUNT_STATUS_LABELS[account.status]}
          </Text>
        </View>
      </InfoRow>

      <InfoRow label="Payment Terms">
        <Text style={styles.infoValue}>
          {PAYMENT_TERMS_LABELS[account.paymentTerms]}
        </Text>
      </InfoRow>

      {account.customerEmail && (
        <InfoRow label="Email">
          <Text style={styles.infoValue}>{account.customerEmail}</Text>
        </InfoRow>
      )}

      {account.customerPhone && (
        <InfoRow label="Phone">
          <Text style={styles.infoValue}>{account.customerPhone}</Text>
        </InfoRow>
      )}

      <InfoRow label="Opened">
        <Text style={styles.infoValue}>{formatShortDate(account.openedAt)}</Text>
      </InfoRow>

      {account.lastTransactionAt && (
        <InfoRow label="Last Transaction">
          <Text style={styles.infoValue}>
            {formatShortDate(account.lastTransactionAt)}
          </Text>
        </InfoRow>
      )}
    </View>
  );
});

/** Single key-value row inside the account info section. */
function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** Recent-transactions preview showing the last N entries. */
const RecentTransactions = React.memo(function RecentTransactions({
  transactions,
}: {
  transactions: AccountTransaction[];
}) {
  /**
   * Why sort + slice here rather than expecting pre-sorted data?
   * The parent may pass the full history; we defensively take only
   * the most recent entries so rendering stays fast.
   */
  const recent = useMemo(
    () =>
      [...transactions]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, RECENT_TX_LIMIT),
    [transactions]
  );

  if (recent.length === 0) {
    return (
      <View style={styles.card} testID="recent-transactions-section">
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={32} color="#4b5563" />
          <Text style={styles.emptyText}>No transactions yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card} testID="recent-transactions-section">
      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      {recent.map((tx) => {
        const icon = TRANSACTION_TYPE_ICONS[tx.type] ?? "ellipse-outline";
        const color = TRANSACTION_TYPE_COLORS[tx.type] ?? "#9ca3af";
        const sign = tx.type === "payment" || tx.type === "credit_note" ? "−" : "+";

        return (
          <View key={tx.id} style={styles.txRow} testID={`tx-row-${tx.id}`}>
            <View style={[styles.txIcon, { backgroundColor: color + "22" }]}>
              <Ionicons name={icon} size={18} color={color} />
            </View>
            <View style={styles.txDetails}>
              <Text style={styles.txDescription} numberOfLines={1}>
                {tx.description}
              </Text>
              <Text style={styles.txMeta}>
                {formatDateTime(tx.createdAt)} · {tx.staffName}
              </Text>
            </View>
            <View style={styles.txAmountCol}>
              <Text style={[styles.txAmount, { color }]}>
                {sign}{formatCurrency(tx.amount)}
              </Text>
              <Text style={styles.txBalance}>
                Bal: {formatCurrency(tx.balanceAfter)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Full-screen detail view for a customer account.
 *
 * @param account        The account to display.
 * @param transactions   Full transaction history (component takes last 5).
 * @param onBack         Navigate back to the account list.
 * @param onCharge       Open the charge-to-account flow.
 * @param onPayment      Open the payment entry flow.
 * @param onViewStatements Navigate to the statements/history screen.
 */
function AccountDetailScreenInner({
  account,
  transactions,
  onBack,
  onCharge,
  onPayment,
  onViewStatements,
}: AccountDetailScreenProps) {
  return (
    <View style={styles.container} testID="account-detail-screen">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          testID="back-button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color="#f3f4f6" />
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {account.customerName}
          </Text>
          <Text style={styles.headerSubtitle}>Account Details</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BalanceSummaryCard account={account} />
        <AccountInfoSection account={account} />
        <RecentTransactions transactions={transactions} />
      </ScrollView>

      {/* Sticky action buttons at the bottom */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionCharge]}
          onPress={onCharge}
          testID="charge-button"
        >
          <Ionicons name="cart-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Charge</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionPayment]}
          onPress={onPayment}
          testID="payment-button"
        >
          <Ionicons name="cash-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Payment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionStatements]}
          onPress={onViewStatements}
          testID="statements-button"
        >
          <Ionicons name="document-text-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Statements</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const AccountDetailScreen = React.memo(AccountDetailScreenInner);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  /* Layout */
  container: { flex: 1, backgroundColor: "#0f172a" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24, gap: 12 },

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
  headerTitleBlock: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#f3f4f6" },
  headerSubtitle: { fontSize: 13, color: "#9ca3af", marginTop: 2 },

  /* Cards (shared) */
  card: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 12,
  },

  /* Balance summary */
  balanceLabel: { fontSize: 13, color: "#9ca3af" },
  balanceAmount: { fontSize: 32, fontWeight: "800", color: "#f3f4f6", marginTop: 2 },
  balanceOverLimit: { color: "#ef4444" },

  barSection: { marginTop: 16 },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  barLabelText: { fontSize: 12, color: "#9ca3af" },
  barTrack: {
    height: 8,
    backgroundColor: "#374151",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: 8, borderRadius: 4 },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryItemLabel: { fontSize: 11, color: "#6b7280", marginBottom: 2 },
  summaryItemValue: { fontSize: 14, fontWeight: "600", color: "#f3f4f6" },

  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    backgroundColor: "#ef444422",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  warningText: { fontSize: 12, fontWeight: "600", color: "#ef4444" },

  /* Account info */
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  infoLabel: { fontSize: 14, color: "#9ca3af" },
  infoValue: { fontSize: 14, color: "#f3f4f6", fontWeight: "500" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 12, fontWeight: "600" },

  /* Transactions */
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    gap: 10,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  txDetails: { flex: 1 },
  txDescription: { fontSize: 14, color: "#f3f4f6", fontWeight: "500" },
  txMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  txAmountCol: { alignItems: "flex-end" },
  txAmount: { fontSize: 14, fontWeight: "700" },
  txBalance: { fontSize: 11, color: "#6b7280", marginTop: 2 },

  emptyState: { alignItems: "center", paddingVertical: 24 },
  emptyText: { color: "#6b7280", fontSize: 14, marginTop: 8 },

  /* Action bar */
  actionBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
    /* Min 48px touch target ensured by paddingVertical + icon + text height */
    minHeight: 48,
  },
  actionCharge: { backgroundColor: "#f59e0b" },
  actionPayment: { backgroundColor: "#22c55e" },
  actionStatements: { backgroundColor: "#3b82f6" },
  actionButtonText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
