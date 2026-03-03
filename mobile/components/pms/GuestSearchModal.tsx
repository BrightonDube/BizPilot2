/**
 * BizPilot Mobile POS — GuestSearchModal Component
 *
 * Modal for searching hotel guests by room number or name.
 * Used during the POS checkout flow when "Room Charge" is selected.
 *
 * Why two search modes (room + name)?
 * - Room number: fastest for staff who know where the guest is dining from
 * - Name search: for when the guest mentions their name but not their room
 * Both are common in hotel F&B operations.
 *
 * Layout: segmented control for search mode, then search input, then results.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Modal, Badge } from "@/components/ui";
import { useGuestSearch } from "@/hooks/useGuestSearch";
import type { PMSGuest } from "@/types/pms";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GuestSearchModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Called when a guest is selected */
  onSelectGuest: (guest: PMSGuest) => void;
}

// ---------------------------------------------------------------------------
// Search mode type
// ---------------------------------------------------------------------------

type SearchMode = "room" | "name";

// ---------------------------------------------------------------------------
// Guest row sub-component
// ---------------------------------------------------------------------------

interface GuestRowProps {
  guest: PMSGuest;
  onPress: (guest: PMSGuest) => void;
}

const GuestRow: React.FC<GuestRowProps> = React.memo(function GuestRow({
  guest,
  onPress,
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(guest);
  }, [guest, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={!guest.canCharge}
      style={({ pressed }) => [
        styles.guestRow,
        pressed && styles.guestRowPressed,
        !guest.canCharge && styles.guestRowDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Select guest ${guest.name}, room ${guest.roomNumber}`}
    >
      <View style={styles.guestInfo}>
        <View style={styles.guestNameRow}>
          <Text style={styles.guestName}>{guest.name}</Text>
          {guest.vipLevel > 0 && (
            <Badge label={`VIP ${guest.vipLevel}`} variant="warning" />
          )}
        </View>
        <Text style={styles.guestRoom}>
          Room {guest.roomNumber} · Folio {guest.folioNumber}
        </Text>
        <Text style={styles.guestDates}>
          {new Date(guest.checkInDate).toLocaleDateString()} –{" "}
          {new Date(guest.checkOutDate).toLocaleDateString()}
        </Text>
      </View>

      {!guest.canCharge ? (
        <View style={styles.noChargeTag}>
          <Text style={styles.noChargeText}>No Charge</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#6b7280" />
      )}
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const GuestSearchModal: React.FC<GuestSearchModalProps> = React.memo(
  function GuestSearchModal({ visible, onClose, onSelectGuest }) {
    const [searchMode, setSearchMode] = useState<SearchMode>("room");
    const [query, setQuery] = useState("");
    const { results, loading, error, searchByRoom, searchByName, clearResults } =
      useGuestSearch();

    const handleSearchModeChange = useCallback(
      (mode: SearchMode) => {
        setSearchMode(mode);
        setQuery("");
        clearResults();
      },
      [clearResults]
    );

    const handleQueryChange = useCallback(
      (text: string) => {
        setQuery(text);
        if (searchMode === "room") {
          searchByRoom(text);
        } else {
          searchByName(text);
        }
      },
      [searchMode, searchByRoom, searchByName]
    );

    const handleSelectGuest = useCallback(
      (guest: PMSGuest) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSelectGuest(guest);
        onClose();
        // Reset state for next open
        setQuery("");
        clearResults();
      },
      [onSelectGuest, onClose, clearResults]
    );

    const handleClose = useCallback(() => {
      setQuery("");
      clearResults();
      onClose();
    }, [clearResults, onClose]);

    return (
      <Modal visible={visible} onClose={handleClose} title="Find Guest">
        {/* Search mode segmented control */}
        <View style={styles.segmentedControl}>
          <Pressable
            onPress={() => handleSearchModeChange("room")}
            style={[
              styles.segment,
              searchMode === "room" && styles.segmentActive,
            ]}
          >
            <Ionicons
              name="bed-outline"
              size={16}
              color={searchMode === "room" ? "#ffffff" : "#9ca3af"}
            />
            <Text
              style={[
                styles.segmentText,
                searchMode === "room" && styles.segmentTextActive,
              ]}
            >
              Room Number
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleSearchModeChange("name")}
            style={[
              styles.segment,
              searchMode === "name" && styles.segmentActive,
            ]}
          >
            <Ionicons
              name="person-outline"
              size={16}
              color={searchMode === "name" ? "#ffffff" : "#9ca3af"}
            />
            <Text
              style={[
                styles.segmentText,
                searchMode === "name" && styles.segmentTextActive,
              ]}
            >
              Guest Name
            </Text>
          </Pressable>
        </View>

        {/* Search input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleQueryChange}
            placeholder={
              searchMode === "room"
                ? "Enter room number (e.g., 101)"
                : "Search by guest name..."
            }
            placeholderTextColor="#6b7280"
            keyboardType={searchMode === "room" ? "number-pad" : "default"}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => handleQueryChange("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#6b7280" />
            </Pressable>
          )}
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.loadingText}>Searching PMS...</Text>
          </View>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <GuestRow guest={item} onPress={handleSelectGuest} />
            )}
            style={styles.resultsList}
            contentContainerStyle={{ paddingBottom: 16 }}
          />
        )}

        {/* Empty state */}
        {!loading && results.length === 0 && query.length > 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={40} color="#374151" />
            <Text style={styles.emptyText}>No guests found</Text>
            <Text style={styles.emptySubtext}>
              {searchMode === "room"
                ? "Check the room number and try again"
                : "Try searching with a different name"}
            </Text>
          </View>
        )}
      </Modal>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: "#3b82f6",
  },
  segmentText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#ffffff",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    backgroundColor: "#1c1917",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    marginBottom: 8,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 20,
  },
  loadingText: {
    color: "#9ca3af",
    fontSize: 14,
  },
  resultsList: {
    maxHeight: 400,
  },
  guestRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  guestRowPressed: {
    backgroundColor: "#1f2937",
  },
  guestRowDisabled: {
    opacity: 0.5,
  },
  guestInfo: {
    flex: 1,
  },
  guestNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  guestName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  guestRoom: {
    color: "#9ca3af",
    fontSize: 13,
  },
  guestDates: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  noChargeTag: {
    backgroundColor: "#7f1d1d",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  noChargeText: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  emptySubtext: {
    color: "#4b5563",
    fontSize: 13,
    marginTop: 4,
  },
});

export default GuestSearchModal;
