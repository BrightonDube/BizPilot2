/**
 * BizPilot Mobile POS — BottomSheet Component
 *
 * Slide-up sheet for actions, filters, and secondary content.
 * Used instead of full modals when the user needs to see
 * underlying content (e.g., cart summary behind payment options).
 *
 * Why a custom BottomSheet instead of @gorhom/bottom-sheet?
 * The POS only needs a simple slide-up sheet with fixed heights.
 * A 200-line component is preferable to a 500KB dependency
 * with gesture complexity that adds native linking burden.
 * Uses react-native-reanimated for smooth 60fps animations.
 */

import React, { useCallback, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Dimensions,
  type ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BottomSheetHeight = "quarter" | "half" | "three-quarter" | "full";

interface BottomSheetProps {
  /** Controls visibility */
  visible: boolean;
  /** Called when the sheet is dismissed */
  onClose: () => void;
  /** Optional title shown in the header */
  title?: string;
  /** Content rendered inside the sheet */
  children: React.ReactNode;
  /** Preset height (defaults to "half") */
  height?: BottomSheetHeight;
  /** Additional container styles */
  style?: ViewStyle;
  /** If true, tapping the backdrop won't close the sheet */
  persistent?: boolean;
}

// ---------------------------------------------------------------------------
// Height mapping
// ---------------------------------------------------------------------------

const SCREEN_HEIGHT = Dimensions.get("window").height;

const HEIGHT_MAP: Record<BottomSheetHeight, number> = {
  quarter: SCREEN_HEIGHT * 0.25,
  half: SCREEN_HEIGHT * 0.5,
  "three-quarter": SCREEN_HEIGHT * 0.75,
  full: SCREEN_HEIGHT * 0.92,
};

const ANIMATION_DURATION = 300;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BottomSheet: React.FC<BottomSheetProps> = React.memo(
  function BottomSheet({
    visible,
    onClose,
    title,
    children,
    height = "half",
    style,
    persistent = false,
  }) {
    const sheetHeight = HEIGHT_MAP[height];
    const translateY = useSharedValue(sheetHeight);

    useEffect(() => {
      if (visible) {
        translateY.value = withTiming(0, {
          duration: ANIMATION_DURATION,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        translateY.value = withTiming(sheetHeight, {
          duration: ANIMATION_DURATION,
          easing: Easing.in(Easing.cubic),
        });
      }
    }, [visible, sheetHeight, translateY]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
    }));

    const handleBackdropPress = useCallback(() => {
      if (!persistent) {
        onClose();
      }
    }, [persistent, onClose]);

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        {/* Backdrop */}
        <Pressable
          onPress={handleBackdropPress}
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "flex-end",
          }}
        >
          {/* Sheet body — Pressable with no onPress to stop propagation */}
          <Pressable onPress={() => {}}>
            <Animated.View
              style={[
                {
                  backgroundColor: "#1f2937",
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  height: sheetHeight,
                  overflow: "hidden",
                },
                animatedStyle,
                style,
              ]}
            >
              {/* Drag handle indicator */}
              <View style={{ alignItems: "center", paddingTop: 8 }}>
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: "#4b5563",
                  }}
                />
              </View>

              {/* Header */}
              {title && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: "#374151",
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 18,
                      fontWeight: "700",
                    }}
                  >
                    {title}
                  </Text>
                  <Pressable
                    onPress={onClose}
                    hitSlop={12}
                    accessibilityLabel="Close"
                    accessibilityRole="button"
                  >
                    <Text style={{ color: "#9ca3af", fontSize: 22 }}>✕</Text>
                  </Pressable>
                </View>
              )}

              {/* Content */}
              <View style={{ flex: 1, padding: 16 }}>{children}</View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }
);

export default BottomSheet;
