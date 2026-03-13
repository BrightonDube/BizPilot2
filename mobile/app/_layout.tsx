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
 *
 * Startup optimization (Task 14.5):
 * - Splash screen hides after auth + DB init (not a fixed timer)
 * - InteractionManager defers non-critical work until after first paint
 * - StartupProfiler logs phase durations for regression tracking
 */

import React, { useEffect, useCallback, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, InteractionManager } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { StartupProfiler } from "@/utils/StartupProfiler";

// Prevent the splash screen from auto-hiding.
// We'll hide it once critical initialization is done.
SplashScreen.preventAutoHideAsync();
StartupProfiler.markStart("app-mount");

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    /**
     * Startup sequence — ordered for fastest time-to-interactive:
     * 1. DB init (already happens eagerly via db/index.ts singleton)
     * 2. Auth state restore (check AsyncStorage for saved tokens)
     * 3. Hide splash screen and render the app
     * 4. Defer non-critical work (sync, cache warm, profiler report)
     *
     * Why InteractionManager for deferred work?
     * It waits until after all animations and rendering are done,
     * ensuring the POS UI is responsive before background tasks start.
     */
    async function initializeApp() {
      StartupProfiler.markStart("init-sequence");

      try {
        // Phase 1: Database — already initialized as a module-level singleton.
        // The import triggers creation, so by the time this effect runs,
        // WatermelonDB is ready. We just mark the timing.
        StartupProfiler.markStart("db-ready");
        StartupProfiler.markEnd("db-ready");

        // Phase 2: Auth state restore
        // TODO: Replace with actual auth store hydration when auth is implemented
        StartupProfiler.markStart("auth-restore");
        // await authStore.getState().hydrate();
        StartupProfiler.markEnd("auth-restore");
      } catch (error) {
        // Non-fatal: app can still function (will redirect to login)
        console.warn("[Startup] Initialization error:", error);
      } finally {
        StartupProfiler.markEnd("init-sequence");
        setIsReady(true);
      }
    }

    initializeApp();
  }, []);

  const onLayoutReady = useCallback(async () => {
    if (!isReady) return;

    StartupProfiler.markStart("splash-hide");
    await SplashScreen.hideAsync();
    StartupProfiler.markEnd("splash-hide");
    StartupProfiler.markEnd("app-mount");

    // Defer non-critical work until after the first paint
    InteractionManager.runAfterInteractions(() => {
      StartupProfiler.report();

      // TODO: Trigger background sync, warm caches, etc.
      // These are intentionally deferred to keep startup fast.
    });
  }, [isReady]);

  if (!isReady) {
    // While initializing, keep the splash screen visible.
    // Return null to avoid rendering anything underneath.
    return null;
  }

  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: "#1f2937" }} onLayout={onLayoutReady}>
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
