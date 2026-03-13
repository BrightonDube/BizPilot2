/**
 * BizPilot Mobile POS — Root Index (Entry Point)
 *
 * Redirects to the appropriate screen based on auth state.
 * If authenticated → tabs (POS). If not → login.
 */

import { Redirect } from "expo-router";
import { useAuthStore } from "@/stores/authStore";

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
