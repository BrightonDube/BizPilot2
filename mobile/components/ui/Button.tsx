/**
 * BizPilot Mobile POS — PosButton Component
 *
 * Primary touch-optimized button for POS interactions.
 * Provides haptic feedback, loading states, and visual variants.
 *
 * Why a custom button instead of TouchableOpacity?
 * - Enforces minimum touch target size (44dp) per accessibility guidelines
 * - Built-in haptic feedback for tactile confirmation
 * - Consistent styling with variant system
 * - Loading state prevents double-taps (critical for payment buttons)
 */

import React, { useCallback } from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface PosButtonProps {
  /** Button text label */
  label: string;
  /** Called when the button is pressed */
  onPress: () => void;
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size preset */
  size?: ButtonSize;
  /** Show loading spinner and disable interaction */
  loading?: boolean;
  /** Disable the button */
  disabled?: boolean;
  /** Whether to trigger haptic feedback on press */
  haptic?: boolean;
  /** Optional icon element rendered before the label */
  icon?: React.ReactNode;
  /** Additional styles for the container */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Style mappings
// ---------------------------------------------------------------------------

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
  primary: { bg: "#2563eb", text: "#ffffff", border: "#2563eb" },
  secondary: { bg: "#374151", text: "#ffffff", border: "#4b5563" },
  danger: { bg: "#dc2626", text: "#ffffff", border: "#dc2626" },
  ghost: { bg: "transparent", text: "#9ca3af", border: "transparent" },
};

const SIZE_STYLES: Record<ButtonSize, { height: number; paddingH: number; fontSize: number }> = {
  sm: { height: 36, paddingH: 12, fontSize: 14 },
  md: { height: 48, paddingH: 16, fontSize: 16 },
  lg: { height: 56, paddingH: 20, fontSize: 18 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PosButton: React.FC<PosButtonProps> = React.memo(function PosButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  haptic = true,
  icon,
  style,
}) {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  const handlePress = useCallback(() => {
    if (isDisabled) return;
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }, [isDisabled, haptic, onPress]);

  const containerStyle: ViewStyle = {
    backgroundColor: variantStyle.bg,
    borderColor: variantStyle.border,
    borderWidth: 1,
    borderRadius: 8,
    height: sizeStyle.height,
    paddingHorizontal: sizeStyle.paddingH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    opacity: isDisabled ? 0.5 : 1,
    minWidth: 44, // Accessibility: minimum touch target
    ...style,
  };

  const textStyle: TextStyle = {
    color: variantStyle.text,
    fontSize: sizeStyle.fontSize,
    fontWeight: "600",
    marginLeft: icon ? 8 : 0,
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        containerStyle,
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyle.text} />
      ) : (
        <>
          {icon}
          <Text style={textStyle}>{label}</Text>
        </>
      )}
    </Pressable>
  );
});

export default PosButton;
