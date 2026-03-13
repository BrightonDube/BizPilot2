/**
 * BizPilot Mobile POS — FolioDisplay Component
 *
 * Shows a guest's hotel folio: balance, credit limit, and recent charges.
 *
 * Why show folio in POS?
 * Hotel staff often need to check a guest's current balance before
 * posting a new charge (especially if the guest is near their credit limit).
 * Having it accessible from the POS saves time vs. calling the front desk.
 */

import React, { useEffect, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { useFolio } from "@/hooks/useFolio";
import type { PMSGuest, PMSFolioCharge } from "@/types/pms";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FolioDisplayProps {
  /** Guest whose folio to display */
  guest: PMSGuest | null;
  /** Whether to auto-fetch on mount/guest change */
  autoFetch?: boolean;
}

// ---------------------------------------------------------------------------
// Charge row sub-component
// ---------------------------------------------------------------------------

interface ChargeRowProps {
  charge: PMSFolioCharge;
}

const ChargeRow: React.FC<ChargeRowProps> = React.memo(function ChargeRow({ charge }) {
  return (
    <View style={styles.chargeRow}>
      <View style={styles.chargeInfo}>
        <View style={styles.chargeDescRow}>
          <Text style={styles.chargeDesc}>{charge.description}</Text>
          {charge.isFromThisPOS && (
            <View style={styles.posTag}>
              <Text style={styles.posTagText}>POS</Text>
            </View>
          )}
        </View>
        <Text style={styles.chargeDate}>
          {new Date(charge.date).toLocaleDateString("en-ZA", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
      <Text style={styles.chargeAmount}>{formatCurrency(charge.amount)}</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const FolioDisplay: React.FC<FolioDisplayProps> = React.memo(
  function FolioDisplay({ guest, autoFetch = true }) {
    const { folio, loading, error, fetchFolio, clearFolio } = useFolio();

    // Auto-fetch on guest change
    useEffect(() => {
      if (autoFetch && guest) {
        fetchFolio(guest.id);
      } else if (!guest) {
        clearFolio();
      }
    }, [guest, autoFetch, fetchFolio, clearFolio]);

    const handleRefresh = useCallback(() => {
      if (guest) fetchFolio(guest.id);
    }, [guest, fetchFolio]);

    if (!guest) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={32} color="#374151" />
          <Text style={styles.emptyText}>Select a guest to view folio</Text>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading folio...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={handleRefresh}>
            <Text style={styles.retryLink}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    if (!folio) return null;

    // Calculate credit remaining
    const creditRemaining =
      folio.creditLimit !== null ? folio.creditLimit - folio.balance : null;
    const isNearLimit =
      creditRemaining !== null && creditRemaining < folio.balance * 0.2;

    return (
      <View style={styles.container}>
        {/* Folio header */}
        <View style={styles.headerRow}>
          <Text style={styles.folioNumber}>Folio {folio.folioNumber}</Text>
          <Pressable onPress={handleRefresh} hitSlop={8}>
            <Ionicons name="refresh-outline" size={18} color="#3b82f6" />
          </Pressable>
        </View>

        {/* Balance and credit */}
        <View style={styles.balanceContainer}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={styles.balanceValue}>
              {formatCurrency(folio.balance)}
            </Text>
          </View>
          {folio.creditLimit !== null && (
            <>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>Credit Limit</Text>
                <Text style={styles.balanceValue}>
                  {formatCurrency(folio.creditLimit)}
                </Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>Remaining</Text>
                <Text
                  style={[
                    styles.balanceValue,
                    isNearLimit && styles.balanceWarning,
                  ]}
                >
                  {formatCurrency(creditRemaining!)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Near limit warning */}
        {isNearLimit && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={16} color="#f59e0b" />
            <Text style={styles.warningText}>Guest is near their credit limit</Text>
          </View>
        )}

        {/* Recent charges */}
        <Text style={styles.sectionTitle}>Recent Charges</Text>
        {folio.recentCharges.length === 0 ? (
          <Text style={styles.noChargesText}>No charges on this folio</Text>
        ) : (
          <FlatList
            data={folio.recentCharges}
            keyExtractor={(item) => item.reference}
            renderItem={({ item }) => <ChargeRow charge={item} />}
            scrollEnabled={false}
          />
        )}

        {/* Last updated */}
        <Text style={styles.lastUpdated}>
          Last updated: {new Date(folio.lastFetchedAt).toLocaleTimeString()}
        </Text>
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 14,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 24,
    gap: 8,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 20,
  },
  loadingText: {
    color: "#9ca3af",
    fontSize: 14,
  },
  errorContainer: {
    alignItems: "center",
    padding: 16,
    gap: 8,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
  },
  retryLink: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  folioNumber: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
  },
  balanceContainer: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  balanceItem: {
    flex: 1,
    alignItems: "center",
  },
  balanceDivider: {
    width: 1,
    backgroundColor: "#374151",
  },
  balanceLabel: {
    color: "#6b7280",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  balanceValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  balanceWarning: {
    color: "#f59e0b",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    backgroundColor: "#1c1917",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#78350f",
    marginBottom: 12,
  },
  warningText: {
    color: "#f59e0b",
    fontSize: 13,
  },
  sectionTitle: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  noChargesText: {
    color: "#6b7280",
    fontSize: 13,
    fontStyle: "italic",
  },
  chargeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  chargeInfo: {
    flex: 1,
  },
  chargeDescRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chargeDesc: {
    color: "#ffffff",
    fontSize: 14,
  },
  posTag: {
    backgroundColor: "#1e3a5f",
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  posTagText: {
    color: "#3b82f6",
    fontSize: 10,
    fontWeight: "700",
  },
  chargeDate: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  chargeAmount: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  lastUpdated: {
    color: "#4b5563",
    fontSize: 11,
    textAlign: "right",
    marginTop: 10,
  },
});

export default FolioDisplay;
