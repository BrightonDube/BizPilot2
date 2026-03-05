/**
 * LocationListScreen — Displays all business locations with inventory summaries.
 *
 * Each card surfaces the key health metrics (product count, total value,
 * low-stock alerts) so managers can triage without drilling in.
 */
import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface LocationSummary {
  id: string;
  name: string;
  address: string;
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  lastSyncAt: string;
  isActive: boolean;
}

export interface LocationListScreenProps {
  locations: LocationSummary[];
  onLocationPress: (locationId: string) => void;
  onAddLocation: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isLoading?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Format an ISO timestamp to a human-friendly relative string. */
const formatLastSync = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

interface LocationCardProps {
  location: LocationSummary;
  onPress: (id: string) => void;
}

/**
 * Individual location card rendered inside the FlatList.
 * Memoised to avoid re-renders when sibling cards change.
 */
const LocationCard = React.memo<LocationCardProps>(
  function LocationCard({ location, onPress }) {
    const handlePress = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress(location.id);
    }, [location.id, onPress]);

    return (
      <TouchableOpacity
        testID={`location-card-${location.id}`}
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {/* ---- Name row + active badge ---- */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>
            {location.name}
          </Text>

          <View
            style={[
              styles.badge,
              location.isActive ? styles.badgeActive : styles.badgeInactive,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                location.isActive
                  ? styles.badgeTextActive
                  : styles.badgeTextInactive,
              ]}
            >
              {location.isActive ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>

        {/* ---- Address ---- */}
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={14} color="#9ca3af" />
          <Text style={styles.addressText} numberOfLines={1}>
            {location.address}
          </Text>
        </View>

        {/* ---- Stats row ---- */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="cube-outline" size={16} color="#3b82f6" />
            <Text style={styles.statValue}>{location.totalProducts}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>

          <View style={styles.stat}>
            <Ionicons name="cash-outline" size={16} color="#22c55e" />
            <Text style={styles.statValue}>
              {formatCurrency(location.totalValue)}
            </Text>
            <Text style={styles.statLabel}>Value</Text>
          </View>

          {/* Low-stock badge — only shown when count > 0 */}
          {location.lowStockCount > 0 && (
            <View style={styles.stat}>
              <Ionicons name="warning-outline" size={16} color="#fbbf24" />
              <Text style={[styles.statValue, styles.lowStockValue]}>
                {location.lowStockCount}
              </Text>
              <Text style={styles.statLabel}>Low Stock</Text>
            </View>
          )}
        </View>

        {/* ---- Last sync ---- */}
        <View style={styles.syncRow}>
          <Ionicons name="sync-outline" size={12} color="#6b7280" />
          <Text style={styles.syncText}>
            Synced {formatLastSync(location.lastSyncAt)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const LocationListScreen: React.FC<LocationListScreenProps> = ({
  locations,
  onLocationPress,
  onAddLocation,
  searchQuery,
  onSearchChange,
  isLoading = false,
}) => {
  /**
   * Filter client-side so the list responds instantly to keystrokes
   * rather than waiting for a network round-trip.
   */
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return locations;
    const q = searchQuery.toLowerCase();
    return locations.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.address.toLowerCase().includes(q),
    );
  }, [locations, searchQuery]);

  const handleAdd = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddLocation();
  }, [onAddLocation]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<LocationSummary>) => (
      <LocationCard location={item} onPress={onLocationPress} />
    ),
    [onLocationPress],
  );

  const keyExtractor = useCallback((item: LocationSummary) => item.id, []);

  /* ---- Empty state ---- */
  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View testID="location-empty" style={styles.emptyContainer}>
        <Ionicons name="business-outline" size={48} color="#4b5563" />
        <Text style={styles.emptyTitle}>No locations found</Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery
            ? "Try a different search term"
            : "Add your first location to get started"}
        </Text>
      </View>
    );
  }, [isLoading, searchQuery]);

  /* ---- Header (rendered above FlatList) ---- */
  const renderHeader = useCallback(
    () => (
      <View style={styles.searchWrapper}>
        <Ionicons
          name="search-outline"
          size={18}
          color="#6b7280"
          style={styles.searchIcon}
        />
        <TextInput
          testID="location-search"
          style={styles.searchInput}
          placeholder="Search locations…"
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={onSearchChange}
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange("")}>
            <Ionicons name="close-circle" size={18} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>
    ),
    [searchQuery, onSearchChange],
  );

  return (
    <View testID="location-list" style={styles.container}>
      {/* ---- Top header bar ---- */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Locations</Text>
        <TouchableOpacity
          testID="location-add"
          style={styles.addButton}
          onPress={handleAdd}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Location</Text>
        </TouchableOpacity>
      </View>

      {/* ---- Loading overlay ---- */}
      {isLoading && (
        <View testID="location-loading" style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading locations…</Text>
        </View>
      )}

      {/* ---- List ---- */}
      {!isLoading && (
        <FlatList<LocationSummary>
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  /* Layout */
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  separator: {
    height: 12,
  },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },

  /* Search */
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginVertical: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 15,
  },

  /* Card */
  card: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#f3f4f6",
    flex: 1,
    marginRight: 8,
  },

  /* Badge */
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeActive: {
    backgroundColor: "rgba(34,197,94,0.15)",
  },
  badgeInactive: {
    backgroundColor: "rgba(107,114,128,0.2)",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  badgeTextActive: {
    color: "#22c55e",
  },
  badgeTextInactive: {
    color: "#6b7280",
  },

  /* Address */
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  addressText: {
    fontSize: 13,
    color: "#9ca3af",
    flex: 1,
  },

  /* Stats */
  statsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  statLabel: {
    fontSize: 12,
    color: "#9ca3af",
  },
  lowStockValue: {
    color: "#fbbf24",
  },

  /* Sync */
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  syncText: {
    fontSize: 11,
    color: "#6b7280",
  },

  /* Loading */
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#9ca3af",
    fontSize: 14,
  },

  /* Empty */
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
});

export default React.memo(LocationListScreen);
