/**
 * BizPilot Mobile POS — Card Component
 *
 * Elevated surface container matching the web app's dark theme.
 * Used for product items, order summaries, and settings sections.
 */

import React from "react";
import { View, type ViewStyle } from "react-native";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Why gray-700 background?
 * The app background is gray-800 (#1f2937). Cards use gray-700
 * (#374151) for a subtle elevation effect without drop shadows,
 * which perform poorly on low-end Android tablets.
 */
const Card: React.FC<CardProps> = React.memo(function Card({
  children,
  style,
}) {
  return (
    <View
      style={[
        {
          backgroundColor: "#374151",
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: "#4b5563",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
});

export default Card;
