/**
 * ScheduleCalendar — Calendar view for scheduling content on digital displays.
 *
 * Renders a time grid (06:00–23:00) with coloured slot blocks positioned by
 * time. Supports day and week view modes, with date navigation and tap-to-add.
 *
 * Why a custom time grid instead of a calendar library?
 * Signage scheduling is hour-granular and highly visual. A purpose-built grid
 * gives us full control over slot rendering, colour coding, and tablet-optimised
 * touch targets without pulling in a heavy third-party calendar dependency.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ScheduledSlot {
  id: string;
  contentName: string;
  displayName: string;
  startTime: string; // ISO
  endTime: string;
  color: string;
  isRecurring: boolean;
}

export interface ScheduleCalendarProps {
  slots: ScheduledSlot[];
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  onSlotPress: (slotId: string) => void;
  onAddSlot: (hour: number) => void;
  viewMode: "day" | "week";
  onViewModeChange: (mode: "day" | "week") => void;
  isLoading?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Display hours from 6 AM to 11 PM — covers typical signage operating hours. */
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const HOUR_HEIGHT = 64;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Format hour number to HH:00 string. */
function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

/**
 * Parse a YYYY-MM-DD string into a Date object at midnight UTC.
 *
 * Why UTC?
 * We avoid timezone-related shifts when navigating between dates. All
 * date comparisons and arithmetic stay consistent regardless of device locale.
 */
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDateDisplay(dateStr: string): string {
  const date = parseDate(dateStr);
  const day = date.getUTCDate();
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const dayName = DAY_LABELS[date.getUTCDay()];
  return `${dayName}, ${day} ${month} ${year}`;
}

/** Navigate date string by a number of days. */
function shiftDate(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

/** Clickable hour row that triggers slot creation. */
const HourRow = React.memo(function HourRow({
  hour,
  onAddSlot,
}: {
  hour: number;
  onAddSlot: (hour: number) => void;
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddSlot(hour);
  }, [onAddSlot, hour]);

  return (
    <TouchableOpacity
      testID={`schedule-hour-${hour}`}
      style={styles.hourRow}
      onPress={handlePress}
      activeOpacity={0.5}
      accessibilityLabel={`Add slot at ${formatHour(hour)}`}
      accessibilityRole="button"
    >
      <Text style={styles.hourLabel}>{formatHour(hour)}</Text>
      <View style={styles.hourLine} />
    </TouchableOpacity>
  );
});

/** Positioned slot block overlaid on the time grid. */
const SlotBlock = React.memo(function SlotBlock({
  slot,
  onPress,
}: {
  slot: ScheduledSlot;
  onPress: (id: string) => void;
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress(slot.id);
  }, [onPress, slot.id]);

  /**
   * Calculate vertical position from start/end times.
   *
   * Why compute from hours directly?
   * Each hour row has a fixed height, so pixel offset = (hour - 6) * HOUR_HEIGHT.
   * This avoids layout measurement and keeps rendering synchronous.
   */
  const startDate = new Date(slot.startTime);
  const endDate = new Date(slot.endTime);
  const startHour = startDate.getHours() + startDate.getMinutes() / 60;
  const endHour = endDate.getHours() + endDate.getMinutes() / 60;
  const top = (startHour - 6) * HOUR_HEIGHT;
  const height = Math.max((endHour - startHour) * HOUR_HEIGHT, HOUR_HEIGHT * 0.5);

  return (
    <TouchableOpacity
      testID={`schedule-slot-${slot.id}`}
      style={[
        styles.slotBlock,
        {
          top,
          height,
          backgroundColor: slot.color + "30",
          borderLeftColor: slot.color,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityLabel={`${slot.contentName} on ${slot.displayName}`}
      accessibilityRole="button"
    >
      <View style={styles.slotHeader}>
        <Text style={[styles.slotName, { color: slot.color }]} numberOfLines={1}>
          {slot.contentName}
        </Text>
        {slot.isRecurring && (
          <Ionicons name="repeat-outline" size={12} color={slot.color} />
        )}
      </View>
      <Text style={styles.slotDisplay} numberOfLines={1}>
        {slot.displayName}
      </Text>
    </TouchableOpacity>
  );
});

// ─── Main Component ─────────────────────────────────────────────────────────

/**
 * @param props - {@link ScheduleCalendarProps}
 * @returns Time-grid calendar for scheduling signage content.
 */
const ScheduleCalendar = React.memo(function ScheduleCalendar({
  slots,
  selectedDate,
  onDateChange,
  onSlotPress,
  onAddSlot,
  viewMode,
  onViewModeChange,
  isLoading = false,
}: ScheduleCalendarProps) {
  // ── Navigation handlers ───────────────────────────────────────

  const handlePrev = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const days = viewMode === "week" ? -7 : -1;
    onDateChange(shiftDate(selectedDate, days));
  }, [onDateChange, selectedDate, viewMode]);

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const days = viewMode === "week" ? 7 : 1;
    onDateChange(shiftDate(selectedDate, days));
  }, [onDateChange, selectedDate, viewMode]);

  const handleDayMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onViewModeChange("day");
  }, [onViewModeChange]);

  const handleWeekMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onViewModeChange("week");
  }, [onViewModeChange]);

  // ── Filter slots for selected date ────────────────────────────

  const visibleSlots = useMemo(() => {
    const base = parseDate(selectedDate);
    if (viewMode === "day") {
      return slots.filter((s) => {
        const d = new Date(s.startTime);
        return (
          d.getFullYear() === base.getUTCFullYear() &&
          d.getMonth() === base.getUTCMonth() &&
          d.getDate() === base.getUTCDate()
        );
      });
    }
    // Week view: 7 days starting from selectedDate
    const end = parseDate(shiftDate(selectedDate, 7));
    return slots.filter((s) => {
      const d = new Date(s.startTime);
      return d >= base && d < end;
    });
  }, [slots, selectedDate, viewMode]);

  // Week column headers
  const weekDays = useMemo(() => {
    if (viewMode !== "week") return [];
    return Array.from({ length: 7 }, (_, i) => {
      const d = parseDate(shiftDate(selectedDate, i));
      return {
        label: DAY_LABELS[d.getUTCDay()],
        date: d.getUTCDate(),
      };
    });
  }, [selectedDate, viewMode]);

  // ── Render ────────────────────────────────────────────────────

  return (
    <View testID="schedule-calendar" style={styles.container}>
      {/* ── Header ──────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Date navigation */}
        <View style={styles.dateNav}>
          <TouchableOpacity
            testID="schedule-date-prev"
            style={styles.navButton}
            onPress={handlePrev}
            accessibilityLabel="Previous"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={22} color="#f3f4f6" />
          </TouchableOpacity>

          <Text style={styles.dateText}>{formatDateDisplay(selectedDate)}</Text>

          <TouchableOpacity
            testID="schedule-date-next"
            style={styles.navButton}
            onPress={handleNext}
            accessibilityLabel="Next"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-forward" size={22} color="#f3f4f6" />
          </TouchableOpacity>
        </View>

        {/* View mode toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            testID="schedule-mode-day"
            style={[styles.modeButton, viewMode === "day" && styles.modeButtonActive]}
            onPress={handleDayMode}
            accessibilityLabel="Day view"
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.modeButtonText,
                viewMode === "day" && styles.modeButtonTextActive,
              ]}
            >
              Day
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="schedule-mode-week"
            style={[styles.modeButton, viewMode === "week" && styles.modeButtonActive]}
            onPress={handleWeekMode}
            accessibilityLabel="Week view"
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.modeButtonText,
                viewMode === "week" && styles.modeButtonTextActive,
              ]}
            >
              Week
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Week column headers ─────────────────────────── */}
      {viewMode === "week" && weekDays.length > 0 && (
        <View style={styles.weekHeaderRow}>
          {/* Spacer for hour label column */}
          <View style={styles.hourLabelSpacer} />
          {weekDays.map((wd, i) => (
            <View key={i} style={styles.weekDayHeader}>
              <Text style={styles.weekDayLabel}>{wd.label}</Text>
              <Text style={styles.weekDayDate}>{wd.date}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Loading state ───────────────────────────────── */}
      {isLoading ? (
        <View testID="schedule-loading" style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading schedule…</Text>
        </View>
      ) : (
        /* ── Time grid ────────────────────────────────────── */
        <ScrollView
          style={styles.gridScroll}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.gridContainer}>
            {/* Hour rows */}
            {HOURS.map((hour) => (
              <HourRow key={hour} hour={hour} onAddSlot={onAddSlot} />
            ))}

            {/* Slot overlays */}
            {visibleSlots.map((slot) => (
              <SlotBlock key={slot.id} slot={slot} onPress={onSlotPress} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
});

export default ScheduleCalendar;

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
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f2937",
    borderRadius: 10,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
    minWidth: 180,
    textAlign: "center",
  },

  /* Mode toggle */
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    borderRadius: 10,
    overflow: "hidden",
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonActive: {
    backgroundColor: "#3b82f6",
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
  },
  modeButtonTextActive: {
    color: "#f3f4f6",
  },

  /* ── Week header ────────────────────────────────────── */
  weekHeaderRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  hourLabelSpacer: {
    width: 56,
  },
  weekDayHeader: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  weekDayLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9ca3af",
  },
  weekDayDate: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f3f4f6",
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

  /* ── Grid ───────────────────────────────────────────── */
  gridScroll: {
    flex: 1,
  },
  gridContent: {
    paddingBottom: 32,
  },
  gridContainer: {
    position: "relative",
    minHeight: HOURS.length * HOUR_HEIGHT,
  },

  /* Hour rows */
  hourRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    height: HOUR_HEIGHT,
    paddingLeft: 16,
  },
  hourLabel: {
    width: 48,
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    paddingTop: 2,
  },
  hourLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#1e293b",
    marginTop: 8,
  },

  /* Slot block */
  slotBlock: {
    position: "absolute",
    left: 72,
    right: 16,
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: "center",
  },
  slotHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  slotName: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  slotDisplay: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
});
