/**
 * WidgetConfigPanel — Configuration panel for customising a dashboard widget.
 *
 * Provides controls for title, data source, display type, refresh interval,
 * and colour scheme. Includes Preview / Save / Cancel action buttons.
 *
 * Why a vertical ScrollView layout instead of tabs?
 * The configuration surface is compact — five fields plus action buttons.
 * Vertical scrolling keeps everything on one screen on tablets and requires
 * only a short scroll on phones, avoiding the cognitive overhead of switching
 * between tabs.
 *
 * Why icon-based display type selector instead of a dropdown?
 * Five display types are few enough to show simultaneously. Icons provide
 * immediate recognition (chart, table, gauge…) without requiring the user to
 * read text labels inside a collapsed dropdown.
 *
 * Why React.memo?  The parent dashboard builder may re-render when adjacent
 * widgets update; memo keeps this panel from repainting unless its own props
 * change.
 */

import React, { memo, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WidgetConfig {
  title: string;
  dataSource: string;
  refreshInterval: number; // seconds
  displayType: "chart" | "table" | "kpi" | "gauge" | "list";
  colorScheme: string;
  filters: Record<string, string>;
}

interface WidgetConfigPanelProps {
  config: WidgetConfig;
  onConfigChange: (updates: Partial<WidgetConfig>) => void;
  dataSources: Array<{ id: string; name: string }>;
  onSave: () => void;
  onCancel: () => void;
  onPreview: () => void;
  isSaving?: boolean;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const COLORS = {
  bg: "#0f172a",
  card: "#1f2937",
  input: "#111827",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#fbbf24",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  grey: "#6b7280",
  border: "#374151",
} as const;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Display type options with associated icon and label. */
const DISPLAY_TYPES: {
  type: WidgetConfig["displayType"];
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
}[] = [
  { type: "chart", icon: "bar-chart-outline", label: "Chart" },
  { type: "table", icon: "grid-outline", label: "Table" },
  { type: "kpi", icon: "trending-up-outline", label: "KPI" },
  { type: "gauge", icon: "speedometer-outline", label: "Gauge" },
  { type: "list", icon: "list-outline", label: "List" },
];

/** Refresh interval presets (in seconds). */
const REFRESH_INTERVALS: { value: number; label: string }[] = [
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "1m" },
  { value: 300, label: "5m" },
];

/** Colour scheme swatches. */
const COLOR_SCHEMES: { id: string; color: string }[] = [
  { id: "green", color: COLORS.green },
  { id: "blue", color: COLORS.blue },
  { id: "purple", color: COLORS.purple },
  { id: "amber", color: COLORS.amber },
  { id: "red", color: COLORS.red },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Section label used throughout the panel. */
const SectionLabel = memo(function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
});

/** Individual data source option row. */
const SourceOption = memo(function SourceOption({
  source,
  isSelected,
  onPress,
}: {
  source: { id: string; name: string };
  isSelected: boolean;
  onPress: (id: string) => void;
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(source.id);
  }, [onPress, source.id]);

  return (
    <TouchableOpacity
      testID={`widget-config-source-${source.id}`}
      style={[styles.sourceOption, isSelected && styles.sourceOptionActive]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={isSelected ? "radio-button-on" : "radio-button-off"}
        size={18}
        color={isSelected ? COLORS.blue : COLORS.grey}
      />
      <Text style={[styles.sourceText, isSelected && styles.sourceTextActive]}>
        {source.name}
      </Text>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const WidgetConfigPanel: React.FC<WidgetConfigPanelProps> = ({
  config,
  onConfigChange,
  dataSources,
  onSave,
  onCancel,
  onPreview,
  isSaving = false,
}) => {
  // ------- handlers -------

  const handleTitleChange = useCallback(
    (text: string) => onConfigChange({ title: text }),
    [onConfigChange],
  );

  const handleSourceSelect = useCallback(
    (id: string) => onConfigChange({ dataSource: id }),
    [onConfigChange],
  );

  const handleTypeSelect = useCallback(
    (type: WidgetConfig["displayType"]) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onConfigChange({ displayType: type });
    },
    [onConfigChange],
  );

  const handleIntervalSelect = useCallback(
    (value: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onConfigChange({ refreshInterval: value });
    },
    [onConfigChange],
  );

  const handleColorSelect = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onConfigChange({ colorScheme: id });
    },
    [onConfigChange],
  );

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave();
  }, [onSave]);

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  }, [onCancel]);

  const handlePreview = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPreview();
  }, [onPreview]);

  // ------- render -------

  return (
    <ScrollView
      testID="widget-config-panel"
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ---- Header ---- */}
      <View style={styles.header}>
        <Ionicons name="settings-outline" size={22} color={COLORS.text} />
        <Text style={styles.headerTitle}>Configure Widget</Text>
      </View>

      {/* ---- Title input ---- */}
      <SectionLabel label="Title" />
      <TextInput
        testID="widget-config-title"
        style={styles.textInput}
        value={config.title}
        onChangeText={handleTitleChange}
        placeholder="Widget title"
        placeholderTextColor={COLORS.grey}
        autoCorrect={false}
      />

      {/* ---- Data source selector ---- */}
      <SectionLabel label="Data Source" />
      <View style={styles.sourceList}>
        {dataSources.map((src) => (
          <SourceOption
            key={src.id}
            source={src}
            isSelected={config.dataSource === src.id}
            onPress={handleSourceSelect}
          />
        ))}
      </View>

      {/* ---- Display type selector ---- */}
      <SectionLabel label="Display Type" />
      <View style={styles.typeRow}>
        {DISPLAY_TYPES.map((dt) => {
          const isActive = config.displayType === dt.type;
          return (
            <TouchableOpacity
              key={dt.type}
              testID={`widget-config-type-${dt.type}`}
              style={[styles.typeOption, isActive && styles.typeOptionActive]}
              onPress={() => handleTypeSelect(dt.type)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={dt.icon}
                size={22}
                color={isActive ? COLORS.blue : COLORS.grey}
              />
              <Text style={[styles.typeLabel, isActive && styles.typeLabelActive]}>
                {dt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ---- Refresh interval ---- */}
      <SectionLabel label="Refresh Interval" />
      <View style={styles.intervalRow}>
        {REFRESH_INTERVALS.map((ri) => {
          const isActive = config.refreshInterval === ri.value;
          return (
            <TouchableOpacity
              key={ri.value}
              testID={`widget-config-refresh-${ri.value}`}
              style={[styles.intervalOption, isActive && styles.intervalOptionActive]}
              onPress={() => handleIntervalSelect(ri.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.intervalText, isActive && styles.intervalTextActive]}>
                {ri.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ---- Colour scheme ---- */}
      <SectionLabel label="Color Scheme" />
      <View style={styles.colorRow}>
        {COLOR_SCHEMES.map((cs) => {
          const isActive = config.colorScheme === cs.id;
          return (
            <TouchableOpacity
              key={cs.id}
              testID={`widget-config-color-${cs.id}`}
              style={[
                styles.colorSwatch,
                { backgroundColor: cs.color },
                isActive && styles.colorSwatchActive,
              ]}
              onPress={() => handleColorSelect(cs.id)}
              activeOpacity={0.7}
            >
              {isActive && <Ionicons name="checkmark" size={18} color="#fff" />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ---- Action buttons ---- */}
      <View style={styles.actions}>
        <TouchableOpacity
          testID="widget-config-preview"
          style={styles.previewButton}
          onPress={handlePreview}
          activeOpacity={0.7}
        >
          <Ionicons name="eye-outline" size={18} color={COLORS.blue} />
          <Text style={styles.previewText}>Preview</Text>
        </TouchableOpacity>

        <View style={styles.primaryActions}>
          <TouchableOpacity
            testID="widget-config-cancel"
            style={styles.cancelButton}
            onPress={handleCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="widget-config-save"
            style={[styles.saveButton, isSaving && styles.disabledButton]}
            onPress={handleSave}
            activeOpacity={0.7}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.saveText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },

  // Section labels
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },

  // Title input
  textInput: {
    backgroundColor: COLORS.input,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },

  // Data source list
  sourceList: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    overflow: "hidden",
  },
  sourceOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sourceOptionActive: {
    backgroundColor: COLORS.blue + "11",
  },
  sourceText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  sourceTextActive: {
    color: COLORS.text,
    fontWeight: "600",
  },

  // Display type row
  typeRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  typeOptionActive: {
    backgroundColor: COLORS.blue + "22",
    borderColor: COLORS.blue,
  },
  typeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.grey,
  },
  typeLabelActive: {
    color: COLORS.blue,
  },

  // Refresh interval
  intervalRow: {
    flexDirection: "row",
    gap: 10,
  },
  intervalOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  intervalOptionActive: {
    backgroundColor: COLORS.green + "22",
    borderColor: COLORS.green,
  },
  intervalText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  intervalTextActive: {
    color: COLORS.green,
  },

  // Colour scheme
  colorRow: {
    flexDirection: "row",
    gap: 14,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchActive: {
    borderColor: COLORS.text,
  },

  // Action buttons
  actions: {
    marginTop: 28,
    gap: 12,
  },
  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.blue,
  },
  previewText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.blue,
  },
  primaryActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.green,
  },
  saveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  disabledButton: {
    opacity: 0.6,
  },
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default memo(WidgetConfigPanel);
export type { WidgetConfigPanelProps, WidgetConfig };
