/**
 * IncentiveProgressDisplay — Detailed incentive / bonus progress tracker.
 *
 * Why separate from StaffPersonalDashboard: This component is a dedicated
 * deep-dive view for incentive management, whereas the dashboard shows a
 * condensed summary.  Keeping them separate allows the incentive list to be
 * re-used in manager views and team screens without importing dashboard state.
 *
 * Why animate the progress ring via strokeDasharray: React Native doesn't
 * support conic-gradient; an SVG-based ring (Svg + Circle) is the standard
 * approach for deterministic circular progress bars.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "../../utils/formatters";

// region — Types

interface IncentiveItem {
  id: string;
  name: string;
  description: string;
  incentiveType: string;
  targetValue: number;
  currentValue: number;
  progressPercent: number;
  isAchieved: boolean;
  daysRemaining: number;
  rewardType: string;
  rewardValue: number;
  startDate: string;
  endDate: string;
  isTeam: boolean;
}

interface IncentiveProgressDisplayProps {
  incentives: IncentiveItem[];
  onIncentivePress?: (incentiveId: string) => void;
  isLoading?: boolean;
}

// endregion

// region — Constants

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IS_TABLET = SCREEN_WIDTH >= 768;

/**
 * Circular progress ring dimensions.  Radius and stroke are kept proportional
 * to tablet vs phone layout so the ring doesn't look cramped on small screens.
 */
const RING_SIZE = IS_TABLET ? 72 : 60;
const RING_STROKE = IS_TABLET ? 6 : 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const REWARD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  cash: "cash-outline",
  bonus: "gift-outline",
  time_off: "time-outline",
  voucher: "card-outline",
  prize: "ribbon-outline",
};

// endregion

// region — Helpers

/** Determine status label + colour from progress percentage. */
function getStatus(
  isAchieved: boolean,
  percent: number
): { label: string; color: string; bgColor: string } {
  if (isAchieved) {
    return { label: "Achieved!", color: "#22c55e", bgColor: "#052e16" };
  }
  if (percent >= 80) {
    return { label: "Almost There!", color: "#fbbf24", bgColor: "#451a03" };
  }
  return { label: "In Progress", color: "#3b82f6", bgColor: "#172554" };
}

/** Format ISO date string to a short readable date. */
function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

// endregion

// region — Sub-components

/**
 * Circular progress ring built with bordered views.
 *
 * Why not SVG: To avoid adding react-native-svg as a hard dependency we use a
 * thick-bordered circle with percentage text in the centre.  For a true
 * arc-based ring, SVG <Circle strokeDasharray> would be preferred.
 */
const ProgressRing = React.memo(function ProgressRing({
  percent,
  isAchieved,
}: {
  percent: number;
  isAchieved: boolean;
}) {
  const clampedPercent = Math.min(percent, 100);
  const ringColor = isAchieved
    ? "#22c55e"
    : clampedPercent >= 80
      ? "#fbbf24"
      : "#3b82f6";

  return (
    <View
      style={[
        styles.ringOuter,
        { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2 },
      ]}
    >
      <View
        style={[
          styles.ringTrack,
          {
            width: RING_SIZE,
            height: RING_SIZE,
            borderRadius: RING_SIZE / 2,
            borderWidth: RING_STROKE,
          },
        ]}
      />
      {/*
       * Overlay a coloured border whose top/right/bottom/left segments
       * approximate fill.  For a full production ring, use SVG circles.
       */}
      <View
        style={[
          styles.ringFill,
          {
            width: RING_SIZE,
            height: RING_SIZE,
            borderRadius: RING_SIZE / 2,
            borderWidth: RING_STROKE,
            borderColor: ringColor,
            opacity: clampedPercent / 100,
          },
        ]}
      />
      <View style={styles.ringCenter}>
        <Text style={[styles.ringText, { color: ringColor }]}>
          {clampedPercent}%
        </Text>
      </View>
    </View>
  );
});

/** Card for a single incentive. */
const IncentiveCard = React.memo(function IncentiveCard({
  incentive,
  onPress,
}: {
  incentive: IncentiveItem;
  onPress?: (id: string) => void;
}) {
  const status = getStatus(incentive.isAchieved, incentive.progressPercent);
  const rewardIcon =
    REWARD_ICONS[incentive.rewardType.toLowerCase()] ?? "gift-outline";

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(incentive.id);
  }, [onPress, incentive.id]);

  return (
    <TouchableOpacity
      testID={`incentive-card-${incentive.id}`}
      style={[
        styles.card,
        incentive.isAchieved && styles.cardAchieved,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${incentive.name}, ${status.label}, ${incentive.progressPercent}% complete`}
    >
      {/* Top row: ring + info */}
      <View style={styles.cardTop}>
        <ProgressRing
          percent={incentive.progressPercent}
          isAchieved={incentive.isAchieved}
        />

        <View style={styles.cardInfo}>
          {/* Name + team/individual badge */}
          <View style={styles.nameRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {incentive.name}
            </Text>
            <View
              style={[
                styles.teamBadge,
                {
                  backgroundColor: incentive.isTeam ? "#172554" : "#1f2937",
                },
              ]}
            >
              <Ionicons
                name={incentive.isTeam ? "people-outline" : "person-outline"}
                size={12}
                color={incentive.isTeam ? "#3b82f6" : "#9ca3af"}
              />
              <Text
                style={[
                  styles.teamBadgeText,
                  { color: incentive.isTeam ? "#3b82f6" : "#9ca3af" },
                ]}
              >
                {incentive.isTeam ? "Team" : "Individual"}
              </Text>
            </View>
          </View>

          <Text style={styles.cardDesc} numberOfLines={2}>
            {incentive.description}
          </Text>

          {/* Current / Target values */}
          <View style={styles.valuesRow}>
            <Text style={styles.currentVal}>
              {formatCurrency(incentive.currentValue)}
            </Text>
            <Text style={styles.valDivider}>/</Text>
            <Text style={styles.targetVal}>
              {formatCurrency(incentive.targetValue)}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom row: badges */}
      <View style={styles.cardBottom}>
        {/* Status badge */}
        <View style={[styles.badge, { backgroundColor: status.bgColor }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>

        {/* Days remaining */}
        <View style={styles.badge}>
          <Ionicons name="time-outline" size={13} color="#fbbf24" />
          <Text style={[styles.badgeText, { color: "#fbbf24" }]}>
            {incentive.daysRemaining}d remaining
          </Text>
        </View>

        {/* Reward preview */}
        <View style={styles.badge}>
          <Ionicons name={rewardIcon} size={13} color="#8b5cf6" />
          <Text style={[styles.badgeText, { color: "#8b5cf6" }]}>
            {incentive.rewardType}: {formatCurrency(incentive.rewardValue)}
          </Text>
        </View>

        {/* Date range */}
        <View style={styles.badge}>
          <Ionicons name="calendar-outline" size={13} color="#6b7280" />
          <Text style={[styles.badgeText, { color: "#6b7280" }]}>
            {formatShortDate(incentive.startDate)} –{" "}
            {formatShortDate(incentive.endDate)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// endregion

// region — Main component

function IncentiveProgressDisplayComponent({
  incentives,
  onIncentivePress,
  isLoading = false,
}: IncentiveProgressDisplayProps) {
  /**
   * Split into active vs completed so achieved incentives sink to a
   * "celebration" section — keeps the active ones front-and-centre.
   */
  const { active, completed } = useMemo(
    () => ({
      active: incentives.filter((i) => !i.isAchieved),
      completed: incentives.filter((i) => i.isAchieved),
    }),
    [incentives]
  );

  const renderCard = useCallback(
    ({ item }: { item: IncentiveItem }) => (
      <IncentiveCard incentive={item} onPress={onIncentivePress} />
    ),
    [onIncentivePress]
  );

  const keyExtractor = useCallback((item: IncentiveItem) => item.id, []);

  // — Loading state
  if (isLoading) {
    return (
      <View
        testID="incentive-loading"
        style={styles.centeredContainer}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading incentives"
      >
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading incentives…</Text>
      </View>
    );
  }

  // — Empty state
  if (incentives.length === 0) {
    return (
      <View
        testID="incentive-empty"
        style={styles.centeredContainer}
        accessibilityRole="text"
        accessibilityLabel="No incentives available"
      >
        <Ionicons name="gift-outline" size={48} color="#6b7280" />
        <Text style={styles.emptyTitle}>No Incentives</Text>
        <Text style={styles.emptySubtitle}>
          Active incentives and bonuses will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View testID="incentive-display" style={styles.container}>
      {/* Header */}
      <Text style={styles.headerTitle}>Incentives &amp; Bonuses</Text>

      {/* Active incentives */}
      {active.length > 0 && (
        <View testID="incentive-active-section">
          <Text style={styles.sectionLabel}>Active</Text>
          <FlatList
            data={active}
            renderItem={renderCard}
            keyExtractor={keyExtractor}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
          />
        </View>
      )}

      {/* Completed incentives — celebration colours */}
      {completed.length > 0 && (
        <View testID="incentive-completed-section">
          <View style={styles.completedHeader}>
            <Ionicons name="trophy" size={18} color="#22c55e" />
            <Text style={styles.completedLabel}>Completed</Text>
          </View>
          <FlatList
            data={completed}
            renderItem={renderCard}
            keyExtractor={keyExtractor}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
          />
        </View>
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
  headerTitle: {
    fontSize: IS_TABLET ? 24 : 20,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: IS_TABLET ? 20 : 14,
  },

  // Sections
  sectionLabel: {
    fontSize: IS_TABLET ? 16 : 14,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  completedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: IS_TABLET ? 20 : 14,
    marginBottom: 8,
  },
  completedLabel: {
    fontSize: IS_TABLET ? 16 : 14,
    fontWeight: "600",
    color: "#22c55e",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  listContent: {
    gap: IS_TABLET ? 12 : 8,
    paddingBottom: 4,
  },

  // Card
  card: {
    backgroundColor: "#1f2937",
    borderRadius: 14,
    padding: IS_TABLET ? 18 : 14,
  },
  cardAchieved: {
    borderWidth: 1.5,
    borderColor: "#22c55e",
    /* Subtle green tint to celebrate achievement. */
    backgroundColor: "#0f2918",
  },
  cardTop: {
    flexDirection: "row",
    gap: IS_TABLET ? 14 : 10,
    marginBottom: 12,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardName: {
    fontSize: IS_TABLET ? 16 : 14,
    fontWeight: "700",
    color: "#f3f4f6",
    flexShrink: 1,
  },
  teamBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  teamBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  cardDesc: {
    fontSize: IS_TABLET ? 13 : 11,
    color: "#9ca3af",
    lineHeight: IS_TABLET ? 18 : 15,
  },
  valuesRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 2,
  },
  currentVal: {
    fontSize: IS_TABLET ? 15 : 13,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  valDivider: {
    fontSize: IS_TABLET ? 13 : 11,
    color: "#6b7280",
  },
  targetVal: {
    fontSize: IS_TABLET ? 13 : 11,
    color: "#9ca3af",
  },
  cardBottom: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  // Badges
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },

  // Progress ring
  ringOuter: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  ringTrack: {
    position: "absolute",
    borderColor: "#374151",
  },
  ringFill: {
    position: "absolute",
  },
  ringCenter: {
    justifyContent: "center",
    alignItems: "center",
  },
  ringText: {
    fontSize: IS_TABLET ? 16 : 14,
    fontWeight: "700",
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
  IncentiveProgressDisplayComponent
) as typeof IncentiveProgressDisplayComponent;
