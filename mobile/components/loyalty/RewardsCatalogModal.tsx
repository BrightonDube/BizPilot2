/**
 * RewardsCatalogModal
 *
 * Full-screen modal displaying the loyalty rewards catalog to the customer.
 * Used at checkout when a customer wants to redeem points for a specific reward
 * (as opposed to the free-form point deduction in LoyaltyRedemptionPanel).
 *
 * Why a separate modal from LoyaltyRedemptionPanel?
 * The redemption panel handles "I want to knock X points off my total."
 * The catalog modal handles "I want THAT specific reward (product/discount)."
 * These are two distinct redemption paths described in Requirement 3 & 4.
 * Keeping them separate avoids a bloated component that handles both flows.
 *
 * Reward types:
 * - "discount_percent"  → e.g. 10% off
 * - "discount_fixed"    → e.g. R20 off
 * - "free_product"      → e.g. free coffee
 *
 * Design:
 * - Two-column grid on tablets (adapts to phone single column)
 * - Each reward card shows: name, description, points cost, type badge
 * - Cards are greyed out and non-tappable when customer cannot afford them
 * - "Limited" badge shown when availability is restricted
 *
 * Validates: loyalty-programs Requirement 4 (Rewards Catalog) — Tasks 5.1–5.4
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  FlatList,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Modal } from "@/components/ui";
import { formatCurrency } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single reward in the catalog.
 *
 * Stored in the database; synced to mobile via the offline sync engine.
 * The `availability` field is null for unlimited rewards.
 */
export interface Reward {
  id: string;
  name: string;
  description: string;
  /** Points cost to redeem this reward */
  pointsCost: number;
  /** What kind of reward this is */
  type: "discount_percent" | "discount_fixed" | "free_product";
  /**
   * The value of the reward:
   * - discount_percent → percentage (e.g. 10 = 10%)
   * - discount_fixed   → ZAR amount (e.g. 20 = R20)
   * - free_product     → not used (product name in `description`)
   */
  value: number;
  /** Remaining availability (null = unlimited) */
  availability: number | null;
  /** Whether the reward is currently active */
  active: boolean;
}

export interface RewardsCatalogModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** All rewards from the database */
  rewards: Reward[];
  /** Customer's current loyalty balance — used to disable un-affordable rewards */
  customerBalance: number;
  /** Called when the cashier selects a reward to redeem */
  onSelectReward: (reward: Reward) => void;
  /** Whether the tablet layout should be used (2 columns) */
  isTablet?: boolean;
}

// ---------------------------------------------------------------------------
// RewardCard sub-component
// ---------------------------------------------------------------------------

/**
 * Single reward card in the catalog grid.
 * Separated to allow React.memo to prevent re-renders when other cards
 * change (e.g. when balance updates and some become affordable).
 */
interface RewardCardProps {
  reward: Reward;
  canAfford: boolean;
  onPress: (reward: Reward) => void;
}

const TYPE_LABELS: Record<Reward["type"], string> = {
  discount_percent: "% Discount",
  discount_fixed: "Fixed Discount",
  free_product: "Free Product",
};

const TYPE_COLORS: Record<Reward["type"], string> = {
  discount_percent: "#6366F1", // indigo
  discount_fixed: "#059669",   // emerald
  free_product: "#D97706",     // amber
};

function formatRewardValue(reward: Reward): string {
  switch (reward.type) {
    case "discount_percent":
      return `${reward.value}% off`;
    case "discount_fixed":
      return `${formatCurrency(reward.value)} off`;
    case "free_product":
      return "Free item";
    default:
      return "";
  }
}

const RewardCard: React.FC<RewardCardProps> = React.memo(function RewardCard({
  reward,
  canAfford,
  onPress,
}) {
  const handlePress = useCallback(() => {
    if (!canAfford) {
      Alert.alert(
        "Not Enough Points",
        `You need ${reward.pointsCost.toLocaleString()} points but only have enough to redeem this reward once your balance reaches that level.`
      );
      return;
    }
    Haptics.selectionAsync();
    onPress(reward);
  }, [reward, canAfford, onPress]);

  const isLimited = reward.availability !== null;
  const isOutOfStock = isLimited && reward.availability === 0;
  const disabled = !canAfford || isOutOfStock;

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.rewardCard, disabled && styles.rewardCardDisabled]}
      accessibilityLabel={`Redeem ${reward.name} for ${reward.pointsCost} points`}
      accessibilityState={{ disabled }}
    >
      {/* Type badge */}
      <View
        style={[
          styles.typeBadge,
          { backgroundColor: TYPE_COLORS[reward.type] + "20" },
        ]}
      >
        <Text
          style={[styles.typeBadgeText, { color: TYPE_COLORS[reward.type] }]}
        >
          {TYPE_LABELS[reward.type]}
        </Text>
      </View>

      {/* Reward name */}
      <Text style={[styles.rewardName, disabled && styles.textDisabled]}>
        {reward.name}
      </Text>

      {/* Description */}
      <Text
        style={[styles.rewardDescription, disabled && styles.textDisabled]}
        numberOfLines={2}
      >
        {reward.description}
      </Text>

      {/* Value */}
      <Text style={[styles.rewardValue, disabled && styles.textDisabled]}>
        {formatRewardValue(reward)}
      </Text>

      {/* Footer row: points cost + availability */}
      <View style={styles.rewardFooter}>
        <View style={styles.pointsCostBadge}>
          <Ionicons
            name="star"
            size={12}
            color={disabled ? "#D1D5DB" : "#F59E0B"}
          />
          <Text
            style={[styles.pointsCostText, disabled && styles.textDisabled]}
          >
            {reward.pointsCost.toLocaleString()} pts
          </Text>
        </View>

        {isLimited && !isOutOfStock && (
          <View style={styles.limitedBadge}>
            <Text style={styles.limitedText}>
              {reward.availability} left
            </Text>
          </View>
        )}

        {isOutOfStock && (
          <View style={styles.outOfStockBadge}>
            <Text style={styles.outOfStockText}>Out of stock</Text>
          </View>
        )}
      </View>

      {/* Affordability overlay */}
      {!canAfford && !isOutOfStock && (
        <View style={styles.insufficientOverlay}>
          <Ionicons name="lock-closed" size={14} color="#9CA3AF" />
          <Text style={styles.insufficientText}>Insufficient points</Text>
        </View>
      )}
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// RewardsCatalogModal
// ---------------------------------------------------------------------------

const RewardsCatalogModal: React.FC<RewardsCatalogModalProps> = React.memo(
  function RewardsCatalogModal({
    visible,
    onClose,
    rewards,
    customerBalance,
    onSelectReward,
    isTablet = true,
  }) {
    // Only show active rewards sorted: affordable first, then by points cost
    const sortedRewards = useMemo(() => {
      const active = rewards.filter((r) => r.active);
      const affordable = active.filter((r) => r.pointsCost <= customerBalance);
      const notAffordable = active.filter((r) => r.pointsCost > customerBalance);
      // Within each group, sort by points cost ascending
      const sortByPoints = (a: Reward, b: Reward) => a.pointsCost - b.pointsCost;
      return [...affordable.sort(sortByPoints), ...notAffordable.sort(sortByPoints)];
    }, [rewards, customerBalance]);

    const handleSelectReward = useCallback(
      (reward: Reward) => {
        Alert.alert(
          `Redeem "${reward.name}"?`,
          `This will use ${reward.pointsCost.toLocaleString()} loyalty points.\n\nValue: ${formatRewardValue(reward)}`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Confirm",
              onPress: () => {
                onSelectReward(reward);
                onClose();
              },
            },
          ]
        );
      },
      [onSelectReward, onClose]
    );

    const numColumns = isTablet ? 2 : 1;

    const renderReward = useCallback(
      ({ item }: { item: Reward }) => (
        <View style={[styles.rewardCardWrapper, { width: `${100 / numColumns}%` }]}>
          <RewardCard
            reward={item}
            canAfford={item.pointsCost <= customerBalance}
            onPress={handleSelectReward}
          />
        </View>
      ),
      [customerBalance, handleSelectReward, numColumns]
    );

    const keyExtractor = useCallback((item: Reward) => item.id, []);

    return (
      <Modal
        visible={visible}
        onClose={onClose}
        title="Rewards Catalog"
        size={isTablet ? "large" : "medium"}
      >
        {/* Balance header */}
        <View style={styles.balanceHeader}>
          <Ionicons name="star" size={16} color="#F59E0B" />
          <Text style={styles.balanceHeaderText}>
            Your balance:{" "}
            <Text style={styles.balanceHeaderPoints}>
              {customerBalance.toLocaleString()} points
            </Text>
          </Text>
        </View>

        {sortedRewards.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="gift-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>No Rewards Available</Text>
            <Text style={styles.emptyStateText}>
              Check back later for rewards to redeem.
            </Text>
          </View>
        ) : (
          <FlatList
            data={sortedRewards}
            keyExtractor={keyExtractor}
            renderItem={renderReward}
            numColumns={numColumns}
            key={`catalog-${numColumns}`} // Force re-mount when columns change
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Modal>
    );
  }
);

export default RewardsCatalogModal;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFBEB",
    borderBottomWidth: 1,
    borderBottomColor: "#FDE68A",
    marginBottom: 8,
  },
  balanceHeaderText: {
    fontSize: 14,
    color: "#374151",
  },
  balanceHeaderPoints: {
    fontWeight: "700",
    color: "#92400E",
  },
  grid: {
    padding: 12,
  },
  rewardCardWrapper: {
    padding: 6,
  },
  rewardCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
    // Minimum touch target height
    minHeight: 160,
  },
  rewardCardDisabled: {
    backgroundColor: "#F9FAFB",
    borderColor: "#F3F4F6",
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  rewardName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  rewardDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  rewardValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  rewardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  pointsCostBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pointsCostText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
  },
  limitedBadge: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  limitedText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5B21B6",
  },
  outOfStockBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  outOfStockText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#991B1B",
  },
  insufficientOverlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  insufficientText: {
    fontSize: 11,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  textDisabled: {
    color: "#9CA3AF",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#374151",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
