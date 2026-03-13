/**
 * QuoteListScreen — searchable, filterable list of proforma invoices / quotes.
 *
 * Layout: Header → Stats Row → Filter Pills → Search → FlatList of cards.
 * Each card displays quote number, customer, total, dates, expiry indicator,
 * and a colour-coded status badge.
 *
 * Why FlatList?
 * A business may have hundreds of quotes. FlatList virtualises the list so
 * only visible rows are rendered — essential for tablet-first POS.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ListRenderItemInfo,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { triggerHaptic } from "@/utils/haptics";
import {
  Quote,
  QuoteStatus,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  searchQuotes,
  sortQuotesByDate,
  filterQuotesByStatus,
  calculateExpiryWarning,
  getDaysUntilExpiry,
} from "@/services/quotes/QuoteService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QuoteListScreenProps {
  quotes: Quote[];
  onCreateQuote: () => void;
  onQuotePress: (quoteId: string) => void;
  onBack: () => void;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Filter config
// ---------------------------------------------------------------------------

interface FilterOption {
  key: QuoteStatus | "all";
  label: string;
  testID: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { key: "all", label: "All", testID: "quote-filter-all" },
  { key: "draft", label: "Draft", testID: "quote-filter-draft" },
  { key: "sent", label: "Sent", testID: "quote-filter-sent" },
  { key: "approved", label: "Approved", testID: "quote-filter-approved" },
  { key: "expired", label: "Expired", testID: "quote-filter-expired" },
];

// ---------------------------------------------------------------------------
// Expiry colours
// ---------------------------------------------------------------------------

const EXPIRY_COLORS: Record<string, string> = {
  safe: "#22c55e",
  warning: "#f59e0b",
  critical: "#ef4444",
  expired: "#ef4444",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Stat mini-card used in the stats row. */
const StatCard = React.memo(function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function QuoteListScreenInner({
  quotes,
  onCreateQuote,
  onQuotePress,
  onBack,
  isLoading = false,
}: QuoteListScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<QuoteStatus | "all">("all");

  const now = useMemo(() => new Date(), []);

  // --- Derived data ---

  const stats = useMemo(() => {
    const active = quotes.filter(
      (q) => q.status === "draft" || q.status === "sent" || q.status === "viewed"
    ).length;
    const pending = quotes.filter((q) => q.status === "sent" || q.status === "viewed").length;
    const converted = quotes.filter((q) => q.status === "converted").length;

    return { total: quotes.length, active, pending, converted };
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    let result = quotes;

    if (activeFilter !== "all") {
      result = filterQuotesByStatus(result, [activeFilter]);
    }

    result = searchQuotes(result, searchQuery);
    return sortQuotesByDate(result, "desc");
  }, [quotes, activeFilter, searchQuery]);

  // --- Handlers ---

  const handleFilterPress = useCallback((filter: QuoteStatus | "all") => {
    triggerHaptic("selection");
    setActiveFilter(filter);
  }, []);

  const handleCreatePress = useCallback(() => {
    triggerHaptic("tap");
    onCreateQuote();
  }, [onCreateQuote]);

  const handleBackPress = useCallback(() => {
    triggerHaptic("tap");
    onBack();
  }, [onBack]);

  // --- FlatList renderItem ---

  const renderQuoteCard = useCallback(
    ({ item }: ListRenderItemInfo<Quote>) => {
      const statusColor = QUOTE_STATUS_COLORS[item.status];
      const expiryLevel = calculateExpiryWarning(item, now);
      const daysLeft = getDaysUntilExpiry(item, now);
      const expiryColor = EXPIRY_COLORS[expiryLevel];

      const createdDate = new Date(item.createdAt).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const validDate = new Date(item.validUntil).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      return (
        <TouchableOpacity
          style={styles.quoteCard}
          onPress={() => {
            triggerHaptic("tap");
            onQuotePress(item.id);
          }}
          testID={`quote-card-${item.id}`}
        >
          {/* Row 1: Quote number + status badge */}
          <View style={styles.cardTopRow}>
            <Text style={styles.quoteNumber}>{item.quoteNumber}</Text>
            <View
              style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}
            >
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {QUOTE_STATUS_LABELS[item.status]}
              </Text>
            </View>
          </View>

          {/* Row 2: Customer + grand total */}
          <View style={styles.cardMiddleRow}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.customerName}
            </Text>
            <Text style={styles.grandTotal}>
              {formatCurrency(item.grandTotal)}
            </Text>
          </View>

          {/* Row 3: Dates + expiry indicator + items count */}
          <View style={styles.cardBottomRow}>
            <View style={styles.dateColumn}>
              <Text style={styles.dateLabel}>
                Created: {createdDate}
              </Text>
              <Text style={styles.dateLabel}>
                Valid until: {validDate}
              </Text>
            </View>

            <View style={styles.cardBottomRight}>
              <View style={styles.expiryBadge}>
                <View
                  style={[styles.expiryDot, { backgroundColor: expiryColor }]}
                />
                <Text style={[styles.expiryText, { color: expiryColor }]}>
                  {expiryLevel === "expired"
                    ? "Expired"
                    : `${daysLeft}d left`}
                </Text>
              </View>
              <Text style={styles.itemsCount}>
                {item.items.length} item{item.items.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [now, onQuotePress]
  );

  const keyExtractor = useCallback((item: Quote) => item.id, []);

  // --- Render ---

  return (
    <View style={styles.container} testID="quote-list">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBackPress}
          hitSlop={12}
          testID="quote-back-btn"
        >
          <Ionicons name="arrow-back" size={24} color="#f3f4f6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quotes</Text>
        <TouchableOpacity
          style={styles.newButton}
          onPress={handleCreatePress}
          testID="quote-new-btn"
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newButtonText}>New Quote</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow} testID="quote-stats">
        <StatCard label="Total" value={stats.total} color="#f3f4f6" />
        <StatCard label="Active" value={stats.active} color="#3b82f6" />
        <StatCard label="Pending" value={stats.pending} color="#f59e0b" />
        <StatCard label="Converted" value={stats.converted} color="#22c55e" />
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_OPTIONS.map((opt) => {
          const isActive = activeFilter === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => handleFilterPress(opt.key)}
              testID={opt.testID}
            >
              <Text
                style={[
                  styles.filterPillText,
                  isActive && styles.filterPillTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by quote number or customer..."
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="quote-search-input"
        />
      </View>

      {/* Quotes List */}
      {isLoading ? (
        <View style={styles.loadingState} testID="quote-loading">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading quotes…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredQuotes}
          renderItem={renderQuoteCard}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          testID="quote-list-items"
          ListEmptyComponent={
            <View style={styles.emptyState} testID="quote-empty">
              <Ionicons name="document-text-outline" size={48} color="#4b5563" />
              <Text style={styles.emptyText}>No quotes found</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery || activeFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : 'Tap "New Quote" to create one'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const QuoteListScreen = React.memo(QuoteListScreenInner);
export default QuoteListScreen;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#f3f4f6" },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 44,
  },
  newButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  /* Stats row */
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 22, fontWeight: "700" },
  statLabel: { fontSize: 11, color: "#9ca3af", marginTop: 2 },

  /* Filter pills */
  filterRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    minHeight: 36,
    justifyContent: "center",
  },
  filterPillActive: { borderColor: "#3b82f6", backgroundColor: "#1e3a5f" },
  filterPillText: { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  filterPillTextActive: { color: "#3b82f6" },

  /* Search */
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 16,
    paddingVertical: 12,
  },

  /* List */
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },

  /* Loading */
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#9ca3af", fontSize: 14, marginTop: 12 },

  /* Empty */
  emptyState: { alignItems: "center", paddingVertical: 64 },
  emptyText: { color: "#6b7280", fontSize: 16, marginTop: 12 },
  emptySubtext: { color: "#4b5563", fontSize: 13, marginTop: 4 },

  /* Quote card */
  quoteCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  quoteNumber: { color: "#f3f4f6", fontSize: 16, fontWeight: "700" },
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

  cardMiddleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  customerName: { color: "#d1d5db", fontSize: 14, flex: 1, marginRight: 12 },
  grandTotal: { color: "#f3f4f6", fontSize: 20, fontWeight: "700" },

  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  dateColumn: { gap: 2 },
  dateLabel: { color: "#6b7280", fontSize: 12 },
  cardBottomRight: { alignItems: "flex-end", gap: 4 },
  expiryBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  expiryDot: { width: 6, height: 6, borderRadius: 3 },
  expiryText: { fontSize: 11, fontWeight: "600" },
  itemsCount: { color: "#6b7280", fontSize: 11 },
});
