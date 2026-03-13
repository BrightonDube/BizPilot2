/**
 * PaymentDisplay — Customer-facing payment status screen.
 *
 * Cycles through four visual states (pending → processing → complete | failed)
 * so the customer always knows what's happening without cashier intervention.
 * Haptic feedback on completion/failure provides a tactile confirmation.
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ─── Types ───────────────────────────────────────────────────────────

type PaymentStatus = "pending" | "processing" | "complete" | "failed";

interface PaymentDisplayProps {
  amount: number;
  method: string; // 'cash' | 'card' | 'eft' | 'qr_code' | 'room_charge'
  status: PaymentStatus;
  qrCodeData?: string | null;
  instructions?: string;
  changeDue?: number;
  onRetry?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const formatCurrency = (value: number): string =>
  `R ${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

/** Map method keys to human-readable labels. */
const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  eft: "EFT",
  qr_code: "QR Code",
  room_charge: "Room Charge",
};

/** Map method keys to Ionicons names. */
const METHOD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  cash: "cash-outline",
  card: "card-outline",
  eft: "swap-horizontal-outline",
  qr_code: "qr-code-outline",
  room_charge: "bed-outline",
};

// ─── Theme ───────────────────────────────────────────────────────────

const COLORS = {
  bg: "#0f172a",
  card: "#1f2937",
  text: "#f3f4f6",
  muted: "#9ca3af",
  accent: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  border: "#374151",
} as const;

// ─── Main Component ──────────────────────────────────────────────────

const PaymentDisplay: React.FC<PaymentDisplayProps> = ({
  amount,
  method,
  status,
  qrCodeData = null,
  instructions,
  changeDue,
  onRetry,
}) => {
  // Haptic feedback gives physical confirmation of terminal outcomes
  useEffect(() => {
    if (status === "complete") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (status === "failed") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [status]);

  const methodLabel = METHOD_LABELS[method] ?? method;
  const methodIcon = METHOD_ICONS[method] ?? "ellipsis-horizontal-outline";

  return (
    <View testID="payment-display" style={styles.container}>
      {/* ── Amount ─────────────────────────────────────────────── */}
      <Text testID="payment-amount" style={styles.amount}>
        {formatCurrency(amount)}
      </Text>

      {/* ── Payment Method ─────────────────────────────────────── */}
      <View testID="payment-method" style={styles.methodRow}>
        <Ionicons
          name={methodIcon as any}
          size={24}
          color={COLORS.muted}
          style={styles.methodIcon}
        />
        <Text style={styles.methodLabel}>{methodLabel}</Text>
      </View>

      {/* ── Status Indicator ───────────────────────────────────── */}
      <View testID="payment-status" style={styles.statusSection}>
        {status === "pending" && <PendingIndicator />}
        {status === "processing" && <ProcessingIndicator />}
        {status === "complete" && <CompleteIndicator changeDue={changeDue} />}
        {status === "failed" && <FailedIndicator onRetry={onRetry} />}
      </View>

      {/* ── QR Code ────────────────────────────────────────────── */}
      {qrCodeData && (
        <View testID="payment-qr" style={styles.qrSection}>
          <View style={styles.qrPlaceholder}>
            <Ionicons
              name="qr-code-outline"
              size={80}
              color={COLORS.muted}
            />
          </View>
          <Text style={styles.qrHint}>Scan to Pay</Text>
        </View>
      )}

      {/* ── Instructions ───────────────────────────────────────── */}
      {instructions ? (
        <Text testID="payment-instructions" style={styles.instructions}>
          {instructions}
        </Text>
      ) : null}
    </View>
  );
};

// ─── Status sub-components ───────────────────────────────────────────

/** Pulsing dot conveys "waiting" without a spinner's urgency. */
const PendingIndicator: React.FC = React.memo(() => (
  <View style={styles.statusCard}>
    <Ionicons name="time-outline" size={48} color={COLORS.accent} />
    <Text style={styles.statusText}>Waiting for payment…</Text>
  </View>
));
PendingIndicator.displayName = "PendingIndicator";

const ProcessingIndicator: React.FC = React.memo(() => (
  <View style={styles.statusCard}>
    <ActivityIndicator size="large" color={COLORS.accent} />
    <Text style={styles.statusText}>Processing…</Text>
  </View>
));
ProcessingIndicator.displayName = "ProcessingIndicator";

interface CompleteIndicatorProps {
  changeDue?: number;
}

const CompleteIndicator: React.FC<CompleteIndicatorProps> = React.memo(
  ({ changeDue }) => (
    <View style={styles.statusCard}>
      <Ionicons name="checkmark-circle" size={56} color={COLORS.green} />
      <Text style={[styles.statusText, { color: COLORS.green }]}>
        Payment Successful!
      </Text>
      {changeDue != null && changeDue > 0 && (
        <Text testID="payment-change" style={styles.changeText}>
          Change Due: {formatCurrency(changeDue)}
        </Text>
      )}
    </View>
  ),
);
CompleteIndicator.displayName = "CompleteIndicator";

interface FailedIndicatorProps {
  onRetry?: () => void;
}

const FailedIndicator: React.FC<FailedIndicatorProps> = React.memo(
  ({ onRetry }) => (
    <View style={styles.statusCard}>
      <Ionicons name="close-circle" size={56} color={COLORS.red} />
      <Text style={[styles.statusText, { color: COLORS.red }]}>
        Payment Failed
      </Text>
      {onRetry && (
        <TouchableOpacity
          testID="payment-retry-btn"
          style={styles.retryButton}
          onPress={onRetry}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={20} color="#ffffff" />
          <Text style={styles.retryLabel}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  ),
);
FailedIndicator.displayName = "FailedIndicator";

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  // Amount
  amount: {
    fontSize: 48,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 12,
  },

  // Method
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },
  methodIcon: {
    marginRight: 8,
  },
  methodLabel: {
    fontSize: 18,
    color: COLORS.muted,
  },

  // Status
  statusSection: {
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
  },
  statusCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
  },
  statusText: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 12,
  },
  changeText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 8,
  },

  // Retry
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  retryLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginLeft: 6,
  },

  // QR Code
  qrSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  /** Placeholder box until a real QR library (e.g. react-native-qrcode-svg) is wired in. */
  qrPlaceholder: {
    width: 160,
    height: 160,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  qrHint: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 8,
  },

  // Instructions
  instructions: {
    fontSize: 15,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 16,
  },
});

export default React.memo(PaymentDisplay);
