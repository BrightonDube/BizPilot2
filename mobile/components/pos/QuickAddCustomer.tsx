/**
 * BizPilot Mobile POS — QuickAddCustomer Component
 *
 * A minimal customer creation form accessible from the CustomerSelector.
 * Collects only the essentials: name, phone, email.
 *
 * Why a separate "quick add" instead of the full customer form?
 * During a busy service, the cashier doesn't have time for a full
 * customer profile. This captures just enough to link the sale to
 * a customer record. The full profile can be completed later from
 * the Customers tab.
 *
 * Why validate phone format?
 * South African mobile numbers follow specific patterns (07x, 08x).
 * Catching obvious typos here prevents sync issues later.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Modal, Button } from "@/components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuickCustomerData {
  name: string;
  phone: string | null;
  email: string | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QuickAddCustomerProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Called when the customer is saved successfully */
  onSave: (customer: QuickCustomerData) => void;
  /** Whether the save is in progress (shows loading state) */
  isSaving?: boolean;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validates a South African phone number (basic check).
 * Accepts: 0712345678, +27712345678, 27712345678
 */
function isValidSAPhone(phone: string): boolean {
  if (phone.length === 0) return true; // Optional field
  const cleaned = phone.replace(/[\s-]/g, "");
  return /^(\+?27|0)\d{9}$/.test(cleaned);
}

/** Basic email validation */
function isValidEmail(email: string): boolean {
  if (email.length === 0) return true; // Optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const QuickAddCustomer: React.FC<QuickAddCustomerProps> = React.memo(
  function QuickAddCustomer({ visible, onClose, onSave, isSaving = false }) {
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const nameRef = useRef<TextInput>(null);

    // Reset and focus when modal opens
    useEffect(() => {
      if (visible) {
        setName("");
        setPhone("");
        setEmail("");
        setTimeout(() => nameRef.current?.focus(), 300);
      }
    }, [visible]);

    const handleSave = useCallback(() => {
      const trimmedName = name.trim();

      // Validate
      if (trimmedName.length < 2) {
        Alert.alert("Name Required", "Please enter a customer name (at least 2 characters).");
        return;
      }
      if (!isValidSAPhone(phone.trim())) {
        Alert.alert("Invalid Phone", "Please enter a valid South African phone number.");
        return;
      }
      if (!isValidEmail(email.trim())) {
        Alert.alert("Invalid Email", "Please enter a valid email address.");
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSave({
        name: trimmedName,
        phone: phone.trim() || null,
        email: email.trim() || null,
      });
    }, [name, phone, email, onSave]);

    return (
      <Modal visible={visible} onClose={onClose} title="Quick Add Customer">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.container}>
            {/* Name (required) */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                ref={nameRef}
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Customer name"
                placeholderTextColor="#6b7280"
                autoCapitalize="words"
                returnKeyType="next"
                maxLength={100}
                accessibilityLabel="Customer name"
              />
            </View>

            {/* Phone (optional) */}
            <View style={styles.field}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="071 234 5678"
                placeholderTextColor="#6b7280"
                keyboardType="phone-pad"
                returnKeyType="next"
                maxLength={15}
                accessibilityLabel="Customer phone number"
              />
            </View>

            {/* Email (optional) */}
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="customer@example.com"
                placeholderTextColor="#6b7280"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="done"
                maxLength={150}
                accessibilityLabel="Customer email"
              />
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                label="Cancel"
                onPress={onClose}
                variant="secondary"
                size="sm"
              />
              <Button
                label={isSaving ? "Saving..." : "Add Customer"}
                onPress={handleSave}
                disabled={isSaving || name.trim().length < 2}
                size="lg"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  field: {
    gap: 6,
  },
  label: {
    color: "#d1d5db",
    fontSize: 14,
    fontWeight: "600",
  },
  required: {
    color: "#ef4444",
  },
  input: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 8,
    padding: 12,
    color: "#ffffff",
    fontSize: 16,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
});

export default QuickAddCustomer;
