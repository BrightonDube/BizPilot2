/**
 * PlaylistBuilder — Compose display playlists by picking content from a
 * library, setting per-item durations, and optionally scheduling time windows.
 *
 * The builder is split into two regions: a horizontal content library ribbon
 * at the top (tap-to-add) and a vertical FlatList of the current playlist
 * below. Operators can reorder items with up/down arrows, tweak durations
 * with a +/- stepper, and assign optional HH:mm start/end times.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// Re-use the content type definition from ContentEditor for consistency.
import type { ContentType } from "./ContentEditor";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PlaylistItem {
  id: string;
  contentName: string;
  contentType: ContentType;
  /** How long (seconds) to show this item before advancing. */
  duration: number;
  /** Optional HH:mm — if set, item only plays within this window. */
  startTime?: string;
  /** Optional HH:mm — end of the scheduling window. */
  endTime?: string;
}

export interface PlaylistBuilderProps {
  items: PlaylistItem[];
  availableContent: Array<{ id: string; name: string; type: ContentType }>;
  onAddItem: (contentId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateDuration: (itemId: string, duration: number) => void;
  onReorder: (itemIds: string[]) => void;
  onSave: () => void;
  onCancel: () => void;
  /** Pre-computed total duration so the parent can derive it however it likes. */
  totalDuration: number;
  isSaving?: boolean;
}

// ─── Content-type icon map ──────────────────────────────────────────────────

const TYPE_ICON: Record<ContentType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  text: { icon: "text-outline", color: "#3b82f6" },
  image: { icon: "image-outline", color: "#22c55e" },
  menu_board: { icon: "restaurant-outline", color: "#fbbf24" },
  promotion: { icon: "pricetag-outline", color: "#ef4444" },
  video: { icon: "videocam-outline", color: "#8b5cf6" },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Human-friendly mm:ss (or hh:mm:ss for long playlists). */
function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Swap two indices and return the new id ordering. */
function swapItems(ids: string[], from: number, to: number): string[] {
  const copy = [...ids];
  const tmp = copy[from];
  copy[from] = copy[to];
  copy[to] = tmp;
  return copy;
}

/** Clamp duration to a sensible range (1–9999 seconds). */
function clampDuration(value: number): number {
  return Math.max(1, Math.min(9999, value));
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/**
 * Horizontally-scrollable library card — tapping it adds the content to the
 * playlist. Kept deliberately compact so many items fit on a single row.
 */
const LibraryCard: React.FC<{
  item: { id: string; name: string; type: ContentType };
  onAdd: (contentId: string) => void;
}> = React.memo(({ item, onAdd }) => {
  const meta = TYPE_ICON[item.type];

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdd(item.id);
  }, [onAdd, item.id]);

  return (
    <TouchableOpacity
      testID={`playlist-add-${item.id}`}
      style={styles.libraryCard}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Add ${item.name} to playlist`}
    >
      <View style={[styles.libraryIconWrap, { backgroundColor: `${meta.color}20` }]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>
      <Text style={styles.libraryName} numberOfLines={2}>
        {item.name}
      </Text>
      <View style={styles.libraryAddBadge}>
        <Ionicons name="add" size={14} color="#22c55e" />
      </View>
    </TouchableOpacity>
  );
});

/** Single row in the playlist FlatList. */
const PlaylistRow: React.FC<{
  item: PlaylistItem;
  index: number;
  total: number;
  itemIds: string[];
  onRemoveItem: (id: string) => void;
  onUpdateDuration: (id: string, dur: number) => void;
  onReorder: (ids: string[]) => void;
}> = React.memo(
  ({ item, index, total, itemIds, onRemoveItem, onUpdateDuration, onReorder }) => {
    const meta = TYPE_ICON[item.contentType];

    // ── Duration stepper ──────────────────────────────────────────

    const handleDecrement = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onUpdateDuration(item.id, clampDuration(item.duration - 5));
    }, [onUpdateDuration, item.id, item.duration]);

    const handleIncrement = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onUpdateDuration(item.id, clampDuration(item.duration + 5));
    }, [onUpdateDuration, item.id, item.duration]);

    const handleDurationText = useCallback(
      (text: string) => {
        const parsed = parseInt(text, 10);
        if (!Number.isNaN(parsed)) {
          onUpdateDuration(item.id, clampDuration(parsed));
        }
      },
      [onUpdateDuration, item.id],
    );

    // ── Reorder ───────────────────────────────────────────────────

    const handleMoveUp = useCallback(() => {
      if (index === 0) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onReorder(swapItems(itemIds, index, index - 1));
    }, [index, itemIds, onReorder]);

    const handleMoveDown = useCallback(() => {
      if (index === total - 1) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onReorder(swapItems(itemIds, index, index + 1));
    }, [index, total, itemIds, onReorder]);

    // ── Remove ────────────────────────────────────────────────────

    const handleRemove = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onRemoveItem(item.id);
    }, [onRemoveItem, item.id]);

    return (
      <View testID={`playlist-item-${item.id}`} style={styles.rowCard}>
        {/* ── Order indicator ─────────────────────────────────────── */}
        <View style={styles.rowIndex}>
          <Text style={styles.rowIndexText}>{index + 1}</Text>
        </View>

        {/* ── Content info ────────────────────────────────────────── */}
        <View style={styles.rowBody}>
          <View style={styles.rowNameRow}>
            <Ionicons name={meta.icon} size={16} color={meta.color} />
            <Text style={styles.rowName} numberOfLines={1}>
              {item.contentName}
            </Text>
          </View>

          {/* Duration stepper */}
          <View testID={`playlist-duration-${item.id}`} style={styles.stepperRow}>
            <Text style={styles.stepperLabel}>Duration</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                onPress={handleDecrement}
                style={styles.stepperBtn}
                accessibilityLabel="Decrease duration"
              >
                <Ionicons name="remove" size={16} color="#f3f4f6" />
              </TouchableOpacity>

              <TextInput
                style={styles.stepperInput}
                value={String(item.duration)}
                onChangeText={handleDurationText}
                keyboardType="number-pad"
                accessibilityLabel="Duration in seconds"
              />

              <TouchableOpacity
                onPress={handleIncrement}
                style={styles.stepperBtn}
                accessibilityLabel="Increase duration"
              >
                <Ionicons name="add" size={16} color="#f3f4f6" />
              </TouchableOpacity>
            </View>
            <Text style={styles.stepperUnit}>sec</Text>
          </View>

          {/* Optional schedule time */}
          {(item.startTime !== undefined || item.endTime !== undefined) && (
            <View style={styles.scheduleRow}>
              <Ionicons name="time-outline" size={14} color="#fbbf24" />
              <Text style={styles.scheduleText}>
                {item.startTime ?? "--:--"} → {item.endTime ?? "--:--"}
              </Text>
            </View>
          )}
        </View>

        {/* ── Side actions ────────────────────────────────────────── */}
        <View style={styles.rowSideActions}>
          <TouchableOpacity
            onPress={handleMoveUp}
            disabled={index === 0}
            style={[styles.sideBtn, index === 0 && styles.sideBtnDisabled]}
            accessibilityLabel="Move item up"
          >
            <Ionicons
              name="chevron-up"
              size={18}
              color={index === 0 ? "#4b5563" : "#9ca3af"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleMoveDown}
            disabled={index === total - 1}
            style={[styles.sideBtn, index === total - 1 && styles.sideBtnDisabled]}
            accessibilityLabel="Move item down"
          >
            <Ionicons
              name="chevron-down"
              size={18}
              color={index === total - 1 ? "#4b5563" : "#9ca3af"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            testID={`playlist-remove-${item.id}`}
            onPress={handleRemove}
            style={styles.removeBtn}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.contentName}`}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  },
);

// ─── Main component ─────────────────────────────────────────────────────────

const PlaylistBuilder: React.FC<PlaylistBuilderProps> = ({
  items,
  availableContent,
  onAddItem,
  onRemoveItem,
  onUpdateDuration,
  onReorder,
  onSave,
  onCancel,
  totalDuration,
  isSaving = false,
}) => {
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave();
  }, [onSave]);

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  }, [onCancel]);

  // ── List renderers ──────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<PlaylistItem>) => (
      <PlaylistRow
        item={item}
        index={index}
        total={items.length}
        itemIds={itemIds}
        onRemoveItem={onRemoveItem}
        onUpdateDuration={onUpdateDuration}
        onReorder={onReorder}
      />
    ),
    [items.length, itemIds, onRemoveItem, onUpdateDuration, onReorder],
  );

  const keyExtractor = useCallback((item: PlaylistItem) => item.id, []);

  // ── Empty state ─────────────────────────────────────────────────

  const ListEmpty = useMemo(
    () => (
      <View testID="playlist-empty" style={styles.emptyContainer}>
        <Ionicons name="musical-notes-outline" size={48} color="#4b5563" />
        <Text style={styles.emptyTitle}>Playlist is empty</Text>
        <Text style={styles.emptySubtitle}>
          Add content from the library above
        </Text>
      </View>
    ),
    [],
  );

  // ── Header above FlatList ───────────────────────────────────────

  const ListHeader = useMemo(
    () => (
      <View>
        {/* Content library ribbon */}
        <Text style={styles.sectionLabel}>Content Library</Text>
        {availableContent.length > 0 ? (
          <ScrollView
            testID="playlist-library"
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.libraryScroll}
          >
            {availableContent.map((c) => (
              <LibraryCard key={c.id} item={c} onAdd={onAddItem} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.libraryEmpty}>
            <Text style={styles.libraryEmptyText}>
              No content available — create content first
            </Text>
          </View>
        )}

        {items.length > 0 && (
          <Text style={styles.sectionLabel}>
            Playlist ({items.length} items)
          </Text>
        )}
      </View>
    ),
    [availableContent, onAddItem, items.length],
  );

  // ── Footer with total duration ──────────────────────────────────

  const ListFooter = useMemo(
    () =>
      items.length > 0 ? (
        <View testID="playlist-total-duration" style={styles.totalBar}>
          <Ionicons name="timer-outline" size={18} color="#3b82f6" />
          <Text style={styles.totalLabel}>Total Duration</Text>
          <Text style={styles.totalValue}>{formatDuration(totalDuration)}</Text>
        </View>
      ) : null,
    [items.length, totalDuration],
  );

  // ── Render ──────────────────────────────────────────────────────

  return (
    <View testID="playlist-builder" style={styles.container}>
      {/* ── Top bar ────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.heading}>Playlist Builder</Text>
          <View style={styles.durationChip}>
            <Ionicons name="timer-outline" size={14} color="#3b82f6" />
            <Text style={styles.durationChipText}>
              {formatDuration(totalDuration)}
            </Text>
          </View>
        </View>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            testID="playlist-cancel-btn"
            style={styles.cancelBtn}
            onPress={handleCancel}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cancel playlist"
          >
            <Ionicons name="close" size={18} color="#9ca3af" />
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="playlist-save-btn"
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Save playlist"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.saveLabel}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Playlist list ──────────────────────────────────────────── */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  durationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#3b82f615",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  durationChipText: {
    fontSize: 13,
    color: "#3b82f6",
    fontWeight: "600",
  },
  topBarActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  cancelLabel: {
    fontSize: 14,
    color: "#9ca3af",
    fontWeight: "500",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#22c55e",
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveLabel: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
  },

  /* List */
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  /* Section labels */
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 4,
  },

  /* ── Content library ribbon ─────────────────────────────────────── */
  libraryScroll: {
    paddingBottom: 16,
    gap: 10,
  },
  libraryCard: {
    width: 110,
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  libraryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  libraryName: {
    fontSize: 12,
    color: "#f3f4f6",
    textAlign: "center",
    marginBottom: 6,
    fontWeight: "500",
  },
  libraryAddBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#22c55e20",
    alignItems: "center",
    justifyContent: "center",
  },
  libraryEmpty: {
    paddingVertical: 20,
    alignItems: "center",
  },
  libraryEmptyText: {
    fontSize: 13,
    color: "#6b7280",
    fontStyle: "italic",
  },

  /* ── Playlist row card ──────────────────────────────────────────── */
  rowCard: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#374151",
    alignItems: "flex-start",
  },
  rowIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  rowIndexText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9ca3af",
  },
  rowBody: {
    flex: 1,
  },
  rowNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  rowName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f3f4f6",
    flex: 1,
  },

  /* Stepper */
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  stepperLabel: {
    fontSize: 12,
    color: "#9ca3af",
    width: 56,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  stepperBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stepperInput: {
    width: 48,
    textAlign: "center",
    color: "#f3f4f6",
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 4,
    // Subtle separator between buttons and the number.
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#374151",
  },
  stepperUnit: {
    fontSize: 12,
    color: "#9ca3af",
  },

  /* Schedule */
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scheduleText: {
    fontSize: 12,
    color: "#fbbf24",
  },

  /* Side actions */
  rowSideActions: {
    alignItems: "center",
    marginLeft: 8,
    gap: 2,
  },
  sideBtn: {
    padding: 4,
  },
  sideBtnDisabled: {
    opacity: 0.4,
  },
  removeBtn: {
    padding: 6,
    marginTop: 2,
  },

  /* Total bar */
  totalBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
    backgroundColor: "#1f2937",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
  },
  totalLabel: {
    fontSize: 14,
    color: "#9ca3af",
    fontWeight: "500",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3b82f6",
  },

  /* Empty state */
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
});

export default React.memo(PlaylistBuilder);
