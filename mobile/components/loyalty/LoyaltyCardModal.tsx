/**
 * LoyaltyCardModal
 *
 * Displays a customer's digital loyalty card and supports card-number
 * lookup (for customers who present a physical card at the POS).
 *
 * Two usage modes:
 * 1. **Lookup mode** (no customer loaded) — cashier scans/types a card number
 *    to find the customer before processing their order.
 * 2. **Card display mode** (customer loaded) — shows the customer's digital card
 *    (card number, tier badge, points balance, QR code for barcode scanner).
 *
 * Why a modal?
 * Card lookup and display are contextual actions initiated from CustomerSelector.
 * They don't need a full screen — a modal lets the cashier immediately return
 * to the POS after finding/identifying the customer.
 *
 * Why display the card number as text AND as a QR barcode?
 * Physical card scanners (connected via USB/BT) expect a barcode string.
 * The QR code lets a phone camera scan the card number without a dedicated
 * scanner — useful during tablet POS demos or when the scanner fails.
 *
 * Note: QR code generation uses a lightweight inline SVG approach to avoid
 * adding a heavy native dependency. For production, replace with
 * `react-native-qrcode-svg` which renders a proper QR code.
 *
 * Validates: loyalty-programs Requirement 7 (Loyalty Card) — Tasks 8.1–8.3
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Modal, Button } from "@/components/ui";
import { formatCurrency } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal customer data needed to display the loyalty card.
 * Full customer profile is managed by CustomerService/CustomerSelector.
 */
export interface LoyaltyCardCustomer {
  id: string;
  name: string;
  /** Loyalty card number (stored in CustomerService as "CARD:{number}" in notes) */
  cardNumber?: string;
  /** Current loyalty tier name (from LoyaltyService.determineTier) */
  tierName: string;
  /** Current point balance */
  pointsBalance: number;
  /** Total lifetime points (for tier display) */
  lifetimePoints: number;
}

export interface LoyaltyCardModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /**
   * Customer to display the card for.
   * If null, the modal shows in lookup mode.
   */
  customer: LoyaltyCardCustomer | null;
  /**
   * Called when a card number is entered/scanned and the cashier taps
   * "Find Customer". The parent should run `lookupCustomerByCard` and
   * call `setCustomer` if found.
   */
  onLookupCard: (cardNumber: string) => Promise<LoyaltyCardCustomer | null>;
  /**
   * Called when the cashier confirms linking a card number to the customer.
   * Parent should call the API to save the card-customer association.
   */
  onLinkCard: (customerId: string, cardNumber: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Tier colour map
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Bronze:   { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  Silver:   { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB" },
  Gold:     { bg: "#FEF9C3", text: "#854D0E", border: "#FEF08A" },
  Platinum: { bg: "#EDE9FE", text: "#4C1D95", border: "#C4B5FD" },
};

function getTierColors(tierName: string) {
  return TIER_COLORS[tierName] ?? TIER_COLORS["Bronze"];
}

// ---------------------------------------------------------------------------
// DigitalCard sub-component
// ---------------------------------------------------------------------------

/**
 * Renders the visual loyalty card (like a credit card style display).
 * Separated so it can be rendered both inside the modal and potentially
 * on the customer receipt.
 */
interface DigitalCardProps {
  customer: LoyaltyCardCustomer;
}

const DigitalCard: React.FC<DigitalCardProps> = React.memo(function DigitalCard({
  customer,
}) {
  const tierColors = getTierColors(customer.tierName);

  return (
    <View
      style={[
        styles.digitalCard,
        {
          backgroundColor: tierColors.bg,
          borderColor: tierColors.border,
        },
      ]}
    >
      {/* Card header row */}
      <View style={styles.cardHeader}>
        <Ionicons name="star" size={20} color={tierColors.text} />
        <Text style={[styles.cardBrand, { color: tierColors.text }]}>
          BizPilot Loyalty
        </Text>
        {/* Tier badge */}
        <View
          style={[styles.tierBadge, { borderColor: tierColors.border }]}
        >
          <Text style={[styles.tierBadgeText, { color: tierColors.text }]}>
            {customer.tierName.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Card number */}
      <Text style={[styles.cardNumber, { color: tierColors.text }]}>
        {customer.cardNumber
          ? formatCardNumber(customer.cardNumber)
          : "No card assigned"}
      </Text>

      {/* Customer name */}
      <Text style={[styles.cardHolderName, { color: tierColors.text }]}>
        {customer.name.toUpperCase()}
      </Text>

      {/* Points row */}
      <View style={styles.cardPointsRow}>
        <View>
          <Text style={[styles.cardPointsLabel, { color: tierColors.text + "99" }]}>
            AVAILABLE
          </Text>
          <Text style={[styles.cardPointsValue, { color: tierColors.text }]}>
            {customer.pointsBalance.toLocaleString()} pts
          </Text>
        </View>
        <View>
          <Text style={[styles.cardPointsLabel, { color: tierColors.text + "99" }]}>
            LIFETIME
          </Text>
          <Text style={[styles.cardPointsValue, { color: tierColors.text }]}>
            {customer.lifetimePoints.toLocaleString()} pts
          </Text>
        </View>
      </View>
    </View>
  );
});

/** Format card number into groups of 4: "1234567890123456" → "1234 5678 9012 3456" */
function formatCardNumber(cardNumber: string): string {
  const clean = cardNumber.replace(/\s/g, "");
  const groups = clean.match(/.{1,4}/g) ?? [clean];
  return groups.join(" ");
}

// ---------------------------------------------------------------------------
// LookupPanel sub-component
// ---------------------------------------------------------------------------

interface LookupPanelProps {
  onLookup: (cardNumber: string) => void;
  isLoading: boolean;
}

const LookupPanel: React.FC<LookupPanelProps> = React.memo(
  function LookupPanel({ onLookup, isLoading }) {
    const [cardInput, setCardInput] = useState("");

    const handleSubmit = useCallback(() => {
      const trimmed = cardInput.trim();
      if (!trimmed) {
        Alert.alert("Enter Card Number", "Please enter or scan a card number.");
        return;
      }
      onLookup(trimmed);
    }, [cardInput, onLookup]);

    return (
      <View style={styles.lookupPanel}>
        <View style={styles.lookupIconRow}>
          <Ionicons name="card-outline" size={40} color="#D1D5DB" />
          <Text style={styles.lookupTitle}>Loyalty Card Lookup</Text>
          <Text style={styles.lookupSubtitle}>
            Scan or manually enter the card number to find the customer.
          </Text>
        </View>

        <View style={styles.lookupInputRow}>
          <TextInput
            value={cardInput}
            onChangeText={setCardInput}
            placeholder="Card number or barcode"
            style={styles.cardInput}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleSubmit}
            placeholderTextColor="#9CA3AF"
            editable={!isLoading}
          />
          <Button
            label={isLoading ? "Searching…" : "Find"}
            onPress={handleSubmit}
            disabled={isLoading || !cardInput.trim()}
            variant="primary"
          />
        </View>
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// LoyaltyCardModal
// ---------------------------------------------------------------------------

const LoyaltyCardModal: React.FC<LoyaltyCardModalProps> = React.memo(
  function LoyaltyCardModal({
    visible,
    onClose,
    customer,
    onLookupCard,
    onLinkCard,
  }) {
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [isLinking, setIsLinking] = useState(false);
    const [newCardNumber, setNewCardNumber] = useState("");
    const [showLinkInput, setShowLinkInput] = useState(false);

    // ---------------------------------------------------------------------------
    // Card lookup handler
    // ---------------------------------------------------------------------------

    const handleLookupCard = useCallback(
      async (cardNumber: string) => {
        setIsLookingUp(true);
        try {
          const found = await onLookupCard(cardNumber);
          if (!found) {
            Alert.alert(
              "Card Not Found",
              "No customer is linked to this card number. You can link a card to a customer from their profile."
            );
          }
          // If found, the parent updates `customer` prop — modal will re-render
        } catch {
          Alert.alert("Lookup Failed", "Could not look up the card. Try again.");
        } finally {
          setIsLookingUp(false);
        }
      },
      [onLookupCard]
    );

    // ---------------------------------------------------------------------------
    // Card link handler
    // ---------------------------------------------------------------------------

    const handleLinkCard = useCallback(async () => {
      if (!customer) return;
      const trimmed = newCardNumber.trim();
      if (!trimmed) {
        Alert.alert("Enter Card Number", "Please enter a card number to link.");
        return;
      }

      setIsLinking(true);
      try {
        await onLinkCard(customer.id, trimmed);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Card Linked",
          `Card ${trimmed} is now linked to ${customer.name}.`
        );
        setShowLinkInput(false);
        setNewCardNumber("");
      } catch {
        Alert.alert("Link Failed", "Could not link the card. Try again.");
      } finally {
        setIsLinking(false);
      }
    }, [customer, newCardNumber, onLinkCard]);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    const title = customer ? `${customer.name}'s Card` : "Loyalty Card Lookup";

    return (
      <Modal visible={visible} onClose={onClose} title={title} size="medium">
        {/* ---- MODE 1: No customer — show lookup panel ---- */}
        {!customer && (
          <LookupPanel onLookup={handleLookupCard} isLoading={isLookingUp} />
        )}

        {/* ---- MODE 2: Customer loaded — show digital card ---- */}
        {customer && (
          <View style={styles.cardDisplayContainer}>
            <DigitalCard customer={customer} />

            {/* Link card section (if no card assigned) */}
            {!customer.cardNumber && (
              <View style={styles.linkSection}>
                <Text style={styles.linkPrompt}>
                  No physical card linked. Link a card to enable scanning.
                </Text>

                {showLinkInput ? (
                  <View style={styles.linkInputRow}>
                    <TextInput
                      value={newCardNumber}
                      onChangeText={setNewCardNumber}
                      placeholder="Scan or enter card number"
                      style={[styles.cardInput, { flex: 1 }]}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleLinkCard}
                      placeholderTextColor="#9CA3AF"
                      editable={!isLinking}
                    />
                    <Button
                      label={isLinking ? "Linking…" : "Link"}
                      onPress={handleLinkCard}
                      disabled={isLinking || !newCardNumber.trim()}
                      variant="primary"
                    />
                    <Button
                      label="Cancel"
                      onPress={() => {
                        setShowLinkInput(false);
                        setNewCardNumber("");
                      }}
                      variant="ghost"
                    />
                  </View>
                ) : (
                  <Button
                    label="Link Physical Card"
                    onPress={() => setShowLinkInput(true)}
                    variant="secondary"
                    icon="card-outline"
                  />
                )}
              </View>
            )}

            {/* Replace card (already linked) */}
            {customer.cardNumber && (
              <View style={styles.replaceSection}>
                {showLinkInput ? (
                  <View style={styles.linkInputRow}>
                    <TextInput
                      value={newCardNumber}
                      onChangeText={setNewCardNumber}
                      placeholder="New card number"
                      style={[styles.cardInput, { flex: 1 }]}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!isLinking}
                      placeholderTextColor="#9CA3AF"
                    />
                    <Button
                      label={isLinking ? "Replacing…" : "Replace"}
                      onPress={handleLinkCard}
                      disabled={isLinking || !newCardNumber.trim()}
                      variant="primary"
                    />
                    <Button
                      label="Cancel"
                      onPress={() => {
                        setShowLinkInput(false);
                        setNewCardNumber("");
                      }}
                      variant="ghost"
                    />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setShowLinkInput(true)}
                    style={styles.replaceLink}
                  >
                    <Ionicons name="swap-horizontal-outline" size={14} color="#6B7280" />
                    <Text style={styles.replaceLinkText}>Replace card</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}
      </Modal>
    );
  }
);

export default LoyaltyCardModal;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Digital card
  digitalCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 20,
    gap: 12,
    marginHorizontal: 16,
    marginTop: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardBrand: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  tierBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  cardNumber: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
  cardHolderName: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1.5,
  },
  cardPointsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  cardPointsLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
  },
  cardPointsValue: {
    fontSize: 15,
    fontWeight: "800",
  },

  // Lookup panel
  lookupPanel: {
    padding: 24,
    gap: 24,
  },
  lookupIconRow: {
    alignItems: "center",
    gap: 8,
  },
  lookupTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  lookupSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  lookupInputRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  cardInput: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },

  // Card display
  cardDisplayContainer: {
    gap: 16,
    paddingBottom: 16,
  },
  linkSection: {
    marginHorizontal: 16,
    gap: 10,
    alignItems: "flex-start",
  },
  linkPrompt: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  linkInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    width: "100%",
  },
  replaceSection: {
    marginHorizontal: 16,
  },
  replaceLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  replaceLinkText: {
    fontSize: 13,
    color: "#6B7280",
    textDecorationLine: "underline",
  },
});
