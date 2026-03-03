/**
 * BizPilot Mobile POS — Root Layout
 *
 * The top-level layout wraps the entire app with providers
 * and configures the navigation container.
 *
 * Why providers in the root layout?
 * Every screen needs access to the database, auth state,
 * and error boundary. Placing them here ensures they're
 * available throughout the navigation tree.
 */

import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import ErrorBoundary from "@/components/common/ErrorBoundary";

// Prevent the splash screen from auto-hiding.
// We'll hide it once auth state is determined.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen after initial load.
    // In production, this would wait for auth restore + initial sync.
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: "#1f2937" }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#1f2937" },
            animation: "slide_from_right",
          }}
        />
      </View>
    </ErrorBoundary>
  );
}
