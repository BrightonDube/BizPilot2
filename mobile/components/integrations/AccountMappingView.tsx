/**
 * BizPilot Mobile — AccountMappingView Component
 *
 * Full-screen view for mapping POS ledger accounts to external
 * accounting system (Sage / Xero) chart-of-accounts entries.
 *
 * Why this exists:
 * POS account names rarely match an accounting system 1-to-1
 * (e.g. "Walk-in Sales" vs "Revenue – Retail"). This view lets
 * the owner manually pair each POS account with its external
 * counterpart, or tap "Auto-Map" to let the server match by
 * code/name heuristics. The category pills surface unmapped
 * accounts so the owner can triage what still needs attention
 * before the next sync.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

type AccountCategory = "revenue" | "expense" | "asset" | "liability";

interface AccountMapping {
  id: string;
  /** Display name of the account in the POS system. */
  posAccountName: string;
  /** Ledger code of the POS account. */
  posAccountCode: string;
  /** Name of the linked external account, if mapped. */
  externalAccountName: string | null;
  /** Code of the linked external account, if mapped. */
  externalAccountCode: string | null;
  /** Whether this account has been paired. */
  isMapped: boolean;
  category: AccountCategory;
}

interface AccountMappingViewProps {
  mappings: AccountMapping[];
  /** Open the account-picker sheet for a given mapping. */
  onMapAccount: (mappingId: string) => void;
  /** Remove the external link for a mapping. */
  onUnmapAccount: (mappingId: string) => void;
  /** Run server-side heuristic matching for all unmapped accounts. */
  onAutoMap: () => void;
  /** Persist the current mapping state to the backend. */
  onSave: () => void;
  /** Navigate back. */
  onBack: () => void;
  /** Active category filter (empty = show all). */
  filterCategory: string;
  onFilterChange: (cat: string) => void;
  isSaving?: boolean;
  /** True when local mapping state differs from last-saved state. */
  hasChanges?: boolean;
}

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const COLORS = {
  bg: "#0f172a",
  card: "#1f2937",
  input: "#111827",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#fbbf24",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  border: "#374151",
} as const;

/** Category filter pill definitions. */
const CATEGORY_FILTERS: { key: string; label: string; color: string }[] = [
  { key: "", label: "All", color: COLORS.text },
  { key: "revenue", label: "Revenue", color: COLORS.green },
  { key: "expense", label: "Expense", color: COLORS.red },
  { key: "asset", label: "Asset", color: COLORS.blue },
  { key: "liability", label: "Liability", color: COLORS.amber },
];

/** Map category to a colour for the category chip on each row. */
const CATEGORY_COLOR_MAP: Record<AccountCategory, string> = {
  revenue: COLORS.green,
  expense: COLORS.red,
  asset: COLORS.blue,
  liability: COLORS.amber,
};

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

/** Capitalise first letter. */
function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────

/** Horizontal filter pill row (same UX as SyncLogViewer). */
const FilterPillRow = React.memo(function FilterPillRow({
  items,
  activeKey,
  onSelect,
  testIDPrefix,
}: {
  items: { key: string; label: string; color?: string }[];
  activeKey: string;
  onSelect: (key: string) => void;
  testIDPrefix: string;
}) {
  return (
    <View style={styles.pillRow}>
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(item.key);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Filter ${item.label}`}
            accessibilityState={{ selected: isActive }}
            testID={`${testIDPrefix}${item.key || "all"}`}
            style={[
              styles.pill,
              isActive && styles.pillActive,
            ]}
          >
            <Text
              style={[
                styles.pillText,
                isActive && styles.pillTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

/** A single mapping row: POS account → external account. */
const MappingRow = React.memo(function MappingRow({
  mapping,
  onMap,
  onUnmap,
}: {
  mapping: AccountMapping;
  onMap: () => void;
  onUnmap: () => void;
}) {
  const catColor = CATEGORY_COLOR_MAP[mapping.category];

  const handleAction = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (mapping.isMapped) {
      onUnmap();
    } else {
      onMap();
    }
  }, [mapping.isMapped, onMap, onUnmap]);

  return (
    <View style={styles.mappingRow} testID={`account-mapping-item-${mapping.id}`}>
      {/* ── Left: POS account ────────────────── */}
      <View style={styles.accountBlock}>
        <View style={styles.accountNameRow}>
          <Text style={styles.accountName} numberOfLines={1}>
            {mapping.posAccountName}
          </Text>
          <View style={[styles.categoryChip, { borderColor: catColor }]}>
            <Text style={[styles.categoryChipText, { color: catColor }]}>
              {capitalise(mapping.category)}
            </Text>
          </View>
        </View>
        <Text style={styles.accountCode}>{mapping.posAccountCode}</Text>
      </View>

      {/* ── Arrow ────────────────────────────── */}
      <View style={styles.arrowContainer}>
        <Ionicons
          name="arrow-forward"
          size={18}
          color={mapping.isMapped ? COLORS.green : COLORS.textMuted}
        />
      </View>

      {/* ── Right: External account ──────────── */}
      <View style={styles.accountBlock}>
        {mapping.isMapped && mapping.externalAccountName ? (
          <>
            <Text style={styles.accountName} numberOfLines={1}>
              {mapping.externalAccountName}
            </Text>
            <Text style={styles.accountCode}>
              {mapping.externalAccountCode}
            </Text>
          </>
        ) : (
          <Text style={styles.notMappedText}>Not Mapped</Text>
        )}
      </View>

      {/* ── Map / Unmap button ───────────────── */}
      <Pressable
        onPress={handleAction}
        accessibilityRole="button"
        accessibilityLabel={mapping.isMapped ? "Unmap account" : "Map account"}
        testID={`account-mapping-map-${mapping.id}`}
        style={({ pressed }) => [
          styles.mapBtn,
          {
            borderColor: mapping.isMapped ? COLORS.red : COLORS.green,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons
          name={mapping.isMapped ? "unlink-outline" as any : "link-outline"}
          size={16}
          color={mapping.isMapped ? COLORS.red : COLORS.green}
        />
        <Text
          style={[
            styles.mapBtnText,
            { color: mapping.isMapped ? COLORS.red : COLORS.green },
          ]}
        >
          {mapping.isMapped ? "Unmap" : "Map"}
        </Text>
      </Pressable>
    </View>
  );
});

// ────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────

const AccountMappingView: React.FC<AccountMappingViewProps> = React.memo(
  function AccountMappingView({
    mappings,
    onMapAccount,
    onUnmapAccount,
    onAutoMap,
    onSave,
    onBack,
    filterCategory,
    onFilterChange,
    isSaving = false,
    hasChanges = false,
  }) {
    // ── Derived stats ────────────────────────
    const totalCount = mappings.length;
    const mappedCount = useMemo(
      () => mappings.filter((m) => m.isMapped).length,
      [mappings],
    );

    // ── Render helpers ───────────────────────
    const renderItem = useCallback(
      ({ item }: ListRenderItemInfo<AccountMapping>) => (
        <MappingRow
          mapping={item}
          onMap={() => onMapAccount(item.id)}
          onUnmap={() => onUnmapAccount(item.id)}
        />
      ),
      [onMapAccount, onUnmapAccount],
    );

    const keyExtractor = useCallback(
      (item: AccountMapping) => item.id,
      [],
    );

    const renderEmpty = useCallback(
      () => (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="git-compare-outline"
            size={48}
            color={COLORS.textMuted}
          />
          <Text style={styles.emptyText}>No accounts in this category</Text>
        </View>
      ),
      [],
    );

    return (
      <View style={styles.screen} testID="account-mapping-view">
        {/* ── Header ─────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onBack();
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="account-mapping-back"
            hitSlop={12}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Account Mapping</Text>
            <Text style={styles.headerSubtitle}>
              {mappedCount} of {totalCount} mapped
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {/* ── Progress bar ───────────────────── */}
        <View style={styles.progressBarOuter}>
          <View
            style={[
              styles.progressBarInner,
              {
                width:
                  totalCount > 0
                    ? `${Math.round((mappedCount / totalCount) * 100)}%`
                    : "0%",
              } as any,
            ]}
          />
        </View>

        {/* ── Auto-Map button ────────────────── */}
        <View style={styles.autoMapRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onAutoMap();
            }}
            accessibilityRole="button"
            accessibilityLabel="Auto-map accounts"
            testID="account-mapping-auto"
            style={({ pressed }) => [
              styles.autoMapBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="flash-outline" size={18} color={COLORS.amber} />
            <Text style={styles.autoMapBtnText}>Auto-Map</Text>
          </Pressable>
        </View>

        {/* ── Category filters ───────────────── */}
        <FilterPillRow
          items={CATEGORY_FILTERS}
          activeKey={filterCategory}
          onSelect={onFilterChange}
          testIDPrefix="account-mapping-filter-"
        />

        {/* ── Mapping list ───────────────────── */}
        <FlatList
          data={mappings}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        {/* ── Save button (sticky bottom) ────── */}
        <View style={styles.saveBarOuter}>
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              onSave();
            }}
            disabled={!hasChanges || isSaving}
            accessibilityRole="button"
            accessibilityLabel="Save mappings"
            accessibilityState={{ disabled: !hasChanges || isSaving }}
            testID="account-mapping-save"
            style={({ pressed }) => [
              styles.saveBtn,
              {
                opacity: !hasChanges || isSaving ? 0.4 : pressed ? 0.8 : 1,
              },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.text} />
            )}
            <Text style={styles.saveBtnText}>
              {isSaving ? "Saving…" : "Save Mappings"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  },
);

// ────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────

const styles: Record<string, ViewStyle | TextStyle> = {
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  headerSpacer: {
    width: 32,
  },

  // Progress bar
  progressBarOuter: {
    height: 4,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
    borderRadius: 2,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressBarInner: {
    height: 4,
    backgroundColor: COLORS.green,
    borderRadius: 2,
  },

  // Auto-map
  autoMapRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  autoMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: COLORS.input,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.amber,
  },
  autoMapBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.amber,
  },

  // Filter pills
  pillRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillActive: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textMuted,
  },
  pillTextActive: {
    color: COLORS.text,
    fontWeight: "600",
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100, // room for the sticky save bar
  },

  // Mapping row card
  mappingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  accountBlock: {
    flex: 1,
  },
  accountNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  accountName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    flexShrink: 1,
  },
  accountCode: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  categoryChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  categoryChipText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  notMappedText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.red,
  },

  // Arrow
  arrowContainer: {
    paddingHorizontal: 4,
  },

  // Map / Unmap button
  mapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mapBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textMuted,
  },

  // Save bar
  saveBarOuter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.green,
    borderRadius: 12,
    paddingVertical: 14,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
};

export default AccountMappingView;
