/**
 * BizPilot Mobile POS — 404 Not Found Screen
 */

import { View, Text } from "react-native";
import { Link } from "expo-router";

export default function NotFound() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#1f2937",
      }}
    >
      <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "700" }}>
        404
      </Text>
      <Text style={{ color: "#9ca3af", marginTop: 8, marginBottom: 24 }}>
        Screen not found
      </Text>
      <Link href="/" style={{ color: "#3b82f6", fontSize: 16 }}>
        Go to Home
      </Link>
    </View>
  );
}
