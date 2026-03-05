/**
 * CampaignTimeline — Timeline view for signage campaigns and promotions.
 *
 * Displays a filterable list of campaigns with status badges, date ranges,
 * metrics, and a progress bar showing where each campaign sits between its
 * start and end dates.
 *
 * Why a timeline progress bar?
 * Campaign managers need an at-a-glance sense of how far along each promotion
 * is. A simple linear bar from start → end date communicates this instantly
 * without requiring the operator to do date math.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  displaysCount: number;
  contentCount: number;
  impressions: number;
}

export interface CampaignTimelineProps {
  campaigns: Campaign[];
  onCampaignPress: (campaignId: string) => void;
  onCreateCampaign: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  draft: { label: "Draft", color: "#9ca3af", icon: "document-outline" },
  scheduled: { label: "Scheduled", color: "#3b82f6", icon: "time-outline" },
  active: { label: "Active", color: "#22c55e", icon: "play-circle-outline" },
  paused: { label: "Paused", color: "#fbbf24", icon: "pause-circle-outline" },
  completed: { label: "Completed", color: "#8b5cf6", icon: "checkmark-circle-outline" },
  cancelled: { label: "Cancelled", color: "#ef4444", icon: "close-circle-outline" },
};

const ALL_STATUSES: CampaignStatus[] = [
  "draft",
  "scheduled",
  "active",
  "paused",
  "completed",
  "cancelled",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Format an ISO date string to a compact display label. */
function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  const day = d.getDate();
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Format a large number with K/M suffix. */
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Compute timeline progress as a 0–1 fraction.
 *
 * Clamps to [0, 1] so the bar never overflows or underflows,
 * even for campaigns that haven't started or have already ended.
 */
function computeProgress(startDate: string, endDate: string): number {
  const now = Date.now();
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (end <= start) return 1;
  return Math.max(0, Math.min(1, (now - start) / (end - start)));
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

/** Status filter pills */
const StatusFilters = React.memo(function StatusFilters({
  activeFilter,
  onFilterChange,
}: {
  activeFilter: CampaignStatus | null;
  onFilterChange: (status: CampaignStatus | null) => void;
}) {
  const handlePress = useCallback(
    (status: CampaignStatus) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onFilterChange(activeFilter === status ? null : status);
    },
    [activeFilter, onFilterChange],
  );

  return (
    <View style={styles.filtersRow}>
      {ALL_STATUSES.map((status) => {
        const cfg = STATUS_CONFIG[status];
        const isActive = activeFilter === status;
        return (
          <TouchableOpacity
            key={status}
            testID={`campaign-filter-${status}`}
            style={[
              styles.filterPill,
              isActive && { backgroundColor: cfg.color + "30" },
            ]}
            onPress={() => handlePress(status)}
            accessibilityLabel={`Filter by ${cfg.label}`}
            accessibilityRole="button"
          >
            <View
              style={[styles.filterDot, { backgroundColor: cfg.color }]}
            />
            <Text
              style={[
                styles.filterPillText,
                isActive && { color: cfg.color },
              ]}
            >
              {cfg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

/** Single campaign card with metrics and timeline bar. */
const CampaignCard = React.memo(function CampaignCard({
  campaign,
  onPress,
}: {
  campaign: Campaign;
  onPress: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[campaign.status];
  const progress = computeProgress(campaign.startDate, campaign.endDate);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress(campaign.id);
  }, [onPress, campaign.id]);

  return (
    <TouchableOpacity
      testID={`campaign-card-${campaign.id}`}
      style={styles.campaignCard}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityLabel={`Campaign ${campaign.name}`}
      accessibilityRole="button"
    >
      {/* Name + status */}
      <View style={styles.cardTopRow}>
        <Text style={styles.campaignName} numberOfLines={1}>
          {campaign.name}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: cfg.color + "20" }]}>
          <Ionicons name={cfg.icon} size={14} color={cfg.color} />
          <Text style={[styles.statusBadgeText, { color: cfg.color }]}>
            {cfg.label}
          </Text>
        </View>
      </View>

      {/* Date range */}
      <View style={styles.dateRow}>
        <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
        <Text style={styles.dateText}>
          {formatDate(campaign.startDate)} → {formatDate(campaign.endDate)}
        </Text>
      </View>

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Ionicons name="tv-outline" size={14} color="#3b82f6" />
          <Text style={styles.metricValue}>{campaign.displaysCount}</Text>
          <Text style={styles.metricLabel}>Displays</Text>
        </View>

        <View style={styles.metricItem}>
          <Ionicons name="albums-outline" size={14} color="#8b5cf6" />
          <Text style={styles.metricValue}>{campaign.contentCount}</Text>
          <Text style={styles.metricLabel}>Content</Text>
        </View>

        <View style={styles.metricItem}>
          <Ionicons name="eye-outline" size={14} color="#22c55e" />
          <Text style={styles.metricValue}>{formatNumber(campaign.impressions)}</Text>
          <Text style={styles.metricLabel}>Impressions</Text>
        </View>
      </View>

      {/* Timeline progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: cfg.color,
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
});

// ─── Main Component ─────────────────────────────────────────────────────────

/**
 * @param props - {@link CampaignTimelineProps}
 * @returns Filterable campaign list with progress timeline bars.
 */
const CampaignTimeline = React.memo(function CampaignTimeline({
  campaigns,
  onCampaignPress,
  onCreateCampaign,
  onBack,
  isLoading = false,
}: CampaignTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<CampaignStatus | null>(null);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  const handleCreate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCreateCampaign();
  }, [onCreateCampaign]);

  const filteredCampaigns = useMemo(() => {
    if (!activeFilter) return campaigns;
    return campaigns.filter((c) => c.status === activeFilter);
  }, [campaigns, activeFilter]);

  const renderItem = useCallback(
    ({ item }: { item: Campaign }) => (
      <CampaignCard campaign={item} onPress={onCampaignPress} />
    ),
    [onCampaignPress],
  );

  const keyExtractor = useCallback((item: Campaign) => item.id, []);

  // ── Empty state ──────────────────────────────────────────────

  const ListEmpty = useCallback(
    () => (
      <View testID="campaign-empty" style={styles.emptyContainer}>
        <Ionicons name="megaphone-outline" size={56} color="#4b5563" />
        <Text style={styles.emptyTitle}>
          {activeFilter ? "No Matching Campaigns" : "No Campaigns Yet"}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeFilter
            ? "Try a different filter or create a new campaign."
            : "Create your first signage campaign to get started."}
        </Text>
      </View>
    ),
    [activeFilter],
  );

  return (
    <View testID="campaign-timeline" style={styles.container}>
      {/* ── Header ──────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            testID="campaign-back-btn"
            style={styles.backButton}
            onPress={handleBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color="#f3f4f6" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Campaigns</Text>
        </View>

        <TouchableOpacity
          testID="campaign-new-btn"
          style={styles.newButton}
          onPress={handleCreate}
          accessibilityLabel="New campaign"
          accessibilityRole="button"
        >
          <Ionicons name="add-outline" size={20} color="#f3f4f6" />
          <Text style={styles.newButtonText}>New Campaign</Text>
        </TouchableOpacity>
      </View>

      {/* ── Status filters ──────────────────────────────── */}
      <StatusFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      {/* ── Content ─────────────────────────────────────── */}
      {isLoading ? (
        <View testID="campaign-loading" style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading campaigns…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCampaigns}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={ListEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
});

export default CampaignTimeline;

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  /* ── Header ─────────────────────────────────────────── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f2937",
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 48,
  },
  newButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f3f4f6",
  },

  /* ── Filters ────────────────────────────────────────── */
  filtersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1f2937",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9ca3af",
  },

  /* ── List ───────────────────────────────────────────── */
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },

  /* ── Campaign card ──────────────────────────────────── */
  campaignCard: {
    backgroundColor: "#1f2937",
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  campaignName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },

  /* Date row */
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: "#9ca3af",
  },

  /* Metrics */
  metricsRow: {
    flexDirection: "row",
    gap: 16,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  metricLabel: {
    fontSize: 12,
    color: "#6b7280",
  },

  /* Progress bar */
  progressTrack: {
    height: 6,
    backgroundColor: "#111827",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },

  /* ── Loading ────────────────────────────────────────── */
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#9ca3af",
  },

  /* ── Empty ──────────────────────────────────────────── */
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    maxWidth: 280,
  },
});
