/**
 * BizPilot Mobile POS — Settings Screen
 *
 * Configuration and account management.
 * Includes business settings, sync controls, and logout.
 */

import React, { useCallback } from "react";
import { View, Text, ScrollView, Pressable, Switch, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSyncStore } from "@/stores/syncStore";
import { logout } from "@/services/auth/AuthService";
import { Card, Button, Badge } from "@/components/ui";
import { formatDateTime } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// Settings section component
// ---------------------------------------------------------------------------

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

function SettingsRow({ icon, label, value, onPress, rightElement }: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !rightElement}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: pressed && onPress ? "#374151" : "transparent",
        borderBottomWidth: 1,
        borderBottomColor: "#1f2937",
      })}
    >
      <Ionicons name={icon} size={20} color="#9ca3af" style={{ marginRight: 12 }} />
      <Text style={{ flex: 1, color: "#ffffff", fontSize: 15 }}>{label}</Text>
      {value && (
        <Text style={{ color: "#6b7280", fontSize: 14, marginRight: 8 }}>
          {value}
        </Text>
      )}
      {rightElement}
      {onPress && !rightElement && (
        <Ionicons name="chevron-forward" size={18} color="#6b7280" />
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main Settings Screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const settings = useSettingsStore();
  const syncState = useSyncStore();

  const handleLogout = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          clearAuth();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }, [clearAuth]);

  const handleSync = useCallback(() => {
    // TODO: call SyncService.triggerManualSync()
    Alert.alert("Sync", "Manual sync triggered.");
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#1f2937" }}>
      {/* Header */}
      <View
        style={{
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: "#374151",
        }}
      >
        <Text style={{ color: "#ffffff", fontSize: 22, fontWeight: "700" }}>
          Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Account section */}
        <Text
          style={{
            color: "#6b7280",
            fontSize: 12,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 1,
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 8,
          }}
        >
          Account
        </Text>
        <View style={{ backgroundColor: "#111827", borderRadius: 12, marginHorizontal: 12 }}>
          <SettingsRow
            icon="person"
            label="User"
            value={user ? `${user.firstName} ${user.lastName}` : "Not signed in"}
          />
          <SettingsRow
            icon="mail"
            label="Email"
            value={user?.email ?? "—"}
          />
          <SettingsRow
            icon="shield-checkmark"
            label="Role"
            value={user?.role ?? "—"}
          />
        </View>

        {/* Business section */}
        <Text
          style={{
            color: "#6b7280",
            fontSize: 12,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 1,
            paddingHorizontal: 16,
            paddingTop: 24,
            paddingBottom: 8,
          }}
        >
          Business
        </Text>
        <View style={{ backgroundColor: "#111827", borderRadius: 12, marginHorizontal: 12 }}>
          <SettingsRow
            icon="business"
            label="Business Name"
            value={settings.businessName}
          />
          <SettingsRow
            icon="cash"
            label="Currency"
            value={settings.currency}
          />
          <SettingsRow
            icon="calculator"
            label="VAT Rate"
            value={`${(settings.vatRate * 100).toFixed(0)}%`}
          />
        </View>

        {/* Sync section */}
        <Text
          style={{
            color: "#6b7280",
            fontSize: 12,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 1,
            paddingHorizontal: 16,
            paddingTop: 24,
            paddingBottom: 8,
          }}
        >
          Sync
        </Text>
        <View style={{ backgroundColor: "#111827", borderRadius: 12, marginHorizontal: 12 }}>
          <SettingsRow
            icon="cloud"
            label="Sync Status"
            rightElement={
              <Badge
                label={syncState.status}
                variant={
                  syncState.status === "idle"
                    ? "success"
                    : syncState.status === "error"
                    ? "danger"
                    : "warning"
                }
              />
            }
          />
          <SettingsRow
            icon="time"
            label="Last Sync"
            value={syncState.lastSyncAt ? formatDateTime(syncState.lastSyncAt) : "Never"}
          />
          <SettingsRow
            icon="hourglass"
            label="Pending Changes"
            value={String(syncState.pendingChanges)}
          />
          <SettingsRow
            icon="refresh"
            label="Sync Now"
            onPress={handleSync}
          />
        </View>

        {/* Display section */}
        <Text
          style={{
            color: "#6b7280",
            fontSize: 12,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 1,
            paddingHorizontal: 16,
            paddingTop: 24,
            paddingBottom: 8,
          }}
        >
          Display
        </Text>
        <View style={{ backgroundColor: "#111827", borderRadius: 12, marginHorizontal: 12 }}>
          <SettingsRow
            icon="grid"
            label="Grid Columns"
            value={String(settings.gridColumns)}
          />
          <SettingsRow
            icon="notifications"
            label="Sound Effects"
            rightElement={
              <Switch
                value={settings.soundEnabled}
                onValueChange={(v) => settings.setSoundEnabled(v)}
                trackColor={{ false: "#374151", true: "#3b82f6" }}
                thumbColor="#ffffff"
              />
            }
          />
        </View>

        {/* Danger zone */}
        <View style={{ paddingHorizontal: 12, paddingTop: 32 }}>
          <Button
            label="Sign Out"
            variant="danger"
            onPress={handleLogout}
            size="lg"
          />
        </View>

        {/* Version */}
        <Text
          style={{
            color: "#4b5563",
            fontSize: 12,
            textAlign: "center",
            marginTop: 24,
          }}
        >
          BizPilot POS v0.1.0
        </Text>
      </ScrollView>
    </View>
  );
}
