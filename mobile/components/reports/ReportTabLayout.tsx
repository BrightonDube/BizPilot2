/**
 * ReportTabLayout — Top-level container for the extended reports screen.
 *
 * Renders the header, date-range quick-presets, a horizontally-scrollable
 * tab bar, and a content area where the active tab's children are shown.
 *
 * Designed tablet-first: generous touch targets, wide-screen padding, and
 * horizontal scroll for tabs so the layout still works on phones.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReportTab {
  key: string;
  label: string;
  icon: string;
}

export interface ReportTabLayoutProps {
  tabs: ReportTab[];
  activeTab: string;
  onTabChange: (tabKey: string) => void;
  dateRange: { startDate: string; endDate: string };
  onDateRangeChange: (range: { startDate: string; endDate: string }) => void;
  onExport?: () => void;
  onBack: () => void;
  children: React.ReactNode;
}

// ─── Date helpers ────────────────────────────────────────────────────────────

/** Build an ISO date string relative to today. */
function isoDate(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  // Monday-based week
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function startOfQuarter(): string {
  const d = new Date();
  const quarter = Math.floor(d.getMonth() / 3);
  d.setMonth(quarter * 3, 1);
  return d.toISOString().split("T")[0];
}

interface DatePreset {
  key: string;
  label: string;
  testID: string;
  range: () => { startDate: string; endDate: string };
}

const DATE_PRESETS: DatePreset[] = [
  {
    key: "today",
    label: "Today",
    testID: "report-date-today",
    range: () => ({ startDate: isoDate(0), endDate: isoDate(0) }),
  },
  {
    key: "week",
    label: "This Week",
    testID: "report-date-week",
    range: () => ({ startDate: startOfWeek(), endDate: isoDate(0) }),
  },
  {
    key: "month",
    label: "This Month",
    testID: "report-date-month",
    range: () => ({ startDate: startOfMonth(), endDate: isoDate(0) }),
  },
  {
    key: "quarter",
    label: "This Quarter",
    testID: "report-date-quarter",
    range: () => ({ startDate: startOfQuarter(), endDate: isoDate(0) }),
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Single date-range pill. */
const DatePill = React.memo(function DatePill({
  preset,
  isActive,
  onPress,
}: {
  preset: DatePreset;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      testID={preset.testID}
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.datePill, isActive && styles.datePillActive]}
    >
      <Text style={[styles.datePillText, isActive && styles.datePillTextActive]}>
        {preset.label}
      </Text>
    </TouchableOpacity>
  );
});

/** Single tab button inside the scrollable tab bar. */
const TabButton = React.memo(function TabButton({
  tab,
  isActive,
  onPress,
}: {
  tab: ReportTab;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      testID={`report-tab-${tab.key}`}
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.tabButton, isActive && styles.tabButtonActive]}
    >
      <Ionicons
        name={tab.icon as any}
        size={20}
        color={isActive ? "#22c55e" : "#9ca3af"}
      />
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
        {tab.label}
      </Text>
    </TouchableOpacity>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

function ReportTabLayout({
  tabs,
  activeTab,
  onTabChange,
  dateRange,
  onDateRangeChange,
  onExport,
  onBack,
  children,
}: ReportTabLayoutProps) {
  // ── Detect which preset (if any) matches the current dateRange ──
  const activePreset = useMemo(() => {
    for (const preset of DATE_PRESETS) {
      const r = preset.range();
      if (r.startDate === dateRange.startDate && r.endDate === dateRange.endDate) {
        return preset.key;
      }
    }
    return null;
  }, [dateRange]);

  // ── Handlers ──
  const handlePresetPress = useCallback(
    (preset: DatePreset) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onDateRangeChange(preset.range());
    },
    [onDateRangeChange],
  );

  const handleTabPress = useCallback(
    (key: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onTabChange(key);
    },
    [onTabChange],
  );

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  const handleExport = useCallback(() => {
    if (!onExport) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onExport();
  }, [onExport]);

  // ── Display range for custom dates ──
  const rangeLabel = useMemo(() => {
    const fmt = (iso: string) =>
      new Date(iso).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
      });
    return `${fmt(dateRange.startDate)} – ${fmt(dateRange.endDate)}`;
  }, [dateRange]);

  // ── Render ──
  return (
    <View style={styles.container} testID="report-tabs">
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="report-back-btn"
          onPress={handleBack}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#f3f4f6" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Reports</Text>

        {onExport ? (
          <TouchableOpacity
            testID="report-export-btn"
            onPress={handleExport}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <Ionicons name="download-outline" size={24} color="#f3f4f6" />
          </TouchableOpacity>
        ) : (
          // Keep symmetry so the title stays centred.
          <View style={styles.headerButton} />
        )}
      </View>

      {/* ── Date Range Selector ── */}
      <View style={styles.dateSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateScrollContent}
        >
          {DATE_PRESETS.map((preset) => (
            <DatePill
              key={preset.key}
              preset={preset}
              isActive={activePreset === preset.key}
              onPress={() => handlePresetPress(preset)}
            />
          ))}
        </ScrollView>

        {/* Always show the resolved range so users know what dates are active. */}
        <Text style={styles.rangeLabel}>{rangeLabel}</Text>
      </View>

      {/* ── Tab Bar ── */}
      <View style={styles.tabBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          {tabs.map((tab) => (
            <TabButton
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              onPress={() => handleTabPress(tab.key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Content Area ── */}
      <View style={styles.content} testID="report-content">
        {children}
      </View>
    </View>
  );
}

export default React.memo(ReportTabLayout);

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  } as ViewStyle,

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },

  // ── Date range ──
  dateSection: {
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#374151",
  },
  dateScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  datePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1f2937",
  },
  datePillActive: {
    backgroundColor: "#22c55e",
  },
  datePillText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#9ca3af",
  },
  datePillTextActive: {
    color: "#0f172a",
    fontWeight: "600",
  },
  rangeLabel: {
    marginTop: 6,
    paddingHorizontal: 16,
    fontSize: 12,
    color: "#6b7280",
  },

  // ── Tabs ──
  tabBarContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#374151",
  },
  tabBarContent: {
    paddingHorizontal: 12,
    gap: 4,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabButtonActive: {
    borderBottomColor: "#22c55e",
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#9ca3af",
  },
  tabLabelActive: {
    color: "#22c55e",
    fontWeight: "600",
  },

  // ── Content ──
  content: {
    flex: 1,
  },
});
