/**
 * LaybyConfigForm — configuration form for layby business rules.
 *
 * Lets a manager set deposit minimums, instalment limits, grace
 * periods, cancellation fees, and automatic reminder behaviour.
 *
 * Why expose these settings instead of hard-coding them?
 * Every retail business has different risk appetite. A furniture
 * store might require 30% deposit with 12-month max, while a
 * clothing shop uses 10% and 3 months. Making rules configurable
 * avoids per-client code forks.
 *
 * Why a toggle + conditional field for reminders?
 * Some businesses handle follow-ups manually (WhatsApp, phone).
 * The toggle lets them opt-out cleanly instead of setting
 * reminder days to some "disabled" magic number.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { triggerHaptic } from "@/utils/haptics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LaybyConfig {
  minDepositPercent: number;
  maxInstalmentMonths: number;
  overdueGraceDays: number;
  cancellationFeePercent: number;
  autoReminderEnabled: boolean;
  reminderDaysBefore: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LaybyConfigFormProps {
  config: LaybyConfig;
  onConfigChange: (updates: Partial<LaybyConfig>) => void;
  onSave: () => void;
  onReset: () => void;
  isSaving?: boolean;
  hasChanges?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard max-instalment options covering short to extended plans. */
const MONTH_OPTIONS = [3, 6, 9, 12, 18, 24] as const;

/**
 * Preset deposit percentages for quick selection.
 * Why these? They cover the most common SA retail policies.
 */
const DEPOSIT_PRESETS = [10, 15, 20, 25, 30, 50] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely parse a numeric text input, clamping within [min, max].
 * Returns null when the string is empty so the caller can decide
 * whether to reset to a default or leave the field blank.
 */
function parseNumericInput(
  text: string,
  min: number,
  max: number,
): number | null {
  if (text.trim() === "") return null;
  const parsed = parseFloat(text);
  if (isNaN(parsed)) return null;
  return Math.min(Math.max(parsed, min), max);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function LaybyConfigFormInner({
  config,
  onConfigChange,
  onSave,
  onReset,
  isSaving = false,
  hasChanges = false,
}: LaybyConfigFormProps) {
  // -- Handlers -------------------------------------------------------------

  const handleDepositPreset = useCallback(
    (pct: number) => {
      triggerHaptic("selection");
      onConfigChange({ minDepositPercent: pct });
    },
    [onConfigChange],
  );

  const handleDepositTextChange = useCallback(
    (text: string) => {
      const val = parseNumericInput(text, 0, 100);
      if (val !== null) onConfigChange({ minDepositPercent: val });
    },
    [onConfigChange],
  );

  const handleMonthSelect = useCallback(
    (months: number) => {
      triggerHaptic("selection");
      onConfigChange({ maxInstalmentMonths: months });
    },
    [onConfigChange],
  );

  const handleGraceDaysChange = useCallback(
    (text: string) => {
      const val = parseNumericInput(text, 0, 90);
      if (val !== null) onConfigChange({ overdueGraceDays: val });
    },
    [onConfigChange],
  );

  const handleCancelFeeChange = useCallback(
    (text: string) => {
      const val = parseNumericInput(text, 0, 100);
      if (val !== null) onConfigChange({ cancellationFeePercent: val });
    },
    [onConfigChange],
  );

  const handleReminderToggle = useCallback(
    (value: boolean) => {
      triggerHaptic("selection");
      onConfigChange({ autoReminderEnabled: value });
    },
    [onConfigChange],
  );

  const handleReminderDaysChange = useCallback(
    (text: string) => {
      const val = parseNumericInput(text, 1, 30);
      if (val !== null) onConfigChange({ reminderDaysBefore: val });
    },
    [onConfigChange],
  );

  const handleSave = useCallback(() => {
    if (!hasChanges || isSaving) return;
    triggerHaptic("success");
    onSave();
  }, [hasChanges, isSaving, onSave]);

  const handleReset = useCallback(() => {
    triggerHaptic("tap");
    onReset();
  }, [onReset]);

  // -- Render ---------------------------------------------------------------

  return (
    <View style={styles.root} testID="layby-config-form">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="settings-outline" size={22} color="#3b82f6" />
          <Text style={styles.headerTitle}>Layby Settings</Text>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---- Min deposit % ---- */}
        <Text style={styles.fieldLabel}>Minimum Deposit (%)</Text>
        <View style={styles.depositRow}>
          <View style={styles.numericInputWrap}>
            <TextInput
              style={styles.numericInput}
              value={String(config.minDepositPercent)}
              onChangeText={handleDepositTextChange}
              keyboardType="decimal-pad"
              selectTextOnFocus
              testID="layby-config-min-deposit"
            />
            <Text style={styles.numericSuffix}>%</Text>
          </View>
        </View>
        <View style={styles.presetRow}>
          {DEPOSIT_PRESETS.map((pct) => {
            const isActive = config.minDepositPercent === pct;
            return (
              <TouchableOpacity
                key={pct}
                style={[styles.presetPill, isActive && styles.presetPillActive]}
                onPress={() => handleDepositPreset(pct)}
              >
                <Text
                  style={[
                    styles.presetPillText,
                    isActive && styles.presetPillTextActive,
                  ]}
                >
                  {pct}%
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ---- Max instalment months ---- */}
        <Text style={[styles.fieldLabel, styles.fieldGap]}>
          Max Instalment Months
        </Text>
        <View style={styles.monthRow}>
          {MONTH_OPTIONS.map((months) => {
            const isActive = config.maxInstalmentMonths === months;
            return (
              <TouchableOpacity
                key={months}
                style={[
                  styles.monthPill,
                  isActive && styles.monthPillActive,
                ]}
                onPress={() => handleMonthSelect(months)}
                testID={
                  isActive ? "layby-config-max-months" : undefined
                }
              >
                <Text
                  style={[
                    styles.monthPillText,
                    isActive && styles.monthPillTextActive,
                  ]}
                >
                  {months}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {/* Stable testID for the selected max months value */}
        <Text style={styles.fieldHint} testID="layby-config-max-months">
          Customers can spread payments over up to {config.maxInstalmentMonths}{" "}
          months
        </Text>

        {/* ---- Overdue grace days ---- */}
        <Text style={[styles.fieldLabel, styles.fieldGap]}>
          Overdue Grace Period (days)
        </Text>
        <View style={styles.numericInputWrap}>
          <TextInput
            style={styles.numericInput}
            value={String(config.overdueGraceDays)}
            onChangeText={handleGraceDaysChange}
            keyboardType="number-pad"
            selectTextOnFocus
            testID="layby-config-grace-days"
          />
          <Text style={styles.numericSuffix}>days</Text>
        </View>
        <Text style={styles.fieldHint}>
          Days after due date before a layby is marked overdue
        </Text>

        {/* ---- Cancellation fee % ---- */}
        <Text style={[styles.fieldLabel, styles.fieldGap]}>
          Cancellation Fee (%)
        </Text>
        <View style={styles.numericInputWrap}>
          <TextInput
            style={styles.numericInput}
            value={String(config.cancellationFeePercent)}
            onChangeText={handleCancelFeeChange}
            keyboardType="decimal-pad"
            selectTextOnFocus
            testID="layby-config-cancel-fee"
          />
          <Text style={styles.numericSuffix}>%</Text>
        </View>
        <Text style={styles.fieldHint}>
          Percentage of amount paid deducted as a cancellation fee
        </Text>

        {/* ---- Auto-reminder toggle ---- */}
        <View style={[styles.toggleRow, styles.fieldGap]}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Automatic Reminders</Text>
            <Text style={styles.toggleHint}>
              Send payment reminders before due dates
            </Text>
          </View>
          <Switch
            value={config.autoReminderEnabled}
            onValueChange={handleReminderToggle}
            trackColor={{ false: "#374151", true: "#1e3a5f" }}
            thumbColor={config.autoReminderEnabled ? "#3b82f6" : "#6b7280"}
            testID="layby-config-reminder-toggle"
          />
        </View>

        {/* ---- Reminder days before due ---- */}
        {config.autoReminderEnabled && (
          <>
            <Text style={styles.fieldLabel}>
              Remind Days Before Due Date
            </Text>
            <View style={styles.numericInputWrap}>
              <TextInput
                style={styles.numericInput}
                value={String(config.reminderDaysBefore)}
                onChangeText={handleReminderDaysChange}
                keyboardType="number-pad"
                selectTextOnFocus
                testID="layby-config-reminder-days"
              />
              <Text style={styles.numericSuffix}>days</Text>
            </View>
            <Text style={styles.fieldHint}>
              Customers receive a reminder this many days before each
              instalment is due
            </Text>
          </>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <Ionicons name="refresh-outline" size={18} color="#9ca3af" />
          <Text style={styles.resetButtonText} testID="layby-config-reset">
            Reset
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!hasChanges || isSaving) && styles.saveDisabled,
          ]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
          testID="layby-config-save"
        >
          <Ionicons name="save-outline" size={20} color="#fff" />
          <Text style={styles.saveButtonText}>
            {isSaving ? "Saving…" : "Save Settings"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const LaybyConfigForm = React.memo(LaybyConfigFormInner);
export default LaybyConfigForm;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a" },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#f3f4f6" },

  /* Body */
  body: { flex: 1 },
  bodyContent: { padding: 20, gap: 8, paddingBottom: 32 },

  /* Fields */
  fieldLabel: { color: "#9ca3af", fontSize: 13, marginTop: 2 },
  fieldGap: { marginTop: 16 },
  fieldHint: { color: "#6b7280", fontSize: 12, fontStyle: "italic" },

  /* Numeric input */
  numericInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    minWidth: 120,
  },
  numericInput: {
    color: "#f3f4f6",
    fontSize: 18,
    fontWeight: "700",
    paddingVertical: 10,
    minWidth: 50,
    textAlign: "center",
  },
  numericSuffix: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },

  /* Deposit row */
  depositRow: { flexDirection: "row", alignItems: "center", gap: 12 },

  /* Preset pills */
  presetRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  presetPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    minHeight: 38,
  },
  presetPillActive: { borderColor: "#8b5cf6", backgroundColor: "#2e1065" },
  presetPillText: { color: "#6b7280", fontSize: 12, fontWeight: "600" },
  presetPillTextActive: { color: "#8b5cf6" },

  /* Month pills */
  monthRow: { flexDirection: "row", gap: 8 },
  monthPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    minHeight: 44,
  },
  monthPillActive: { borderColor: "#3b82f6", backgroundColor: "#1e3a5f" },
  monthPillText: { color: "#6b7280", fontSize: 14, fontWeight: "600" },
  monthPillTextActive: { color: "#3b82f6" },

  /* Toggle row */
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
  },
  toggleInfo: { flex: 1, marginRight: 16 },
  toggleLabel: { color: "#f3f4f6", fontSize: 15, fontWeight: "600" },
  toggleHint: { color: "#6b7280", fontSize: 12, marginTop: 2 },

  /* Footer */
  footer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    backgroundColor: "#1e293b",
  },
  resetButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4b5563",
    minHeight: 48,
  },
  resetButtonText: { color: "#9ca3af", fontSize: 16, fontWeight: "600" },
  saveButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#3b82f6",
    minHeight: 48,
  },
  saveDisabled: { backgroundColor: "#374151", opacity: 0.6 },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
