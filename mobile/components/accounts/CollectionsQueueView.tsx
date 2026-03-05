/**
 * CollectionsQueueView — manages overdue customer accounts for POS collections.
 * (customer-accounts collections queue)
 *
 * Layout (top → bottom):
 *   1. Header with back button, "Collections Queue" title, total overdue badge
 *   2. Filter pills — priority filters (All, High, Medium, Low) + sort toggles
 *   3. Summary bar — total overdue, account count, average days overdue
 *   4. FlatList of CollectionItem cards with priority borders, details, actions
 *   5. Activity log modal — quick-log call/email/note against an account
 *
 * Why FlatList instead of ScrollView?
 * A business may have dozens or hundreds of overdue accounts. FlatList
 * virtualises rows so only visible cards are mounted, keeping memory
 * usage constant regardless of queue size.
 *
 * Why haptic feedback on action buttons?
 * Collections actions (logging calls, emails) are consequential — the
 * subtle vibration confirms the tap registered and helps prevent
 * accidental double-taps on a busy POS tablet.
 *
 * Why left-border priority indicator instead of a badge?
 * The coloured left border is visible even when the user is scrolling
 * quickly through the list. It provides an at-a-glance priority map
 * without requiring the user to read text or focus on a small badge.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import * as Haptics from "expo-haptics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActivityType = "phone_call" | "email" | "letter" | "visit" | "promise" | "note";
export type CollectionPriority = "high" | "medium" | "low";

export interface CollectionActivity {
  id: string;
  type: ActivityType;
  date: string;
  notes: string;
  createdBy: string;
}

export interface CollectionItem {
  id: string;
  accountId: string;
  accountName: string;
  accountNumber: string;
  totalOwed: number;
  overdueAmount: number;
  daysOverdue: number;
  lastPaymentDate: string | null;
  lastContactDate: string | null;
  priority: CollectionPriority;
  promiseDate: string | null;
  promiseAmount: number | null;
  recentActivities: CollectionActivity[];
}

export interface CollectionsQueueViewProps {
  /** Full list of overdue collection items. */
  items: CollectionItem[];
  /** Grand total of all overdue amounts — shown in the header badge. */
  totalOverdue: number;
  /** Navigate back to the previous screen. */
  onBack: () => void;
  /** Log a collection activity against an account. */
  onLogActivity?: (accountId: string, type: ActivityType, notes: string) => void;
  /** Navigate to the full account detail screen. */
  onAccountPress?: (accountId: string) => void;
  /** Write off an overdue account balance. */
  onWriteOff?: (accountId: string) => void;
  /** When true the list shows a loading spinner. */
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Priority → border colour mapping.
 * Red draws immediate attention to high-priority accounts; amber signals
 * caution; green indicates lower urgency.
 */
const PRIORITY_COLORS: Record<CollectionPriority, string> = {
  high: "#ef4444",
  medium: "#fbbf24",
  low: "#22c55e",
};

/** Human-readable labels for priority pills. */
const PRIORITY_LABELS: Record<CollectionPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Icons for each activity type — chosen for instant recognition on a tablet. */
const ACTIVITY_ICONS: Record<ActivityType, keyof typeof Ionicons.glyphMap> = {
  phone_call: "call-outline",
  email: "mail-outline",
  letter: "document-text-outline",
  visit: "walk-outline",
  promise: "handshake-outline",
  note: "create-outline",
};

/** Human-readable labels for activity types. */
const ACTIVITY_LABELS: Record<ActivityType, string> = {
  phone_call: "Phone Call",
  email: "Email",
  letter: "Letter",
  visit: "Visit",
  promise: "Promise",
  note: "Note",
};

/** Filter options for the priority pill bar. */
const PRIORITY_FILTER_OPTIONS: Array<{
  key: "all" | CollectionPriority;
  label: string;
  testID: string;
}> = [
  { key: "all", label: "All", testID: "collections-filter-all" },
  { key: "high", label: "High", testID: "collections-filter-high" },
  { key: "medium", label: "Medium", testID: "collections-filter-medium" },
  { key: "low", label: "Low", testID: "collections-filter-low" },
];

/** Sort options for the sort toggle pills. */
const SORT_OPTIONS: Array<{
  key: "amount" | "daysOverdue";
  label: string;
  testID: string;
}> = [
  { key: "amount", label: "Amount", testID: "collections-sort-amount" },
  { key: "daysOverdue", label: "Days Overdue", testID: "collections-sort-days" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats an ISO-8601 date string to a short locale date.
 * Returns "—" for null/empty values so the UI never shows "null".
 */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single filter / sort pill in the horizontal bar. */
const FilterPill = React.memo(function FilterPill({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      testID={testID}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

/** Preview of a single recent activity shown inside the collection card. */
const ActivityPreview = React.memo(function ActivityPreview({
  activity,
}: {
  activity: CollectionActivity;
}) {
  const icon = ACTIVITY_ICONS[activity.type];

  return (
    <View style={styles.activityPreviewRow}>
      <Ionicons name={icon} size={14} color="#9ca3af" />
      <Text style={styles.activityPreviewDate}>{formatDate(activity.date)}</Text>
      <Text style={styles.activityPreviewNotes} numberOfLines={1}>
        {activity.notes}
      </Text>
    </View>
  );
});

/** Empty state shown when the queue has no overdue accounts. */
const EmptyState = React.memo(function EmptyState() {
  return (
    <View style={styles.emptyState} testID="collections-empty">
      <Text style={styles.emptyEmoji}>🎉</Text>
      <Text style={styles.emptyTitle}>No overdue accounts</Text>
      <Text style={styles.emptySubtitle}>
        All customer accounts are up to date.
      </Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Collections queue for managing overdue customer accounts.
 *
 * Provides priority filtering, sorting, per-account action buttons for
 * logging calls/emails/notes, and an activity-log modal for quick data entry.
 *
 * @param items         Full array of overdue collection items.
 * @param totalOverdue  Grand total overdue amount for the header badge.
 * @param onBack        Callback to navigate back.
 * @param onLogActivity Called when the user saves a new activity log entry.
 * @param onAccountPress Called when the user taps an account card.
 * @param onWriteOff    Called when the user writes off an account.
 * @param isLoading     Shows a loading spinner instead of the list.
 */
function CollectionsQueueViewComponent({
  items,
  totalOverdue,
  onBack,
  onLogActivity,
  onAccountPress,
  onWriteOff,
  isLoading = false,
}: CollectionsQueueViewProps) {
  // ---- state ----
  const [selectedPriority, setSelectedPriority] = useState<"all" | CollectionPriority>("all");
  const [sortBy, setSortBy] = useState<"amount" | "daysOverdue">("amount");
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activityType, setActivityType] = useState<ActivityType>("phone_call");
  const [activityNotes, setActivityNotes] = useState("");

  // ---- derived data ----

  /**
   * Why filter + sort in a single useMemo?
   * Both operations run over the same array and produce a single result.
   * Splitting them would create an intermediate array that's immediately
   * discarded — a wasteful allocation on every render cycle.
   */
  const filteredItems = useMemo(() => {
    let result = items;

    if (selectedPriority !== "all") {
      result = result.filter((item) => item.priority === selectedPriority);
    }

    const sorted = [...result].sort((a, b) => {
      if (sortBy === "amount") {
        return b.overdueAmount - a.overdueAmount;
      }
      return b.daysOverdue - a.daysOverdue;
    });

    return sorted;
  }, [items, selectedPriority, sortBy]);

  /** Summary statistics derived from the filtered list. */
  const summary = useMemo(() => {
    const count = filteredItems.length;
    const totalFiltered = filteredItems.reduce((sum, item) => sum + item.overdueAmount, 0);
    const avgDays =
      count > 0
        ? Math.round(filteredItems.reduce((sum, item) => sum + item.daysOverdue, 0) / count)
        : 0;

    return { count, totalFiltered, avgDays };
  }, [filteredItems]);

  // ---- callbacks ----

  const handlePriorityPress = useCallback(
    (key: "all" | CollectionPriority) => setSelectedPriority(key),
    [],
  );

  const handleSortPress = useCallback(
    (key: "amount" | "daysOverdue") => setSortBy(key),
    [],
  );

  /**
   * Opens the activity modal pre-configured for the selected action type.
   * Haptic feedback confirms the tap on tablet-sized touch targets.
   */
  const handleActionPress = useCallback(
    (accountId: string, type: ActivityType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveAccountId(accountId);
      setActivityType(type);
      setActivityNotes("");
      setActivityModalVisible(true);
    },
    [],
  );

  /** Saves the logged activity and closes the modal. */
  const handleActivitySave = useCallback(() => {
    if (activeAccountId && onLogActivity) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onLogActivity(activeAccountId, activityType, activityNotes);
    }
    setActivityModalVisible(false);
    setActiveAccountId(null);
    setActivityNotes("");
  }, [activeAccountId, activityType, activityNotes, onLogActivity]);

  /** Dismisses the modal without saving. */
  const handleActivityCancel = useCallback(() => {
    setActivityModalVisible(false);
    setActiveAccountId(null);
    setActivityNotes("");
  }, []);

  const handleAccountPress = useCallback(
    (accountId: string) => {
      if (onAccountPress) {
        onAccountPress(accountId);
      }
    },
    [onAccountPress],
  );

  // ---- render helpers ----

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<CollectionItem>) => {
      const borderColor = PRIORITY_COLORS[item.priority];
      const recentActivities = item.recentActivities.slice(0, 2);

      return (
        <TouchableOpacity
          style={[styles.card, { borderLeftColor: borderColor }]}
          onPress={() => handleAccountPress(item.accountId)}
          activeOpacity={onAccountPress ? 0.7 : 1}
          testID={`collection-card-${item.id}`}
        >
          {/* Top row: account info + days overdue badge */}
          <View style={styles.cardTopRow}>
            <View style={styles.cardAccountInfo}>
              <Text style={styles.cardAccountName} numberOfLines={1}>
                {item.accountName}
              </Text>
              <Text style={styles.cardAccountNumber}>{item.accountNumber}</Text>
            </View>
            <View style={[styles.daysOverdueBadge, { backgroundColor: borderColor + "22" }]}>
              <Text style={[styles.daysOverdueText, { color: borderColor }]}>
                {item.daysOverdue}d overdue
              </Text>
            </View>
          </View>

          {/* Amounts row */}
          <View style={styles.cardAmountsRow}>
            <View>
              <Text style={styles.cardAmountLabel}>Total Owed</Text>
              <Text style={styles.cardAmountValue}>
                {formatCurrency(item.totalOwed)}
              </Text>
            </View>
            <View style={styles.cardAmountRight}>
              <Text style={styles.cardAmountLabel}>Overdue</Text>
              <Text style={[styles.cardAmountValue, { color: "#ef4444" }]}>
                {formatCurrency(item.overdueAmount)}
              </Text>
            </View>
          </View>

          {/* Dates row */}
          <View style={styles.cardDatesRow}>
            <Text style={styles.cardDateText}>
              Last Payment: {formatDate(item.lastPaymentDate)}
            </Text>
            <Text style={styles.cardDateText}>
              Last Contact: {formatDate(item.lastContactDate)}
            </Text>
          </View>

          {/* Promise info — only shown when a promise exists */}
          {item.promiseDate && (
            <View style={styles.promiseBanner}>
              <Ionicons name="handshake-outline" size={14} color="#fbbf24" />
              <Text style={styles.promiseText}>
                Promise: {formatDate(item.promiseDate)}
                {item.promiseAmount != null && ` — ${formatCurrency(item.promiseAmount)}`}
              </Text>
            </View>
          )}

          {/* Recent activities preview (last 2) */}
          {recentActivities.length > 0 && (
            <View style={styles.activitiesPreview}>
              {recentActivities.map((activity) => (
                <ActivityPreview key={activity.id} activity={activity} />
              ))}
            </View>
          )}

          {/* Action buttons row */}
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleActionPress(item.accountId, "phone_call")}
              testID={`action-call-${item.id}`}
            >
              <Ionicons name="call-outline" size={16} color="#3b82f6" />
              <Text style={styles.actionButtonText}>Log Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleActionPress(item.accountId, "email")}
              testID={`action-email-${item.id}`}
            >
              <Ionicons name="mail-outline" size={16} color="#3b82f6" />
              <Text style={styles.actionButtonText}>Log Email</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleActionPress(item.accountId, "note")}
              testID={`action-note-${item.id}`}
            >
              <Ionicons name="create-outline" size={16} color="#3b82f6" />
              <Text style={styles.actionButtonText}>Log Note</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    },
    [handleAccountPress, handleActionPress, onAccountPress],
  );

  const keyExtractor = useCallback((item: CollectionItem) => item.id, []);

  const renderListEmpty = useCallback(() => <EmptyState />, []);

  // ---- render ----

  return (
    <View style={styles.container} testID="collections-queue-view">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          testID="collections-back-btn"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color="#f3f4f6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Collections Queue</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>
            {formatCurrency(totalOverdue)}
          </Text>
        </View>
      </View>

      {/* Filter pills — priority + sort */}
      <View style={styles.filterBar}>
        <View style={styles.filterRow}>
          {PRIORITY_FILTER_OPTIONS.map((opt) => (
            <FilterPill
              key={opt.key}
              label={opt.label}
              active={selectedPriority === opt.key}
              onPress={() => handlePriorityPress(opt.key)}
              testID={opt.testID}
            />
          ))}
        </View>
        <View style={styles.filterRow}>
          <Text style={styles.sortLabel}>Sort:</Text>
          {SORT_OPTIONS.map((opt) => (
            <FilterPill
              key={opt.key}
              label={opt.label}
              active={sortBy === opt.key}
              onPress={() => handleSortPress(opt.key)}
              testID={opt.testID}
            />
          ))}
        </View>
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar} testID="collections-summary">
        <View style={styles.summaryCell}>
          <Text style={styles.summaryCellLabel}>Total Overdue</Text>
          <Text style={[styles.summaryCellValue, { color: "#ef4444" }]}>
            {formatCurrency(summary.totalFiltered)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCell}>
          <Text style={styles.summaryCellLabel}>Accounts</Text>
          <Text style={styles.summaryCellValue}>{summary.count}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCell}>
          <Text style={styles.summaryCellLabel}>Avg Days</Text>
          <Text style={[styles.summaryCellValue, { color: "#fbbf24" }]}>
            {summary.avgDays}
          </Text>
        </View>
      </View>

      {/* Loading state */}
      {isLoading ? (
        <View style={styles.loadingState} testID="collections-loading">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        /* Collections list */
        <FlatList<CollectionItem>
          data={filteredItems}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={renderListEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={15}
          windowSize={9}
          testID="collections-list"
        />
      )}

      {/* Activity log modal */}
      <Modal
        visible={activityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleActivityCancel}
        testID="activity-modal"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Log {ACTIVITY_LABELS[activityType]}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Add notes..."
              placeholderTextColor="#6b7280"
              value={activityNotes}
              onChangeText={setActivityNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              testID="activity-notes-input"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleActivityCancel}
                testID="activity-cancel-btn"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleActivitySave}
                testID="activity-save-btn"
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default React.memo(CollectionsQueueViewComponent) as typeof CollectionsQueueViewComponent;

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
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", color: "#f3f4f6" },
  headerBadge: {
    backgroundColor: "#ef4444" + "22",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerBadgeText: { fontSize: 14, fontWeight: "700", color: "#ef4444" },

  /* Filter bar */
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#0f172a",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sortLabel: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1f2937",
    minHeight: 48,
    justifyContent: "center",
  },
  pillActive: { backgroundColor: "#3b82f6" },
  pillText: { fontSize: 13, fontWeight: "600", color: "#9ca3af" },
  pillTextActive: { color: "#ffffff" },

  /* Summary bar */
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  summaryCell: { flex: 1, alignItems: "center" },
  summaryCellLabel: { fontSize: 11, color: "#6b7280", marginBottom: 4 },
  summaryCellValue: { fontSize: 16, fontWeight: "700", color: "#f3f4f6" },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#374151",
  },

  /* List */
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },

  /* Collection card */
  card: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    /* Left border for priority indicator */
    borderLeftWidth: 4,
    borderLeftColor: "#6b7280",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cardAccountInfo: { flex: 1, marginRight: 8 },
  cardAccountName: { fontSize: 16, fontWeight: "700", color: "#f3f4f6" },
  cardAccountNumber: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  daysOverdueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daysOverdueText: { fontSize: 12, fontWeight: "700" },

  /* Amounts */
  cardAmountsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardAmountRight: { alignItems: "flex-end" },
  cardAmountLabel: { fontSize: 11, color: "#6b7280", marginBottom: 2 },
  cardAmountValue: { fontSize: 15, fontWeight: "700", color: "#f3f4f6" },

  /* Dates */
  cardDatesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardDateText: { fontSize: 12, color: "#9ca3af" },

  /* Promise banner */
  promiseBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fbbf24" + "15",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    gap: 6,
  },
  promiseText: { fontSize: 12, fontWeight: "600", color: "#fbbf24" },

  /* Activities preview */
  activitiesPreview: {
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 8,
    marginBottom: 8,
    gap: 4,
  },
  activityPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activityPreviewDate: { fontSize: 11, color: "#6b7280", minWidth: 70 },
  activityPreviewNotes: { fontSize: 12, color: "#9ca3af", flex: 1 },

  /* Action buttons */
  cardActionsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 10,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6" + "15",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    minHeight: 48,
  },
  actionButtonText: { fontSize: 12, fontWeight: "600", color: "#3b82f6" },

  /* Loading state */
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Empty state */
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    color: "#9ca3af",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
  },
  emptySubtitle: { color: "#6b7280", fontSize: 14, marginTop: 4 },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#1f2937",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 480,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    color: "#f3f4f6",
    fontSize: 14,
    padding: 14,
    minHeight: 100,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#374151",
    minHeight: 48,
    justifyContent: "center",
  },
  modalCancelText: { fontSize: 14, fontWeight: "600", color: "#9ca3af" },
  modalSaveButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#3b82f6",
    gap: 6,
    minHeight: 48,
    justifyContent: "center",
  },
  modalSaveText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
});
