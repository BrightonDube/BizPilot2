/**
 * BizPilot Mobile POS — Main Tabs Layout
 *
 * Bottom tab navigation for the core POS sections.
 *
 * Why 5 tabs?
 * Apple HIG and Material Design both recommend 3-5 bottom tabs.
 * These 5 cover the daily POS workflow:
 * 1. POS — main selling screen (most used)
 * 2. Orders — view/manage orders
 * 3. Products — browse catalog
 * 4. Customers — customer lookup
 * 5. Settings — configuration
 */

import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import SyncStatus from "@/components/common/SyncStatus";
import { View } from "react-native";

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#1f2937" }}>
      {/* Persistent sync status bar at the top of all tabs */}
      <SyncStatus />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#111827",
            borderTopColor: "#1f2937",
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
            paddingTop: 4,
          },
          tabBarActiveTintColor: "#3b82f6",
          tabBarInactiveTintColor: "#6b7280",
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "600",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "POS",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: "Orders",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="receipt" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: "Products",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="customers"
          options={{
            title: "Customers",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
