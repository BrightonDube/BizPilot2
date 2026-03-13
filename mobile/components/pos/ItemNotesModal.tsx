/**
 * BizPilot Mobile POS — ItemNotesModal Component
 *
 * Allows staff to add or edit notes for a specific cart item
 * (e.g., "no onions", "extra sauce", "allergy: peanuts").
 *
 * Why a separate modal instead of inline editing?
 * Cart items are compact rows — an inline TextInput would make
 * the cart panel jumpy on every edit. A modal gives the staff
 * member a full-size keyboard and focused editing experience.
 * It also prevents accidental taps on other cart items.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Modal, Button } from "@/components/ui";

// ---------------------------------------------------------------------------
// Common quick notes for hospitality POS
// ---------------------------------------------------------------------------

/**
 * Quick-tap note chips. These are the most common kitchen/bar notes
 * in South African hospitality. Staff can tap to append, or type custom.
 */
const QUICK_NOTES = [
  "No ice",
  "Extra sauce",
  "No onions",
  "Gluten free",
  "Dairy free",
  "Spicy",
  "Mild",
  "Well done",
  "Medium rare",
  "Take away",
  "Allergy",
  "No salt",
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ItemNotesModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Product name (displayed in header) */
  productName: string;
  /** Current notes value */
  currentNotes: string | null;
  /** Called when notes are saved */
  onSave: (notes: string | null) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ItemNotesModal: React.FC<ItemNotesModalProps> = React.memo(
  function ItemNotesModal({
    visible,
    onClose,
    productName,
    currentNotes,
    onSave,
  }) {
    const [notes, setNotes] = useState(currentNotes ?? "");
    const inputRef = useRef<TextInput>(null);

    // Sync state when modal opens with different item
    useEffect(() => {
      if (visible) {
        setNotes(currentNotes ?? "");
        // Auto-focus input after modal animation (slight delay needed)
        setTimeout(() => inputRef.current?.focus(), 300);
      }
    }, [visible, currentNotes]);

    const handleQuickNote = useCallback((quickNote: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNotes((prev) => {
        if (!prev.trim()) return quickNote;
        // Append with comma separator if there's existing text
        return `${prev}, ${quickNote}`;
      });
    }, []);

    const handleSave = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const trimmed = notes.trim();
      onSave(trimmed.length > 0 ? trimmed : null);
      onClose();
    }, [notes, onSave, onClose]);

    const handleClear = useCallback(() => {
      setNotes("");
    }, []);

    return (
      <Modal visible={visible} onClose={onClose} title={`Notes — ${productName}`}>
        <View style={styles.container}>
          {/* Text input */}
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add special instructions..."
            placeholderTextColor="#6b7280"
            multiline
            maxLength={200}
            numberOfLines={3}
            textAlignVertical="top"
            accessibilityLabel={`Notes for ${productName}`}
          />

          {/* Character count */}
          <Text style={styles.charCount}>{notes.length}/200</Text>

          {/* Quick note chips */}
          <Text style={styles.quickLabel}>Quick Add:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
          >
            {QUICK_NOTES.map((quickNote) => (
              <Pressable
                key={quickNote}
                onPress={() => handleQuickNote(quickNote)}
                style={styles.chip}
                accessibilityLabel={`Add note: ${quickNote}`}
              >
                <Text style={styles.chipText}>{quickNote}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable onPress={handleClear} style={styles.clearButton}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
            <Button label="Save Notes" onPress={handleSave} size="lg" />
          </View>
        </View>
      </Modal>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  textInput: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 16,
    minHeight: 80,
    maxHeight: 120,
  },
  charCount: {
    color: "#6b7280",
    fontSize: 12,
    textAlign: "right",
  },
  quickLabel: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "500",
  },
  chipsContainer: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    backgroundColor: "#374151",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    color: "#d1d5db",
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearText: {
    color: "#6b7280",
    fontSize: 14,
  },
});

export default ItemNotesModal;
