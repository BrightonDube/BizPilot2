/**
 * ReceivingScreen — Handles the physical receiving of transferred goods.
 *
 * Warehouse staff use this to record actual quantities received and flag
 * condition issues (damaged / partial) so discrepancies are captured at
 * the point of receipt rather than discovered later during audits.
 */
import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ItemCondition = "good" | "damaged" | "partial";

export interface ReceivingTransferItem {
  id: string;
  productName: string;
  sku: string;
  expectedQty: number;
  receivedQty: number;
  condition: ItemCondition;
}

export interface ReceivingScreenProps {
  transferNumber: string;
  fromLocation: string;
  items: ReceivingTransferItem[];
  onUpdateQty: (itemId: string, qty: number) => void;
  onUpdateCondition: (itemId: string, condition: ItemCondition) => void;
  onReceiveAll: () => void;
  onSubmit: () => void;
  onBack: () => void;
  notes: string;
  onNotesChange: (n: string) => void;
  isSubmitting?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Condition pills — colour-coded so visual scanning is fast. */
const CONDITION_CONFIG: Record<
  ItemCondition,
  { label: string; color: string; bg: string; icon: string }
> = {
  good: {
    label: "Good",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.15)",
    icon: "checkmark-circle-outline",
  },
  damaged: {
    label: "Damaged",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.15)",
    icon: "alert-circle-outline",
  },
  partial: {
    label: "Partial",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.15)",
    icon: "remove-circle-outline",
  },
};

const CONDITIONS: ItemCondition[] = ["good", "damaged", "partial"];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/* ---- Condition pill ---- */

interface ConditionPillProps {
  itemId: string;
  condition: ItemCondition;
  isSelected: boolean;
  onPress: (itemId: string, condition: ItemCondition) => void;
}

const ConditionPill = React.memo<ConditionPillProps>(function ConditionPill({
  itemId,
  condition,
  isSelected,
  onPress,
}) {
  const cfg = CONDITION_CONFIG[condition];

  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onPress(itemId, condition);
  }, [itemId, condition, onPress]);

  return (
    <TouchableOpacity
      testID={`receiving-condition-${itemId}-${condition}`}
      style={[
        styles.conditionPill,
        isSelected
          ? { backgroundColor: cfg.bg, borderColor: cfg.color }
          : styles.conditionPillInactive,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={cfg.icon as any}
        size={12}
        color={isSelected ? cfg.color : "#6b7280"}
      />
      <Text
        style={[
          styles.conditionPillText,
          { color: isSelected ? cfg.color : "#6b7280" },
        ]}
      >
        {cfg.label}
      </Text>
    </TouchableOpacity>
  );
});

/* ---- Receiving item row ---- */

interface ReceivingItemRowProps {
  item: ReceivingTransferItem;
  onUpdateQty: (itemId: string, qty: number) => void;
  onUpdateCondition: (itemId: string, condition: ItemCondition) => void;
}

const ReceivingItemRow = React.memo<ReceivingItemRowProps>(
  function ReceivingItemRow({ item, onUpdateQty, onUpdateCondition }) {
    /** Variance highlights shortages so staff can investigate immediately. */
    const variance = item.receivedQty - item.expectedQty;

    const handleQtyChange = useCallback(
      (text: string) => {
        const parsed = parseInt(text, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          onUpdateQty(item.id, parsed);
        }
      },
      [item.id, onUpdateQty],
    );

    const varianceColor =
      variance === 0 ? "#22c55e" : variance > 0 ? "#3b82f6" : "#ef4444";

    return (
      <View testID={`receiving-item-${item.id}`} style={styles.itemCard}>
        {/* Product info */}
        <View style={styles.itemHeader}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.productName}
            </Text>
            <Text style={styles.itemSku}>{item.sku}</Text>
          </View>
        </View>

        {/* Expected qty */}
        <View style={styles.expectedRow}>
          <Ionicons name="cube-outline" size={14} color="#8b5cf6" />
          <Text style={styles.expectedLabel}>Expected</Text>
          <Text style={styles.expectedValue}>{item.expectedQty}</Text>
        </View>

        {/* Received qty input */}
        <View style={styles.receivedRow}>
          <Text style={styles.receivedLabel}>Received</Text>
          <View style={styles.qtyInputContainer}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => {
                if (item.receivedQty > 0) {
                  Haptics.selectionAsync();
                  onUpdateQty(item.id, item.receivedQty - 1);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={16} color="#f3f4f6" />
            </TouchableOpacity>

            <TextInput
              testID={`receiving-qty-${item.id}`}
              style={styles.qtyInput}
              keyboardType="number-pad"
              value={String(item.receivedQty)}
              onChangeText={handleQtyChange}
            />

            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => {
                Haptics.selectionAsync();
                onUpdateQty(item.id, item.receivedQty + 1);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={16} color="#f3f4f6" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Variance indicator */}
        <View style={styles.varianceRow}>
          <Ionicons
            name={
              variance === 0
                ? "checkmark-circle"
                : variance > 0
                  ? "arrow-up-circle"
                  : "arrow-down-circle"
            }
            size={14}
            color={varianceColor}
          />
          <Text style={[styles.varianceText, { color: varianceColor }]}>
            {variance === 0
              ? "Matches expected"
              : variance > 0
                ? `+${variance} over`
                : `${variance} short`}
          </Text>
        </View>

        {/* Condition selector */}
        <View style={styles.conditionRow}>
          <Text style={styles.conditionLabel}>Condition</Text>
          <View style={styles.conditionPills}>
            {CONDITIONS.map((c) => (
              <ConditionPill
                key={c}
                itemId={item.id}
                condition={c}
                isSelected={item.condition === c}
                onPress={onUpdateCondition}
              />
            ))}
          </View>
        </View>
      </View>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const ReceivingScreen: React.FC<ReceivingScreenProps> = ({
  transferNumber,
  fromLocation,
  items,
  onUpdateQty,
  onUpdateCondition,
  onReceiveAll,
  onSubmit,
  onBack,
  notes,
  onNotesChange,
  isSubmitting = false,
}) => {
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  const handleReceiveAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReceiveAll();
  }, [onReceiveAll]);

  const handleSubmit = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit();
  }, [onSubmit]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ReceivingTransferItem>) => (
      <ReceivingItemRow
        item={item}
        onUpdateQty={onUpdateQty}
        onUpdateCondition={onUpdateCondition}
      />
    ),
    [onUpdateQty, onUpdateCondition],
  );

  const keyExtractor = useCallback(
    (item: ReceivingTransferItem) => item.id,
    [],
  );

  /** Summary stats shown in header so the user has context before scanning items. */
  const summary = useMemo(() => {
    let totalExpected = 0;
    let totalReceived = 0;
    for (const item of items) {
      totalExpected += item.expectedQty;
      totalReceived += item.receivedQty;
    }
    return { totalExpected, totalReceived, itemCount: items.length };
  }, [items]);

  /* ---- Header ---- */
  const renderHeader = useCallback(
    () => (
      <View>
        {/* From location */}
        <View style={styles.fromCard}>
          <Ionicons name="location-outline" size={16} color="#9ca3af" />
          <View>
            <Text style={styles.fromLabel}>From</Text>
            <Text style={styles.fromLocation}>{fromLocation}</Text>
          </View>
        </View>

        {/* Summary bar */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.itemCount}</Text>
            <Text style={styles.summaryLabel}>Items</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.totalExpected}</Text>
            <Text style={styles.summaryLabel}>Expected</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, styles.summaryReceived]}>
              {summary.totalReceived}
            </Text>
            <Text style={styles.summaryLabel}>Received</Text>
          </View>
        </View>

        {/* Receive all */}
        <TouchableOpacity
          testID="receiving-receive-all"
          style={styles.receiveAllBtn}
          onPress={handleReceiveAll}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark-done-outline" size={18} color="#22c55e" />
          <Text style={styles.receiveAllText}>Receive All as Expected</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Items</Text>
      </View>
    ),
    [fromLocation, summary, handleReceiveAll],
  );

  /* ---- Footer: notes + submit ---- */
  const renderFooter = useCallback(
    () => (
      <View>
        {/* Notes */}
        <Text style={styles.notesLabel}>Notes</Text>
        <TextInput
          testID="receiving-notes"
          style={styles.notesInput}
          placeholder="Add receiving notes (damages, discrepancies, etc.)…"
          placeholderTextColor="#6b7280"
          value={notes}
          onChangeText={onNotesChange}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Submit */}
        <TouchableOpacity
          testID="receiving-submit"
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.7}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
          )}
          <Text style={styles.submitBtnText}>
            {isSubmitting ? "Submitting…" : "Confirm Receipt"}
          </Text>
        </TouchableOpacity>
      </View>
    ),
    [notes, onNotesChange, isSubmitting, handleSubmit],
  );

  return (
    <View testID="receiving-screen" style={styles.container}>
      {/* ---- Top bar ---- */}
      <View style={styles.topBar}>
        <TouchableOpacity
          testID="receiving-back"
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#f3f4f6" />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Receive Transfer</Text>
          <Text style={styles.topBarSubtitle}>{transferNumber}</Text>
        </View>

        {/* Spacer to keep title centred */}
        <View style={styles.backButton} />
      </View>

      {/* ---- Content ---- */}
      <FlatList<ReceivingTransferItem>
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  /* Layout */
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  separator: {
    height: 10,
  },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  topBarCenter: {
    flex: 1,
    alignItems: "center",
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  topBarSubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 2,
  },

  /* From card */
  fromCard: {
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    marginBottom: 12,
  },
  fromLabel: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fromLocation: {
    fontSize: 15,
    color: "#f3f4f6",
    fontWeight: "600",
    marginTop: 1,
  },

  /* Summary bar */
  summaryBar: {
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  summaryReceived: {
    color: "#22c55e",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  /* Receive all */
  receiveAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(34,197,94,0.1)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 16,
  },
  receiveAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#22c55e",
  },

  /* Section */
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f3f4f6",
    marginBottom: 10,
  },

  /* Item card */
  itemCard: {
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 14,
  },
  itemHeader: {
    marginBottom: 10,
  },
  itemInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f3f4f6",
    flex: 1,
    marginRight: 8,
  },
  itemSku: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },

  /* Expected */
  expectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  expectedLabel: {
    fontSize: 13,
    color: "#9ca3af",
    flex: 1,
  },
  expectedValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f3f4f6",
  },

  /* Received input */
  receivedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  receivedLabel: {
    fontSize: 13,
    color: "#9ca3af",
  },
  qtyInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  qtyInput: {
    backgroundColor: "#111827",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    color: "#f3f4f6",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    minWidth: 52,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  /* Variance */
  varianceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  varianceText: {
    fontSize: 12,
    fontWeight: "600",
  },

  /* Condition */
  conditionRow: {
    gap: 8,
  },
  conditionLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  conditionPills: {
    flexDirection: "row",
    gap: 6,
  },
  conditionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  conditionPillInactive: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  conditionPillText: {
    fontSize: 12,
    fontWeight: "600",
  },

  /* Notes */
  notesLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f3f4f6",
    marginTop: 20,
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 14,
    color: "#f3f4f6",
    fontSize: 14,
    minHeight: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },

  /* Submit */
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#22c55e",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 20,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default React.memo(ReceivingScreen);
