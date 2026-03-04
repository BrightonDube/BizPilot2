/**
 * CashMovementModal — record mid-shift cash movements (task 4.4, 6.4).
 *
 * Handles three movement types:
 *   - drop    : Mid-shift cash removal to safe (reduces expected drawer)
 *   - paidout : Petty cash payment to a supplier (reduces expected drawer)
 *   - payin   : Cash added to drawer (top-up float, etc.)
 *
 * Why combine all three types in one modal?
 * In a busy POS shift, staff switch rapidly between movement types. A single
 * modal with a type selector reduces the number of screens and navigation
 * steps. Each type is clearly labelled and colour-coded to prevent errors.
 *
 * Why require a note for drops/paidouts but not pay-ins?
 * Cash removed from the drawer MUST have an audit trail for end-of-day
 * reconciliation. Cash added (pay-ins) is also audited but is typically
 * routine (e.g., "float top-up").
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { Modal } from "@/components/ui";
import { formatCurrency } from "@/utils/formatters";
import type { ShiftCashEventType } from "@/services/shift/ShiftService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CashMovementType = "drop" | "paidout" | "payin";

export interface CashMovementData {
  type: CashMovementType;
  amount: number;
  note: string;
}

export interface CashMovementModalProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Called when the user confirms the movement.
   * Parent writes to WatermelonDB and updates the shift's cash events.
   */
  onConfirm: (data: CashMovementData) => Promise<void>;
  /** Current expected balance in the drawer — used to validate drops/paidouts */
  currentBalance: number;
  /** Pre-select a movement type (default: "drop") */
  initialType?: CashMovementType;
}

// ---------------------------------------------------------------------------
// Movement type metadata
// ---------------------------------------------------------------------------

interface MovementTypeMeta {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  description: string;
  noteRequired: boolean;
  notePlaceholder: string;
}

const MOVEMENT_TYPES: Record<CashMovementType, MovementTypeMeta> = {
  drop: {
    label: "Cash Drop",
    icon: "arrow-down-circle-outline",
    color: "#f59e0b",
    bg: "#78350f",
    description: "Remove cash from drawer to the safe",
    noteRequired: true,
    notePlaceholder: "e.g., Drop to safe — midshift",
  },
  paidout: {
    label: "Paid Out",
    icon: "exit-outline",
    color: "#ef4444",
    bg: "#7f1d1d",
    description: "Petty cash payment to supplier or expense",
    noteRequired: true,
    notePlaceholder: "e.g., Groceries — John's Wholesaler",
  },
  payin: {
    label: "Pay In",
    icon: "enter-outline",
    color: "#22c55e",
    bg: "#064e3b",
    description: "Add cash to drawer (float top-up, etc.)",
    noteRequired: false,
    notePlaceholder: "e.g., Float top-up",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CashMovementModal: React.FC<CashMovementModalProps> = React.memo(
  function CashMovementModal({
    visible,
    onClose,
    onConfirm,
    currentBalance,
    initialType = "drop",
  }) {
    const [movementType, setMovementType] = useState<CashMovementType>(initialType);
    const [amountInput, setAmountInput] = useState("");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const meta = MOVEMENT_TYPES[movementType];
    const parsedAmount = parseFloat(amountInput.replace(",", ".")) || 0;

    // Validation
    const validate = useCallback((): string | null => {
      if (parsedAmount <= 0) return "Amount must be greater than R0.00";
      if (meta.noteRequired && !note.trim()) {
        return `A note is required for ${meta.label}`;
      }
      // Prevent drops/paidouts that exceed the drawer balance
      if ((movementType === "drop" || movementType === "paidout") &&
          parsedAmount > currentBalance) {
        return `Amount exceeds drawer balance of ${formatCurrency(currentBalance)}`;
      }
      return null;
    }, [parsedAmount, note, meta, movementType, currentBalance]);

    const handleConfirm = useCallback(async () => {
      const validationError = validate();
      if (validationError) {
        setError(validationError);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        await onConfirm({
          type: movementType,
          amount: parsedAmount,
          note: note.trim() || `${meta.label} — manual entry`,
        });
        // Reset on success
        setAmountInput("");
        setNote("");
        setError(null);
        onClose();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not record movement. Try again.";
        setError(message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setLoading(false);
      }
    }, [validate, movementType, parsedAmount, note, meta, onConfirm, onClose]);

    const handleTypeSelect = useCallback((type: CashMovementType) => {
      setMovementType(type);
      setAmountInput("");
      setNote("");
      setError(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const handleClose = useCallback(() => {
      setAmountInput("");
      setNote("");
      setError(null);
      setLoading(false);
      onClose();
    }, [onClose]);

    return (
      <Modal visible={visible} onClose={handleClose} title="Cash Movement">
        <View style={styles.container}>
          {/* Type selector tabs */}
          <View style={styles.typeTabs}>
            {(Object.entries(MOVEMENT_TYPES) as [CashMovementType, MovementTypeMeta][]).map(
              ([type, typeMeta]) => (
                <Pressable
                  key={type}
                  style={[
                    styles.typeTab,
                    movementType === type && {
                      backgroundColor: typeMeta.bg,
                      borderColor: typeMeta.color,
                    },
                  ]}
                  onPress={() => handleTypeSelect(type)}
                  accessibilityLabel={typeMeta.label}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={typeMeta.icon}
                    size={22}
                    color={movementType === type ? typeMeta.color : "#6b7280"}
                  />
                  <Text
                    style={[
                      styles.typeTabText,
                      movementType === type && { color: typeMeta.color },
                    ]}
                  >
                    {typeMeta.label}
                  </Text>
                </Pressable>
              )
            )}
          </View>

          {/* Description */}
          <Text style={styles.description}>{meta.description}</Text>

          {/* Balance info (for drops/paidouts) */}
          {(movementType === "drop" || movementType === "paidout") && (
            <View style={styles.balanceBanner}>
              <Text style={styles.balanceText}>
                Drawer balance: {formatCurrency(currentBalance)}
              </Text>
            </View>
          )}

          {/* Amount input */}
          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountInputRow}>
            <Text style={styles.currencyPrefix}>R</Text>
            <TextInput
              style={styles.amountInput}
              value={amountInput}
              onChangeText={(v) => { setAmountInput(v); setError(null); }}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#6b7280"
              selectTextOnFocus
              maxLength={10}
              accessibilityLabel="Cash amount"
            />
          </View>

          {/* Note */}
          <Text style={styles.label}>
            Note{meta.noteRequired ? " *" : " (optional)"}
          </Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={(v) => { setNote(v); setError(null); }}
            placeholder={meta.notePlaceholder}
            placeholderTextColor="#6b7280"
            maxLength={120}
            accessibilityLabel="Movement note"
          />

          {/* Error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Confirm button */}
          <Pressable
            style={[
              styles.confirmButton,
              { backgroundColor: meta.color },
              (loading || parsedAmount <= 0) && styles.buttonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={loading || parsedAmount <= 0}
            accessibilityLabel={`Confirm ${meta.label}`}
            accessibilityRole="button"
          >
            <Ionicons name={meta.icon} size={20} color="#ffffff" />
            <Text style={styles.confirmButtonText}>
              {loading ? "Recording…" : `Record ${meta.label}`}
            </Text>
          </Pressable>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
  },

  // Type tabs
  typeTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  typeTab: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#374151",
    backgroundColor: "#1f2937",
    paddingVertical: 12,
    alignItems: "center",
    gap: 6,
  },
  typeTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },

  // Description
  description: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 16,
    textAlign: "center",
  },

  // Balance banner
  balanceBanner: {
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    alignItems: "center",
  },
  balanceText: {
    fontSize: 14,
    color: "#9ca3af",
  },

  // Input
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#d1d5db",
    marginBottom: 8,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  currencyPrefix: {
    fontSize: 22,
    color: "#9ca3af",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 26,
    fontWeight: "700",
    color: "#f3f4f6",
    paddingVertical: 12,
  },
  noteInput: {
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    padding: 14,
    fontSize: 15,
    color: "#f3f4f6",
    marginBottom: 16,
  },

  // Error
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },

  // Confirm button
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    marginTop: 4,
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default CashMovementModal;
