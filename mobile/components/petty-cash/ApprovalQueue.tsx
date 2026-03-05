/**
 * BizPilot Mobile POS — Petty Cash Approval Queue
 *
 * Manager-facing screen that lists pending expense requests.
 * Each card expands inline to collect approval comments or a
 * rejection reason before confirming the action.
 *
 * Why inline expand instead of a modal?
 * On tablets (our primary form factor) modals obscure context.
 * Expanding in-place keeps the surrounding requests visible so
 * managers can compare amounts and justifications side-by-side.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingRequest {
  id: string;
  requestedByName: string;
  categoryName: string;
  requestedAmount: number;
  description: string;
  justification: string;
  createdAt: string;
  fundName: string;
}

interface ApprovalQueueProps {
  requests: PendingRequest[];
  onApprove: (requestId: string, comments: string) => void;
  onReject: (requestId: string, reason: string) => void;
  onBack: () => void;
  isLoading?: boolean;
}

type ActionType = "approve" | "reject";

interface ExpandedState {
  requestId: string;
  action: ActionType;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * @param props {@link ApprovalQueueProps}
 * @returns Approval queue with expandable action rows per request card
 */
function ApprovalQueueComponent({
  requests,
  onApprove,
  onReject,
  onBack,
  isLoading = false,
}: ApprovalQueueProps) {
  // ---- state ----

  const [expanded, setExpanded] = useState<ExpandedState | null>(null);
  const [inputText, setInputText] = useState<string>("");

  // ---- handlers ----

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  const handleActionPress = useCallback(
    (requestId: string, action: ActionType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Toggle if already expanded for the same request + action
      if (expanded?.requestId === requestId && expanded.action === action) {
        setExpanded(null);
        setInputText("");
        return;
      }
      setExpanded({ requestId, action });
      setInputText("");
    },
    [expanded],
  );

  const handleConfirm = useCallback(() => {
    if (!expanded) return;

    if (expanded.action === "approve") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onApprove(expanded.requestId, inputText.trim());
    } else {
      if (!inputText.trim()) {
        // Rejection requires a reason — nudge the manager
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      onReject(expanded.requestId, inputText.trim());
    }

    setExpanded(null);
    setInputText("");
  }, [expanded, inputText, onApprove, onReject]);

  // ---- renderers ----

  const renderRequest = useCallback(
    ({ item }: { item: PendingRequest }) => {
      const isExpanded = expanded?.requestId === item.id;
      const createdDate = new Date(item.createdAt).toLocaleDateString();

      return (
        <View testID={`approval-card-${item.id}`} style={styles.card}>
          {/* Requester + date */}
          <View style={styles.cardTopRow}>
            <View style={styles.requesterRow}>
              <Ionicons name="person-outline" size={14} color="#9ca3af" />
              <Text style={styles.requesterName}>{item.requestedByName}</Text>
            </View>
            <Text style={styles.dateText}>{createdDate}</Text>
          </View>

          {/* Category badge */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{item.categoryName}</Text>
          </View>

          {/* Amount */}
          <Text style={styles.amountText}>
            {formatCurrency(item.requestedAmount)}
          </Text>

          {/* Description + justification */}
          <Text style={styles.descriptionLabel}>Description</Text>
          <Text style={styles.descriptionText}>{item.description}</Text>
          <Text style={styles.descriptionLabel}>Justification</Text>
          <Text style={styles.descriptionText}>{item.justification}</Text>

          {/* Fund name */}
          <View style={styles.fundRow}>
            <Ionicons name="wallet-outline" size={12} color="#6b7280" />
            <Text style={styles.fundText}>{item.fundName}</Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              testID={`approval-approve-${item.id}`}
              style={[
                styles.approveBtn,
                isExpanded && expanded.action === "approve" && styles.approveBtnActive,
              ]}
              onPress={() => handleActionPress(item.id, "approve")}
              activeOpacity={0.7}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color="#22c55e"
              />
              <Text style={styles.approveBtnText}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID={`approval-reject-${item.id}`}
              style={[
                styles.rejectBtn,
                isExpanded && expanded.action === "reject" && styles.rejectBtnActive,
              ]}
              onPress={() => handleActionPress(item.id, "reject")}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>

          {/* Expanded action area */}
          {isExpanded && (
            <View style={styles.expandedArea}>
              <Text style={styles.expandedLabel}>
                {expanded.action === "approve"
                  ? "Comments (optional)"
                  : "Reason for rejection (required)"}
              </Text>
              <TextInput
                testID="approval-comments-input"
                style={styles.expandedInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder={
                  expanded.action === "approve"
                    ? "Add any comments…"
                    : "Explain why this request is rejected…"
                }
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
              <TouchableOpacity
                testID="approval-confirm-btn"
                style={[
                  styles.confirmBtn,
                  {
                    backgroundColor:
                      expanded.action === "approve" ? "#22c55e" : "#ef4444",
                  },
                ]}
                onPress={handleConfirm}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={
                    expanded.action === "approve"
                      ? "checkmark-outline"
                      : "close-outline"
                  }
                  size={18}
                  color="#ffffff"
                />
                <Text style={styles.confirmBtnText}>
                  {expanded.action === "approve"
                    ? "Confirm Approval"
                    : "Confirm Rejection"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    },
    [expanded, inputText, handleActionPress, handleConfirm],
  );

  const keyExtractor = useCallback((item: PendingRequest) => item.id, []);

  // ---- loading state ----

  if (isLoading) {
    return (
      <View testID="approval-loading" style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading approvals…</Text>
      </View>
    );
  }

  // ---- empty state ----

  const ListEmpty = (
    <View testID="approval-empty" style={styles.centered}>
      <Ionicons name="checkmark-done-circle-outline" size={48} color="#22c55e" />
      <Text style={styles.emptyText}>No pending approvals ✓</Text>
      <Text style={styles.emptySubtext}>All expense requests have been processed.</Text>
    </View>
  );

  // ---- main render ----

  return (
    <View testID="approval-queue" style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="approval-back-btn"
          onPress={handleBack}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#f3f4f6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Approvals</Text>
        {requests.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{requests.length}</Text>
          </View>
        )}
        {/* Spacer to keep title centred when badge is absent */}
        {requests.length === 0 && <View style={{ width: 32 }} />}
      </View>

      {/* Request list */}
      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#1f2937",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  countBadge: {
    backgroundColor: "#fbbf24",
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },

  // List
  listContent: {
    paddingBottom: 32,
  },

  // Card
  card: {
    backgroundColor: "#1f2937",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  requesterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  requesterName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  dateText: {
    fontSize: 12,
    color: "#6b7280",
  },

  // Category
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#3b82f620",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3b82f6",
  },

  // Amount
  amountText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 12,
  },

  // Description / justification
  descriptionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
    marginTop: 6,
  },
  descriptionText: {
    fontSize: 13,
    color: "#d1d5db",
    lineHeight: 18,
    marginBottom: 4,
  },

  // Fund
  fundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    marginBottom: 12,
  },
  fundText: {
    fontSize: 12,
    color: "#6b7280",
  },

  // Action buttons
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 12,
  },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#22c55e15",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  approveBtnActive: {
    borderColor: "#22c55e",
  },
  approveBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#22c55e",
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ef444415",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  rejectBtnActive: {
    borderColor: "#ef4444",
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },

  // Expanded area
  expandedArea: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  expandedLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
    marginBottom: 8,
  },
  expandedInput: {
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#f3f4f6",
    minHeight: 56,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },

  // States
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  emptySubtext: {
    fontSize: 13,
    color: "#6b7280",
  },
});

export default React.memo(ApprovalQueueComponent) as typeof ApprovalQueueComponent;
