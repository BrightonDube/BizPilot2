/**
 * BizPilot Mobile POS — GuestSearchModal Component
 *
 * Full-screen modal for searching and selecting a hotel guest to charge
 * a POS order to their room folio. Tablet-first layout with large touch
 * targets, dark theme, and offline-safe (works from a pre-fetched guest
 * list — no network call inside the modal itself).
 *
 * Why a modal instead of a page?
 * The cashier is mid-transaction on the POS screen; we overlay guest
 * search so they never lose context of the current order.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";
import type { GuestProfile } from "@/services/pms/PMSService";
import {
  searchGuests,
  calculateGuestAvailableCredit,
  isGuestCheckingOutToday,
} from "@/services/pms/PMSService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GuestSearchModalProps {
  visible: boolean;
  guests: GuestProfile[];
  onSelectGuest: (guest: GuestProfile) => void;
  onClose: () => void;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Credit-utilisation progress bar. */
const CreditBar = React.memo(function CreditBar({
  current,
  limit,
}: {
  current: number;
  limit: number;
}) {
  const ratio = limit > 0 ? Math.min(current / limit, 1) : 0;
  const barColor = ratio > 0.85 ? "#ef4444" : ratio > 0.6 ? "#f59e0b" : "#22c55e";

  return (
    <View style={styles.creditBarTrack}>
      <View
        style={[
          styles.creditBarFill,
          { width: `${Math.round(ratio * 100)}%`, backgroundColor: barColor },
        ]}
      />
    </View>
  );
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const GuestSearchModal: React.FC<GuestSearchModalProps> = React.memo(
  function GuestSearchModal({
    visible,
    guests,
    onSelectGuest,
    onClose,
    isLoading = false,
  }) {
    const [query, setQuery] = useState("");
    const now = useMemo(() => new Date(), []);

    const filtered = useMemo(
      () => searchGuests(guests, query),
      [guests, query]
    );

    const handleSelect = useCallback(
      (guest: GuestProfile) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelectGuest(guest);
      },
      [onSelectGuest]
    );

    const handleClose = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setQuery("");
      onClose();
    }, [onClose]);

    // -- Render helpers -------------------------------------------------------

    const renderGuest = useCallback(
      ({ item }: ListRenderItemInfo<GuestProfile>) => {
        const available = calculateGuestAvailableCredit(item);
        const checkingOut = isGuestCheckingOutToday(item, now);

        return (
          <Pressable
            testID={`guest-card-${item.id}`}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
            onPress={() => handleSelect(item)}
          >
            {/* Top row — room number + guest name */}
            <View style={styles.cardRow}>
              <View style={styles.roomBadge}>
                <Ionicons name="bed-outline" size={16} color="#93c5fd" />
                <Text style={styles.roomNumber}>{item.roomNumber}</Text>
              </View>

              <Text style={styles.guestName} numberOfLines={1}>
                {item.guestName}
              </Text>

              {item.vipStatus && (
                <View style={styles.vipBadge}>
                  <Ionicons name="star" size={12} color="#fbbf24" />
                  <Text style={styles.vipText}>VIP</Text>
                </View>
              )}
            </View>

            {/* Dates */}
            <Text style={styles.dates}>
              {item.checkInDate} → {item.checkOutDate}
            </Text>

            {/* Credit info */}
            <View style={styles.creditRow}>
              <Text style={styles.creditLabel}>
                {formatCurrency(item.currentBalance)} /{" "}
                {formatCurrency(item.creditLimit)}
              </Text>
              <Text style={styles.creditAvailable}>
                {formatCurrency(available)} available
              </Text>
            </View>

            <CreditBar current={item.currentBalance} limit={item.creditLimit} />

            {/* Checkout warning */}
            {checkingOut && (
              <View style={styles.warningRow}>
                <Ionicons
                  name="warning-outline"
                  size={14}
                  color="#f59e0b"
                />
                <Text style={styles.warningText}>Checking out today</Text>
              </View>
            )}
          </Pressable>
        );
      },
      [handleSelect, now]
    );

    const keyExtractor = useCallback((g: GuestProfile) => g.id, []);

    const ListEmpty = useMemo(() => {
      if (isLoading) {
        return (
          <View testID="guest-loading" style={styles.centered}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.emptyText}>Loading guests…</Text>
          </View>
        );
      }
      return (
        <View testID="guest-empty" style={styles.centered}>
          <Ionicons name="search-outline" size={48} color="#6b7280" />
          <Text style={styles.emptyText}>
            {query.length > 0
              ? "No guests match your search"
              : "No guests available"}
          </Text>
        </View>
      );
    }, [isLoading, query]);

    // -- Main render ----------------------------------------------------------

    return (
      <Modal
        testID="guest-search-modal"
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleClose}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Find Guest</Text>
            <Pressable
              testID="guest-close-btn"
              onPress={handleClose}
              hitSlop={12}
            >
              <Ionicons name="close" size={28} color="#f3f4f6" />
            </Pressable>
          </View>

          {/* Search input */}
          <View style={styles.searchWrapper}>
            <Ionicons
              name="search-outline"
              size={20}
              color="#9ca3af"
              style={styles.searchIcon}
            />
            <TextInput
              testID="guest-search-input"
              style={styles.searchInput}
              placeholder="Search by room number or guest name…"
              placeholderTextColor="#6b7280"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color="#6b7280" />
              </Pressable>
            )}
          </View>

          {/* Guest list */}
          <FlatList
            testID="guest-list"
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderGuest}
            ListEmptyComponent={ListEmpty}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </Modal>
    );
  }
);

export default GuestSearchModal;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    color: "#f3f4f6",
    fontSize: 20,
    fontWeight: "700",
  },

  // Search
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4b5563",
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 16,
    paddingVertical: 12,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Card
  card: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4b5563",
    padding: 16,
    marginTop: 10,
  },
  cardPressed: {
    backgroundColor: "#374151",
    transform: [{ scale: 0.98 }],
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // Room badge
  roomBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e3a5f",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  roomNumber: {
    color: "#93c5fd",
    fontSize: 18,
    fontWeight: "800",
  },

  // Guest name
  guestName: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 16,
    fontWeight: "600",
  },

  // VIP badge
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#422006",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  vipText: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "700",
  },

  // Dates
  dates: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 6,
  },

  // Credit
  creditRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  creditLabel: {
    color: "#9ca3af",
    fontSize: 13,
  },
  creditAvailable: {
    color: "#22c55e",
    fontSize: 13,
    fontWeight: "600",
  },

  // Credit bar
  creditBarTrack: {
    height: 4,
    backgroundColor: "#374151",
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  },
  creditBarFill: {
    height: "100%",
    borderRadius: 2,
  },

  // Warning
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 4,
  },
  warningText: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "600",
  },

  // Empty / loading
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 15,
  },
});
