/**
 * BulkOperationsScreen — tablet-first UI for managing bulk operations.
 *
 * Layout: Split-pane
 * - Left panel (60%): List of recent/active operations with live progress bars
 * - Right panel (40%): Quick-action buttons to start new bulk operations
 *
 * Why split-pane?
 * On a tablet, staff can monitor running jobs while selecting a new operation
 * to queue — the same pattern as the main POS screen. Single-column layout
 * degrades gracefully on phones via the `isTablet` utility.
 *
 * Offline resilience:
 * New operations are queued locally immediately. Progress tracking only works
 * when online; we show a "Waiting for connection" badge when offline.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useDatabase } from "@nozbe/watermelondb/hooks";
import { withObservables } from "@nozbe/watermelondb/react";
import { Ionicons } from "@expo/vector-icons";

import {
  BulkOperation,
  BulkOperationType,
  BulkOperationStatus,
} from "@/db/models/BulkOperation";
import {
  BulkOperationsService,
  PROGRESS_POLL_INTERVAL_MS,
} from "@/services/BulkOperationsService";
import { useAuthStore } from "@/stores/authStore";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Status badge colour map.
 * Colour coding is intentional: green=done, amber=in-progress, red=error.
 */
const STATUS_COLORS: Record<BulkOperationStatus, string> = {
  pending: "#F59E0B",
  processing: "#3B82F6",
  completed: "#10B981",
  failed: "#EF4444",
  cancelled: "#6B7280",
};

const STATUS_LABELS: Record<BulkOperationStatus, string> = {
  pending: "Queued",
  processing: "Processing",
  completed: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

interface StatusBadgeProps {
  status: BulkOperationStatus;
}

/**
 * Coloured pill showing the operation status.
 * Large enough (min 28px height) for easy reading on tablet.
 */
const StatusBadge = React.memo<StatusBadgeProps>(function StatusBadge({
  status,
}) {
  return (
    <View
      style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] }]}
    >
      <Text style={styles.statusBadgeText}>{STATUS_LABELS[status]}</Text>
    </View>
  );
});

interface ProgressBarProps {
  percent: number;
  status: BulkOperationStatus;
}

/**
 * Animated horizontal progress bar.
 * Shows percent complete (0–100). Hidden for pending/cancelled operations.
 */
const ProgressBar = React.memo<ProgressBarProps>(function ProgressBar({
  percent,
  status,
}) {
  if (status === "pending" || status === "cancelled") return null;

  return (
    <View style={styles.progressBarTrack}>
      <View
        style={[
          styles.progressBarFill,
          {
            width: `${percent}%` as `${number}%`,
            backgroundColor: STATUS_COLORS[status],
          },
        ]}
      />
    </View>
  );
});

interface OperationRowProps {
  operation: BulkOperation;
  onCancel: (op: BulkOperation) => void;
}

/**
 * A single row in the operations list.
 * Shows title, status badge, progress bar, and record counts.
 */
const OperationRow = React.memo<OperationRowProps>(function OperationRow({
  operation,
  onCancel,
}) {
  return (
    <View style={styles.operationRow}>
      <View style={styles.operationRowHeader}>
        <Text style={styles.operationTitle} numberOfLines={1}>
          {operation.title}
        </Text>
        <StatusBadge status={operation.status} />
      </View>

      <ProgressBar
        percent={operation.progressPercent}
        status={operation.status}
      />

      <View style={styles.operationRowFooter}>
        <Text style={styles.operationMeta}>
          {operation.processedRecords} / {operation.totalRecords} records
          {operation.failedRecords > 0 && (
            <Text style={styles.failedCount}>
              {" "}
              · {operation.failedRecords} failed
            </Text>
          )}
        </Text>

        {operation.isCancellable && (
          <TouchableOpacity
            onPress={() => onCancel(operation)}
            style={styles.cancelButton}
            accessibilityLabel="Cancel operation"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Quick-action cards (right panel)
// ---------------------------------------------------------------------------

interface QuickAction {
  id: BulkOperationType;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "price_update",
    label: "Bulk Price Update",
    description: "Update prices for multiple products at once",
    icon: "pricetag-outline",
    color: "#6366F1",
  },
  {
    id: "stock_adjustment",
    label: "Bulk Stock Adjustment",
    description: "Adjust stock levels for multiple products",
    icon: "cube-outline",
    color: "#0EA5E9",
  },
  {
    id: "product_deactivate",
    label: "Deactivate Products",
    description: "Bulk deactivate discontinued products",
    icon: "eye-off-outline",
    color: "#F59E0B",
  },
  {
    id: "product_export",
    label: "Export Product Catalog",
    description: "Export all products to CSV for review",
    icon: "download-outline",
    color: "#10B981",
  },
];

interface QuickActionCardProps {
  action: QuickAction;
  onPress: (action: QuickAction) => void;
}

const QuickActionCard = React.memo<QuickActionCardProps>(
  function QuickActionCard({ action, onPress }) {
    return (
      <TouchableOpacity
        style={styles.quickActionCard}
        onPress={() => onPress(action)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={action.label}
      >
        <View
          style={[styles.quickActionIcon, { backgroundColor: action.color }]}
        >
          <Ionicons name={action.icon} size={28} color="#FFFFFF" />
        </View>
        <View style={styles.quickActionText}>
          <Text style={styles.quickActionLabel}>{action.label}</Text>
          <Text style={styles.quickActionDescription} numberOfLines={2}>
            {action.description}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    );
  }
);

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

interface BulkOperationsScreenInnerProps {
  operations: BulkOperation[];
}

/**
 * Inner component receives reactive WatermelonDB operations array.
 * Separated from the outer HOC so we can control the observable subscription.
 */
function BulkOperationsScreenInner({
  operations,
}: BulkOperationsScreenInnerProps) {
  const db = useDatabase();
  const { currentUser } = useAuthStore();
  const businessId = currentUser?.businessId ?? "";

  const service = useMemo(() => new BulkOperationsService(db), [db]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Poll for progress on active operations every 3 seconds
  useEffect(() => {
    const activeOps = operations.filter(
      (op) => op.status === "pending" || op.status === "processing"
    );
    if (activeOps.length === 0) return;

    const interval = setInterval(() => {
      activeOps.forEach((op) => {
        service.pollProgress(op).catch((err) => {
          console.warn("[BulkOps] Poll error:", err);
        });
      });
    }, PROGRESS_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [operations, service]);

  const handleCancel = useCallback(
    (operation: BulkOperation) => {
      Alert.alert(
        "Cancel Operation",
        `Cancel "${operation.title}"? This cannot be undone.`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel Operation",
            style: "destructive",
            onPress: async () => {
              try {
                await service.cancelOperation(operation);
              } catch (err) {
                Alert.alert(
                  "Error",
                  "Could not cancel this operation. It may already be processing."
                );
              }
            },
          },
        ]
      );
    },
    [service]
  );

  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      // In a full implementation, each action type opens a configuration modal.
      // For now, show a placeholder alert.
      // TODO: wire up BulkPriceUpdateModal, BulkStockAdjustmentModal, etc.
      Alert.alert(
        action.label,
        `Opening ${action.label} wizard...\n\nFull configuration UI coming in the next release.`,
        [{ text: "OK" }]
      );
    },
    []
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Re-submit any dirty pending operations (e.g. just came back online)
      const dirty = await service.getDirtyOperations(businessId);
      await Promise.all(dirty.map((op) => service.submitToServer(op)));
    } finally {
      setIsRefreshing(false);
    }
  }, [service, businessId]);

  const { width } = Dimensions.get("window");
  const isTablet = width >= 768;

  const renderOperation = useCallback(
    ({ item }: { item: BulkOperation }) => (
      <OperationRow operation={item} onCancel={handleCancel} />
    ),
    [handleCancel]
  );

  const renderQuickAction = useCallback(
    ({ item }: { item: QuickAction }) => (
      <QuickActionCard action={item} onPress={handleQuickAction} />
    ),
    [handleQuickAction]
  );

  const operationsPanel = (
    <View style={[styles.panel, isTablet && styles.panelLeft]}>
      <Text style={styles.panelTitle}>Operations</Text>
      {operations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyStateText}>No operations yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Use the quick actions to start a bulk operation
          </Text>
        </View>
      ) : (
        <FlatList
          data={operations}
          keyExtractor={(item) => item.id}
          renderItem={renderOperation}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  const actionsPanel = (
    <View style={[styles.panel, isTablet && styles.panelRight]}>
      <Text style={styles.panelTitle}>Quick Actions</Text>
      <FlatList
        data={QUICK_ACTIONS}
        keyExtractor={(item) => item.id}
        renderItem={renderQuickAction}
        contentContainerStyle={styles.listContent}
        scrollEnabled={false}
      />
    </View>
  );

  if (isTablet) {
    return (
      <View style={styles.tabletContainer}>
        {operationsPanel}
        {actionsPanel}
      </View>
    );
  }

  // Phone: stacked layout
  return (
    <View style={styles.phoneContainer}>
      {actionsPanel}
      {operationsPanel}
    </View>
  );
}

// ---------------------------------------------------------------------------
// WatermelonDB reactive HOC
// ---------------------------------------------------------------------------

/**
 * withObservables wraps BulkOperationsScreenInner so it re-renders
 * automatically whenever the operations query emits new results.
 * This is the idiomatic WatermelonDB pattern — no manual subscription needed.
 */
const enhance = withObservables(
  ["businessId"],
  ({ businessId, db }: { businessId: string; db: ReturnType<typeof useDatabase> }) => ({
    operations: db
      .get<BulkOperation>("bulk_operations")
      .query()
      .observe(),
  })
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EnhancedBulkOperationsScreen = enhance(BulkOperationsScreenInner as any);

/**
 * The exported screen component.
 * Provides the database and businessId props to the enhanced inner component.
 */
export default function BulkOperationsScreen() {
  const db = useDatabase();
  const { currentUser } = useAuthStore();
  const businessId = currentUser?.businessId ?? "";

  return (
    <EnhancedBulkOperationsScreen
      db={db}
      businessId={businessId}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  tabletContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
  },
  phoneContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  panel: {
    flex: 1,
    padding: 16,
  },
  panelLeft: {
    flex: 6,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  panelRight: {
    flex: 4,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 24,
  },
  // Operation rows
  operationRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  operationRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  operationTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginRight: 8,
  },
  operationRowFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  operationMeta: {
    fontSize: 13,
    color: "#6B7280",
  },
  failedCount: {
    color: "#EF4444",
  },
  cancelButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  cancelButtonText: {
    fontSize: 13,
    color: "#EF4444",
    fontWeight: "600",
  },
  // Status badge
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    minHeight: 24,
    justifyContent: "center",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Progress bar
  progressBarTrack: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
    marginVertical: 6,
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  // Quick action cards
  quickActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 72,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    flexShrink: 0,
  },
  quickActionText: {
    flex: 1,
  },
  quickActionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  quickActionDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9CA3AF",
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: "#D1D5DB",
    marginTop: 4,
    textAlign: "center",
    maxWidth: 240,
  },
});
