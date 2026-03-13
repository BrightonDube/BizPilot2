/**
 * TagPicker — Tag selection component for filtering and categorisation.
 *
 * Why a dedicated picker instead of a generic multi-select:
 * - Tags carry colour information that a plain checkbox list can't
 *   communicate; the coloured pill/chip presentation gives instant
 *   visual feedback matching how tags appear elsewhere in the app.
 * - Grouped mode (by category) helps staff navigate large tag sets
 *   without scrolling endlessly — critical during busy POS sessions.
 * - maxSelections cap prevents over-tagging which degrades search
 *   quality in reports and analytics.
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  SectionList,
  FlatList,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface Tag {
  id: string;
  name: string;
  /** Hex colour used as the chip background. */
  color: string;
  category: string;
}

export interface TagPickerProps {
  tags: Tag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onClearAll?: () => void;
  /** Show a search input to filter tags by name. */
  searchable?: boolean;
  /** Group tags under category section headers. */
  grouped?: boolean;
  /** Cap on how many tags can be selected at once. */
  maxSelections?: number;
}

// ──────────────────────────────────────────────
// Sub-component: individual tag chip
// ──────────────────────────────────────────────

interface TagChipProps {
  tag: Tag;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: (tagId: string) => void;
}

const TagChip: React.FC<TagChipProps> = React.memo(function TagChip({
  tag,
  isSelected,
  isDisabled,
  onToggle,
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(tag.id);
  }, [onToggle, tag.id]);

  return (
    <Pressable
      style={[
        styles.chip,
        { backgroundColor: isSelected ? tag.color : "#374151" },
        isSelected && styles.chipSelected,
        isDisabled && styles.chipDisabled,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      testID={`tag-picker-tag-${tag.id}`}
      accessibilityLabel={`${tag.name}${isSelected ? ", selected" : ""}`}
      accessibilityRole="button"
    >
      {isSelected && (
        <Ionicons name="checkmark" size={14} color="#ffffff" />
      )}
      <Text
        style={[
          styles.chipText,
          isSelected && styles.chipTextSelected,
          isDisabled && styles.chipTextDisabled,
        ]}
        numberOfLines={1}
      >
        {tag.name}
      </Text>
    </Pressable>
  );
});

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────

const TagPickerComponent: React.FC<TagPickerProps> = function TagPickerComponent({
  tags,
  selectedTagIds,
  onToggleTag,
  onClearAll,
  searchable = false,
  grouped = false,
  maxSelections,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const selectedSet = useMemo(
    () => new Set(selectedTagIds),
    [selectedTagIds],
  );

  const selectedCount = selectedTagIds.length;

  /** Whether the selection cap has been reached. */
  const isAtMax = maxSelections != null && selectedCount >= maxSelections;

  // ── Filtering ──

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const q = searchQuery.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, searchQuery]);

  // ── Grouped sections for SectionList ──

  const sections = useMemo(() => {
    if (!grouped) return [];
    const map = new Map<string, Tag[]>();
    for (const tag of filteredTags) {
      const list = map.get(tag.category) ?? [];
      list.push(tag);
      map.set(tag.category, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, data]) => ({ title: category, data }));
  }, [filteredTags, grouped]);

  // ── Handlers ──

  const handleToggle = useCallback(
    (tagId: string) => {
      // Allow deselecting even when at max
      if (isAtMax && !selectedSet.has(tagId)) return;
      onToggleTag(tagId);
    },
    [onToggleTag, isAtMax, selectedSet],
  );

  const handleClearAll = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onClearAll?.();
  }, [onClearAll]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  // ── Render helpers ──

  const isChipDisabled = useCallback(
    (tagId: string) => isAtMax && !selectedSet.has(tagId),
    [isAtMax, selectedSet],
  );

  const renderChip = useCallback(
    ({ item }: { item: Tag }) => (
      <TagChip
        tag={item}
        isSelected={selectedSet.has(item.id)}
        isDisabled={isChipDisabled(item.id)}
        onToggle={handleToggle}
      />
    ),
    [selectedSet, isChipDisabled, handleToggle],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <Text
        style={styles.sectionHeader}
        testID={`tag-picker-category-${section.title}`}
      >
        {section.title}
      </Text>
    ),
    [],
  );

  const keyExtractor = useCallback((item: Tag) => item.id, []);

  // ── Main render ──

  return (
    <View style={styles.container} testID="tag-picker">
      {/* Search bar */}
      {searchable && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder="Search tags…"
            placeholderTextColor="#6b7280"
            testID="tag-picker-search"
            accessibilityLabel="Search tags"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#6b7280" />
            </Pressable>
          )}
        </View>
      )}

      {/* Toolbar: count + clear */}
      <View style={styles.toolbar}>
        <Text style={styles.countText} testID="tag-picker-count">
          {selectedCount}
          {maxSelections != null ? `/${maxSelections}` : `/${tags.length}`}{" "}
          selected
        </Text>

        {selectedCount > 0 && onClearAll && (
          <Pressable
            style={styles.clearBtn}
            onPress={handleClearAll}
            testID="tag-picker-clear"
            accessibilityLabel="Clear all selected tags"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={16} color="#ef4444" />
            <Text style={styles.clearBtnText}>Clear All</Text>
          </Pressable>
        )}
      </View>

      {/* Tag grid / list */}
      {grouped ? (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderChip}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <FlatList
          data={filteredTags}
          keyExtractor={keyExtractor}
          renderItem={renderChip}
          numColumns={3}
          columnWrapperStyle={styles.chipRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  // -- Container --
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  // -- Search --
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#111827",
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#f3f4f6",
    paddingVertical: 10,
  },

  // -- Toolbar --
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  countText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minHeight: 48,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ef4444",
  },

  // -- Section headers (grouped mode) --
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },

  // -- Chip grid --
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  chipRow: {
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  // -- Tag chip --
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 48,
    marginBottom: 8,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: "transparent",
  },
  chipSelected: {
    borderColor: "#3b82f6",
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9ca3af",
  },
  chipTextSelected: {
    color: "#ffffff",
  },
  chipTextDisabled: {
    color: "#6b7280",
  },
});

export default React.memo(TagPickerComponent) as typeof TagPickerComponent;
