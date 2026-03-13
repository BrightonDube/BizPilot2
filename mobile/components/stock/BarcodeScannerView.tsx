/**
 * BarcodeScannerView — UI for barcode scanning with text-input fallback.
 *
 * Why text input instead of camera?
 * 1. Hardware barcode scanners (USB/Bluetooth) on tablets act as keyboard input —
 *    they type the barcode into the focused text field and press Enter automatically.
 *    This is the primary scanning method in BizPilot deployments.
 * 2. Camera-based scanning (expo-barcode-scanner) requires native module setup
 *    and camera permissions. It can be added as a progressive enhancement.
 * 3. Text input works everywhere — web, Windows kiosk, Android, iOS.
 *
 * The component shows the last scan result, a history list, and processing state.
 *
 * @module BarcodeScannerView
 */

import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type ListRenderItemInfo,
  type TextInput as TextInputType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { triggerHaptic } from "@/utils/haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LastScanResult {
  productName: string | null;
  isValid: boolean;
  format: string;
}

interface RecentScan {
  barcode: string;
  productName: string | null;
  timestamp: string;
}

interface BarcodeScannerViewProps {
  onScan: (barcode: string) => void;
  lastScanResult?: LastScanResult | null;
  recentScans: RecentScan[];
  onClearHistory: () => void;
  isProcessing?: boolean;
}

// ─── Theme ───────────────────────────────────────────────────────────────────

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
  border: "#374151",
} as const;

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Last scan result display — green if product found, red if not.
 */
const LastResult = React.memo(function LastResult({
  result,
}: {
  result: LastScanResult;
}) {
  const found = result.productName !== null;

  return (
    <View
      testID="barcode-last-result"
      style={[
        styles.lastResultCard,
        { borderLeftColor: found ? COLORS.green : COLORS.red },
      ]}
    >
      <View style={styles.lastResultHeader}>
        <Ionicons
          name={found ? "checkmark-circle" : "alert-circle"}
          size={20}
          color={found ? COLORS.green : COLORS.red}
        />
        <Text
          style={[
            styles.lastResultTitle,
            { color: found ? COLORS.green : COLORS.red },
          ]}
        >
          {found ? "Product Found" : "Not Recognized"}
        </Text>
      </View>

      <Text style={styles.lastResultProduct}>
        {found ? result.productName : "No matching product in catalog"}
      </Text>

      {/* Format badge */}
      <View style={styles.formatBadge}>
        <Ionicons name="barcode-outline" size={13} color={COLORS.textMuted} />
        <Text style={styles.formatBadgeText}>{result.format}</Text>
      </View>
    </View>
  );
});

/**
 * Single row in the recent scans history list.
 */
const ScanHistoryRow = React.memo(function ScanHistoryRow({
  scan,
  index,
}: {
  scan: RecentScan;
  index: number;
}) {
  const found = scan.productName !== null;

  // Format timestamp to a short time string
  const timeStr = useMemo(() => {
    try {
      const date = new Date(scan.timestamp);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return scan.timestamp;
    }
  }, [scan.timestamp]);

  return (
    <View testID={`barcode-recent-${index}`} style={styles.historyRow}>
      <View style={styles.historyIcon}>
        <Ionicons
          name={found ? "checkmark-circle" : "close-circle"}
          size={16}
          color={found ? COLORS.green : COLORS.red}
        />
      </View>
      <View style={styles.historyInfo}>
        <Text style={styles.historyBarcode} numberOfLines={1}>
          {scan.barcode}
        </Text>
        <Text style={styles.historyProduct} numberOfLines={1}>
          {found ? scan.productName : "Unknown product"}
        </Text>
      </View>
      <Text style={styles.historyTime}>{timeStr}</Text>
    </View>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

function BarcodeScannerView({
  onScan,
  lastScanResult = null,
  recentScans,
  onClearHistory,
  isProcessing = false,
}: BarcodeScannerViewProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<TextInputType>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleScan = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isProcessing) return;

    triggerHaptic("tap");
    onScan(trimmed);
    setInputValue("");

    // Re-focus the input for the next scan — hardware scanners expect
    // the field to be focused so the next scan goes into it automatically.
    inputRef.current?.focus();
  }, [inputValue, isProcessing, onScan]);

  /**
   * Handle Enter/Submit from the text input.
   * Hardware barcode scanners send Enter after typing the barcode.
   */
  const handleSubmitEditing = useCallback(() => {
    handleScan();
  }, [handleScan]);

  const handleClearHistory = useCallback(() => {
    triggerHaptic("tap");
    onClearHistory();
  }, [onClearHistory]);

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderScanRow = useCallback(
    ({ item, index }: ListRenderItemInfo<RecentScan>) => (
      <ScanHistoryRow scan={item} index={index} />
    ),
    []
  );

  const keyExtractor = useCallback(
    (_item: RecentScan, index: number) => `scan-${index}`,
    []
  );

  const EmptyHistory = useMemo(
    () => (
      <View style={styles.emptyHistory}>
        <Ionicons name="barcode-outline" size={36} color={COLORS.textMuted} />
        <Text style={styles.emptyText}>No scans yet</Text>
        <Text style={styles.emptySubtext}>
          Scan a barcode or type one manually
        </Text>
      </View>
    ),
    []
  );

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <View testID="barcode-scanner-view" style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="scan-outline" size={22} color={COLORS.purple} />
          <Text style={styles.title}>Barcode Scanner</Text>
        </View>
        {recentScans.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{recentScans.length}</Text>
          </View>
        )}
      </View>

      {/* Manual input area */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>
          Scan barcode or enter manually
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            testID="barcode-input"
            style={styles.barcodeInput}
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={handleSubmitEditing}
            placeholder="Barcode number…"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            editable={!isProcessing}
            // autoFocus so hardware scanners can immediately type into this field
            autoFocus
          />
          <TouchableOpacity
            testID="barcode-scan-btn"
            onPress={handleScan}
            style={[
              styles.scanButton,
              (!inputValue.trim() || isProcessing) && styles.scanButtonDisabled,
            ]}
            disabled={!inputValue.trim() || isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator
                testID="barcode-processing"
                size="small"
                color={COLORS.text}
              />
            ) : (
              <>
                <Ionicons name="scan" size={18} color={COLORS.text} />
                <Text style={styles.scanButtonText}>Scan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Last scan result */}
      {lastScanResult && <LastResult result={lastScanResult} />}

      {/* Recent scans history */}
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Text style={styles.sectionLabel}>Recent Scans</Text>
          {recentScans.length > 0 && (
            <TouchableOpacity
              testID="barcode-clear-history"
              onPress={handleClearHistory}
              style={styles.clearButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.red} />
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={recentScans}
          renderItem={renderScanRow}
          keyExtractor={keyExtractor}
          ListEmptyComponent={EmptyHistory}
          contentContainerStyle={styles.historyList}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.purple,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },

  // Input section
  inputSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  inputLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
  },
  barcodeInput: {
    flex: 1,
    backgroundColor: COLORS.input,
    color: COLORS.text,
    fontSize: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    // Larger font for readability during fast scanning
    fontFamily: "monospace",
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: COLORS.blue,
  },
  scanButtonDisabled: {
    backgroundColor: COLORS.border,
    opacity: 0.6,
  },
  scanButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },

  // Last result
  lastResultCard: {
    margin: 16,
    marginBottom: 0,
    padding: 14,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
  },
  lastResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  lastResultTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  lastResultProduct: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
  },
  formatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: `${COLORS.textMuted}15`,
  },
  formatBadgeText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  // History section
  historySection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  clearText: {
    color: COLORS.red,
    fontSize: 13,
    fontWeight: "600",
  },
  historyList: {
    paddingBottom: 24,
  },

  // History row
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  historyIcon: {
    marginRight: 10,
  },
  historyInfo: {
    flex: 1,
  },
  historyBarcode: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "monospace",
  },
  historyProduct: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  historyTime: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginLeft: 8,
  },

  // Empty state
  emptyHistory: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 6,
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
});

export default React.memo(BarcodeScannerView);
