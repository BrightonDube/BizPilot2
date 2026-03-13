/**
 * MobileCountEntry — Month-end stock count entry interface.
 *
 * Designed tablet-first for warehouse staff performing physical stock takes.
 * Supports blind-count mode (hides expected quantities to prevent bias),
 * barcode scanning integration, and real-time variance tracking.
 *
 * @module MobileCountEntry
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  type ListRenderItemInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { formatCurrency } from '@/utils/formatters';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CountSheetItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  /** Display unit for the product — "each", "kg", "litre" */
  unit: string;
  /** null when operating in blind-count mode */
  expectedQuantity: number | null;
  /** null means the item has not been counted yet */
  countedQuantity: number | null;
  /** counted − expected; null until counted */
  variance: number | null;
  costPrice: number;
  notes: string;
}

interface CountSheet {
  id: string;
  name: string;
  date: string;
  status: 'draft' | 'in_progress' | 'completed' | 'approved';
  /** Hides expected quantities so counters aren't biased */
  isBlindCount: boolean;
  totalItems: number;
  countedItems: number;
  assignedTo: string;
}

interface MobileCountEntryProps {
  countSheet: CountSheet;
  items: CountSheetItem[];
  onUpdateCount: (itemId: string, quantity: number, notes: string) => void;
  onComplete: () => void;
  onBack: () => void;
  onBarcodeScanned?: (barcode: string) => void;
  isSubmitting?: boolean;
}

// ─── Filter type ─────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'uncounted' | 'counted' | 'variance';

// ─── Palette (dark theme) ────────────────────────────────────────────────────

const COLORS = {
  bg: '#0f172a',
  card: '#1f2937',
  input: '#111827',
  text: '#f3f4f6',
  muted: '#9ca3af',
  border: '#374151',
  green: '#22c55e',
  red: '#ef4444',
  amber: '#fbbf24',
  blue: '#3b82f6',
} as const;

// ─── Status badge colour map ─────────────────────────────────────────────────

const STATUS_COLORS: Record<CountSheet['status'], string> = {
  draft: COLORS.muted,
  in_progress: COLORS.blue,
  completed: COLORS.green,
  approved: COLORS.green,
};

// ─── Variance thresholds ─────────────────────────────────────────────────────
// Small variance: abs ≤ 5% of expected (or ≤2 units if expected is 0/null)
// Anything above is considered large.

const SMALL_VARIANCE_RATIO = 0.05;
const SMALL_VARIANCE_ABS = 2;

/**
 * Return the appropriate colour for a variance value.
 * Zero → green, small → amber, large → red.
 */
function varianceColor(variance: number, expected: number | null): string {
  if (variance === 0) return COLORS.green;
  const absVar = Math.abs(variance);
  const threshold =
    expected != null && expected !== 0
      ? Math.max(expected * SMALL_VARIANCE_RATIO, SMALL_VARIANCE_ABS)
      : SMALL_VARIANCE_ABS;
  return absVar <= threshold ? COLORS.amber : COLORS.red;
}

// ─── Count Item Row ──────────────────────────────────────────────────────────

interface CountItemRowProps {
  item: CountSheetItem;
  isBlindCount: boolean;
  isEditingNotes: boolean;
  onToggleNotes: (id: string) => void;
  onUpdateCount: (itemId: string, quantity: number, notes: string) => void;
}

/**
 * Individual row for a stock count item.
 * Memoised so that only the changed row re-renders when the user taps +/−.
 */
const CountItemRow = React.memo(function CountItemRow({
  item,
  isBlindCount,
  isEditingNotes,
  onToggleNotes,
  onUpdateCount,
}: CountItemRowProps) {
  const currentQty = item.countedQuantity ?? 0;

  /** Fires haptic feedback then propagates the new quantity upward. */
  const handleIncrement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdateCount(item.id, currentQty + 1, item.notes);
  }, [item.id, currentQty, item.notes, onUpdateCount]);

  const handleDecrement = useCallback(() => {
    // Prevent negative stock counts
    if (currentQty <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdateCount(item.id, currentQty - 1, item.notes);
  }, [item.id, currentQty, item.notes, onUpdateCount]);

  /** Direct keyboard entry into the quantity field. */
  const handleDirectInput = useCallback(
    (text: string) => {
      const parsed = parseFloat(text);
      // Allow clearing the field (treat as 0) but reject non-numeric input
      const qty = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
      onUpdateCount(item.id, qty, item.notes);
    },
    [item.id, item.notes, onUpdateCount],
  );

  const handleNotesChange = useCallback(
    (text: string) => {
      onUpdateCount(item.id, currentQty, text);
    },
    [item.id, currentQty, onUpdateCount],
  );

  const isCounted = item.countedQuantity !== null;
  const showVariance = isCounted && item.variance !== null && !isBlindCount;
  const costImpact =
    showVariance && item.variance !== null
      ? item.variance * item.costPrice
      : null;

  return (
    <View testID={`count-item-${item.id}`} style={styles.itemCard}>
      {/* ── Product info row ── */}
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.productName}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.skuText}>{item.sku}</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            <Text style={styles.unitLabel}>{item.unit}</Text>
          </View>
        </View>

        {/* Expected qty — hidden in blind-count mode */}
        {!isBlindCount && item.expectedQuantity !== null && (
          <View style={styles.expectedContainer}>
            <Text style={styles.expectedLabel}>Expected</Text>
            <Text style={styles.expectedValue}>{item.expectedQuantity}</Text>
          </View>
        )}
      </View>

      {/* ── Stepper + numeric input ── */}
      <View style={styles.countRow}>
        <TouchableOpacity
          testID={`count-decrement-${item.id}`}
          style={[styles.stepperBtn, currentQty <= 0 && styles.stepperBtnDisabled]}
          onPress={handleDecrement}
          disabled={currentQty <= 0}
          activeOpacity={0.7}
        >
          <Ionicons
            name="remove"
            size={28}
            color={currentQty <= 0 ? COLORS.muted : COLORS.text}
          />
        </TouchableOpacity>

        <TextInput
          testID={`count-input-${item.id}`}
          style={styles.countInput}
          value={isCounted ? String(item.countedQuantity) : ''}
          onChangeText={handleDirectInput}
          keyboardType="numeric"
          placeholder="—"
          placeholderTextColor={COLORS.muted}
          selectTextOnFocus
        />

        <TouchableOpacity
          testID={`count-increment-${item.id}`}
          style={styles.stepperBtn}
          onPress={handleIncrement}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={28} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* ── Variance display ── */}
      {showVariance && item.variance !== null && (
        <View style={styles.varianceRow}>
          <Text
            style={[
              styles.varianceText,
              { color: varianceColor(item.variance, item.expectedQuantity) },
            ]}
          >
            Variance: {item.variance > 0 ? '+' : ''}
            {item.variance} {item.unit}
          </Text>
          {costImpact !== null && (
            <Text
              style={[
                styles.costImpactText,
                { color: varianceColor(item.variance, item.expectedQuantity) },
              ]}
            >
              {costImpact >= 0 ? '+' : ''}
              {formatCurrency(costImpact)}
            </Text>
          )}
        </View>
      )}

      {/* ── Notes toggle + input ── */}
      <TouchableOpacity
        testID={`count-notes-btn-${item.id}`}
        style={styles.notesToggle}
        onPress={() => onToggleNotes(item.id)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isEditingNotes ? 'chevron-up' : 'create-outline'}
          size={18}
          color={COLORS.muted}
        />
        <Text style={styles.notesToggleText}>
          {item.notes ? 'Edit note' : 'Add note'}
        </Text>
      </TouchableOpacity>

      {isEditingNotes && (
        <TextInput
          testID={`count-notes-input-${item.id}`}
          style={styles.notesInput}
          value={item.notes}
          onChangeText={handleNotesChange}
          placeholder="Add a note…"
          placeholderTextColor={COLORS.muted}
          multiline
        />
      )}
    </View>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

function MobileCountEntryComponent({
  countSheet,
  items,
  onUpdateCount,
  onComplete,
  onBack,
  onBarcodeScanned,
  isSubmitting = false,
}: MobileCountEntryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const listRef = useRef<FlatList<CountSheetItem>>(null);

  // ── Derived counts ──
  const countedCount = useMemo(
    () => items.filter((i) => i.countedQuantity !== null).length,
    [items],
  );
  const allCounted = countedCount === items.length && items.length > 0;
  const progressPct = items.length > 0 ? countedCount / items.length : 0;

  // ── Filtered + searched items ──
  const filteredItems = useMemo(() => {
    let result = items;

    // Apply category filter first (cheaper than string search)
    switch (activeFilter) {
      case 'uncounted':
        result = result.filter((i) => i.countedQuantity === null);
        break;
      case 'counted':
        result = result.filter((i) => i.countedQuantity !== null);
        break;
      case 'variance':
        // Show items where counted differs from expected
        result = result.filter(
          (i) => i.variance !== null && i.variance !== 0,
        );
        break;
    }

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.productName.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q),
      );
    }

    return result;
  }, [items, activeFilter, searchQuery]);

  // ── Total variance cost for the summary footer ──
  const totalVarianceCost = useMemo(
    () =>
      items.reduce((sum, i) => {
        if (i.variance !== null) {
          return sum + i.variance * i.costPrice;
        }
        return sum;
      }, 0),
    [items],
  );

  // ── Callbacks ──

  const handleToggleNotes = useCallback((id: string) => {
    setEditingItemId((prev) => (prev === id ? null : id));
  }, []);

  const handleFilterChange = useCallback((tab: FilterTab) => {
    setActiveFilter(tab);
    // Scroll to top when switching filters so user sees results immediately
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const handleBarcodeScan = useCallback(() => {
    if (onBarcodeScanned) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onBarcodeScanned('');
    }
  }, [onBarcodeScanned]);

  const handleComplete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
  }, [onComplete]);

  // ── FlatList helpers ──

  const keyExtractor = useCallback((item: CountSheetItem) => item.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<CountSheetItem>) => (
      <CountItemRow
        item={item}
        isBlindCount={countSheet.isBlindCount}
        isEditingNotes={editingItemId === item.id}
        onToggleNotes={handleToggleNotes}
        onUpdateCount={onUpdateCount}
      />
    ),
    [countSheet.isBlindCount, editingItemId, handleToggleNotes, onUpdateCount],
  );

  const renderEmpty = useCallback(
    () => (
      <View testID="count-empty" style={styles.emptyState}>
        <Ionicons name="search-outline" size={48} color={COLORS.muted} />
        <Text style={styles.emptyText}>No items match your search</Text>
      </View>
    ),
    [],
  );

  // ── Filter tab data ──
  const FILTER_TABS: { key: FilterTab; label: string; testID: string }[] = [
    { key: 'all', label: 'All', testID: 'count-filter-all' },
    { key: 'uncounted', label: 'Uncounted', testID: 'count-filter-uncounted' },
    { key: 'counted', label: 'Counted', testID: 'count-filter-counted' },
    { key: 'variance', label: 'Variance', testID: 'count-filter-variance' },
  ];

  return (
    <KeyboardAvoidingView
      testID="count-entry-view"
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ═══════════ Header ═══════════ */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="count-back-btn"
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {countSheet.name}
          </Text>
          <Text style={styles.headerSubtitle}>
            {countedCount}/{countSheet.totalItems} counted
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: STATUS_COLORS[countSheet.status] + '22' },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: STATUS_COLORS[countSheet.status] },
            ]}
          >
            {countSheet.status.replace('_', ' ')}
          </Text>
        </View>

        <TouchableOpacity
          testID="count-complete-btn"
          style={[
            styles.completeBtn,
            (!allCounted || isSubmitting) && styles.completeBtnDisabled,
          ]}
          onPress={handleComplete}
          disabled={!allCounted || isSubmitting}
          activeOpacity={0.7}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <Text style={styles.completeBtnText}>Complete</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ═══════════ Progress Bar ═══════════ */}
      <View testID="count-progress-bar" style={styles.progressBarTrack}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${Math.round(progressPct * 100)}%`,
              backgroundColor: allCounted ? COLORS.green : COLORS.blue,
            },
          ]}
        />
      </View>

      {/* ═══════════ Search / Scan Bar ═══════════ */}
      <View style={styles.searchBar}>
        <Ionicons
          name="search"
          size={20}
          color={COLORS.muted}
          style={styles.searchIcon}
        />
        <TextInput
          testID="count-search-input"
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name or SKU…"
          placeholderTextColor={COLORS.muted}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {onBarcodeScanned && (
          <TouchableOpacity
            testID="count-barcode-btn"
            style={styles.barcodeBtn}
            onPress={handleBarcodeScan}
            activeOpacity={0.7}
          >
            <Ionicons name="barcode-outline" size={24} color={COLORS.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* ═══════════ Filter Tabs ═══════════ */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              testID={tab.testID}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => handleFilterChange(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterPillText,
                  isActive && styles.filterPillTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ═══════════ Count Items List ═══════════ */}
      <FlatList
        ref={listRef}
        testID="count-items-list"
        data={filteredItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      {/* ═══════════ Summary Footer ═══════════ */}
      <View testID="count-summary-footer" style={styles.summaryFooter}>
        <View style={styles.summaryStats}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryLabel}>Counted</Text>
            <Text style={styles.summaryValue}>
              {countedCount} / {countSheet.totalItems}
            </Text>
          </View>

          {!countSheet.isBlindCount && (
            <View style={styles.summaryStat}>
              <Text style={styles.summaryLabel}>Variance Value</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color:
                      totalVarianceCost === 0
                        ? COLORS.green
                        : totalVarianceCost < 0
                          ? COLORS.red
                          : COLORS.amber,
                  },
                ]}
              >
                {totalVarianceCost >= 0 ? '+' : ''}
                {formatCurrency(totalVarianceCost)}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.footerCompleteBtn,
            (!allCounted || isSubmitting) && styles.completeBtnDisabled,
          ]}
          onPress={handleComplete}
          disabled={!allCounted || isSubmitting}
          activeOpacity={0.7}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.text} />
              <Text style={styles.footerCompleteBtnText}>Complete Count</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Layout ──
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  completeBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnDisabled: {
    opacity: 0.4,
  },
  completeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },

  // ── Progress Bar ──
  progressBarTrack: {
    height: 6,
    backgroundColor: COLORS.border,
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },

  // ── Search / Scan Bar ──
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLORS.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 52,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    height: '100%',
  },
  barcodeBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    marginLeft: 8,
  },

  // ── Filter Tabs ──
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: COLORS.blue,
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
  },
  filterPillTextActive: {
    color: COLORS.text,
  },

  // ── List ──
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // ── Item Card ──
  itemCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  skuText: {
    fontSize: 13,
    color: COLORS.muted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  categoryBadge: {
    backgroundColor: COLORS.blue + '22',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.blue,
  },
  unitLabel: {
    fontSize: 13,
    color: COLORS.muted,
  },
  expectedContainer: {
    alignItems: 'center',
  },
  expectedLabel: {
    fontSize: 11,
    color: COLORS.muted,
    marginBottom: 2,
  },
  expectedValue: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.muted,
  },

  // ── Count Row (stepper + input) ──
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  stepperBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.input,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  countInput: {
    width: 120,
    height: 64,
    borderRadius: 14,
    backgroundColor: COLORS.input,
    borderWidth: 2,
    borderColor: COLORS.blue,
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },

  // ── Variance ──
  varianceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  varianceText: {
    fontSize: 14,
    fontWeight: '600',
  },
  costImpactText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Notes ──
  notesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  notesToggleText: {
    fontSize: 13,
    color: COLORS.muted,
  },
  notesInput: {
    marginTop: 8,
    backgroundColor: COLORS.input,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
    minHeight: 48,
    textAlignVertical: 'top',
  },

  // ── Empty State ──
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.muted,
  },

  // ── Summary Footer ──
  summaryFooter: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  summaryStats: {
    flex: 1,
    flexDirection: 'row',
    gap: 24,
  },
  summaryStat: {
    gap: 2,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.muted,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  footerCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: COLORS.green,
  },
  footerCompleteBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
});

// ─── Export ──────────────────────────────────────────────────────────────────

export default React.memo(MobileCountEntryComponent) as typeof MobileCountEntryComponent;
