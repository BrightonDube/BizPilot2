/**
 * BizPilot Mobile POS — Input Component
 *
 * Styled text input matching the dark theme.
 * Supports labels, error messages, and icons.
 */

import React, { forwardRef } from "react";
import {
  View,
  TextInput,
  Text,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

interface InputProps extends TextInputProps {
  /** Label text shown above the input */
  label?: string;
  /** Error message shown below the input */
  error?: string | null;
  /** Additional container styles */
  containerStyle?: ViewStyle;
}

/**
 * Why forwardRef?
 * Allows parent components to focus this input programmatically
 * (e.g., moving focus from email to password on "Next" key).
 */
const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, containerStyle, style, ...props },
  ref
) {
  return (
    <View style={[{ marginBottom: 12 }, containerStyle]}>
      {label && (
        <Text
          style={{
            color: "#9ca3af",
            fontSize: 14,
            marginBottom: 6,
            fontWeight: "500",
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        ref={ref}
        placeholderTextColor="#6b7280"
        style={[
          {
            backgroundColor: "#1f2937",
            borderWidth: 1,
            borderColor: error ? "#ef4444" : "#4b5563",
            borderRadius: 8,
            color: "#ffffff",
            fontSize: 16,
            paddingHorizontal: 14,
            paddingVertical: 12,
            minHeight: 48, // Accessibility: minimum touch target
          },
          style,
        ]}
        {...props}
      />
      {error && (
        <Text
          style={{
            color: "#ef4444",
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
});

export default Input;
