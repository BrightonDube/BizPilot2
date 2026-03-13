/**
 * Accounts Receivable Summary Dashboard
 *
 * Gives managers an at-a-glance view of outstanding receivables, credit
 * utilisation, monthly charge/payment trends, and the highest-balance
 * accounts. Designed for tablet-first POS environments with large touch
 * targets and a dark theme.
 *
 * Why a dedicated dashboard instead of inline KPIs on the account list?
 * AR health involves cross-account aggregates (DSO, total overdue,
 * utilisation) that don't belong on a per-account screen, and managers
 * need a single place to assess collection risk at shift-open or close.
 *
 * @param metrics        Aggregate AR figures (receivables, DSO, overdue …).
 * @param topAccounts    Top 10 accounts ranked by outstanding balance.
 * @param monthlyTrends  Last N months of charges vs. payments.
 * @param onBack         Navigate back to the previous screen.
 * @param onAccountPress Navigate to a specific account detail.
 * @param onViewAgingReport  Open the aging report screen.
 * @param onViewCollections  Open the collections workflow.
 * @param isLoading      Show skeleton/loading state while data is fetched.
 */

import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ARMetrics {
  totalReceivables: number;
  totalCreditLimit: number;
  totalAvailableCredit: number;
  averageDSO: number;
  overdueAmount: number;
  overduePercentage: number;
  totalAccounts: number;
  activeAccounts: number;
  suspendedAccounts: number;
  collectionsCount: number;
}

export interface TopAccount {
  id: string;
  name: string;
  balance: number;
  creditLimit: number;
  utilizationPercent: number;
  daysOverdue: number;
}

export interface MonthlyTrend {
  month: string;
  charges: number;
  payments: number;
  netChange: number;
}

export interface ARSummaryDashboardProps {
  metrics: ARMetrics;
  topAccounts: TopAccount[];
  monthlyTrends: MonthlyTrend[];
  onBack: () => void;
  onAccountPress?: (accountId: string) => void;
  onViewAgingReport?: () => void;
  onViewCollections?: () => void;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum touchable dimension (px) – follows Material/Apple HIG for tablets. */
const MIN_TOUCH_TARGET = 48;

const COLORS = {
  background: "#0f172a",
  card: "#1f2937",
  input: "#111827",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#fbbf24",
  blue: "#3b82f6",
  progressTrack: "#374151",
} as const;

/**
 * Utilisation thresholds mirror the traffic-light system used across the POS
 * so staff intuitively know when a customer is near their credit limit.
 */
const UTILISATION_THRESHOLDS = { warning: 70, danger: 90 } as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return a colour string for a given utilisation percentage.
 *
 * Why traffic-light rather than a gradient? Discrete colours are easier to
 * interpret at a glance on a busy POS terminal.
 */
function utilisationColor(percent: number): string {
  if (percent >= UTILISATION_THRESHOLDS.danger) return COLORS.red;
  if (percent >= UTILISATION_THRESHOLDS.warning) return COLORS.amber;
  return COLORS.green;
}

/**
 * Clamp a value between 0 and a given maximum.
 *
 * Why clamp? External data may produce utilisation > 100 % if a customer
 * exceeds their credit limit; the progress bar must not overflow its track.
 */
function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

/**
 * Derive the maximum bar height for monthly trend visualisations.
 *
 * Why derive from data rather than a fixed height? It keeps the bars
 * proportional regardless of the absolute values.
 */
function maxTrendValue(trends: MonthlyTrend[]): number {
  if (trends.length === 0) return 1;
  const peak = Math.max(...trends.map((t) => Math.max(t.charges, t.payments)));
  return peak > 0 ? peak : 1;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/* ---- KPI Card ---------------------------------------------------------- */

interface KPICardProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  subtitle?: string;
  testID?: string;
}

/**
 * A single metric tile inside the KPI grid.
 *
 * Why memoised? The grid re-renders whenever any metric changes; memoising
 * each card prevents unnecessary layout work for unchanged tiles.
 */
const KPICard = React.memo(function KPICard({
  label,
  value,
  icon,
  color,
  subtitle,
  testID,
}: KPICardProps) {
  return (
    <View style={styles.kpiCard} testID={testID}>
      <View style={styles.kpiIconRow}>
        <Ionicons name={icon} size={22} color={color} />
        <Text style={[styles.kpiLabel, { color: COLORS.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.kpiValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      {subtitle ? (
        <Text style={styles.kpiSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
});

/* ---- Monthly Trend Card ------------------------------------------------ */

interface TrendCardProps {
  trend: MonthlyTrend;
  maxValue: number;
}

/** Max bar height in the trend mini-chart (px). */
const TREND_BAR_MAX_HEIGHT = 80;

/**
 * A single month's charge/payment comparison card.
 *
 * Why a card-per-month instead of a full-width chart library? It avoids a
 * heavy charting dependency and scrolls naturally on tablets in landscape.
 */
const TrendCard = React.memo(function TrendCard({ trend, maxValue }: TrendCardProps) {
  const chargesHeight = (trend.charges / maxValue) * TREND_BAR_MAX_HEIGHT;
  const paymentsHeight = (trend.payments / maxValue) * TREND_BAR_MAX_HEIGHT;
  const netColor = trend.netChange >= 0 ? COLORS.red : COLORS.green;

  return (
    <View style={styles.trendCard}>
      <Text style={styles.trendMonth}>{trend.month}</Text>

      {/* Mini bar chart */}
      <View style={styles.trendBarsContainer}>
        <View style={styles.trendBarWrapper}>
          <View
            style={[
              styles.trendBar,
              { height: chargesHeight, backgroundColor: COLORS.red },
            ]}
          />
          <Text style={styles.trendBarLabel}>C</Text>
        </View>
        <View style={styles.trendBarWrapper}>
          <View
            style={[
              styles.trendBar,
              { height: paymentsHeight, backgroundColor: COLORS.green },
            ]}
          />
          <Text style={styles.trendBarLabel}>P</Text>
        </View>
      </View>

      {/* Amounts */}
      <Text style={[styles.trendAmount, { color: COLORS.red }]}>
        {formatCurrency(trend.charges)}
      </Text>
      <Text style={[styles.trendAmount, { color: COLORS.green }]}>
        {formatCurrency(trend.payments)}
      </Text>

      {/* Net change */}
      <Text style={[styles.trendNet, { color: netColor }]}>
        {trend.netChange >= 0 ? "+" : ""}
        {formatCurrency(trend.netChange)}
      </Text>
    </View>
  );
});

/* ---- Top Account Row --------------------------------------------------- */

interface AccountRowProps {
  account: TopAccount;
  onPress?: (id: string) => void;
}

/**
 * A pressable row summarising one top account.
 *
 * Why inline utilisation bar instead of a shared ProgressBar component?
 * The bar here needs custom width + colour logic that is specific to account
 * credit utilisation; a generic component would still need this logic as props.
 */
const AccountRow = React.memo(function AccountRow({ account, onPress }: AccountRowProps) {
  const barColor = utilisationColor(account.utilizationPercent);
  const barWidth = `${clamp(account.utilizationPercent, 100)}%` as const;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(account.id);
  }, [account.id, onPress]);

  return (
    <TouchableOpacity
      style={styles.accountRow}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={!onPress}
      testID={`ar-account-row-${account.id}`}
    >
      {/* Left: name + balance */}
      <View style={styles.accountInfo}>
        <Text style={styles.accountName} numberOfLines={1}>
          {account.name}
        </Text>
        <Text style={styles.accountBalance}>
          {formatCurrency(account.balance)}
          <Text style={styles.accountCreditLimit}>
            {" "}
            / {formatCurrency(account.creditLimit)}
          </Text>
        </Text>

        {/* Utilisation bar */}
        <View style={styles.accountBarTrack}>
          <View
            style={[styles.accountBarFill, { width: barWidth, backgroundColor: barColor }]}
          />
        </View>
      </View>

      {/* Right: overdue badge + chevron */}
      <View style={styles.accountTrailing}>
        {account.daysOverdue > 0 ? (
          <View style={styles.overdueBadge}>
            <Text style={styles.overdueBadgeText}>
              {account.daysOverdue}d overdue
            </Text>
          </View>
        ) : (
          <Text style={styles.currentBadgeText}>Current</Text>
        )}
        {onPress ? (
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function ARSummaryDashboardComponent({
  metrics,
  topAccounts,
  monthlyTrends,
  onBack,
  onAccountPress,
  onViewAgingReport,
  onViewCollections,
  isLoading = false,
}: ARSummaryDashboardProps) {
  // -- Derived data --------------------------------------------------------

  const trendMax = useMemo(() => maxTrendValue(monthlyTrends), [monthlyTrends]);

  /**
   * Why compute utilisation here instead of expecting it in props?
   * `metrics` already carries the raw totals; deriving the percentage avoids
   * an extra field that could drift out of sync with the underlying data.
   */
  const creditUtilisationPercent = useMemo(() => {
    if (metrics.totalCreditLimit === 0) return 0;
    return (metrics.totalReceivables / metrics.totalCreditLimit) * 100;
  }, [metrics.totalReceivables, metrics.totalCreditLimit]);

  const utilisationBarColor = useMemo(
    () => utilisationColor(creditUtilisationPercent),
    [creditUtilisationPercent],
  );

  // -- Callbacks -----------------------------------------------------------

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  const handleAgingReport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onViewAgingReport?.();
  }, [onViewAgingReport]);

  const handleCollections = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onViewCollections?.();
  }, [onViewCollections]);

  // -- FlatList helpers ----------------------------------------------------

  const renderAccountRow = useCallback(
    ({ item }: { item: TopAccount }) => (
      <AccountRow account={item} onPress={onAccountPress} />
    ),
    [onAccountPress],
  );

  const keyExtractor = useCallback((item: TopAccount) => item.id, []);

  // -- Loading state -------------------------------------------------------

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="ar-loading">
        <ActivityIndicator size="large" color={COLORS.blue} />
        <Text style={styles.loadingText}>Loading AR summary…</Text>
      </View>
    );
  }

  // -- Render --------------------------------------------------------------

  return (
    <View style={styles.container} testID="ar-summary-dashboard">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            testID="ar-back-btn"
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>AR Summary</Text>

          <View style={styles.headerActions}>
            {onViewAgingReport ? (
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={handleAgingReport}
                testID="ar-aging-btn"
              >
                <Ionicons name="calendar-outline" size={20} color={COLORS.blue} />
                <Text style={styles.headerActionText}>Aging Report</Text>
              </TouchableOpacity>
            ) : null}

            {onViewCollections ? (
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={handleCollections}
                testID="ar-collections-btn"
              >
                <Ionicons name="wallet-outline" size={20} color={COLORS.amber} />
                <Text style={styles.headerActionText}>Collections</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* ── KPI Grid ─────────────────────────────────────────────── */}
        <View style={styles.kpiGrid} testID="ar-kpi-grid">
          <KPICard
            label="Total Receivables"
            value={formatCurrency(metrics.totalReceivables)}
            icon="cash-outline"
            color={COLORS.blue}
            testID="ar-kpi-total-receivables"
          />
          <KPICard
            label="Avg DSO"
            value={`${metrics.averageDSO.toFixed(1)} days`}
            icon="time-outline"
            color={COLORS.text}
            subtitle="Days Sales Outstanding"
            testID="ar-kpi-avg-dso"
          />
          <KPICard
            label="Overdue"
            value={formatCurrency(metrics.overdueAmount)}
            icon="alert-circle-outline"
            color={metrics.overdueAmount > 0 ? COLORS.red : COLORS.green}
            subtitle={`${metrics.overduePercentage.toFixed(1)}% of receivables`}
            testID="ar-kpi-overdue"
          />
          <KPICard
            label="Active Accounts"
            value={`${metrics.activeAccounts} / ${metrics.totalAccounts}`}
            icon="people-outline"
            color={COLORS.text}
            subtitle={
              metrics.suspendedAccounts > 0
                ? `${metrics.suspendedAccounts} suspended`
                : undefined
            }
            testID="ar-kpi-active-accounts"
          />
          <KPICard
            label="Total Credit Limit"
            value={formatCurrency(metrics.totalCreditLimit)}
            icon="shield-checkmark-outline"
            color={COLORS.text}
            testID="ar-kpi-credit-limit"
          />
          <KPICard
            label="Available Credit"
            value={formatCurrency(metrics.totalAvailableCredit)}
            icon="trending-up-outline"
            color={COLORS.green}
            testID="ar-kpi-available-credit"
          />
        </View>

        {/* ── Credit Utilisation Bar ───────────────────────────────── */}
        <View style={styles.utilisationSection} testID="ar-utilization-bar">
          <View style={styles.utilisationHeader}>
            <Text style={styles.sectionTitle}>Credit Utilisation</Text>
            <Text style={[styles.utilisationPercent, { color: utilisationBarColor }]}>
              {creditUtilisationPercent.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.utilisationTrack}>
            <View
              style={[
                styles.utilisationFill,
                {
                  width: `${clamp(creditUtilisationPercent, 100)}%`,
                  backgroundColor: utilisationBarColor,
                },
              ]}
            />
          </View>
          <View style={styles.utilisationLabels}>
            <Text style={styles.utilisationLabelText}>
              {formatCurrency(metrics.totalReceivables)} used
            </Text>
            <Text style={styles.utilisationLabelText}>
              {formatCurrency(metrics.totalCreditLimit)} limit
            </Text>
          </View>
        </View>

        {/* ── Monthly Trends ───────────────────────────────────────── */}
        <View style={styles.section} testID="ar-monthly-trends">
          <Text style={styles.sectionTitle}>Monthly Trends</Text>

          {monthlyTrends.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bar-chart-outline" size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyStateText}>No trend data available</Text>
            </View>
          ) : (
            <>
              {/* Legend */}
              <View style={styles.trendLegend}>
                <View style={styles.trendLegendItem}>
                  <View style={[styles.trendLegendDot, { backgroundColor: COLORS.red }]} />
                  <Text style={styles.trendLegendLabel}>Charges</Text>
                </View>
                <View style={styles.trendLegendItem}>
                  <View
                    style={[styles.trendLegendDot, { backgroundColor: COLORS.green }]}
                  />
                  <Text style={styles.trendLegendLabel}>Payments</Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.trendScrollContent}
              >
                {monthlyTrends.map((trend) => (
                  <TrendCard key={trend.month} trend={trend} maxValue={trendMax} />
                ))}
              </ScrollView>
            </>
          )}
        </View>

        {/* ── Top Accounts ─────────────────────────────────────────── */}
        <View style={styles.section} testID="ar-top-accounts">
          <Text style={styles.sectionTitle}>
            Top Accounts by Balance
            {topAccounts.length > 0 ? ` (${topAccounts.length})` : ""}
          </Text>

          {topAccounts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyStateText}>No accounts to display</Text>
            </View>
          ) : (
            /**
             * Why FlatList with scrollEnabled={false} inside a ScrollView?
             * We benefit from FlatList's keyExtractor and renderItem pattern
             * for the account list, but the outer ScrollView must own the
             * scroll gesture so all sections scroll as one continuous page.
             */
            <FlatList
              data={topAccounts}
              renderItem={renderAccountRow}
              keyExtractor={keyExtractor}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  /* Layout */
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 16,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: MIN_TOUCH_TARGET,
  },
  headerActionText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },

  /* KPI Grid */
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 10,
  },
  kpiCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    /**
     * Why `flexBasis` with `flexGrow`?
     * This ensures cards fill roughly half the row on tablets while
     * allowing the layout to adapt if there is extra horizontal space.
     */
    flexBasis: "47%",
    flexGrow: 1,
    gap: 4,
  },
  kpiIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  kpiSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  /* Credit Utilisation */
  utilisationSection: {
    marginHorizontal: 16,
    marginTop: 18,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
  },
  utilisationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  utilisationPercent: {
    fontSize: 18,
    fontWeight: "700",
  },
  utilisationTrack: {
    height: 14,
    backgroundColor: COLORS.progressTrack,
    borderRadius: 7,
    overflow: "hidden",
  },
  utilisationFill: {
    height: "100%",
    borderRadius: 7,
  },
  utilisationLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  utilisationLabelText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  /* Section (shared) */
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
  },

  /* Monthly Trends */
  trendLegend: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 10,
  },
  trendLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trendLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  trendLegendLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  trendScrollContent: {
    gap: 10,
    paddingRight: 16,
  },
  trendCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    width: 140,
    alignItems: "center",
  },
  trendMonth: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },
  trendBarsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: TREND_BAR_MAX_HEIGHT,
    gap: 8,
    marginBottom: 8,
  },
  trendBarWrapper: {
    alignItems: "center",
    gap: 4,
  },
  trendBar: {
    width: 28,
    borderRadius: 4,
    minHeight: 4,
  },
  trendBarLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  trendAmount: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  trendNet: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },

  /* Top Accounts */
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    minHeight: MIN_TOUCH_TARGET,
  },
  accountInfo: {
    flex: 1,
    gap: 4,
  },
  accountName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  accountBalance: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  accountCreditLimit: {
    fontWeight: "400",
    color: COLORS.textMuted,
  },
  accountBarTrack: {
    height: 6,
    backgroundColor: COLORS.progressTrack,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 4,
  },
  accountBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  accountTrailing: {
    alignItems: "flex-end",
    gap: 6,
    marginLeft: 12,
  },
  overdueBadge: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  overdueBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  currentBadgeText: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: "600",
  },

  /* Empty state */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 10,
  },
  emptyStateText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Why `React.memo` on the top-level component?
 * The dashboard is typically rendered inside a navigation stack. Memoising
 * prevents re-renders when the parent navigator updates unrelated screens.
 */
export default React.memo(ARSummaryDashboardComponent) as typeof ARSummaryDashboardComponent;
