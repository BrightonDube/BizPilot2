/**
 * BizPilot Mobile POS — Badge Component
 *
 * Small status/label indicator used for order status,
 * sync state, and product tags.
 */

import React from "react";
import { View, Text, type ViewStyle } from "react-native";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: "#374151", text: "#d1d5db" },
  success: { bg: "#065f46", text: "#6ee7b7" },
  warning: { bg: "#78350f", text: "#fcd34d" },
  danger: { bg: "#7f1d1d", text: "#fca5a5" },
  info: { bg: "#1e3a5f", text: "#93c5fd" },
};

const Badge: React.FC<BadgeProps> = React.memo(function Badge({
  label,
  variant = "default",
  style,
}) {
  const colors = VARIANT_COLORS[variant];

  return (
    <View
      style={[
        {
          backgroundColor: colors.bg,
          borderRadius: 12,
          paddingHorizontal: 10,
          paddingVertical: 4,
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
});

export default Badge;
