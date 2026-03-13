/**
 * DateRangePicker — Reusable date-range selector with preset pills.
 *
 * Renders a human-readable range display, quick-select presets (Today, 7 Days,
 * etc.) and an expandable "Custom" mode with validated text inputs.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface DateRangePickerProps {
  /** Start of range in YYYY-MM-DD format */
  startDate: string;
  /** End of range in YYYY-MM-DD format */
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  presets?: Array<{ label: string; days: number }>;
  /** Earliest selectable date (YYYY-MM-DD) */
  minDate?: string;
  /** Latest selectable date (YYYY-MM-DD) */
  maxDate?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

interface Preset {
  label: string;
  days: number;
}

const DEFAULT_PRESETS: Preset[] = [
  { label: "Today", days: 0 },
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
  { label: "This Month", days: -1 },
  { label: "This Quarter", days: -2 },
];

/** YYYY-MM-DD validation pattern */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Format YYYY-MM-DD into a friendly display string, e.g. "Mar 1, 2024". */
function formatDisplay(ymd: string): string {
  const d = new Date(ymd + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Return today as YYYY-MM-DD in the device timezone. */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Subtract `n` days from today and return YYYY-MM-DD. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** First day of the current month. */
function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

/** First day of the current quarter. */
function quarterStart(): string {
  const d = new Date();
  const qMonth = Math.floor(d.getMonth() / 3) * 3;
  d.setMonth(qMonth, 1);
  return d.toISOString().slice(0, 10);
}

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(value + "T00:00:00");
  return !isNaN(d.getTime());
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

function DateRangePicker({
  startDate,
  endDate,
  onRangeChange,
  presets,
  minDate,
  maxDate,
}: DateRangePickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);

  const resolvedPresets = presets ?? DEFAULT_PRESETS;

  // ── Derived state ─────────────────────────────────────────────────────────

  const displayLabel = useMemo(
    () => `${formatDisplay(startDate)} — ${formatDisplay(endDate)}`,
    [startDate, endDate],
  );

  const canApply = useMemo(() => {
    if (!isValidDate(draftStart) || !isValidDate(draftEnd)) return false;
    if (draftStart > draftEnd) return false;
    if (minDate && draftStart < minDate) return false;
    if (maxDate && draftEnd > maxDate) return false;
    return true;
  }, [draftStart, draftEnd, minDate, maxDate]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePreset = useCallback(
    (preset: Preset) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      let start: string;
      const end = todayStr();

      if (preset.days === 0) {
        start = end; // Today
      } else if (preset.days === -1) {
        start = monthStart(); // This Month
      } else if (preset.days === -2) {
        start = quarterStart(); // This Quarter
      } else {
        start = daysAgo(preset.days);
      }

      setShowCustom(false);
      onRangeChange(start, end);
    },
    [onRangeChange],
  );

  const handleCustomToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setShowCustom((prev) => !prev);
  }, [startDate, endDate]);

  const handleApply = useCallback(() => {
    if (!canApply) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowCustom(false);
    onRangeChange(draftStart, draftEnd);
  }, [canApply, draftStart, draftEnd, onRangeChange]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container} testID="date-range-picker">
      {/* Range display */}
      <TouchableOpacity style={styles.rangeDisplay} onPress={handleCustomToggle}>
        <Ionicons name="calendar-outline" size={16} color="#9ca3af" />
        <Text style={styles.rangeText}>{displayLabel}</Text>
        <Ionicons
          name={showCustom ? "chevron-up" : "chevron-down"}
          size={16}
          color="#9ca3af"
        />
      </TouchableOpacity>

      {/* Preset pills */}
      <View style={styles.presetsRow}>
        {resolvedPresets.map((preset) => (
          <TouchableOpacity
            key={preset.label}
            testID={`date-preset-${preset.label}`}
            style={styles.presetPill}
            onPress={() => handlePreset(preset)}
          >
            <Text style={styles.presetText}>{preset.label}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.presetPill, showCustom && styles.presetPillActive]}
          testID="date-preset-Custom"
          onPress={handleCustomToggle}
        >
          <Text style={[styles.presetText, showCustom && styles.presetTextActive]}>Custom</Text>
        </TouchableOpacity>
      </View>

      {/* Custom date inputs (shown when expanded) */}
      {showCustom && (
        <View style={styles.customSection}>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Start</Text>
              <TextInput
                testID="date-start"
                style={[
                  styles.input,
                  !isValidDate(draftStart) && draftStart.length === 10 && styles.inputError,
                ]}
                value={draftStart}
                onChangeText={setDraftStart}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#4b5563"
                maxLength={10}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <Ionicons
              name="arrow-forward"
              size={16}
              color="#6b7280"
              style={styles.arrowIcon}
            />

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>End</Text>
              <TextInput
                testID="date-end"
                style={[
                  styles.input,
                  !isValidDate(draftEnd) && draftEnd.length === 10 && styles.inputError,
                ]}
                value={draftEnd}
                onChangeText={setDraftEnd}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#4b5563"
                maxLength={10}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <TouchableOpacity
            testID="date-apply-btn"
            style={[styles.applyBtn, !canApply && styles.applyBtnDisabled]}
            onPress={handleApply}
            disabled={!canApply}
          >
            <Text style={[styles.applyBtnText, !canApply && styles.applyBtnTextDisabled]}>
              Apply Range
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  } as ViewStyle,

  // ── Range display ─────────────────────────────────────────────────────────

  rangeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  } as ViewStyle,

  rangeText: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 14,
    fontWeight: "500",
  } as TextStyle,

  // ── Presets ───────────────────────────────────────────────────────────────

  presetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  } as ViewStyle,

  presetPill: {
    backgroundColor: "#1f2937",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  } as ViewStyle,

  presetPillActive: {
    backgroundColor: "#3b82f6",
  } as ViewStyle,

  presetText: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "500",
  } as TextStyle,

  presetTextActive: {
    color: "#ffffff",
  } as TextStyle,

  // ── Custom section ────────────────────────────────────────────────────────

  customSection: {
    marginTop: 12,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    gap: 12,
  } as ViewStyle,

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  } as ViewStyle,

  inputGroup: {
    flex: 1,
    gap: 4,
  } as ViewStyle,

  inputLabel: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "500",
  } as TextStyle,

  input: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f3f4f6",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#374151",
  } as TextStyle,

  inputError: {
    borderColor: "#ef4444",
  } as ViewStyle,

  arrowIcon: {
    marginBottom: 10,
  } as ViewStyle,

  // ── Apply button ──────────────────────────────────────────────────────────

  applyBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  } as ViewStyle,

  applyBtnDisabled: {
    backgroundColor: "#374151",
  } as ViewStyle,

  applyBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  } as TextStyle,

  applyBtnTextDisabled: {
    color: "#6b7280",
  } as TextStyle,
});

export default React.memo(DateRangePicker);
