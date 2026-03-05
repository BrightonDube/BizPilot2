/**
 * MenuBoardEditor — Editor for creating restaurant menu boards for digital displays.
 *
 * Provides a structured form for building menu boards with multiple sections,
 * each containing items with name, price, description, and highlight toggle.
 * Optimised for tablet use with large touch targets and clear visual hierarchy.
 *
 * Why FlatList for sections?
 * Menu boards can grow to many sections and items. FlatList virtualises the
 * list to keep memory usage stable even for extensive menus, while
 * ListFooterComponent keeps "Add Section" always accessible.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Switch,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MenuBoardItem {
  name: string;
  price: number;
  description: string;
  isHighlighted: boolean;
}

export interface MenuBoardSection {
  id: string;
  title: string;
  items: MenuBoardItem[];
}

export interface MenuBoardEditorProps {
  sections: MenuBoardSection[];
  boardName: string;
  onUpdateBoardName: (name: string) => void;
  onAddSection: () => void;
  onRemoveSection: (sectionId: string) => void;
  onUpdateSection: (sectionId: string, updates: Partial<MenuBoardSection>) => void;
  onAddItem: (sectionId: string) => void;
  onRemoveItem: (sectionId: string, itemIndex: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onPreview: () => void;
  isSaving?: boolean;
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

/** Single menu item row within a section. */
const MenuItemRow = React.memo(function MenuItemRow({
  item,
  index,
  sectionId,
  onRemoveItem,
}: {
  item: MenuBoardItem;
  index: number;
  sectionId: string;
  onRemoveItem: (sectionId: string, itemIndex: number) => void;
}) {
  const handleRemove = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemoveItem(sectionId, index);
  }, [onRemoveItem, sectionId, index]);

  return (
    <View style={styles.itemRow}>
      <View style={styles.itemMain}>
        {/* Name + highlight indicator */}
        <View style={styles.itemNameRow}>
          {item.isHighlighted && (
            <Ionicons name="star" size={14} color="#fbbf24" />
          )}
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name || "Untitled Item"}
          </Text>
        </View>

        {/* Description */}
        {item.description !== "" && (
          <Text style={styles.itemDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
      </View>

      {/* Price */}
      <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>

      {/* Remove button */}
      <TouchableOpacity
        style={styles.itemRemoveButton}
        onPress={handleRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={`Remove item ${item.name}`}
        accessibilityRole="button"
      >
        <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
});

/** A full menu section card with title, items, and controls. */
const SectionCard = React.memo(function SectionCard({
  section,
  onRemoveSection,
  onUpdateSection,
  onAddItem,
  onRemoveItem,
}: {
  section: MenuBoardSection;
  onRemoveSection: (id: string) => void;
  onUpdateSection: (id: string, updates: Partial<MenuBoardSection>) => void;
  onAddItem: (id: string) => void;
  onRemoveItem: (sectionId: string, itemIndex: number) => void;
}) {
  const handleTitleChange = useCallback(
    (text: string) => onUpdateSection(section.id, { title: text }),
    [onUpdateSection, section.id],
  );

  const handleRemove = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onRemoveSection(section.id);
  }, [onRemoveSection, section.id]);

  const handleAddItem = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddItem(section.id);
  }, [onAddItem, section.id]);

  return (
    <View testID={`menu-section-${section.id}`} style={styles.sectionCard}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Ionicons name="list-outline" size={20} color="#8b5cf6" />

        <TextInput
          style={styles.sectionTitleInput}
          value={section.title}
          onChangeText={handleTitleChange}
          placeholder="Section Title"
          placeholderTextColor="#6b7280"
          accessibilityLabel="Section title"
        />

        <TouchableOpacity
          testID={`menu-section-remove-${section.id}`}
          style={styles.sectionRemoveButton}
          onPress={handleRemove}
          accessibilityLabel={`Remove section ${section.title}`}
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Items list */}
      {section.items.length > 0 ? (
        <View style={styles.itemsList}>
          {section.items.map((item, idx) => (
            <MenuItemRow
              key={`${section.id}-item-${idx}`}
              item={item}
              index={idx}
              sectionId={section.id}
              onRemoveItem={onRemoveItem}
            />
          ))}
        </View>
      ) : (
        <View style={styles.noItemsContainer}>
          <Text style={styles.noItemsText}>No items in this section</Text>
        </View>
      )}

      {/* Add item button */}
      <TouchableOpacity
        testID={`menu-add-item-${section.id}`}
        style={styles.addItemButton}
        onPress={handleAddItem}
        accessibilityLabel={`Add item to ${section.title}`}
        accessibilityRole="button"
      >
        <Ionicons name="add-circle-outline" size={18} color="#22c55e" />
        <Text style={styles.addItemButtonText}>Add Item</Text>
      </TouchableOpacity>
    </View>
  );
});

// ─── Main Component ─────────────────────────────────────────────────────────

/**
 * @param props - {@link MenuBoardEditorProps}
 * @returns Structured editor for building digital menu boards.
 */
const MenuBoardEditor = React.memo(function MenuBoardEditor({
  sections,
  boardName,
  onUpdateBoardName,
  onAddSection,
  onRemoveSection,
  onUpdateSection,
  onAddItem,
  onRemoveItem,
  onSave,
  onCancel,
  onPreview,
  isSaving = false,
}: MenuBoardEditorProps) {
  // ── Handlers ──────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave();
  }, [onSave]);

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  }, [onCancel]);

  const handlePreview = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPreview();
  }, [onPreview]);

  const handleAddSection = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddSection();
  }, [onAddSection]);

  // ── Render helpers ────────────────────────────────────────────

  const renderSection = useCallback(
    ({ item }: { item: MenuBoardSection }) => (
      <SectionCard
        section={item}
        onRemoveSection={onRemoveSection}
        onUpdateSection={onUpdateSection}
        onAddItem={onAddItem}
        onRemoveItem={onRemoveItem}
      />
    ),
    [onRemoveSection, onUpdateSection, onAddItem, onRemoveItem],
  );

  const keyExtractor = useCallback((item: MenuBoardSection) => item.id, []);

  /** Total item count across all sections — useful header summary. */
  const totalItems = useMemo(
    () => sections.reduce((sum, s) => sum + s.items.length, 0),
    [sections],
  );

  // ── Footer — always-visible "Add Section" button ─────────────

  const ListFooter = useCallback(
    () => (
      <View style={styles.footerContainer}>
        <TouchableOpacity
          testID="menu-add-section"
          style={styles.addSectionButton}
          onPress={handleAddSection}
          accessibilityLabel="Add section"
          accessibilityRole="button"
        >
          <Ionicons name="add-outline" size={22} color="#8b5cf6" />
          <Text style={styles.addSectionText}>Add Section</Text>
        </TouchableOpacity>
      </View>
    ),
    [handleAddSection],
  );

  // ── Empty state ──────────────────────────────────────────────

  const ListEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons name="restaurant-outline" size={56} color="#4b5563" />
        <Text style={styles.emptyTitle}>No Sections Yet</Text>
        <Text style={styles.emptySubtitle}>
          Add sections to start building your menu board.
        </Text>
      </View>
    ),
    [],
  );

  return (
    <View testID="menu-board-editor" style={styles.container}>
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Ionicons name="easel-outline" size={24} color="#f3f4f6" />
          <TextInput
            testID="menu-board-name"
            style={styles.boardNameInput}
            value={boardName}
            onChangeText={onUpdateBoardName}
            placeholder="Board Name"
            placeholderTextColor="#6b7280"
            accessibilityLabel="Board name"
          />
        </View>

        {/* Summary */}
        <View style={styles.headerSummary}>
          <Text style={styles.summaryText}>
            {sections.length} section{sections.length !== 1 ? "s" : ""} · {totalItems} item
            {totalItems !== 1 ? "s" : ""}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            testID="menu-cancel-btn"
            style={styles.cancelButton}
            onPress={handleCancel}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
          >
            <Ionicons name="close-outline" size={20} color="#f3f4f6" />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="menu-preview-btn"
            style={styles.previewButton}
            onPress={handlePreview}
            accessibilityLabel="Preview menu board"
            accessibilityRole="button"
          >
            <Ionicons name="eye-outline" size={20} color="#f3f4f6" />
            <Text style={styles.previewButtonText}>Preview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="menu-save-btn"
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityLabel="Save menu board"
            accessibilityRole="button"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#f3f4f6" />
            ) : (
              <Ionicons name="save-outline" size={20} color="#f3f4f6" />
            )}
            <Text style={styles.saveButtonText}>
              {isSaving ? "Saving…" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Sections List ───────────────────────────────────── */}
      <FlatList
        data={sections}
        renderItem={renderSection}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
});

export default MenuBoardEditor;

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  /* ── Header ─────────────────────────────────────────── */
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    gap: 10,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  boardNameInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
  },
  headerSummary: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#8b5cf6",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
  },
  previewButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 48,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f3f4f6",
  },

  /* ── List ───────────────────────────────────────────── */
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },

  /* ── Section card ───────────────────────────────────── */
  sectionCard: {
    backgroundColor: "#1f2937",
    borderRadius: 14,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
  },
  sectionTitleInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#f3f4f6",
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
  },
  sectionRemoveButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Items ──────────────────────────────────────────── */
  itemsList: {
    paddingVertical: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#111827",
    minHeight: 48,
    gap: 10,
  },
  itemMain: {
    flex: 1,
    gap: 2,
  },
  itemNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  itemDescription: {
    fontSize: 12,
    color: "#9ca3af",
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#22c55e",
    minWidth: 80,
    textAlign: "right",
  },
  itemRemoveButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  noItemsContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  noItemsText: {
    fontSize: 13,
    color: "#6b7280",
  },

  /* ── Add item button ────────────────────────────────── */
  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#111827",
    minHeight: 48,
  },
  addItemButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#22c55e",
  },

  /* ── Footer ─────────────────────────────────────────── */
  footerContainer: {
    marginTop: 8,
  },
  addSectionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1f2937",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#8b5cf6",
    borderStyle: "dashed",
    paddingVertical: 16,
    minHeight: 56,
  },
  addSectionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#8b5cf6",
  },

  /* ── Empty state ────────────────────────────────────── */
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    maxWidth: 280,
  },
});
