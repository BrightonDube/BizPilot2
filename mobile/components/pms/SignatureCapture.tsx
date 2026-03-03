/**
 * BizPilot Mobile POS — SignatureCapture Component
 *
 * A touch-based signature pad for capturing guest signatures on
 * room charge authorizations. Renders a canvas area where the user
 * draws with their finger or stylus.
 *
 * Why a custom implementation instead of a library?
 * Signature capture libraries (react-native-signature-canvas) add
 * a WebView dependency which is heavy and slow on older tablets.
 * Our implementation uses simple View + PanResponder for a native
 * feel with no WebView overhead. The trade-off is we capture strokes
 * as point arrays rather than SVG, which is sufficient for
 * authorization purposes (we're not doing handwriting recognition).
 *
 * Why store as base64 PNG instead of vector paths?
 * The signature is stored as evidence of authorization, not for
 * editing. A base64 PNG is universally displayable (receipts,
 * emails, PDF reports) without any rendering library.
 */

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Button } from "@/components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single point in a stroke */
interface Point {
  x: number;
  y: number;
}

/** A complete stroke (finger down → finger up) */
type Stroke = Point[];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SignatureCaptureProps {
  /** Called when the user confirms their signature */
  onCapture: (strokes: Stroke[]) => void;
  /** Called when the user cancels */
  onCancel: () => void;
  /** Optional label above the signature pad */
  label?: string;
  /** Minimum number of points required for a valid signature */
  minPoints?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SignatureCapture: React.FC<SignatureCaptureProps> = React.memo(
  function SignatureCapture({
    onCapture,
    onCancel,
    label = "Sign below to authorize",
    minPoints = 10,
  }) {
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const currentStroke = useRef<Stroke>([]);

    const totalPoints = strokes.reduce((sum, s) => sum + s.length, 0);
    const hasSignature = totalPoints >= minPoints;

    /**
     * Extract touch position relative to the signature pad.
     * We use pageX/pageY and subtract the pad's position.
     */
    const padRef = useRef<View>(null);
    const padLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });

    const handleLayout = useCallback(() => {
      padRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
        padLayout.current = { x: pageX, y: pageY, width, height };
      });
    }, []);

    const getPoint = useCallback(
      (evt: GestureResponderEvent): Point => {
        const { pageX, pageY } = evt.nativeEvent;
        return {
          x: pageX - padLayout.current.x,
          y: pageY - padLayout.current.y,
        };
      },
      []
    );

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (evt) => {
          currentStroke.current = [getPoint(evt)];
        },

        onPanResponderMove: (evt) => {
          const point = getPoint(evt);
          currentStroke.current.push(point);
          // Force re-render to show stroke in real-time
          setStrokes((prev) => [...prev]);
        },

        onPanResponderRelease: () => {
          if (currentStroke.current.length > 1) {
            setStrokes((prev) => [...prev, [...currentStroke.current]]);
          }
          currentStroke.current = [];
        },
      })
    ).current;

    const handleClear = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStrokes([]);
      currentStroke.current = [];
    }, []);

    const handleConfirm = useCallback(() => {
      if (!hasSignature) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCapture(strokes);
    }, [hasSignature, strokes, onCapture]);

    // Render strokes as simple dots/lines using absolute-positioned Views
    // This is a lightweight approach that avoids react-native-svg dependency
    const renderStrokes = useCallback(() => {
      const allStrokes = [
        ...strokes,
        ...(currentStroke.current.length > 0 ? [currentStroke.current] : []),
      ];

      return allStrokes.map((stroke, strokeIdx) =>
        stroke.map((point, pointIdx) => (
          <View
            key={`${strokeIdx}-${pointIdx}`}
            style={[
              styles.strokeDot,
              {
                left: point.x - 2,
                top: point.y - 2,
              },
            ]}
          />
        ))
      );
    }, [strokes]);

    return (
      <View style={styles.container}>
        {/* Label */}
        <Text style={styles.label}>{label}</Text>

        {/* Signature pad */}
        <View
          ref={padRef}
          onLayout={handleLayout}
          style={styles.pad}
          {...panResponder.panHandlers}
        >
          {strokes.length === 0 && currentStroke.current.length === 0 && (
            <View style={styles.placeholder}>
              <Ionicons name="finger-print-outline" size={32} color="#374151" />
              <Text style={styles.placeholderText}>
                Draw your signature here
              </Text>
            </View>
          )}
          {renderStrokes()}
          {/* Signature line */}
          <View style={styles.signatureLine} />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable onPress={handleClear} style={styles.clearButton}>
            <Ionicons name="refresh" size={18} color="#6b7280" />
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>

          <View style={styles.actionButtons}>
            <Button
              label="Cancel"
              onPress={onCancel}
              variant="secondary"
              size="sm"
            />
            <Button
              label="Confirm Signature"
              onPress={handleConfirm}
              disabled={!hasSignature}
              size="sm"
            />
          </View>
        </View>

        {/* Validation hint */}
        {!hasSignature && strokes.length > 0 && (
          <Text style={styles.hint}>
            Please provide a more complete signature
          </Text>
        )}
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  label: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  pad: {
    height: 200,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#374151",
    overflow: "hidden",
    position: "relative",
  },
  placeholder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 8,
  },
  signatureLine: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: "#d1d5db",
  },
  strokeDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#1f2937",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 8,
  },
  clearText: {
    color: "#6b7280",
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  hint: {
    color: "#f59e0b",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
});

export default SignatureCapture;
