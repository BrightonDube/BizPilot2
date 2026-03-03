/**
 * BizPilot Mobile POS — Auth Layout
 *
 * Stack navigator for authentication screens.
 * No tab bar or sync status shown here — just clean auth UI.
 */

import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#1f2937" },
      }}
    />
  );
}
