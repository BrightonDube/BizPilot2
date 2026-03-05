/**
 * ExportButton — Export action with PDF / Excel / CSV dropdown.
 *
 * Renders a single "Export" button that, on press, reveals a popover-style
 * dropdown of file-format options.  Each option triggers the corresponding
 * callback; a loading overlay replaces the dropdown while the export runs.
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ExportButtonProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
  onExportCSV?: () => void;
  isExporting?: boolean;
  disabled?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Option metadata
// ────────────────────────────────────────────────────────────────────────────

interface ExportOption {
  key: string;
  label: string;
  icon: string;
  testID: string;
  color: string;
}

const PDF_OPTION: ExportOption = {
  key: "pdf",
  label: "PDF Document",
  icon: "document-text-outline",
  testID: "export-pdf",
  color: "#ef4444",
};

const EXCEL_OPTION: ExportOption = {
  key: "excel",
  label: "Excel Spreadsheet",
  icon: "grid-outline",
  testID: "export-excel",
  color: "#22c55e",
};

const CSV_OPTION: ExportOption = {
  key: "csv",
  label: "CSV File",
  icon: "code-slash-outline",
  testID: "export-csv",
  color: "#fbbf24",
};

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

function ExportButton({
  onExportPDF,
  onExportExcel,
  onExportCSV,
  isExporting = false,
  disabled = false,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);

  // Build the options array once — CSV is conditional on prop presence.
  const options: ExportOption[] = onExportCSV
    ? [PDF_OPTION, EXCEL_OPTION, CSV_OPTION]
    : [PDF_OPTION, EXCEL_OPTION];

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleDropdown = useCallback(() => {
    if (disabled || isExporting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen((prev) => !prev);
  }, [disabled, isExporting]);

  const handleSelect = useCallback(
    (key: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setOpen(false);
      switch (key) {
        case "pdf":
          onExportPDF();
          break;
        case "excel":
          onExportExcel();
          break;
        case "csv":
          onExportCSV?.();
          break;
      }
    },
    [onExportPDF, onExportExcel, onExportCSV],
  );

  // Close the dropdown when tapping outside (backdrop press).
  const handleBackdropPress = useCallback(() => setOpen(false), []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.wrapper}>
      {/* Trigger button */}
      <TouchableOpacity
        testID="export-button"
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={toggleDropdown}
        activeOpacity={0.7}
        disabled={disabled || isExporting}
      >
        {isExporting ? (
          <View style={styles.loadingRow} testID="export-loading">
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={styles.buttonText}>Exporting…</Text>
          </View>
        ) : (
          <>
            <Ionicons name="download-outline" size={18} color="#ffffff" />
            <Text style={styles.buttonText}>Export</Text>
            <Ionicons
              name={open ? "chevron-up" : "chevron-down"}
              size={14}
              color="#ffffff"
            />
          </>
        )}
      </TouchableOpacity>

      {/* Dropdown overlay */}
      {open && (
        <>
          {/* Invisible backdrop to close on outside tap */}
          <Pressable style={styles.backdrop} onPress={handleBackdropPress} />

          <View style={styles.dropdown} testID="export-dropdown">
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                testID={opt.testID}
                style={styles.optionRow}
                onPress={() => handleSelect(opt.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={opt.icon as any} size={18} color={opt.color} />
                <Text style={styles.optionLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    zIndex: 10,
  } as ViewStyle,

  // ── Trigger button ────────────────────────────────────────────────────────

  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  } as ViewStyle,

  buttonDisabled: {
    opacity: 0.5,
  } as ViewStyle,

  buttonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  } as TextStyle,

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  } as ViewStyle,

  // ── Dropdown ──────────────────────────────────────────────────────────────

  backdrop: {
    position: "absolute",
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 1,
  } as ViewStyle,

  dropdown: {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: 6,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 200,
    zIndex: 2,
    // Shadow for depth perception
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  } as ViewStyle,

  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  } as ViewStyle,

  optionLabel: {
    color: "#f3f4f6",
    fontSize: 14,
    fontWeight: "500",
  } as TextStyle,
});

export default React.memo(ExportButton);
