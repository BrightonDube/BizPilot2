/**
 * BizPilot Mobile POS — Modal Component
 *
 * Full-screen modal with dark overlay. Used for payment,
 * customer search, and product detail.
 */

import React from "react";
import {
  Modal as RNModal,
  View,
  Pressable,
  Text,
  SafeAreaView,
  type ViewStyle,
} from "react-native";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

const Modal: React.FC<ModalProps> = React.memo(function Modal({
  visible,
  onClose,
  title,
  children,
  style,
}) {
  return (
    <RNModal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <SafeAreaView
          style={[
            {
              backgroundColor: "#1f2937",
              borderRadius: 16,
              width: "90%",
              maxHeight: "85%",
              overflow: "hidden",
            },
            style,
          ]}
        >
          {/* Header with close button */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
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
              {title ?? ""}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel="Close modal"
              accessibilityRole="button"
            >
              <Text style={{ color: "#9ca3af", fontSize: 24 }}>✕</Text>
            </Pressable>
          </View>

          {/* Content */}
          <View style={{ padding: 16 }}>{children}</View>
        </SafeAreaView>
      </View>
    </RNModal>
  );
});

export default Modal;
