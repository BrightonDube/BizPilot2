/**
 * BizPilot Mobile POS — SwipeableCartItem Component
 *
 * Wraps the CartItem component with swipe-to-delete gesture support
 * using react-native-gesture-handler's Swipeable API.
 *
 * Why a separate wrapper instead of modifying CartItem directly?
 * CartItem is a pure presentational component that doesn't depend on
 * gesture-handler. Keeping swipe logic in a wrapper means CartItem
 * can be used in non-swipeable contexts (e.g., receipt preview,
 * held cart summary) without pulling in the gesture dependency.
 *
 * Why Swipeable from gesture-handler instead of Animated PanResponder?
 * Swipeable handles the physics (spring, overshoot, snap-back) and
 * accessibility (it exposes the action as an accessible action)
 * out of the box. PanResponder would require ~100 lines of manual
 * animation logic that's error-prone on different devices.
 */

import React, { useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import CartItem from "./CartItem";
import type { CartItemProps } from "./CartItem";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SwipeableCartItemProps extends CartItemProps {
  /**
   * Whether swipe-to-delete is enabled.
   * Disabled in read-only contexts like receipt previews.
   */
  swipeEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SwipeableCartItem: React.FC<SwipeableCartItemProps> = React.memo(
  function SwipeableCartItem({ swipeEnabled = true, ...cartItemProps }) {
    const swipeableRef = useRef<Swipeable>(null);

    const handleSwipeDelete = useCallback(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      cartItemProps.onRemove(cartItemProps.item.productId);
    }, [cartItemProps]);

    /**
     * Renders the action shown behind the cart item when swiped right-to-left.
     * Uses Animated.View for the background delete action.
     *
     * Why right swipe (from the right side)?
     * The delete action on right-swipe is the established iOS/Android pattern.
     * Swiping from the left is typically for secondary actions.
     */
    const renderRightActions = useCallback(
      (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
      ) => {
        const opacity = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        });

        const translateX = dragX.interpolate({
          inputRange: [-80, 0],
          outputRange: [0, 80],
          extrapolate: "clamp",
        });

        return (
          <Animated.View
            style={[styles.deleteAction, { opacity, transform: [{ translateX }] }]}
          >
            <Pressable
              onPress={handleSwipeDelete}
              style={styles.deleteButton}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${cartItemProps.item.productName}`}
            >
              <Ionicons name="trash" size={20} color="#ffffff" />
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </Animated.View>
        );
      },
      [handleSwipeDelete, cartItemProps.item.productName]
    );

    /**
     * Called when swipe passes the activation threshold.
     * Provides haptic feedback to confirm the swipe was registered.
     */
    const handleSwipeOpen = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, []);

    if (!swipeEnabled) {
      return <CartItem {...cartItemProps} />;
    }

    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        onSwipeableOpen={handleSwipeOpen}
        rightThreshold={40}
        overshootRight={false}
        friction={2}
        containerStyle={styles.swipeableContainer}
      >
        <CartItem {...cartItemProps} />
      </Swipeable>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  swipeableContainer: {
    backgroundColor: "#111827",
  },
  deleteAction: {
    width: 80,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ef4444",
  },
  deleteButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  deleteText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
});

export default SwipeableCartItem;
