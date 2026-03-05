/**
 * ContentEditor — Editor for creating and editing signage content blocks.
 *
 * Each "block" represents a slide in the signage rotation: text headlines,
 * images, menu boards, promotions, or videos. Blocks can be reordered,
 * edited in place, and removed. The list uses a FlatList for performance so
 * playlists with many blocks stay smooth on mid-range tablets.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ContentType =
  | "text"
  | "image"
  | "menu_board"
  | "promotion"
  | "video";

export interface ContentBlock {
  id: string;
  type: ContentType;
  title: string;
  /** Raw text or a URL pointing to an asset. */
  content: string;
  /** How long (seconds) this block is shown before advancing. */
  duration: number;
  style?: {
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
  };
}

export interface ContentEditorProps {
  blocks: ContentBlock[];
  onAddBlock: (type: ContentType) => void;
  onUpdateBlock: (blockId: string, updates: Partial<ContentBlock>) => void;
  onRemoveBlock: (blockId: string) => void;
  onReorderBlocks: (blockIds: string[]) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

// ─── Content-type metadata ──────────────────────────────────────────────────

interface TypeMeta {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  testSuffix: string;
}

const TYPE_META: Record<ContentType, TypeMeta> = {
  text: { icon: "text-outline", label: "Text", color: "#3b82f6", testSuffix: "text" },
  image: { icon: "image-outline", label: "Image", color: "#22c55e", testSuffix: "image" },
  menu_board: { icon: "restaurant-outline", label: "Menu Board", color: "#fbbf24", testSuffix: "menu" },
  promotion: { icon: "pricetag-outline", label: "Promotion", color: "#ef4444", testSuffix: "promo" },
  video: { icon: "videocam-outline", label: "Video", color: "#8b5cf6", testSuffix: "video" },
};

const CONTENT_TYPES: ContentType[] = [
  "text",
  "image",
  "menu_board",
  "promotion",
  "video",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Swap two array indices and return the resulting id list.
 * Used for the up/down reorder buttons — a simple swap is the most
 * intuitive model when drag-and-drop isn't yet implemented.
 */
function swapItems(ids: string[], fromIdx: number, toIdx: number): string[] {
  const copy = [...ids];
  const temp = copy[fromIdx];
  copy[fromIdx] = copy[toIdx];
  copy[toIdx] = temp;
  return copy;
}

/** Truncate a content string for preview so the card doesn't grow unbounded. */
function previewContent(content: string, type: ContentType): string {
  if (!content) {
    return type === "text" ? "No text entered" : "No source set";
  }
  if (type === "text") {
    return content.length > 120 ? `${content.slice(0, 120)}…` : content;
  }
  // For media types show just the filename portion of a URL.
  const segments = content.split("/");
  return segments[segments.length - 1] || content;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/** Pill button used in the "Add block" row. */
const AddBlockPill: React.FC<{
  type: ContentType;
  onAdd: (type: ContentType) => void;
}> = React.memo(({ type, onAdd }) => {
  const meta = TYPE_META[type];

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdd(type);
  }, [onAdd, type]);

  return (
    <TouchableOpacity
      testID={`content-add-${meta.testSuffix}`}
      style={[styles.addPill, { borderColor: `${meta.color}60` }]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Add ${meta.label} block`}
    >
      <Ionicons name={meta.icon} size={16} color={meta.color} />
      <Text style={[styles.addPillLabel, { color: meta.color }]}>
        {meta.label}
      </Text>
    </TouchableOpacity>
  );
});

/** A single content block row inside the editor list. */
const BlockRow: React.FC<{
  block: ContentBlock;
  index: number;
  total: number;
  blockIds: string[];
  onUpdateBlock: ContentEditorProps["onUpdateBlock"];
  onRemoveBlock: ContentEditorProps["onRemoveBlock"];
  onReorderBlocks: ContentEditorProps["onReorderBlocks"];
}> = React.memo(
  ({ block, index, total, blockIds, onUpdateBlock, onRemoveBlock, onReorderBlocks }) => {
    const meta = TYPE_META[block.type];

    // ── Callbacks ──────────────────────────────────────────────────

    const handleTitleChange = useCallback(
      (text: string) => onUpdateBlock(block.id, { title: text }),
      [onUpdateBlock, block.id],
    );

    const handleContentChange = useCallback(
      (text: string) => onUpdateBlock(block.id, { content: text }),
      [onUpdateBlock, block.id],
    );

    const handleDurationChange = useCallback(
      (text: string) => {
        const parsed = parseInt(text, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          onUpdateBlock(block.id, { duration: parsed });
        }
      },
      [onUpdateBlock, block.id],
    );

    const handleRemove = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onRemoveBlock(block.id);
    }, [onRemoveBlock, block.id]);

    const handleMoveUp = useCallback(() => {
      if (index === 0) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onReorderBlocks(swapItems(blockIds, index, index - 1));
    }, [index, blockIds, onReorderBlocks]);

    const handleMoveDown = useCallback(() => {
      if (index === total - 1) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onReorderBlocks(swapItems(blockIds, index, index + 1));
    }, [index, total, blockIds, onReorderBlocks]);

    return (
      <View testID={`content-block-${block.id}`} style={styles.blockCard}>
        {/* ── Block header ─────────────────────────────────────────── */}
        <View style={styles.blockHeader}>
          <View style={[styles.blockTypeBadge, { backgroundColor: `${meta.color}20` }]}>
            <Ionicons name={meta.icon} size={14} color={meta.color} />
            <Text style={[styles.blockTypeLabel, { color: meta.color }]}>
              {meta.label}
            </Text>
          </View>

          {/* Reorder + remove */}
          <View style={styles.blockActions}>
            <TouchableOpacity
              onPress={handleMoveUp}
              disabled={index === 0}
              style={[styles.blockActionBtn, index === 0 && styles.blockActionDisabled]}
              accessibilityLabel="Move block up"
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
              style={[
                styles.blockActionBtn,
                index === total - 1 && styles.blockActionDisabled,
              ]}
              accessibilityLabel="Move block down"
            >
              <Ionicons
                name="chevron-down"
                size={18}
                color={index === total - 1 ? "#4b5563" : "#9ca3af"}
              />
            </TouchableOpacity>

            {/* Drag handle — visual only, reordering uses the arrows above */}
            <View style={styles.dragHandle}>
              <Ionicons name="reorder-three" size={20} color="#4b5563" />
            </View>

            <TouchableOpacity
              testID={`content-remove-${block.id}`}
              onPress={handleRemove}
              style={styles.removeBtn}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${block.title || meta.label} block`}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Title input ──────────────────────────────────────────── */}
        <Text style={styles.fieldLabel}>Title</Text>
        <TextInput
          style={styles.textInput}
          value={block.title}
          onChangeText={handleTitleChange}
          placeholder="Block title"
          placeholderTextColor="#6b7280"
          accessibilityLabel="Block title"
        />

        {/* ── Content input / preview ──────────────────────────────── */}
        <Text style={styles.fieldLabel}>
          {block.type === "text" ? "Content" : "Source URL"}
        </Text>
        {block.type === "text" ? (
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            value={block.content}
            onChangeText={handleContentChange}
            placeholder="Enter display text…"
            placeholderTextColor="#6b7280"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            accessibilityLabel="Block content"
          />
        ) : (
          <View style={styles.previewRow}>
            <Ionicons
              name={block.content ? "link-outline" : "alert-circle-outline"}
              size={14}
              color={block.content ? "#3b82f6" : "#6b7280"}
            />
            <Text
              style={[
                styles.previewText,
                !block.content && styles.previewTextEmpty,
              ]}
              numberOfLines={1}
            >
              {previewContent(block.content, block.type)}
            </Text>
          </View>
        )}

        {/* ── Duration ─────────────────────────────────────────────── */}
        <View style={styles.durationRow}>
          <Text style={styles.fieldLabel}>Duration</Text>
          <View style={styles.durationInputWrap}>
            <TextInput
              testID={`content-duration-${block.id}`}
              style={styles.durationInput}
              value={String(block.duration)}
              onChangeText={handleDurationChange}
              keyboardType="number-pad"
              accessibilityLabel="Block duration in seconds"
            />
            <Text style={styles.durationUnit}>sec</Text>
          </View>
        </View>
      </View>
    );
  },
);

// ─── Main component ─────────────────────────────────────────────────────────

const ContentEditor: React.FC<ContentEditorProps> = ({
  blocks,
  onAddBlock,
  onUpdateBlock,
  onRemoveBlock,
  onReorderBlocks,
  onSave,
  onCancel,
  isSaving = false,
}) => {
  /** Stable id list for reorder helpers — recalculated only when blocks change. */
  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks]);

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave();
  }, [onSave]);

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  }, [onCancel]);

  // ── List renderer ───────────────────────────────────────────────

  const renderBlock = useCallback(
    ({ item, index }: ListRenderItemInfo<ContentBlock>) => (
      <BlockRow
        block={item}
        index={index}
        total={blocks.length}
        blockIds={blockIds}
        onUpdateBlock={onUpdateBlock}
        onRemoveBlock={onRemoveBlock}
        onReorderBlocks={onReorderBlocks}
      />
    ),
    [blocks.length, blockIds, onUpdateBlock, onRemoveBlock, onReorderBlocks],
  );

  const keyExtractor = useCallback((item: ContentBlock) => item.id, []);

  // ── Empty state ─────────────────────────────────────────────────

  const ListEmpty = useMemo(
    () => (
      <View testID="content-empty" style={styles.emptyContainer}>
        <Ionicons name="layers-outline" size={48} color="#4b5563" />
        <Text style={styles.emptyTitle}>No content blocks</Text>
        <Text style={styles.emptySubtitle}>
          Add content blocks to create your display
        </Text>
      </View>
    ),
    [],
  );

  // ── Header (rendered above FlatList) ────────────────────────────

  const ListHeader = useMemo(
    () => (
      <View>
        {/* ── Add block pills ─────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Add Block</Text>
        <View style={styles.addRow}>
          {CONTENT_TYPES.map((ct) => (
            <AddBlockPill key={ct} type={ct} onAdd={onAddBlock} />
          ))}
        </View>

        {blocks.length > 0 && (
          <Text style={styles.sectionLabel}>
            Blocks ({blocks.length})
          </Text>
        )}
      </View>
    ),
    [onAddBlock, blocks.length],
  );

  // ── Render ──────────────────────────────────────────────────────

  return (
    <View testID="content-editor" style={styles.container}>
      {/* ── Top bar ────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <Text style={styles.heading}>Content Editor</Text>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            testID="content-cancel-btn"
            style={styles.cancelBtn}
            onPress={handleCancel}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cancel editing"
          >
            <Ionicons name="close" size={18} color="#9ca3af" />
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="content-save-btn"
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Save content"
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

      {/* ── Block list ─────────────────────────────────────────────── */}
      <FlatList
        data={blocks}
        renderItem={renderBlock}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
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
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
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
    marginBottom: 8,
    marginTop: 4,
  },

  /* Add-block pills */
  addRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  addPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "#1f2937",
  },
  addPillLabel: {
    fontSize: 13,
    fontWeight: "600",
  },

  /* Block card */
  blockCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  blockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  blockTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  blockTypeLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  blockActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  blockActionBtn: {
    padding: 4,
  },
  blockActionDisabled: {
    opacity: 0.4,
  },
  dragHandle: {
    paddingHorizontal: 2,
  },
  removeBtn: {
    padding: 6,
    marginLeft: 2,
  },

  /* Inputs */
  fieldLabel: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 4,
    fontWeight: "500",
  },
  textInput: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f3f4f6",
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#374151",
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },

  /* Content preview (non-text types) */
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#374151",
  },
  previewText: {
    fontSize: 13,
    color: "#f3f4f6",
    flex: 1,
  },
  previewTextEmpty: {
    color: "#6b7280",
    fontStyle: "italic",
  },

  /* Duration */
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  durationInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  durationInput: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#f3f4f6",
    fontSize: 14,
    width: 64,
    textAlign: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  durationUnit: {
    fontSize: 13,
    color: "#9ca3af",
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

export default React.memo(ContentEditor);
