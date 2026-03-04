/**
 * ShiftOpenModal — modal to open a new POS shift.
 * (shift-management tasks 6.2, 8.1)
 *
 * Flow:
 *   1. Staff enters opening float amount (how much cash is in the drawer)
 *   2. Staff enters PIN to authorize the shift
 *   3. On success, calls onShiftOpen with {float, pin}
 *
 * Why validate float before PIN?
 * Float is the most likely entry to be wrong (typo, different denomination).
 * Catching float errors first avoids wasting a PIN verification round-trip.
 *
 * Task 8.1 — Standard float: A configurable default float amount is pre-filled.
 * The user can change it but it saves time for consistent daily opens.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Modal } from "@/components/ui";
import PinEntryPad from "./PinEntryPad";
import { formatCurrency } from "@/utils/formatters";
import { validatePinFormat } from "@/services/shift/ShiftService";

// ---------------------------------------------------------------------------
// Constants — Task 8.1: Standard float configuration
// ---------------------------------------------------------------------------

/**
 * Default opening float amount in ZAR.
 * Standard for most BizPilot clients — configurable via business settings.
 * Pre-filling this saves time on the ~95% of shifts that start with the
 * same float amount.
 */
export const DEFAULT_OPENING_FLOAT = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShiftOpenData {
  /** Opening float amount in ZAR */
  floatAmount: number;
  /** Plain-text PIN — only used for hashing; never stored as-is */
  pin: string;
}

export interface ShiftOpenModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should be dismissed without opening a shift */
  onClose: () => void;
  /**
   * Called when the user has entered a valid float and PIN.
   * The parent component is responsible for the actual shift creation
   * (WatermelonDB write + sync queue) and PIN verification.
   */
  onShiftOpen: (data: ShiftOpenData) => Promise<void>;
  /** Staff member's display name shown in the header */
  staffName?: string;
  /**
   * Pre-configured default float amount for this business/terminal.
   * Defaults to DEFAULT_OPENING_FLOAT if not provided.
   */
  defaultFloat?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Step = "float" | "pin";

const ShiftOpenModal: React.FC<ShiftOpenModalProps> = React.memo(
  function ShiftOpenModal({
    visible,
    onClose,
    onShiftOpen,
    staffName,
    defaultFloat = DEFAULT_OPENING_FLOAT,
  }) {
    const [step, setStep] = useState<Step>("float");
    const [floatInput, setFloatInput] = useState(defaultFloat.toFixed(2));
    const [loading, setLoading] = useState(false);
    const [pinError, setPinError] = useState<string | null>(null);

    // Parse and validate the float amount
    const parsedFloat = parseFloat(floatInput.replace(",", ".")) || 0;
    const floatIsValid = parsedFloat >= 0 && Number.isFinite(parsedFloat);

    const handleFloatNext = useCallback(() => {
      if (!floatIsValid) {
        Alert.alert("Invalid Amount", "Please enter a valid opening float amount.");
        return;
      }
      setStep("pin");
    }, [floatIsValid]);

    const handlePinSubmit = useCallback(
      async (pin: string) => {
        const { valid, error } = validatePinFormat(pin);
        if (!valid) {
          setPinError(error);
          return;
        }

        setLoading(true);
        setPinError(null);
        try {
          await onShiftOpen({ floatAmount: parsedFloat, pin });
          // Reset state on success
          setStep("float");
          setFloatInput(defaultFloat.toFixed(2));
        } catch (err) {
          // Let the parent surface the exact error (invalid PIN, already open, etc.)
          const message =
            err instanceof Error ? err.message : "Could not open shift. Try again.";
          setPinError(message);
        } finally {
          setLoading(false);
        }
      },
      [parsedFloat, defaultFloat, onShiftOpen]
    );

    const handleClose = useCallback(() => {
      // Reset state before closing so it's fresh next time
      setStep("float");
      setFloatInput(defaultFloat.toFixed(2));
      setPinError(null);
      setLoading(false);
      onClose();
    }, [defaultFloat, onClose]);

    const handleBack = useCallback(() => {
      setStep("float");
      setPinError(null);
    }, []);

    return (
      <Modal visible={visible} onClose={handleClose} title="Open Shift">
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ---- Step 1: Float entry ---- */}
          {step === "float" && (
            <View style={styles.section}>
              <View style={styles.iconRow}>
                <Ionicons name="cash-outline" size={40} color="#22c55e" />
              </View>

              {staffName ? (
                <Text style={styles.staffName}>
                  Opening shift for{" "}
                  <Text style={styles.staffNameHighlight}>{staffName}</Text>
                </Text>
              ) : null}

              <Text style={styles.label}>Opening Float Amount</Text>
              <Text style={styles.hint}>
                Enter the cash placed in the drawer before the shift starts.
              </Text>

              {/* Float input */}
              <View style={styles.floatInputRow}>
                <Text style={styles.currencyPrefix}>R</Text>
                <TextInput
                  style={styles.floatInput}
                  value={floatInput}
                  onChangeText={setFloatInput}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  maxLength={10}
                  placeholder="0.00"
                  placeholderTextColor="#6b7280"
                  accessibilityLabel="Opening float amount"
                />
              </View>

              {/* Quick float presets */}
              <View style={styles.presetRow}>
                {[200, 500, 1000, 2000].map((preset) => (
                  <Pressable
                    key={preset}
                    style={[
                      styles.presetButton,
                      parsedFloat === preset && styles.presetButtonActive,
                    ]}
                    onPress={() => setFloatInput(preset.toFixed(2))}
                    accessibilityLabel={`Set float to R${preset}`}
                  >
                    <Text
                      style={[
                        styles.presetButtonText,
                        parsedFloat === preset && styles.presetButtonTextActive,
                      ]}
                    >
                      {formatCurrency(preset)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[
                  styles.primaryButton,
                  !floatIsValid && styles.buttonDisabled,
                ]}
                onPress={handleFloatNext}
                disabled={!floatIsValid}
                accessibilityLabel="Continue to PIN entry"
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>Continue →</Text>
              </Pressable>
            </View>
          )}

          {/* ---- Step 2: PIN entry ---- */}
          {step === "pin" && (
            <View style={styles.section}>
              <View style={styles.floatSummaryBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                <Text style={styles.floatSummaryText}>
                  Float: {formatCurrency(parsedFloat)}
                </Text>
                <Pressable onPress={handleBack} accessibilityLabel="Change float">
                  <Text style={styles.changeLink}>Change</Text>
                </Pressable>
              </View>

              <PinEntryPad
                title="Enter Your PIN"
                subtitle="Authorize shift opening"
                onSubmit={handlePinSubmit}
                onCancel={handleClose}
                loading={loading}
                error={pinError}
              />
            </View>
          )}
        </ScrollView>
      </Modal>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: "center",
  },
  iconRow: {
    marginBottom: 12,
  },
  staffName: {
    fontSize: 15,
    color: "#9ca3af",
    marginBottom: 16,
    textAlign: "center",
  },
  staffNameHighlight: {
    color: "#f3f4f6",
    fontWeight: "600",
  },
  label: {
    fontSize: 17,
    fontWeight: "600",
    color: "#f3f4f6",
    marginBottom: 6,
    alignSelf: "flex-start",
  },
  hint: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 16,
    alignSelf: "flex-start",
  },

  // Float input
  floatInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 16,
    marginBottom: 16,
    width: "100%",
  },
  currencyPrefix: {
    fontSize: 22,
    color: "#9ca3af",
    marginRight: 8,
  },
  floatInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
    color: "#f3f4f6",
    paddingVertical: 14,
  },

  // Preset buttons
  presetRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  presetButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#374151",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  presetButtonActive: {
    borderColor: "#3b82f6",
    backgroundColor: "#1d4ed8",
  },
  presetButtonText: {
    fontSize: 14,
    color: "#d1d5db",
    fontWeight: "500",
  },
  presetButtonTextActive: {
    color: "#ffffff",
  },

  // Float summary banner (shown on PIN step)
  floatSummaryBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#065f46",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
    alignSelf: "stretch",
  },
  floatSummaryText: {
    flex: 1,
    color: "#d1fae5",
    fontSize: 15,
    fontWeight: "600",
  },
  changeLink: {
    color: "#34d399",
    fontSize: 14,
    fontWeight: "500",
  },

  // Primary action
  primaryButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default ShiftOpenModal;
