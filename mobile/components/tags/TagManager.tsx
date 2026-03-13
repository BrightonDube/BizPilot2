/**
 * TagManager — Mobile tag CRUD management component.
 * (tag-management task 25.7)
 *
 * Full-screen management view for creating, editing, and deleting tags.
 * Tags are grouped by category (product/customer/order) in a FlatList.
 *
 * Why explicit edit/delete buttons instead of swipe-to-delete?
 * Tablet users often lack the muscle memory for swipe gestures. Explicit
 * icon buttons are more discoverable and work reliably with both touch
 * and stylus input.
 *
 * Why a modal for create/edit instead of inline editing?
 * The colour picker and category selector need screen real-estate. A modal
 * focuses the user's attention on the form and prevents accidental taps
 * on the list underneath.
 *
 * Why preset colour pills instead of a full colour picker?
 * In a POS setting, consistency matters more than customisation. Eight
 * curated colours keep the tag palette harmonious and readable on dark
 * backgrounds without needing a colour-picker dependency.
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Tag {
  id: string;
  name: string;
  /** Hex colour string */
  color: string;
  /** Tag category */
  category: string;
  /** Number of items using this tag */
  count: number;
  /** ISO-8601 creation timestamp */
  createdAt: string;
}

export interface TagManagerProps {
  /** All tags available for management */
  tags: Tag[];
  /** Create a new tag */
  onCreateTag: (name: string, color: string, category: string) => void;
  /** Delete a tag by ID */
  onDeleteTag: (tagId: string) => void;
  /** Edit a tag's name and colour */
  onEditTag: (tagId: string, name: string, color: string) => void;
  /** Navigate back */
  onBack: () => void;
  /** Show a loading overlay when true */
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Preset colour palette for tag creation/editing */
const PRESET_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#ef4444", // red
  "#fbbf24", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
] as const;

/** Category options for new/edited tags */
const CATEGORY_OPTIONS = [
  { key: "product", label: "Product" },
  { key: "customer", label: "Customer" },
  { key: "order", label: "Order" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TagManagerComponent: React.FC<TagManagerProps> = function TagManagerComponent({
    tags,
    onCreateTag,
    onDeleteTag,
    onEditTag,
    onBack,
    isLoading = false,
  }) {
    // -------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------
    const [searchQuery, setSearchQuery] = useState("");

    // Create / edit modal
    const [modalVisible, setModalVisible] = useState(false);
    /** ID of tag being edited; null when creating a new tag */
    const [editingTagId, setEditingTagId] = useState<string | null>(null);
    const [formName, setFormName] = useState("");
    const [formColor, setFormColor] = useState(PRESET_COLORS[0]);
    const [formCategory, setFormCategory] = useState<string>("product");

    // Delete confirmation modal
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deletingTag, setDeletingTag] = useState<Tag | null>(null);

    // -------------------------------------------------------------------
    // Derived data
    // -------------------------------------------------------------------

    /** Tags filtered by the search query */
    const filteredTags = useMemo(() => {
      if (!searchQuery.trim()) return tags;
      const q = searchQuery.toLowerCase();
      return tags.filter((t) => t.name.toLowerCase().includes(q));
    }, [tags, searchQuery]);

    /** Category counts for the stats bar */
    const stats = useMemo(() => {
      const counts: Record<string, number> = { product: 0, customer: 0, order: 0 };
      for (const tag of tags) {
        if (tag.category in counts) {
          counts[tag.category] += 1;
        }
      }
      return { total: tags.length, ...counts };
    }, [tags]);

    /**
     * Group filtered tags by category for section-style rendering.
     * FlatList renders a flat array; we insert header items inline.
     */
    type ListItem =
      | { type: "header"; category: string }
      | { type: "tag"; tag: Tag };

    const listData: ListItem[] = useMemo(() => {
      const grouped: Record<string, Tag[]> = {};
      for (const tag of filteredTags) {
        (grouped[tag.category] ??= []).push(tag);
      }
      const items: ListItem[] = [];
      for (const category of ["product", "customer", "order"]) {
        const group = grouped[category];
        if (group && group.length > 0) {
          items.push({ type: "header", category });
          for (const tag of group) {
            items.push({ type: "tag", tag });
          }
        }
      }
      return items;
    }, [filteredTags]);

    // -------------------------------------------------------------------
    // Modal handlers
    // -------------------------------------------------------------------

    const openCreateModal = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setEditingTagId(null);
      setFormName("");
      setFormColor(PRESET_COLORS[0]);
      setFormCategory("product");
      setModalVisible(true);
    }, []);

    const openEditModal = useCallback(
      (tag: Tag) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditingTagId(tag.id);
        setFormName(tag.name);
        setFormColor(tag.color);
        setFormCategory(tag.category);
        setModalVisible(true);
      },
      [],
    );

    const handleSave = useCallback(() => {
      const trimmed = formName.trim();
      if (!trimmed) return;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (editingTagId) {
        onEditTag(editingTagId, trimmed, formColor);
      } else {
        onCreateTag(trimmed, formColor, formCategory);
      }
      setModalVisible(false);
    }, [editingTagId, formName, formColor, formCategory, onEditTag, onCreateTag]);

    const handleCancelModal = useCallback(() => {
      setModalVisible(false);
    }, []);

    // -------------------------------------------------------------------
    // Delete handlers
    // -------------------------------------------------------------------

    const openDeleteModal = useCallback((tag: Tag) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setDeletingTag(tag);
      setDeleteModalVisible(true);
    }, []);

    const confirmDelete = useCallback(() => {
      if (!deletingTag) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onDeleteTag(deletingTag.id);
      setDeleteModalVisible(false);
      setDeletingTag(null);
    }, [deletingTag, onDeleteTag]);

    const cancelDelete = useCallback(() => {
      setDeleteModalVisible(false);
      setDeletingTag(null);
    }, []);

    // -------------------------------------------------------------------
    // List rendering
    // -------------------------------------------------------------------

    const renderItem = useCallback(
      ({ item }: { item: ListItem }) => {
        if (item.type === "header") {
          return (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>
                {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
              </Text>
            </View>
          );
        }

        const { tag } = item;
        return (
          <View style={styles.tagRow} testID={`tag-row-${tag.id}`}>
            {/* Colour swatch */}
            <View style={[styles.colorSwatch, { backgroundColor: tag.color }]} />

            {/* Name + count */}
            <View style={styles.tagInfo}>
              <Text style={styles.tagName} numberOfLines={1}>
                {tag.name}
              </Text>
              <Text style={styles.tagCount}>
                {tag.count} {tag.count === 1 ? "item" : "items"}
              </Text>
            </View>

            {/* Actions */}
            <Pressable
              testID={`tag-edit-${tag.id}`}
              style={styles.actionBtn}
              onPress={() => openEditModal(tag)}
              hitSlop={8}
              accessibilityLabel={`Edit ${tag.name}`}
              accessibilityRole="button"
            >
              <Ionicons name="pencil" size={18} color="#3b82f6" />
            </Pressable>
            <Pressable
              testID={`tag-delete-${tag.id}`}
              style={styles.actionBtn}
              onPress={() => openDeleteModal(tag)}
              hitSlop={8}
              accessibilityLabel={`Delete ${tag.name}`}
              accessibilityRole="button"
            >
              <Ionicons name="trash" size={18} color="#ef4444" />
            </Pressable>
          </View>
        );
      },
      [openEditModal, openDeleteModal],
    );

    const keyExtractor = useCallback(
      (item: ListItem, index: number) =>
        item.type === "header" ? `header-${item.category}` : item.tag.id,
      [],
    );

    // -------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------

    return (
      <View style={styles.container} testID="tag-manager">
        {/* ---- Header ---- */}
        <View style={styles.header}>
          <Pressable
            testID="tag-manager-back"
            onPress={onBack}
            hitSlop={8}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color="#f3f4f6" />
          </Pressable>
          <Text style={styles.title}>Tag Manager</Text>
          <Pressable
            testID="tag-manager-new"
            style={styles.newBtn}
            onPress={openCreateModal}
            accessibilityLabel="Create new tag"
            accessibilityRole="button"
          >
            <Ionicons name="add-circle" size={28} color="#3b82f6" />
          </Pressable>
        </View>

        {/* ---- Search bar ---- */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            testID="tag-manager-search"
            style={styles.searchInput}
            placeholder="Filter tags…"
            placeholderTextColor="#6b7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Filter tags by name"
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery("")}
              hitSlop={8}
              accessibilityLabel="Clear filter"
              accessibilityRole="button"
            >
              <Ionicons name="close-circle" size={18} color="#6b7280" />
            </Pressable>
          )}
        </View>

        {/* ---- Stats bar ---- */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#3b82f6" }]}>
              {stats.product}
            </Text>
            <Text style={styles.statLabel}>Product</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#22c55e" }]}>
              {stats.customer}
            </Text>
            <Text style={styles.statLabel}>Customer</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#fbbf24" }]}>
              {stats.order}
            </Text>
            <Text style={styles.statLabel}>Order</Text>
          </View>
        </View>

        {/* ---- Loading overlay ---- */}
        {isLoading && (
          <View style={styles.loadingOverlay} testID="tag-manager-loading">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        )}

        {/* ---- Tag list ---- */}
        {!isLoading && listData.length === 0 ? (
          <View style={styles.emptyContainer} testID="tag-manager-empty">
            <Ionicons name="pricetags-outline" size={48} color="#4b5563" />
            <Text style={styles.emptyText}>
              {searchQuery ? "No tags match your filter" : "No tags yet"}
            </Text>
          </View>
        ) : (
          <FlatList
            testID="tag-manager-list"
            data={listData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* ---- Create / Edit Modal ---- */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCancelModal}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard} testID="tag-create-modal">
              <Text style={styles.modalTitle}>
                {editingTagId ? "Edit Tag" : "New Tag"}
              </Text>

              {/* Name input */}
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                testID="tag-create-name"
                style={styles.modalInput}
                placeholder="Tag name"
                placeholderTextColor="#6b7280"
                value={formName}
                onChangeText={setFormName}
                autoCapitalize="words"
                maxLength={50}
                accessibilityLabel="Tag name"
              />

              {/* Colour picker */}
              <Text style={styles.fieldLabel}>Colour</Text>
              <View style={styles.colorPicker}>
                {PRESET_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    style={[
                      styles.colorOption,
                      { backgroundColor: c },
                      formColor === c && styles.colorOptionSelected,
                    ]}
                    onPress={() => setFormColor(c)}
                    accessibilityLabel={`Colour ${c}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: formColor === c }}
                  />
                ))}
              </View>

              {/* Category selector (only for creation — category is immutable on edit) */}
              {!editingTagId && (
                <>
                  <Text style={styles.fieldLabel}>Category</Text>
                  <View style={styles.categoryRow}>
                    {CATEGORY_OPTIONS.map((opt) => {
                      const isActive = formCategory === opt.key;
                      return (
                        <Pressable
                          key={opt.key}
                          style={[
                            styles.categoryPill,
                            isActive && styles.categoryPillActive,
                          ]}
                          onPress={() => setFormCategory(opt.key)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isActive }}
                          accessibilityLabel={`${opt.label} category`}
                        >
                          <Text
                            style={[
                              styles.categoryPillText,
                              isActive && styles.categoryPillTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Action buttons */}
              <View style={styles.modalActions}>
                <Pressable
                  testID="tag-create-cancel"
                  style={styles.cancelBtn}
                  onPress={handleCancelModal}
                  accessibilityLabel="Cancel"
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  testID="tag-create-save"
                  style={[
                    styles.saveBtn,
                    !formName.trim() && styles.saveBtnDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={!formName.trim()}
                  accessibilityLabel="Save tag"
                  accessibilityRole="button"
                >
                  <Text style={styles.saveBtnText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* ---- Delete Confirmation Modal ---- */}
        <Modal
          visible={deleteModalVisible}
          transparent
          animationType="fade"
          onRequestClose={cancelDelete}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard} testID="tag-delete-modal">
              <Ionicons
                name="warning"
                size={32}
                color="#ef4444"
                style={styles.deleteIcon}
              />
              <Text style={styles.modalTitle}>Delete Tag</Text>
              <Text style={styles.deleteMessage}>
                Delete "{deletingTag?.name}"? This cannot be undone.
              </Text>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={cancelDelete}
                  accessibilityLabel="Cancel deletion"
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  testID="tag-delete-confirm"
                  style={styles.deleteBtn}
                  onPress={confirmDelete}
                  accessibilityLabel="Confirm delete"
                  accessibilityRole="button"
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  };

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    padding: 16,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  newBtn: { padding: 4 },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: "#f3f4f6",
  },

  // Stats bar
  statsBar: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 4,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#9ca3af",
    marginTop: 2,
  },

  // Loading
  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
    marginTop: 12,
  },

  // List
  listContent: { paddingBottom: 24 },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Tag row
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  tagInfo: {
    flex: 1,
  },
  tagName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  tagCount: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  actionBtn: {
    padding: 8,
    marginLeft: 4,
  },

  // Modal shared
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#1f2937",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 440,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 16,
    textAlign: "center",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#f3f4f6",
  },

  // Colour picker
  colorPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorOptionSelected: {
    borderColor: "#ffffff",
    borderWidth: 3,
  },

  // Category pills (create modal)
  categoryRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  categoryPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  categoryPillActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  categoryPillText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
  },
  categoryPillTextActive: {
    color: "#ffffff",
  },

  // Modal actions
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#374151",
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#3b82f6",
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },

  // Delete modal
  deleteIcon: {
    alignSelf: "center",
    marginBottom: 8,
  },
  deleteMessage: {
    fontSize: 15,
    color: "#d1d5db",
    textAlign: "center",
    marginBottom: 8,
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    alignItems: "center",
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
});

export default React.memo(TagManagerComponent) as typeof TagManagerComponent;
