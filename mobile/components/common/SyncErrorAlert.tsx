/**
 * BizPilot Mobile POS — SyncErrorAlert Component
 *
 * A dismissable alert banner shown when sync encounters an error.
 * Includes the error message and a retry button.
 *
 * Why a persistent banner and not a toast?
 * Sync errors can be critical (e.g., orders not reaching the server).
 * A toast auto-dismisses and the operator may miss it. A persistent
 * banner stays visible until they explicitly dismiss or retry.
 */

import React, { useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSyncStore } from "@/stores/syncStore";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SyncErrorAlertProps {
  /** Called when the "Retry" button is pressed */
  onRetry: () => void;
  /** Called when the alert is dismissed */
  onDismiss?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SyncErrorAlert: React.FC<SyncErrorAlertProps> = React.memo(
  function SyncErrorAlert({ onRetry, onDismiss }) {
    const status = useSyncStore((s) => s.status);
    const lastError = useSyncStore((s) => s.lastError);

    // Only render when there's an actual error
    if (status !== "error" || !lastError) return null;

    const handleRetry = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onRetry();
    }, [onRetry]);

    const handleDismiss = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onDismiss?.();
    }, [onDismiss]);

    return (
      <View style={styles.container} accessibilityRole="alert">
        <View style={styles.iconRow}>
          <Ionicons name="warning-outline" size={20} color="#fbbf24" />
          <Text style={styles.title}>Sync Error</Text>
          {onDismiss && (
            <Pressable
              onPress={handleDismiss}
              hitSlop={12}
              style={styles.closeButton}
              accessibilityLabel="Dismiss sync error"
            >
              <Ionicons name="close" size={18} color="#9ca3af" />
            </Pressable>
          )}
        </View>

        <Text style={styles.errorMessage} numberOfLines={2}>
          {lastError}
        </Text>

        <Pressable
          onPress={handleRetry}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Retry sync"
        >
          <Ionicons name="refresh-outline" size={16} color="#3b82f6" />
          <Text style={styles.retryText}>Retry Now</Text>
        </Pressable>
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1c1917",
    borderWidth: 1,
    borderColor: "#78350f",
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  title: {
    color: "#fbbf24",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  errorMessage: {
    color: "#d1d5db",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#1e3a5f",
    borderRadius: 6,
  },
  retryButtonPressed: {
    backgroundColor: "#1e40af",
  },
  retryText: {
    color: "#3b82f6",
    fontSize: 13,
    fontWeight: "600",
  },
});

export default SyncErrorAlert;
