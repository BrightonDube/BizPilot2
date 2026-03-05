/**
 * StaffPersonalDashboard — Individual staff member's performance overview.
 *
 * Why quick-stats at the top: Staff glance at this screen between serving
 * customers; the four key numbers must be visible within 1–2 seconds.
 *
 * Why colour-coded progress bars: Pace awareness (green = on/above target,
 * blue = in progress, amber = falling behind) lets staff self-correct before
 * the period ends.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "../../utils/formatters";

// region — Types

interface StaffTarget {
  id: string;
  targetType: string;
  periodType: string;
  targetValue: number;
  achievedValue: number;
  status: string;
}

interface IncentiveProgress {
  id: string;
  name: string;
  description: string;
  currentValue: number;
  targetValue: number;
  progressPercent: number;
  isAchieved: boolean;
  daysRemaining: number;
  rewardType: string;
  rewardValue: number;
}

interface StaffPersonalDashboardProps {
  staffName: string;
  todaySales: number;
  periodSales: number;
  rank: number | null;
  totalStaff: number;
  targets: StaffTarget[];
  incentives: IncentiveProgress[];
  recentTransactionCount: number;
  onViewLeaderboard?: () => void;
  onViewTargetDetails?: (targetId: string) => void;
  onBack: () => void;
  isLoading?: boolean;
}

// endregion

// region — Constants

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IS_TABLET = SCREEN_WIDTH >= 768;

/** Map target types to representative icons. */
const TARGET_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  sales: "cash-outline",
  items: "cube-outline",
  transactions: "receipt-outline",
  revenue: "trending-up-outline",
};

const REWARD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  cash: "cash-outline",
  bonus: "gift-outline",
  time_off: "time-outline",
  voucher: "card-outline",
};

// endregion

// region — Helpers

/**
 * Determine progress bar colour based on percentage achieved.
 * ≥100 % → green (met/exceeded), <50 % → amber (behind pace), else blue.
 */
function progressColor(percent: number): string {
  if (percent >= 100) return "#22c55e";
  if (percent < 50) return "#fbbf24";
  return "#3b82f6";
}

// endregion

// region — Sub-components

/** Compact stat card used in the quick-stats row. */
const StatCard = React.memo(function StatCard({
  label,
  value,
  icon,
  iconColor,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
}) {
  return (
    <View style={styles.statCard} accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={IS_TABLET ? 22 : 18} color={iconColor} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

/** Single target progress card. */
const TargetCard = React.memo(function TargetCard({
  target,
  onPress,
}: {
  target: StaffTarget;
  onPress?: (id: string) => void;
}) {
  const percent = target.targetValue
    ? Math.round((target.achievedValue / target.targetValue) * 100)
    : 0;

  const barColor = progressColor(percent);
  const icon = TARGET_ICONS[target.targetType.toLowerCase()] ?? "flag-outline";

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(target.id);
  }, [onPress, target.id]);

  return (
    <TouchableOpacity
      style={styles.targetCard}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${target.targetType} target, ${percent}% achieved`}
    >
      <View style={styles.targetHeader}>
        <View style={styles.targetLabelRow}>
          <Ionicons name={icon} size={IS_TABLET ? 20 : 18} color="#f3f4f6" />
          <Text style={styles.targetType}>{target.targetType}</Text>
        </View>
        <Text style={styles.targetPeriod}>{target.periodType}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressOuter}>
        <View
          style={[
            styles.progressInner,
            {
              width: `${Math.min(percent, 100)}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>

      <View style={styles.targetValues}>
        <Text style={styles.targetAchieved}>
          {formatCurrency(target.achievedValue)}
        </Text>
        <Text style={styles.targetOf}>/</Text>
        <Text style={styles.targetGoal}>
          {formatCurrency(target.targetValue)}
        </Text>
        <Text style={[styles.targetPercent, { color: barColor }]}>
          {percent}%
        </Text>
      </View>
    </TouchableOpacity>
  );
});

/** Single incentive card with circular progress indicator. */
const IncentiveCard = React.memo(function IncentiveCard({
  incentive,
}: {
  incentive: IncentiveProgress;
}) {
  const percent = Math.min(incentive.progressPercent, 100);
  const rewardIcon =
    REWARD_ICONS[incentive.rewardType.toLowerCase()] ?? "gift-outline";

  return (
    <View
      style={[
        styles.incentiveCard,
        incentive.isAchieved && styles.incentiveAchievedCard,
      ]}
      accessibilityLabel={`Incentive ${incentive.name}, ${percent}% complete`}
    >
      <View style={styles.incentiveTop}>
        {/* Circular progress ring (simplified via bordered view) */}
        <View style={styles.circularOuter}>
          <View
            style={[
              styles.circularInner,
              {
                borderColor: incentive.isAchieved ? "#22c55e" : "#3b82f6",
                /*
                 * Why use borderTopColor + rotation trick: RN doesn't support
                 * conic-gradient, so we approximate with a thick border and
                 * display the percentage as text in the centre instead.
                 */
              },
            ]}
          >
            <Text
              style={[
                styles.circularText,
                { color: incentive.isAchieved ? "#22c55e" : "#f3f4f6" },
              ]}
            >
              {percent}%
            </Text>
          </View>
        </View>

        <View style={styles.incentiveInfo}>
          <Text style={styles.incentiveName}>{incentive.name}</Text>
          <Text style={styles.incentiveDesc} numberOfLines={2}>
            {incentive.description}
          </Text>
        </View>
      </View>

      <View style={styles.incentiveBottom}>
        {/* Days remaining badge */}
        <View style={styles.daysBadge}>
          <Ionicons name="time-outline" size={14} color="#fbbf24" />
          <Text style={styles.daysText}>
            {incentive.daysRemaining}d left
          </Text>
        </View>

        {/* Reward info */}
        <View style={styles.rewardBadge}>
          <Ionicons name={rewardIcon} size={14} color="#8b5cf6" />
          <Text style={styles.rewardText}>
            {incentive.rewardType}: {formatCurrency(incentive.rewardValue)}
          </Text>
        </View>

        {/* Achieved badge */}
        {incentive.isAchieved && (
          <View style={styles.achievedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
            <Text style={styles.achievedText}>Achieved!</Text>
          </View>
        )}
      </View>
    </View>
  );
});

// endregion

// region — Main component

function StaffPersonalDashboardComponent({
  staffName,
  todaySales,
  periodSales,
  rank,
  totalStaff,
  targets,
  incentives,
  recentTransactionCount,
  onViewLeaderboard,
  onViewTargetDetails,
  onBack,
  isLoading = false,
}: StaffPersonalDashboardProps) {
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  const handleViewLeaderboard = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onViewLeaderboard?.();
  }, [onViewLeaderboard]);

  /** Separate achieved vs active incentives for distinct display sections. */
  const { activeIncentives, completedIncentives } = useMemo(
    () => ({
      activeIncentives: incentives.filter((i) => !i.isAchieved),
      completedIncentives: incentives.filter((i) => i.isAchieved),
    }),
    [incentives]
  );

  // — Loading state
  if (isLoading) {
    return (
      <View
        testID="staff-loading"
        style={styles.centeredContainer}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading dashboard"
      >
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading your performance…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      testID="staff-dashboard"
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="staff-back-btn"
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#f3f4f6" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>My Performance</Text>
          <Text style={styles.subtitle}>{staffName}</Text>
        </View>
      </View>

      {/* Quick Stats Row */}
      <View testID="staff-stats-row" style={styles.statsRow}>
        <StatCard
          label="Today"
          value={formatCurrency(todaySales)}
          icon="today-outline"
          iconColor="#22c55e"
        />
        <StatCard
          label="Period"
          value={formatCurrency(periodSales)}
          icon="calendar-outline"
          iconColor="#3b82f6"
        />
        <StatCard
          label="Rank"
          value={rank !== null ? `#${rank} of ${totalStaff}` : "—"}
          icon="podium-outline"
          iconColor="#fbbf24"
        />
        <StatCard
          label="Transactions"
          value={String(recentTransactionCount)}
          icon="receipt-outline"
          iconColor="#8b5cf6"
        />
      </View>

      {/* Active Targets */}
      {targets.length > 0 && (
        <View testID="staff-targets-section" style={styles.section}>
          <Text style={styles.sectionTitle}>Active Targets</Text>
          {targets.map((t) => (
            <TargetCard
              key={t.id}
              target={t}
              onPress={onViewTargetDetails}
            />
          ))}
        </View>
      )}

      {/* Incentive Progress */}
      {incentives.length > 0 && (
        <View testID="staff-incentives-section" style={styles.section}>
          <Text style={styles.sectionTitle}>Incentive Progress</Text>

          {activeIncentives.map((inc) => (
            <IncentiveCard key={inc.id} incentive={inc} />
          ))}

          {completedIncentives.length > 0 && (
            <>
              <Text style={styles.completedLabel}>Completed</Text>
              {completedIncentives.map((inc) => (
                <IncentiveCard key={inc.id} incentive={inc} />
              ))}
            </>
          )}
        </View>
      )}

      {/* Quick Actions */}
      {onViewLeaderboard && (
        <TouchableOpacity
          testID="staff-leaderboard-btn"
          style={styles.leaderboardBtn}
          onPress={handleViewLeaderboard}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="View leaderboard"
        >
          <Ionicons name="trophy-outline" size={20} color="#fbbf24" />
          <Text style={styles.leaderboardBtnText}>View Leaderboard</Text>
          <Ionicons name="chevron-forward" size={18} color="#6b7280" />
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// endregion

// region — Styles

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: IS_TABLET ? 24 : 16,
    paddingBottom: 40,
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
    flexDirection: "row",
    alignItems: "center",
    marginBottom: IS_TABLET ? 24 : 16,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1f2937",
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: IS_TABLET ? 24 : 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  subtitle: {
    fontSize: IS_TABLET ? 15 : 13,
    color: "#9ca3af",
    marginTop: 2,
  },

  // Stats row
  statsRow: {
    flexDirection: "row",
    gap: IS_TABLET ? 14 : 8,
    marginBottom: IS_TABLET ? 24 : 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: IS_TABLET ? 16 : 10,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: IS_TABLET ? 16 : 13,
    fontWeight: "700",
    color: "#f3f4f6",
    textAlign: "center",
  },
  statLabel: {
    fontSize: IS_TABLET ? 12 : 10,
    color: "#9ca3af",
  },

  // Sections
  section: {
    marginBottom: IS_TABLET ? 24 : 16,
  },
  sectionTitle: {
    fontSize: IS_TABLET ? 18 : 16,
    fontWeight: "600",
    color: "#f3f4f6",
    marginBottom: IS_TABLET ? 12 : 8,
  },
  completedLabel: {
    fontSize: IS_TABLET ? 14 : 12,
    fontWeight: "600",
    color: "#22c55e",
    marginTop: 12,
    marginBottom: 6,
  },

  // Target cards
  targetCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: IS_TABLET ? 16 : 12,
    marginBottom: IS_TABLET ? 10 : 8,
  },
  targetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  targetLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  targetType: {
    fontSize: IS_TABLET ? 15 : 13,
    fontWeight: "600",
    color: "#f3f4f6",
    textTransform: "capitalize",
  },
  targetPeriod: {
    fontSize: IS_TABLET ? 12 : 11,
    color: "#9ca3af",
    textTransform: "capitalize",
  },
  progressOuter: {
    height: 6,
    backgroundColor: "#374151",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressInner: {
    height: "100%",
    borderRadius: 3,
  },
  targetValues: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  targetAchieved: {
    fontSize: IS_TABLET ? 15 : 13,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  targetOf: {
    fontSize: IS_TABLET ? 13 : 11,
    color: "#6b7280",
  },
  targetGoal: {
    fontSize: IS_TABLET ? 13 : 11,
    color: "#9ca3af",
  },
  targetPercent: {
    fontSize: IS_TABLET ? 13 : 11,
    fontWeight: "700",
    marginLeft: "auto",
  },

  // Incentive cards
  incentiveCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: IS_TABLET ? 16 : 12,
    marginBottom: IS_TABLET ? 10 : 8,
  },
  incentiveAchievedCard: {
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  incentiveTop: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  incentiveInfo: {
    flex: 1,
  },
  incentiveName: {
    fontSize: IS_TABLET ? 15 : 13,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  incentiveDesc: {
    fontSize: IS_TABLET ? 13 : 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  incentiveBottom: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  // Circular progress ring (simplified)
  circularOuter: {
    width: IS_TABLET ? 56 : 48,
    height: IS_TABLET ? 56 : 48,
    justifyContent: "center",
    alignItems: "center",
  },
  circularInner: {
    width: IS_TABLET ? 52 : 44,
    height: IS_TABLET ? 52 : 44,
    borderRadius: IS_TABLET ? 26 : 22,
    borderWidth: 4,
    borderColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111827",
  },
  circularText: {
    fontSize: IS_TABLET ? 14 : 12,
    fontWeight: "700",
  },

  // Badges
  daysBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  daysText: {
    fontSize: 11,
    color: "#fbbf24",
    fontWeight: "600",
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  rewardText: {
    fontSize: 11,
    color: "#8b5cf6",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  achievedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#052e16",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  achievedText: {
    fontSize: 11,
    color: "#22c55e",
    fontWeight: "700",
  },

  // Leaderboard button
  leaderboardBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: IS_TABLET ? 16 : 14,
    gap: 10,
    marginTop: IS_TABLET ? 8 : 4,
  },
  leaderboardBtnText: {
    flex: 1,
    fontSize: IS_TABLET ? 15 : 14,
    fontWeight: "600",
    color: "#f3f4f6",
  },

  // States
  loadingText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 12,
  },
});

// endregion

export default React.memo(
  StaffPersonalDashboardComponent
) as typeof StaffPersonalDashboardComponent;
