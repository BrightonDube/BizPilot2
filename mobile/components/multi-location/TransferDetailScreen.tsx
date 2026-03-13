/**
 * TransferDetailScreen — Full detail view for a single stock transfer.
 *
 * Shows the item-level breakdown (requested / sent / received) and
 * exposes workflow actions based on the current status so that only
 * valid transitions are available to the user.
 */
import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type TransferStatus =
  | "draft"
  | "pending"
  | "in_transit"
  | "received"
  | "cancelled";

export interface TransferItem {
  id: string;
  productName: string;
  sku: string;
  requestedQty: number;
  sentQty: number;
  receivedQty: number | null;
  unitCost: number;
}

export interface TransferDetailScreenProps {
  transferNumber: string;
  fromLocation: string;
  toLocation: string;
  status: TransferStatus;
  items: TransferItem[];
  createdBy: string;
  createdAt: string;
  onUpdateReceivedQty?: (itemId: string, qty: number) => void;
  onApprove?: () => void;
  onShip?: () => void;
  onReceive?: () => void;
  onCancel?: () => void;
  onBack: () => void;
  isProcessing?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<
  TransferStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  draft: {
    label: "Draft",
    color: "#9ca3af",
    bg: "rgba(156,163,175,0.15)",
    icon: "document-outline",
  },
  pending: {
    label: "Pending",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.15)",
    icon: "time-outline",
  },
  in_transit: {
    label: "In Transit",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.15)",
    icon: "airplane-outline",
  },
  received: {
    label: "Received",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.15)",
    icon: "checkmark-circle-outline",
  },
  cancelled: {
    label: "Cancelled",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.15)",
    icon: "close-circle-outline",
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/* ---- Status badge ---- */

interface StatusBadgeProps {
  status: TransferStatus;
}

const StatusBadge = React.memo<StatusBadgeProps>(function StatusBadge({
  status,
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View
      testID="transfer-status"
      style={[styles.statusBadge, { backgroundColor: cfg.bg }]}
    >
      <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
      <Text style={[styles.statusBadgeText, { color: cfg.color }]}>
        {cfg.label}
      </Text>
    </View>
  );
});

/* ---- Transfer item row ---- */

interface ItemRowProps {
  item: TransferItem;
  isEditable: boolean;
  onUpdateReceivedQty?: (itemId: string, qty: number) => void;
}

const ItemRow = React.memo<ItemRowProps>(function ItemRow({
  item,
  isEditable,
  onUpdateReceivedQty,
}) {
  /** Line total uses sent qty — that's the value actually in motion. */
  const lineTotal = item.sentQty * item.unitCost;

  const handleQtyChange = useCallback(
    (text: string) => {
      const parsed = parseInt(text, 10);
      if (!isNaN(parsed) && parsed >= 0 && onUpdateReceivedQty) {
        onUpdateReceivedQty(item.id, parsed);
      }
    },
    [item.id, onUpdateReceivedQty],
  );

  return (
    <View testID={`transfer-item-${item.id}`} style={styles.itemRow}>
      {/* Product info */}
      <View style={styles.itemHeader}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.productName}
        </Text>
        <Text style={styles.itemSku}>{item.sku}</Text>
      </View>

      {/* Qty columns */}
      <View style={styles.qtyGrid}>
        <View style={styles.qtyCol}>
          <Text style={styles.qtyLabel}>Requested</Text>
          <Text style={styles.qtyValue}>{item.requestedQty}</Text>
        </View>

        <View style={styles.qtyCol}>
          <Text style={styles.qtyLabel}>Sent</Text>
          <Text style={styles.qtyValue}>{item.sentQty}</Text>
        </View>

        <View style={styles.qtyCol}>
          <Text style={styles.qtyLabel}>Received</Text>
          {isEditable ? (
            <TextInput
              testID={`transfer-received-${item.id}`}
              style={styles.qtyInput}
              keyboardType="number-pad"
              value={
                item.receivedQty !== null ? String(item.receivedQty) : ""
              }
              onChangeText={handleQtyChange}
              placeholder="0"
              placeholderTextColor="#6b7280"
            />
          ) : (
            <Text style={styles.qtyValue}>
              {item.receivedQty !== null ? item.receivedQty : "—"}
            </Text>
          )}
        </View>
      </View>

      {/* Line total */}
      <View style={styles.lineTotalRow}>
        <Text style={styles.lineTotalLabel}>Line total</Text>
        <Text style={styles.lineTotalValue}>{formatCurrency(lineTotal)}</Text>
      </View>
    </View>
  );
});

/* ---- Action button ---- */

interface ActionBtnProps {
  testID: string;
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
  disabled: boolean;
}

const ActionBtn = React.memo<ActionBtnProps>(function ActionBtn({
  testID,
  label,
  icon,
  color,
  onPress,
  disabled,
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.actionBtn, { backgroundColor: color }, disabled && styles.actionBtnDisabled]}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <Ionicons name={icon as any} size={18} color="#ffffff" />
      <Text style={styles.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
});

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const TransferDetailScreen: React.FC<TransferDetailScreenProps> = ({
  transferNumber,
  fromLocation,
  toLocation,
  status,
  items,
  createdBy,
  createdAt,
  onUpdateReceivedQty,
  onApprove,
  onShip,
  onReceive,
  onCancel,
  onBack,
  isProcessing = false,
}) => {
  const isEditable = status === "in_transit";

  /* ---- Summary totals ---- */
  const summary = useMemo(() => {
    let totalItems = 0;
    let totalValue = 0;
    for (const item of items) {
      totalItems += item.sentQty;
      totalValue += item.sentQty * item.unitCost;
    }
    return { totalItems, totalValue };
  }, [items]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TransferItem>) => (
      <ItemRow
        item={item}
        isEditable={isEditable}
        onUpdateReceivedQty={onUpdateReceivedQty}
      />
    ),
    [isEditable, onUpdateReceivedQty],
  );

  const keyExtractor = useCallback((item: TransferItem) => item.id, []);

  /* ---- Header component for FlatList ---- */
  const renderHeader = useCallback(
    () => (
      <View>
        {/* Location route */}
        <View style={styles.routeCard}>
          <View style={styles.routeEndpoint}>
            <View style={styles.routeDot} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>From</Text>
              <Text style={styles.routeLocation}>{fromLocation}</Text>
            </View>
          </View>

          <View style={styles.routeArrowContainer}>
            <View style={styles.routeLine} />
            <Ionicons name="arrow-down" size={20} color="#3b82f6" />
            <View style={styles.routeLine} />
          </View>

          <View style={styles.routeEndpoint}>
            <View style={[styles.routeDot, styles.routeDotDest]} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>To</Text>
              <Text style={styles.routeLocation}>{toLocation}</Text>
            </View>
          </View>
        </View>

        {/* Meta */}
        <View style={styles.metaCard}>
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={14} color="#6b7280" />
            <Text style={styles.metaText}>Created by {createdBy}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color="#6b7280" />
            <Text style={styles.metaText}>{formatDate(createdAt)}</Text>
          </View>
        </View>

        {/* Section title */}
        <Text style={styles.sectionTitle}>
          Items ({items.length})
        </Text>
      </View>
    ),
    [fromLocation, toLocation, createdBy, createdAt, items.length],
  );

  /* ---- Footer: summary + actions ---- */
  const renderFooter = useCallback(
    () => (
      <View>
        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Items</Text>
            <Text style={styles.summaryValue}>{summary.totalItems}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Value</Text>
            <Text style={[styles.summaryValue, styles.summaryValueHighlight]}>
              {formatCurrency(summary.totalValue)}
            </Text>
          </View>
        </View>

        {/* Processing indicator */}
        {isProcessing && (
          <View style={styles.processingRow}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.processingText}>Processing…</Text>
          </View>
        )}

        {/* Action buttons — only valid transitions are shown */}
        <View style={styles.actionsRow}>
          {status === "pending" && onApprove && (
            <ActionBtn
              testID="transfer-approve"
              label="Approve"
              icon="checkmark-outline"
              color="#22c55e"
              onPress={onApprove}
              disabled={isProcessing}
            />
          )}

          {status === "pending" && onShip && (
            <ActionBtn
              testID="transfer-ship"
              label="Ship"
              icon="airplane-outline"
              color="#3b82f6"
              onPress={onShip}
              disabled={isProcessing}
            />
          )}

          {status === "in_transit" && onReceive && (
            <ActionBtn
              testID="transfer-receive"
              label="Receive"
              icon="checkmark-done-outline"
              color="#22c55e"
              onPress={onReceive}
              disabled={isProcessing}
            />
          )}

          {(status === "draft" || status === "pending") && onCancel && (
            <ActionBtn
              testID="transfer-cancel"
              label="Cancel"
              icon="close-outline"
              color="#ef4444"
              onPress={onCancel}
              disabled={isProcessing}
            />
          )}
        </View>
      </View>
    ),
    [summary, status, isProcessing, onApprove, onShip, onReceive, onCancel],
  );

  return (
    <View testID="transfer-detail" style={styles.container}>
      {/* ---- Top bar ---- */}
      <View style={styles.topBar}>
        <TouchableOpacity
          testID="transfer-back"
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#f3f4f6" />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>{transferNumber}</Text>
          <StatusBadge status={status} />
        </View>

        {/* Spacer to keep title centred */}
        <View style={styles.backButton} />
      </View>

      {/* ---- Content ---- */}
      <FlatList<TransferItem>
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
    height: 8,
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
    gap: 4,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f3f4f6",
  },

  /* Status badge */
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },

  /* Route */
  routeCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  routeEndpoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#9ca3af",
  },
  routeDotDest: {
    backgroundColor: "#3b82f6",
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  routeLocation: {
    fontSize: 15,
    color: "#f3f4f6",
    fontWeight: "600",
    marginTop: 2,
  },
  routeArrowContainer: {
    alignItems: "center",
    paddingVertical: 4,
    marginLeft: 5,
  },
  routeLine: {
    width: 1,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
  },

  /* Meta */
  metaCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: "#9ca3af",
  },

  /* Section */
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f3f4f6",
    marginBottom: 12,
  },

  /* Item row */
  itemRow: {
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 14,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
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

  /* Qty grid */
  qtyGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  qtyCol: {
    alignItems: "center",
    flex: 1,
  },
  qtyLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 4,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  qtyInput: {
    backgroundColor: "#111827",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: "#f3f4f6",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    minWidth: 56,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.3)",
  },

  /* Line total */
  lineTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lineTotalLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  lineTotalValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#22c55e",
  },

  /* Summary */
  summaryCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#9ca3af",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  summaryValueHighlight: {
    color: "#22c55e",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 10,
  },

  /* Processing */
  processingRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  processingText: {
    color: "#9ca3af",
    fontSize: 14,
  },

  /* Actions */
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default React.memo(TransferDetailScreen);
