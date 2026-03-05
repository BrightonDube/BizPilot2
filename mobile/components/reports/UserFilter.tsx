/**
 * UserFilter — Filter component for selecting users/staff.
 *
 * Renders a searchable grid of user chips with avatar-initials circles,
 * plus Select All / Clear All convenience buttons.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface UserOption {
  id: string;
  name: string;
  role: string;
  avatarInitials: string;
}

export interface UserFilterProps {
  users: UserOption[];
  selectedUserIds: string[];
  onToggleUser: (userId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  /** When true a search bar is rendered above the chips. */
  searchable?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

interface ChipProps {
  user: UserOption;
  selected: boolean;
  onToggle: (id: string) => void;
}

/**
 * A single selectable chip representing one user.
 * Memoised because the grid can contain many chips and only the toggled
 * chip needs to re-render when selection changes.
 */
const UserChip = React.memo(function UserChip({ user, selected, onToggle }: ChipProps) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(user.id);
  }, [onToggle, user.id]);

  return (
    <TouchableOpacity
      testID={`user-filter-chip-${user.id}`}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Avatar circle */}
      <View style={[styles.avatarCircle, selected && styles.avatarCircleSelected]}>
        {selected ? (
          <Ionicons name="checkmark" size={14} color="#ffffff" />
        ) : (
          <Text style={styles.avatarText}>{user.avatarInitials}</Text>
        )}
      </View>

      {/* Name + role */}
      <View style={styles.chipTextGroup}>
        <Text style={styles.chipName} numberOfLines={1}>
          {user.name}
        </Text>
        <Text style={styles.chipRole} numberOfLines={1}>
          {user.role}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

function UserFilter({
  users,
  selectedUserIds,
  onToggleUser,
  onSelectAll,
  onClearAll,
  searchable = false,
}: UserFilterProps) {
  const [search, setSearch] = useState("");

  // ── Filtering ─────────────────────────────────────────────────────────────

  const visibleUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q),
    );
  }, [users, search]);

  // Build a Set for O(1) lookup inside the chip list.
  const selectedSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectAll();
  }, [onSelectAll]);

  const handleClearAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClearAll();
  }, [onClearAll]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container} testID="user-filter">
      {/* Search bar */}
      {searchable && (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color="#6b7280" />
          <TextInput
            testID="user-filter-search"
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search users…"
            placeholderTextColor="#4b5563"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Bulk action buttons */}
      <View style={styles.bulkRow}>
        <TouchableOpacity
          testID="user-filter-select-all"
          style={styles.bulkBtn}
          onPress={handleSelectAll}
        >
          <Ionicons name="checkmark-done-outline" size={16} color="#3b82f6" />
          <Text style={styles.bulkBtnText}>Select All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="user-filter-clear"
          style={styles.bulkBtn}
          onPress={handleClearAll}
        >
          <Ionicons name="close-outline" size={16} color="#9ca3af" />
          <Text style={styles.bulkBtnTextMuted}>Clear All</Text>
        </TouchableOpacity>

        <Text style={styles.selectionCount}>
          {selectedUserIds.length}/{users.length}
        </Text>
      </View>

      {/* User chips grid */}
      <View style={styles.chipsGrid}>
        {visibleUsers.map((user) => (
          <UserChip
            key={user.id}
            user={user}
            selected={selectedSet.has(user.id)}
            onToggle={onToggleUser}
          />
        ))}

        {/* Empty search result */}
        {visibleUsers.length === 0 && (
          <Text style={styles.noResults}>No users match "{search}"</Text>
        )}
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  } as ViewStyle,

  // ── Search bar ────────────────────────────────────────────────────────────

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: "#374151",
  } as ViewStyle,

  searchInput: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 14,
    padding: 0,
  } as TextStyle,

  // ── Bulk action row ───────────────────────────────────────────────────────

  bulkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  } as ViewStyle,

  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1f2937",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  } as ViewStyle,

  bulkBtnText: {
    color: "#3b82f6",
    fontSize: 12,
    fontWeight: "600",
  } as TextStyle,

  bulkBtnTextMuted: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
  } as TextStyle,

  selectionCount: {
    marginLeft: "auto",
    color: "#6b7280",
    fontSize: 12,
  } as TextStyle,

  // ── Chips grid ────────────────────────────────────────────────────────────

  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  } as ViewStyle,

  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
  } as ViewStyle,

  chipSelected: {
    borderColor: "#3b82f6",
  } as ViewStyle,

  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  } as ViewStyle,

  avatarCircleSelected: {
    backgroundColor: "#3b82f6",
  } as ViewStyle,

  avatarText: {
    color: "#d1d5db",
    fontSize: 11,
    fontWeight: "700",
  } as TextStyle,

  chipTextGroup: {
    gap: 1,
  } as ViewStyle,

  chipName: {
    color: "#f3f4f6",
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 100,
  } as TextStyle,

  chipRole: {
    color: "#6b7280",
    fontSize: 10,
    textTransform: "capitalize",
  } as TextStyle,

  noResults: {
    color: "#6b7280",
    fontSize: 13,
    paddingVertical: 12,
  } as TextStyle,
});

export default React.memo(UserFilter);
