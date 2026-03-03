/**
 * BizPilot Mobile POS — ManualSyncButton Component
 *
 * A pressable button that triggers a manual sync.
 * Shows a spinning animation while sync is in progress.
 *
 * Why a separate component?
 * Manual sync is used on multiple screens (Settings, Orders, POS header).
 * Extracting it prevents duplicated sync trigger logic and ensures
 * consistent loading/error feedback everywhere.
 */

import React, { useCallback, useRef } from "react";
import { Pressable, Text, Animated, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSyncStore } from "@/stores/syncStore";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ManualSyncButtonProps {
  /** Called when the sync button is pressed. Should trigger the sync service. */
  onSync: () => Promise<void>;
  /** Optional label text. Defaults to "Sync Now" */
  label?: string;
  /** Compact mode hides the label, showing only the icon */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ManualSyncButton: React.FC<ManualSyncButtonProps> = React.memo(
  function ManualSyncButton({ onSync, label = "Sync Now", compact = false }) {
    const status = useSyncStore((s) => s.status);
    const isOnline = useSyncStore((s) => s.isOnline);
    const isSyncing = status === "syncing";

    // Spin animation for the sync icon while syncing
    const spinValue = useRef(new Animated.Value(0)).current;
    const spinAnimation = useRef<Animated.CompositeAnimation | null>(null);

    const startSpin = useCallback(() => {
      spinValue.setValue(0);
      spinAnimation.current = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      spinAnimation.current.start();
    }, [spinValue]);

    const stopSpin = useCallback(() => {
      spinAnimation.current?.stop();
      spinValue.setValue(0);
    }, [spinValue]);

    const handlePress = useCallback(async () => {
      if (isSyncing) return;

      if (!isOnline) {
        Alert.alert(
          "Offline",
          "Cannot sync while offline. Changes will be synced when connectivity is restored."
        );
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      startSpin();

      try {
        await onSync();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Sync Failed", "Please try again in a moment.");
      } finally {
        stopSpin();
      }
    }, [isSyncing, isOnline, onSync, startSpin, stopSpin]);

    const spin = spinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });

    return (
      <Pressable
        onPress={handlePress}
        disabled={isSyncing}
        style={({ pressed }) => [
          styles.button,
          compact && styles.buttonCompact,
          pressed && styles.buttonPressed,
          isSyncing && styles.buttonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={isSyncing ? "Syncing in progress" : label}
        accessibilityState={{ disabled: isSyncing }}
      >
        <Animated.View style={{ transform: [{ rotate: isSyncing ? spin : "0deg" }] }}>
          <Ionicons
            name="sync-outline"
            size={compact ? 18 : 20}
            color={isSyncing ? "#6b7280" : "#3b82f6"}
          />
        </Animated.View>
        {!compact && (
          <Text style={[styles.label, isSyncing && styles.labelDisabled]}>
            {isSyncing ? "Syncing..." : label}
          </Text>
        )}
      </Pressable>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#1f2937",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  buttonCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  buttonPressed: {
    backgroundColor: "#374151",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  label: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
  },
  labelDisabled: {
    color: "#6b7280",
  },
});

export default ManualSyncButton;
