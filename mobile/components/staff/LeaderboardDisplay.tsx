/**
 * LeaderboardDisplay — Staff performance leaderboard with podium and ranked list.
 *
 * Why a dedicated podium section: Top 3 performers get special visual treatment
 * (gold/silver/bronze) to drive friendly competition and motivation.
 *
 * Why highlight currentUserId: Staff need to immediately spot their own position
 * without scanning the entire list during busy POS shifts.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "../../utils/formatters";

// region — Types

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  value: number;
  target: number | null;
  progressPercent: number;
  trend: "up" | "down" | "stable";
  previousRank: number | null;
}

interface LeaderboardDisplayProps {
  entries: LeaderboardEntry[];
  title: string;
  /** Human-readable metric name shown in the header, e.g. "Sales" */
  metricLabel: string;
  currentUserId: string;
  onEntryPress?: (userId: string) => void;
  isLoading?: boolean;
}

// endregion

// region — Constants

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IS_TABLET = SCREEN_WIDTH >= 768;

const MEDAL_COLORS: Record<number, string> = {
  1: "#fbbf24", // gold
  2: "#9ca3af", // silver
  3: "#d97706", // bronze
};

const TREND_CONFIG = {
  up: { icon: "arrow-up" as const, color: "#22c55e", label: "▲" },
  down: { icon: "arrow-down" as const, color: "#ef4444", label: "▼" },
  stable: { icon: "remove" as const, color: "#6b7280", label: "=" },
};

// endregion

// region — Helpers

/** Extract up to two initials from a display name for avatar fallback. */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Rank‐change indicator relative to previousRank (null → new entry). */
function getRankDelta(
  currentRank: number,
  previousRank: number | null
): string | null {
  if (previousRank === null) return null;
  const delta = previousRank - currentRank;
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return null;
}

// endregion

// region — Sub-components

/** Avatar with image or initial-based fallback. */
const Avatar = React.memo(function Avatar({
  avatarUrl,
  userName,
  size,
}: {
  avatarUrl: string | null;
  userName: string;
  size: number;
}) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarInitials, { fontSize: size * 0.38 }]}>
        {getInitials(userName)}
      </Text>
    </View>
  );
});

/** Podium card for a top-3 entry — medal icon, avatar, name, value. */
const PodiumCard = React.memo(function PodiumCard({
  entry,
  isCurrentUser,
  onPress,
  metricLabel,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  onPress?: (userId: string) => void;
  metricLabel: string;
}) {
  const medalColor = MEDAL_COLORS[entry.rank] ?? "#6b7280";
  /* First place gets a larger card so it visually "stands taller" on the podium. */
  const isFirst = entry.rank === 1;
  const avatarSize = isFirst ? (IS_TABLET ? 72 : 60) : IS_TABLET ? 60 : 48;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(entry.userId);
  }, [onPress, entry.userId]);

  return (
    <TouchableOpacity
      testID={`leaderboard-entry-${entry.userId}`}
      style={[
        styles.podiumCard,
        isFirst && styles.podiumCardFirst,
        isCurrentUser && styles.currentUserBorder,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${entry.userName}, rank ${entry.rank}, ${metricLabel} ${entry.value}`}
    >
      <Ionicons name="medal-outline" size={24} color={medalColor} />
      <Avatar
        avatarUrl={entry.avatarUrl}
        userName={entry.userName}
        size={avatarSize}
      />
      <Text style={styles.podiumName} numberOfLines={1}>
        {entry.userName}
      </Text>
      <Text style={[styles.podiumValue, { color: medalColor }]}>
        {formatCurrency(entry.value)}
      </Text>
      {entry.target !== null && (
        <View style={styles.podiumProgressOuter}>
          <View
            style={[
              styles.podiumProgressInner,
              {
                width: `${Math.min(entry.progressPercent, 100)}%`,
                backgroundColor:
                  entry.progressPercent >= 100 ? "#22c55e" : "#3b82f6",
              },
            ]}
          />
        </View>
      )}
    </TouchableOpacity>
  );
});

/** A single row in the ranked list (entries 4+). */
const LeaderboardRow = React.memo(function LeaderboardRow({
  entry,
  isCurrentUser,
  onPress,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  onPress?: (userId: string) => void;
}) {
  const trend = TREND_CONFIG[entry.trend];
  const delta = getRankDelta(entry.rank, entry.previousRank);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(entry.userId);
  }, [onPress, entry.userId]);

  return (
    <TouchableOpacity
      testID={`leaderboard-entry-${entry.userId}`}
      style={[styles.row, isCurrentUser && styles.currentUserBorder]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Rank ${entry.rank}, ${entry.userName}, ${entry.value}`}
    >
      {/* Rank */}
      <View style={styles.rankContainer}>
        <Text style={styles.rankText}>{entry.rank}</Text>
        {delta && (
          <Text style={[styles.rankDelta, { color: trend.color }]}>
            {delta}
          </Text>
        )}
      </View>

      {/* Trend arrow */}
      <Ionicons
        name={trend.icon}
        size={16}
        color={trend.color}
        style={styles.trendIcon}
      />

      {/* Avatar */}
      <Avatar
        avatarUrl={entry.avatarUrl}
        userName={entry.userName}
        size={IS_TABLET ? 40 : 34}
      />

      {/* Name & value */}
      <View style={styles.rowInfo}>
        <Text
          style={[styles.rowName, isCurrentUser && styles.rowNameHighlight]}
          numberOfLines={1}
        >
          {entry.userName}
        </Text>
        {entry.target !== null && (
          <View style={styles.rowProgressOuter}>
            <View
              style={[
                styles.rowProgressInner,
                {
                  width: `${Math.min(entry.progressPercent, 100)}%`,
                  backgroundColor:
                    entry.progressPercent >= 100 ? "#22c55e" : "#3b82f6",
                },
              ]}
            />
          </View>
        )}
      </View>

      <Text style={styles.rowValue}>{formatCurrency(entry.value)}</Text>
    </TouchableOpacity>
  );
});

// endregion

// region — Main component

function LeaderboardDisplayComponent({
  entries,
  title,
  metricLabel,
  currentUserId,
  onEntryPress,
  isLoading = false,
}: LeaderboardDisplayProps) {
  /* Split entries into podium (top 3) and the remaining ranked list. */
  const { podiumEntries, listEntries } = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.rank - b.rank);
    return {
      podiumEntries: sorted.slice(0, 3),
      listEntries: sorted.slice(3),
    };
  }, [entries]);

  const renderRow = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <LeaderboardRow
        entry={item}
        isCurrentUser={item.userId === currentUserId}
        onPress={onEntryPress}
      />
    ),
    [currentUserId, onEntryPress]
  );

  const keyExtractor = useCallback(
    (item: LeaderboardEntry) => item.userId,
    []
  );

  // — Loading state
  if (isLoading) {
    return (
      <View
        testID="leaderboard-loading"
        style={styles.centeredContainer}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading leaderboard"
      >
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading leaderboard…</Text>
      </View>
    );
  }

  // — Empty state
  if (entries.length === 0) {
    return (
      <View
        testID="leaderboard-empty"
        style={styles.centeredContainer}
        accessibilityRole="text"
        accessibilityLabel="No leaderboard data"
      >
        <Ionicons name="trophy-outline" size={48} color="#6b7280" />
        <Text style={styles.emptyTitle}>No Leaderboard Data</Text>
        <Text style={styles.emptySubtitle}>
          Performance data will appear here once sales are recorded.
        </Text>
      </View>
    );
  }

  return (
    <View testID="leaderboard-display" style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.metricLabel}>{metricLabel}</Text>
      </View>

      {/* Podium — top 3 */}
      {podiumEntries.length > 0 && (
        <View testID="leaderboard-podium" style={styles.podiumRow}>
          {/* Render in visual order: 2nd, 1st, 3rd for classic podium layout */}
          {podiumEntries[1] && (
            <PodiumCard
              entry={podiumEntries[1]}
              isCurrentUser={podiumEntries[1].userId === currentUserId}
              onPress={onEntryPress}
              metricLabel={metricLabel}
            />
          )}
          {podiumEntries[0] && (
            <PodiumCard
              entry={podiumEntries[0]}
              isCurrentUser={podiumEntries[0].userId === currentUserId}
              onPress={onEntryPress}
              metricLabel={metricLabel}
            />
          )}
          {podiumEntries[2] && (
            <PodiumCard
              entry={podiumEntries[2]}
              isCurrentUser={podiumEntries[2].userId === currentUserId}
              onPress={onEntryPress}
              metricLabel={metricLabel}
            />
          )}
        </View>
      )}

      {/* Full ranked list (4+) */}
      {listEntries.length > 0 && (
        <FlatList
          testID="leaderboard-list"
          data={listEntries}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// endregion

// region — Styles

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    padding: IS_TABLET ? 24 : 16,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },

  // Header
  header: {
    marginBottom: IS_TABLET ? 20 : 14,
  },
  title: {
    fontSize: IS_TABLET ? 24 : 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  metricLabel: {
    fontSize: IS_TABLET ? 15 : 13,
    color: "#9ca3af",
    marginTop: 2,
  },

  // Podium
  podiumRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    marginBottom: IS_TABLET ? 24 : 16,
    gap: IS_TABLET ? 16 : 10,
  },
  podiumCard: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 14,
    padding: IS_TABLET ? 16 : 12,
    alignItems: "center",
    gap: 6,
  },
  podiumCardFirst: {
    /* First place rises above siblings to create the "podium" feel. */
    paddingVertical: IS_TABLET ? 22 : 18,
    backgroundColor: "#1e293b",
  },
  podiumName: {
    fontSize: IS_TABLET ? 14 : 12,
    fontWeight: "600",
    color: "#f3f4f6",
    textAlign: "center",
  },
  podiumValue: {
    fontSize: IS_TABLET ? 16 : 14,
    fontWeight: "700",
  },
  podiumProgressOuter: {
    width: "100%",
    height: 4,
    backgroundColor: "#374151",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 4,
  },
  podiumProgressInner: {
    height: "100%",
    borderRadius: 2,
  },

  // Avatar
  avatar: {
    backgroundColor: "#374151",
  },
  avatarFallback: {
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    color: "#f3f4f6",
    fontWeight: "700",
  },

  // List rows
  listContent: {
    gap: IS_TABLET ? 10 : 8,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: IS_TABLET ? 14 : 10,
    gap: IS_TABLET ? 12 : 8,
  },
  currentUserBorder: {
    borderWidth: 1.5,
    borderColor: "#3b82f6",
  },
  rankContainer: {
    width: IS_TABLET ? 36 : 30,
    alignItems: "center",
  },
  rankText: {
    fontSize: IS_TABLET ? 18 : 16,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  rankDelta: {
    fontSize: 10,
    fontWeight: "600",
  },
  trendIcon: {
    marginRight: 2,
  },
  rowInfo: {
    flex: 1,
    gap: 4,
  },
  rowName: {
    fontSize: IS_TABLET ? 15 : 13,
    fontWeight: "500",
    color: "#f3f4f6",
  },
  rowNameHighlight: {
    fontWeight: "700",
    color: "#3b82f6",
  },
  rowValue: {
    fontSize: IS_TABLET ? 15 : 13,
    fontWeight: "700",
    color: "#22c55e",
  },
  rowProgressOuter: {
    height: 3,
    backgroundColor: "#374151",
    borderRadius: 2,
    overflow: "hidden",
  },
  rowProgressInner: {
    height: "100%",
    borderRadius: 2,
  },

  // States
  loadingText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: IS_TABLET ? 18 : 16,
    fontWeight: "600",
    color: "#f3f4f6",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: IS_TABLET ? 14 : 12,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 4,
  },
});

// endregion

export default React.memo(
  LeaderboardDisplayComponent
) as typeof LeaderboardDisplayComponent;
