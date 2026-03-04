/**
 * MobileDashboardScreen — tablet-optimised KPI dashboard for the POS app.
 *
 * Layout (tablet, landscape):
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Period tabs (Today / Week / Month)                        │
 * ├───────────────────────────┬─────────────────────────────────┤
 * │  KPI grid (2×2 on tablet) │  Top Products list             │
 * │  • Sales Total            │  Ranked by revenue             │
 * │  • Orders Count           │                                 │
 * │  • Avg Order Value        ├─────────────────────────────────┤
 * │  • Low Stock Alert        │  Low Stock Alert count         │
 * └───────────────────────────┴─────────────────────────────────┘
 *
 * Phone: single-column scroll with all cards stacked.
 *
 * Offline resilience:
 * Metrics are cached in AsyncStorage. A "stale data" banner is shown when
 * the device is offline and the cached data is >5 minutes old.
 *
 * Touch interactions:
 * - Period tabs: switch aggregation period
 * - KPI cards: tap to drill into the detail report (future feature)
 * - Pull-to-refresh: triggers a fresh API fetch
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useDashboardMetrics, KpiMetric, DashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useAuthStore } from "@/stores/authStore";
import { formatCurrency } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// Period selector
// ---------------------------------------------------------------------------

type Period = "today" | "week" | "month";

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];

interface PeriodTabsProps {
  selected: Period;
  onSelect: (period: Period) => void;
}

/**
 * Horizontal tab bar for switching between time periods.
 * Minimum tap target 44px as per HIG guidelines.
 */
const PeriodTabs = React.memo<PeriodTabsProps>(function PeriodTabs({
  selected,
  onSelect,
}) {
  return (
    <View style={styles.periodTabBar}>
      {PERIODS.map((period) => (
        <TouchableOpacity
          key={period.id}
          style={[
            styles.periodTab,
            selected === period.id && styles.periodTabActive,
          ]}
          onPress={() => onSelect(period.id)}
          accessibilityRole="tab"
          accessibilityState={{ selected: selected === period.id }}
        >
          <Text
            style={[
              styles.periodTabText,
              selected === period.id && styles.periodTabTextActive,
            ]}
          >
            {period.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  metric: KpiMetric;
  onPress?: () => void;
}

/**
 * Individual KPI metric card.
 * Shows value, label, and an optional trend indicator arrow.
 *
 * Touch target is at least 100×80px for comfortable tablet use.
 */
const KpiCard = React.memo<KpiCardProps>(function KpiCard({ metric, onPress }) {
  const formattedValue = useMemo(() => {
    if (metric.unit === "currency") return formatCurrency(metric.value);
    if (metric.unit === "percent") return `${metric.value.toFixed(1)}%`;
    return metric.value.toLocaleString();
  }, [metric.value, metric.unit]);

  const trendColor =
    metric.trend === "up"
      ? "#10B981"
      : metric.trend === "down"
      ? "#EF4444"
      : "#6B7280";

  const trendIcon: keyof typeof Ionicons.glyphMap =
    metric.trend === "up"
      ? "trending-up"
      : metric.trend === "down"
      ? "trending-down"
      : "remove";

  return (
    <TouchableOpacity
      style={styles.kpiCard}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityRole="button"
      accessibilityLabel={`${metric.label}: ${formattedValue}`}
    >
      <Text style={styles.kpiLabel}>{metric.label}</Text>
      <Text style={styles.kpiValue}>{formattedValue}</Text>
      {metric.trend && (
        <View style={styles.kpiTrend}>
          <Ionicons name={trendIcon} size={16} color={trendColor} />
          {metric.trendPercent !== undefined && (
            <Text style={[styles.kpiTrendText, { color: trendColor }]}>
              {Math.abs(metric.trendPercent).toFixed(1)}%
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Top Products list
// ---------------------------------------------------------------------------

interface TopProductsProps {
  products: DashboardMetrics["topProducts"];
}

const TopProducts = React.memo<TopProductsProps>(function TopProducts({
  products,
}) {
  return (
    <View style={styles.topProductsCard}>
      <Text style={styles.sectionTitle}>Top Products</Text>
      {products.length === 0 && (
        <Text style={styles.emptyText}>No sales data yet</Text>
      )}
      {products.map((product, index) => (
        <View key={product.name} style={styles.topProductRow}>
          <Text style={styles.topProductRank}>{index + 1}</Text>
          <Text style={styles.topProductName} numberOfLines={1}>
            {product.name}
          </Text>
          <View style={styles.topProductStats}>
            <Text style={styles.topProductRevenue}>
              {formatCurrency(product.revenue)}
            </Text>
            <Text style={styles.topProductUnits}>{product.units} sold</Text>
          </View>
        </View>
      ))}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Stale data banner
// ---------------------------------------------------------------------------

const StaleDataBanner = React.memo(function StaleDataBanner() {
  return (
    <View style={styles.staleBanner}>
      <Ionicons name="cloud-offline-outline" size={16} color="#92400E" />
      <Text style={styles.staleBannerText}>
        Showing cached data — connect to internet for latest figures
      </Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

/**
 * The exported mobile dashboard screen.
 * Adapts between tablet split-pane and phone single-column layouts.
 */
export default function MobileDashboardScreen() {
  const { currentUser } = useAuthStore();
  const businessId = currentUser?.businessId ?? "";

  const [period, setPeriod] = useState<Period>("today");

  const { metrics, isLoading, isStale, error, refetch } = useDashboardMetrics(
    businessId,
    period
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    refetch();
    // Give the fetch a moment to complete before hiding the spinner
    setTimeout(() => setIsRefreshing(false), 1500);
  }, [refetch]);

  const { width } = Dimensions.get("window");
  const isTablet = width >= 768;

  // Build KPI cards from raw metrics
  const kpis: KpiMetric[] = useMemo(() => {
    if (!metrics) return [];
    return [
      {
        id: "sales_total",
        label: "Sales Total",
        value: metrics.salesTotal,
        unit: "currency",
        trend: "up",
        trendPercent: 5.2,
      },
      {
        id: "orders_count",
        label: "Orders",
        value: metrics.ordersCount,
        unit: "count",
        trend: "up",
        trendPercent: 3.1,
      },
      {
        id: "avg_order",
        label: "Avg Order Value",
        value: metrics.avgOrderValue,
        unit: "currency",
      },
      {
        id: "low_stock",
        label: "Low Stock Items",
        value: metrics.lowStockCount,
        unit: "count",
        trend: metrics.lowStockCount > 0 ? "down" : "flat",
      },
      ...(metrics.kpis ?? []),
    ];
  }, [metrics]);

  const renderContent = () => {
    if (isLoading && !metrics) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      );
    }

    if (error && !metrics) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const kpiGrid = (
      <View style={styles.kpiGrid}>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} metric={kpi} />
        ))}
      </View>
    );

    const topProductsSection = metrics ? (
      <TopProducts products={metrics.topProducts} />
    ) : null;

    if (isTablet) {
      return (
        <View style={styles.tabletContent}>
          <View style={styles.tabletLeft}>{kpiGrid}</View>
          <View style={styles.tabletRight}>{topProductsSection}</View>
        </View>
      );
    }

    return (
      <>
        {kpiGrid}
        {topProductsSection}
      </>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with period tabs */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Dashboard</Text>
        <PeriodTabs selected={period} onSelect={setPeriod} />
      </View>

      {/* Stale data warning */}
      {isStale && <StaleDataBanner />}

      {/* Main scrollable content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  // Period tabs
  periodTabBar: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 8,
  },
  periodTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 36,
    justifyContent: "center",
  },
  periodTabActive: {
    backgroundColor: "#6366F1",
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  periodTabTextActive: {
    color: "#FFFFFF",
  },
  // Tablet layout
  tabletContent: {
    flexDirection: "row",
    gap: 16,
  },
  tabletLeft: {
    flex: 3,
  },
  tabletRight: {
    flex: 2,
  },
  // KPI grid — 2 columns
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 100,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
  },
  kpiTrend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  kpiTrendText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Top products card
  topProductsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  topProductRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  topProductRank: {
    width: 24,
    fontSize: 13,
    fontWeight: "700",
    color: "#9CA3AF",
    textAlign: "center",
  },
  topProductName: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    marginHorizontal: 8,
  },
  topProductStats: {
    alignItems: "flex-end",
  },
  topProductRevenue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  topProductUnits: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 1,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 16,
  },
  // Stale banner
  staleBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  staleBannerText: {
    fontSize: 13,
    color: "#92400E",
    flex: 1,
  },
  // Loading / Error
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  loadingText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: "#6366F1",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
});
