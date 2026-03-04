/**
 * PinEntryPad — numeric PIN entry keypad for POS authentication.
 * (shift-management task 6.1)
 *
 * Used for:
 *   1. Staff login PIN (quick clock-in without password)
 *   2. Manager override PIN (approve discounts, voids, etc.)
 *   3. Shift open / close authorization
 *
 * Why a custom numpad instead of the system keyboard?
 * - System keyboard has smaller targets and layout varies across OS versions.
 * - This pad renders consistently on all tablet sizes with 80dp buttons.
 * - We control haptics, backspace, and the submit action precisely.
 *
 * Why no "Show PIN" toggle?
 * POS terminals are operated in public — obscuring the PIN is mandatory.
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 6;

const NUMPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "back"],
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PinEntryPadProps {
  /** Label shown above the dot indicators (e.g., "Enter PIN" or "Manager PIN") */
  title: string;
  /** Optional subtitle / helper text */
  subtitle?: string;
  /** Called when the user presses Submit with a valid-length PIN */
  onSubmit: (pin: string) => void;
  /** Called if the pad should be dismissed (optional cancel button) */
  onCancel?: () => void;
  /** Whether to show a loading spinner (disables input while processing) */
  loading?: boolean;
  /** Error message to display (cleared automatically on next key press) */
  error?: string | null;
  /** Visual style override for the container */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PinEntryPad renders a 12-key numeric pad with dot-indicator feedback.
 * It is intentionally stateless regarding validation — the parent component
 * decides whether the PIN is correct via `onSubmit`.
 */
const PinEntryPad: React.FC<PinEntryPadProps> = React.memo(
  function PinEntryPad({
    title,
    subtitle,
    onSubmit,
    onCancel,
    loading = false,
    error = null,
    style,
  }) {
    const [pin, setPin] = useState("");
    // Clear error on next key press by tracking it separately
    const [internalError, setInternalError] = useState<string | null>(null);

    // Show either the prop error or the internal error (prop takes precedence)
    const displayError = error ?? internalError;

    const handleKey = useCallback(
      (key: string) => {
        if (loading) return;
        // Clear error on any key press
        setInternalError(null);

        if (key === "back") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setPin((prev) => prev.slice(0, -1));
          return;
        }

        if (key === "" ) return; // Empty spacer key

        if (pin.length >= PIN_MAX_LENGTH) {
          // Already at max length — reject with light haptic
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const newPin = pin + key;
        setPin(newPin);

        // Auto-submit when max length reached
        if (newPin.length === PIN_MAX_LENGTH) {
          onSubmit(newPin);
          setPin(""); // Reset for next entry
        }
      },
      [pin, loading, onSubmit]
    );

    const handleSubmit = useCallback(() => {
      if (loading) return;
      if (pin.length < PIN_MIN_LENGTH) {
        setInternalError(`PIN must be at least ${PIN_MIN_LENGTH} digits`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      onSubmit(pin);
      setPin("");
    }, [pin, loading, onSubmit]);

    // Dot indicators — filled for entered digits, empty for remaining
    const dots = useMemo(() => {
      return Array.from({ length: PIN_MAX_LENGTH }, (_, i) => i < pin.length);
    }, [pin]);

    return (
      <View style={[styles.container, style]}>
        {/* Title */}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {/* PIN dot indicators */}
        <View style={styles.dotsRow}>
          {dots.map((filled, index) => (
            <View
              key={index}
              style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
            />
          ))}
        </View>

        {/* Error message */}
        {displayError ? (
          <Text style={styles.errorText}>{displayError}</Text>
        ) : (
          <View style={styles.errorPlaceholder} />
        )}

        {/* Numpad grid */}
        <View style={styles.numpad}>
          {NUMPAD_KEYS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.numpadRow}>
              {row.map((key, colIndex) => (
                <NumpadKey
                  key={colIndex}
                  keyValue={key}
                  onPress={() => handleKey(key)}
                  disabled={loading}
                />
              ))}
            </View>
          ))}
        </View>

        {/* Submit button (visible only for 4-5 digit PINs) */}
        {pin.length >= PIN_MIN_LENGTH && pin.length < PIN_MAX_LENGTH ? (
          <Pressable
            style={[styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityLabel="Submit PIN"
            accessibilityRole="button"
          >
            <Text style={styles.submitButtonText}>
              {loading ? "Verifying…" : "Submit"}
            </Text>
          </Pressable>
        ) : null}

        {/* Cancel link */}
        {onCancel ? (
          <Pressable
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={loading}
            accessibilityLabel="Cancel PIN entry"
            accessibilityRole="button"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// NumpadKey sub-component
// ---------------------------------------------------------------------------

interface NumpadKeyProps {
  keyValue: string;
  onPress: () => void;
  disabled: boolean;
}

const NumpadKey: React.FC<NumpadKeyProps> = React.memo(function NumpadKey({
  keyValue,
  onPress,
  disabled,
}) {
  if (keyValue === "") {
    // Spacer — transparent, no interaction
    return <View style={styles.numpadKey} />;
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.numpadKey,
        pressed && styles.numpadKeyPressed,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={keyValue === "back" ? "Backspace" : keyValue}
      accessibilityRole="button"
    >
      {keyValue === "back" ? (
        <Ionicons name="backspace-outline" size={28} color="#e5e7eb" />
      ) : (
        <Text style={styles.numpadKeyText}>{keyValue}</Text>
      )}
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 16,
    textAlign: "center",
  },

  // Dot indicators
  dotsRow: {
    flexDirection: "row",
    gap: 14,
    marginVertical: 16,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  dotFilled: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  dotEmpty: {
    backgroundColor: "transparent",
    borderColor: "#6b7280",
  },

  // Error
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    marginBottom: 8,
    textAlign: "center",
  },
  errorPlaceholder: {
    height: 20,
  },

  // Numpad
  numpad: {
    gap: 10,
    marginTop: 4,
  },
  numpadRow: {
    flexDirection: "row",
    gap: 10,
  },
  numpadKey: {
    width: 88,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },
  numpadKeyPressed: {
    backgroundColor: "#4b5563",
    transform: [{ scale: 0.96 }],
  },
  numpadKeyText: {
    fontSize: 28,
    fontWeight: "600",
    color: "#f3f4f6",
  },

  // Submit & Cancel
  submitButton: {
    marginTop: 16,
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 220,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: "#9ca3af",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default PinEntryPad;
