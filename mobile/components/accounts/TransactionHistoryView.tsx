/**
 * TransactionHistoryView — full transaction history with filtering & grouping.
 * (customer-accounts task 13.4)
 *
 * Layout (top → bottom):
 *   1. Header with back button + account name
 *   2. Filter bar — horizontal pills for transaction type
 *   3. Date range inputs (optional start/end)
 *   4. Virtualized FlatList of transactions grouped by date
 *   5. Summary footer — total charges, payments, and net change
 *
 * Why a FlatList with interleaved date headers instead of SectionList?
 * FlatList gives us finer control over `getItemLayout` and
 * `keyExtractor`, which is important when the history can grow to
 * thousands of rows.  Date headers are inserted as lightweight
 * discriminated-union items so the virtualiser still handles them.
 *
 * Why `filterTransactions` from the service layer?
 * Centralises filtering logic so the same rules apply in reports,
 * exports, and this view — no risk of drift.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import {
  AccountTransaction,
  TransactionType,
  filterTransactions,
} from "@/services/accounts/CustomerAccountService";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Icons mapped to each transaction type for quick visual scanning. */
const TX_TYPE_ICONS: Record<TransactionType, keyof typeof Ionicons.glyphMap> = {
  charge: "cart-outline",
  payment: "cash-outline",
  credit_note: "document-text-outline",
  write_off: "close-circle-outline",
};

/**
 * Colour per transaction type — spec-defined so every screen uses the
 * same palette.  Note: these differ from the AccountDetailScreen preview
 * where charge is amber; here the full-history view uses red for charges
 * to emphasise amounts owed.
 */
const TX_TYPE_COLORS: Record<TransactionType, string> = {
  charge: "#ef4444",
  payment: "#22c55e",
  credit_note: "#3b82f6",
  write_off: "#6b7280",
};

/** Human-readable labels shown on the filter pills. */
const TX_TYPE_LABELS: Record<TransactionType, string> = {
  charge: "Charges",
  payment: "Payments",
  credit_note: "Credit Notes",
  write_off: "Write-offs",
};

/** Filter options rendered in the pill bar. */
const FILTER_OPTIONS: Array<{ key: TransactionType | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "charge", label: "Charges" },
  { key: "payment", label: "Payments" },
  { key: "credit_note", label: "Credit Notes" },
  { key: "write_off", label: "Write-offs" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransactionHistoryViewProps {
  /** Full (unfiltered) transaction history for the account. */
  transactions: AccountTransaction[];
  /** Customer / account display name shown in the header. */
  accountName: string;
  /** Navigate back; when omitted the back button is hidden. */
  onBack?: () => void;
}

/**
 * Discriminated union so the FlatList can render both date-group
 * headers and transaction rows from a single data array.
 */
type ListItem =
  | { kind: "header"; date: string; key: string }
  | { kind: "tx"; tx: AccountTransaction; key: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats an ISO-8601 string to a locale date for group headers. */
function formatGroupDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Formats an ISO-8601 string to HH:MM for transaction rows. */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Returns the YYYY-MM-DD date key used for grouping. */
function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Builds the interleaved list of date headers + transaction rows.
 *
 * Why sort descending (newest first)?
 * Users almost always care about the most recent activity, so putting
 * it at the top avoids unnecessary scrolling.
 */
function buildGroupedList(transactions: AccountTransaction[]): ListItem[] {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const items: ListItem[] = [];
  let lastDate = "";

  for (const tx of sorted) {
    const dk = dateKey(tx.createdAt);
    if (dk !== lastDate) {
      lastDate = dk;
      items.push({ kind: "header", date: formatGroupDate(tx.createdAt), key: `hdr-${dk}` });
    }
    items.push({ kind: "tx", tx, key: tx.id });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single filter pill in the horizontal bar. */
const FilterPill = React.memo(function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      testID={`filter-pill-${label}`}
      /* 48px min touch target via minHeight */
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

/** A single transaction row inside the list. */
const TransactionRow = React.memo(function TransactionRow({
  tx,
}: {
  tx: AccountTransaction;
}) {
  const icon = TX_TYPE_ICONS[tx.type];
  const color = TX_TYPE_COLORS[tx.type];

  /*
   * Sign convention: charges and write-offs increase what the customer
   * owes (positive/debit), while payments and credit notes reduce it.
   */
  const isDebit = tx.type === "charge" || tx.type === "write_off";
  const sign = isDebit ? "+" : "−";

  return (
    <View style={styles.txRow} testID={`tx-row-${tx.id}`}>
      {/* Type icon badge */}
      <View style={[styles.txIconBadge, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>

      {/* Centre column: description, reference, meta */}
      <View style={styles.txCenter}>
        <Text style={styles.txDescription} numberOfLines={1}>
          {tx.description}
        </Text>
        {tx.reference ? (
          <Text style={styles.txReference} numberOfLines={1}>
            Ref: {tx.reference}
          </Text>
        ) : null}
        <Text style={styles.txMeta}>
          {formatTime(tx.createdAt)} · {tx.staffName}
        </Text>
      </View>

      {/* Right column: amount + running balance */}
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
});

/** Date group header rendered inline in the FlatList. */
const DateHeader = React.memo(function DateHeader({
  date,
}: {
  date: string;
}) {
  return (
    <View style={styles.dateHeader} testID="date-header">
      <Text style={styles.dateHeaderText}>{date}</Text>
    </View>
  );
});

/** Empty state shown when no transactions match the current filters. */
const EmptyState = React.memo(function EmptyState() {
  return (
    <View style={styles.emptyState} testID="empty-state">
      <Ionicons name="receipt-outline" size={48} color="#4b5563" />
      <Text style={styles.emptyTitle}>No transactions found</Text>
      <Text style={styles.emptySubtitle}>
        Try adjusting the filters or date range.
      </Text>
    </View>
  );
});

/** Summary footer showing totals for the filtered period. */
const SummaryFooter = React.memo(function SummaryFooter({
  totalCharges,
  totalPayments,
  netChange,
}: {
  totalCharges: number;
  totalPayments: number;
  netChange: number;
}) {
  return (
    <View style={styles.summaryFooter} testID="summary-footer">
      <Text style={styles.summaryTitle}>Period Summary</Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryCellLabel}>Total Charges</Text>
          <Text style={[styles.summaryCellValue, { color: TX_TYPE_COLORS.charge }]}>
            {formatCurrency(totalCharges)}
          </Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryCellLabel}>Total Payments</Text>
          <Text style={[styles.summaryCellValue, { color: TX_TYPE_COLORS.payment }]}>
            {formatCurrency(totalPayments)}
          </Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryCellLabel}>Net Change</Text>
          <Text
            style={[
              styles.summaryCellValue,
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
 * Full transaction-history screen with type filtering, date-range
 * selection, virtualised list grouped by date, and a summary footer.
 *
 * @param transactions  Complete (unfiltered) transaction array.
 * @param accountName   Display name shown in the header.
 * @param onBack        Called when the back button is pressed.
 */
function TransactionHistoryViewInner({
  transactions,
  accountName,
  onBack,
}: TransactionHistoryViewProps) {
  // ---- state ----
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ---- derived data ----

  /**
   * Why delegate to `filterTransactions`?
   * Keeps filtering rules in the service layer so report exports and
   * this view always agree on which transactions match a given filter.
   */
  const filtered = useMemo(
    () =>
      filterTransactions(
        transactions,
        typeFilter,
        startDate || undefined,
        endDate || undefined
      ),
    [transactions, typeFilter, startDate, endDate]
  );

  const groupedItems = useMemo(() => buildGroupedList(filtered), [filtered]);

  /** Aggregate totals for the summary footer. */
  const summary = useMemo(() => {
    let totalCharges = 0;
    let totalPayments = 0;

    for (const tx of filtered) {
      if (tx.type === "charge" || tx.type === "write_off") {
        totalCharges += tx.amount;
      } else {
        totalPayments += tx.amount;
      }
    }

    return {
      totalCharges,
      totalPayments,
      netChange: totalCharges - totalPayments,
    };
  }, [filtered]);

  // ---- callbacks ----

  const handleFilterPress = useCallback(
    (key: TransactionType | "all") => setTypeFilter(key),
    []
  );

  const keyExtractor = useCallback((item: ListItem) => item.key, []);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<ListItem>) => {
    if (item.kind === "header") {
      return <DateHeader date={item.date} />;
    }
    return <TransactionRow tx={item.tx} />;
  }, []);

  const renderListEmpty = useCallback(() => <EmptyState />, []);

  /**
   * Footer is rendered inside the FlatList so it scrolls with content
   * and only appears once the user reaches the bottom — avoids taking
   * up precious above-the-fold space.
   */
  const renderListFooter = useCallback(() => {
    if (filtered.length === 0) return null;
    return (
      <SummaryFooter
        totalCharges={summary.totalCharges}
        totalPayments={summary.totalPayments}
        netChange={summary.netChange}
      />
    );
  }, [filtered.length, summary]);

  // ---- render ----

  return (
    <View style={styles.container} testID="transaction-history-view">
      {/* Header */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            testID="back-button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color="#f3f4f6" />
          </TouchableOpacity>
        ) : null}
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {accountName}
          </Text>
          <Text style={styles.headerSubtitle}>Transaction History</Text>
        </View>
        <Text style={styles.headerCount}>
          {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Filter pills — horizontal scroll for small screens */}
      <View style={styles.filterBar} testID="filter-bar">
        {FILTER_OPTIONS.map((opt) => (
          <FilterPill
            key={opt.key}
            label={opt.label}
            active={typeFilter === opt.key}
            onPress={() => handleFilterPress(opt.key)}
          />
        ))}
      </View>

      {/* Date range inputs */}
      <View style={styles.dateRow} testID="date-range">
        <View style={styles.dateInputWrapper}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color="#6b7280"
            style={styles.dateIcon}
          />
          <TextInput
            style={styles.dateInput}
            placeholder="Start (YYYY-MM-DD)"
            placeholderTextColor="#6b7280"
            value={startDate}
            onChangeText={setStartDate}
            maxLength={10}
            testID="start-date-input"
          />
        </View>
        <Text style={styles.dateSeparator}>→</Text>
        <View style={styles.dateInputWrapper}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color="#6b7280"
            style={styles.dateIcon}
          />
          <TextInput
            style={styles.dateInput}
            placeholder="End (YYYY-MM-DD)"
            placeholderTextColor="#6b7280"
            value={endDate}
            onChangeText={setEndDate}
            maxLength={10}
            testID="end-date-input"
          />
        </View>
      </View>

      {/* Transaction list */}
      <FlatList<ListItem>
        data={groupedItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={renderListFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        /* Remove internal state for off-screen items to save memory */
        removeClippedSubviews
        maxToRenderPerBatch={20}
        windowSize={11}
        testID="transaction-list"
      />
    </View>
  );
}

export const TransactionHistoryView = React.memo(TransactionHistoryViewInner);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  /* Layout */
  container: { flex: 1, backgroundColor: "#0f172a" },

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
  headerCount: { fontSize: 13, color: "#9ca3af", fontWeight: "600" },

  /* Filter bar */
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#0f172a",
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1f2937",
    /* 48px min touch via minHeight so pills are easy to tap */
    minHeight: 48,
    justifyContent: "center",
  },
  pillActive: { backgroundColor: "#3b82f6" },
  pillText: { fontSize: 13, fontWeight: "600", color: "#9ca3af" },
  pillTextActive: { color: "#ffffff" },

  /* Date range */
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  dateInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    minHeight: 48,
  },
  dateIcon: { marginLeft: 12 },
  dateInput: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  dateSeparator: { color: "#6b7280", fontSize: 16 },

  /* List */
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },

  /* Date header */
  dateHeader: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  dateHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* Transaction row */
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    gap: 10,
    minHeight: 48,
  },
  txIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  txCenter: { flex: 1 },
  txDescription: { fontSize: 14, color: "#f3f4f6", fontWeight: "500" },
  txReference: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  txMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  txAmountCol: { alignItems: "flex-end" },
  txAmount: { fontSize: 14, fontWeight: "700" },
  txBalance: { fontSize: 11, color: "#6b7280", marginTop: 2 },

  /* Empty state */
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { color: "#9ca3af", fontSize: 16, fontWeight: "600", marginTop: 12 },
  emptySubtitle: { color: "#6b7280", fontSize: 13, marginTop: 4 },

  /* Summary footer */
  summaryFooter: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryCell: { alignItems: "center", flex: 1 },
  summaryCellLabel: { fontSize: 11, color: "#6b7280", marginBottom: 4 },
  summaryCellValue: { fontSize: 15, fontWeight: "700" },
});
