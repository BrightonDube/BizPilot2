/**
 * BizPilot Mobile POS — PIN Login Screen
 *
 * Quick login for staff using a 4-digit PIN.
 * Works offline — verifies against locally cached PIN hash.
 *
 * Why PIN login?
 * In a busy POS environment, staff switch shifts frequently.
 * Typing a full email + password every time is too slow.
 * A 4-digit PIN takes <3 seconds to enter.
 */

import React, { useState, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { PIN_LENGTH } from "@/utils/constants";

export default function PinScreen() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= PIN_LENGTH) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newPin = pin + digit;
      setPin(newPin);
      setError(null);

      if (newPin.length === PIN_LENGTH) {
        // TODO: Verify PIN against local hash
        // For now, show a placeholder error
        setError("PIN verification not yet configured");
        setTimeout(() => setPin(""), 300);
      }
    },
    [pin]
  );

  const handleBackspace = useCallback(() => {
    if (pin.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin(pin.slice(0, -1));
    setError(null);
  }, [pin]);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#1f2937",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
      }}
    >
      <Text
        style={{
          color: "#ffffff",
          fontSize: 24,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        Enter PIN
      </Text>
      <Text style={{ color: "#9ca3af", marginBottom: 32 }}>
        Use your 4-digit staff PIN
      </Text>

      {/* PIN dots */}
      <View
        style={{ flexDirection: "row", gap: 16, marginBottom: 12 }}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: i < pin.length ? "#3b82f6" : "#374151",
              borderWidth: 2,
              borderColor: i < pin.length ? "#3b82f6" : "#4b5563",
            }}
          />
        ))}
      </View>

      {/* Error */}
      {error && (
        <Text style={{ color: "#ef4444", fontSize: 14, marginBottom: 12 }}>
          {error}
        </Text>
      )}

      {/* Number pad */}
      <View style={{ width: "100%", maxWidth: 300, marginTop: 20 }}>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}
        >
          {digits.map((digit, i) => {
            if (digit === "") {
              return <View key={i} style={{ width: "30%", height: 64 }} />;
            }

            return (
              <Pressable
                key={i}
                onPress={() =>
                  digit === "⌫" ? handleBackspace() : handleDigit(digit)
                }
                style={({ pressed }) => ({
                  width: "30%",
                  height: 64,
                  backgroundColor: pressed ? "#4b5563" : "#374151",
                  borderRadius: 12,
                  justifyContent: "center",
                  alignItems: "center",
                })}
                accessibilityLabel={
                  digit === "⌫" ? "Backspace" : `Digit ${digit}`
                }
                accessibilityRole="button"
              >
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: digit === "⌫" ? 20 : 28,
                    fontWeight: "600",
                  }}
                >
                  {digit}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Switch to email login */}
      <Pressable
        onPress={() => router.push("/(auth)/login")}
        style={{ marginTop: 32 }}
        accessibilityRole="link"
      >
        <Text style={{ color: "#6b7280", fontSize: 14 }}>
          Use email and password instead
        </Text>
      </Pressable>
    </View>
  );
}
