/**
 * LoyaltyDisplay — Customer-facing loyalty programme panel.
 *
 * Shown alongside or after the order summary so customers can see
 * their points balance, tier progress, and available rewards.
 * Haptic feedback on reward redemption gives satisfying tactile confirmation.
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ─── Types ───────────────────────────────────────────────────────────

interface Reward {
  id: string;
  name: string;
  pointsCost: number;
  isRedeemable: boolean;
}

interface LoyaltyDisplayProps {
  customerName: string;
  currentPoints: number;
  pointsToEarn: number;
  tier: string;
  /** 0-100 percentage progress toward the next tier. */
  tierProgress: number;
  nextTierName: string;
  availableRewards: Reward[];
  onRedeemReward?: (rewardId: string) => void;
}

// ─── Theme ───────────────────────────────────────────────────────────

const COLORS = {
  bg: "#0f172a",
  card: "#1f2937",
  text: "#f3f4f6",
  muted: "#9ca3af",
  accent: "#3b82f6",
  green: "#22c55e",
  border: "#374151",
  disabledBtn: "#374151",
} as const;

// ─── Sub-components ──────────────────────────────────────────────────

interface RewardCardProps {
  reward: Reward;
  onRedeem?: (rewardId: string) => void;
}

/**
 * Individual reward card inside the horizontal scroll.
 * Memoised because the rewards list rarely changes within a transaction.
 */
const RewardCard = React.memo<RewardCardProps>(({ reward, onRedeem }) => {
  const handlePress = useCallback(() => {
    if (!onRedeem || !reward.isRedeemable) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRedeem(reward.id);
  }, [onRedeem, reward.id, reward.isRedeemable]);

  return (
    <View testID={`loyalty-reward-${reward.id}`} style={styles.rewardCard}>
      <Text style={styles.rewardName} numberOfLines={2}>
        {reward.name}
      </Text>
      <Text style={styles.rewardCost}>{reward.pointsCost} pts</Text>

      <TouchableOpacity
        testID={`loyalty-redeem-${reward.id}`}
        style={[
          styles.redeemButton,
          !reward.isRedeemable && styles.redeemButtonDisabled,
        ]}
        onPress={handlePress}
        disabled={!reward.isRedeemable}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.redeemLabel,
            !reward.isRedeemable && styles.redeemLabelDisabled,
          ]}
        >
          Redeem
        </Text>
      </TouchableOpacity>
    </View>
  );
});

RewardCard.displayName = "RewardCard";

// ─── Main Component ──────────────────────────────────────────────────

const LoyaltyDisplay: React.FC<LoyaltyDisplayProps> = ({
  customerName,
  currentPoints,
  pointsToEarn,
  tier,
  tierProgress,
  nextTierName,
  availableRewards,
  onRedeemReward,
}) => {
  // Clamp progress to 0-100 to prevent visual overflow
  const clampedProgress = Math.min(100, Math.max(0, tierProgress));

  return (
    <View testID="loyalty-display" style={styles.container}>
      {/* ── Welcome ────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text testID="loyalty-name" style={styles.welcomeText}>
          Welcome back, {customerName}!
        </Text>
        <View testID="loyalty-tier" style={styles.tierBadge}>
          <Ionicons name="shield-checkmark" size={16} color={COLORS.accent} />
          <Text style={styles.tierText}>{tier}</Text>
        </View>
      </View>

      {/* ── Points Summary ─────────────────────────────────────── */}
      <View style={styles.pointsSection}>
        <Text testID="loyalty-points" style={styles.pointsValue}>
          {currentPoints.toLocaleString()}
        </Text>
        <Text style={styles.pointsLabel}>points</Text>

        <Text testID="loyalty-earn" style={styles.earnText}>
          +{pointsToEarn.toLocaleString()} pts this order
        </Text>
      </View>

      {/* ── Tier Progress ──────────────────────────────────────── */}
      <View style={styles.progressSection}>
        <View style={styles.progressBarBg}>
          <View
            testID="loyalty-progress"
            style={[styles.progressBarFill, { width: `${clampedProgress}%` }]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {clampedProgress}% to {nextTierName}
        </Text>
      </View>

      {/* ── Available Rewards ──────────────────────────────────── */}
      {availableRewards.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rewardsScroll}
        >
          {availableRewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              onRedeem={onRedeemReward}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.noRewards}>
          <Ionicons name="gift-outline" size={36} color={COLORS.muted} />
          <Text testID="loyalty-no-rewards" style={styles.noRewardsText}>
            Keep earning to unlock rewards!
          </Text>
        </View>
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 24,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    flexShrink: 1,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 12,
  },
  tierText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.accent,
    marginLeft: 4,
  },

  // Points
  pointsSection: {
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  pointsValue: {
    fontSize: 44,
    fontWeight: "800",
    color: COLORS.text,
  },
  pointsLabel: {
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 2,
  },
  earnText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.green,
    marginTop: 10,
  },

  // Progress
  progressSection: {
    marginBottom: 24,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: COLORS.card,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 5,
  },
  progressLabel: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 6,
    textAlign: "right",
  },

  // Rewards
  rewardsScroll: {
    paddingVertical: 4,
  },
  rewardCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 160,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rewardName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 6,
  },
  rewardCost: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 12,
  },
  redeemButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  redeemButtonDisabled: {
    backgroundColor: COLORS.disabledBtn,
  },
  redeemLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  redeemLabelDisabled: {
    color: COLORS.muted,
  },

  // Empty rewards
  noRewards: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  noRewardsText: {
    fontSize: 15,
    color: COLORS.muted,
    marginTop: 10,
  },
});

export default React.memo(LoyaltyDisplay);
