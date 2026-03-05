/**
 * PortionManager — Manage portion sizes for a menu item.
 *
 * Lets managers define size variants (e.g., Small / Medium / Large) with
 * individual prices, a multiplier relative to the base price, and a
 * default selection. Commonly used in restaurants, coffee shops, and
 * fast-food where the same product ships in multiple sizes.
 *
 * Why show a multiplier instead of just prices?
 * Multipliers make bulk price adjustments trivial — if the base price
 * changes, the manager can see at a glance whether each size is still
 * proportionally correct. It also prevents accidental mis-pricing where
 * a "Large" costs less than a "Medium".
 *
 * @module PortionManager
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { triggerHaptic } from "@/utils/haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Portion {
  id: string;
  name: string;
  multiplier: number;
  price: number;
  isDefault: boolean;
}

interface PortionManagerProps {
  productName: string;
  basePrice: number;
  portions: Portion[];
  onAddPortion: () => void;
  onRemovePortion: (portionId: string) => void;
  onUpdatePortion: (portionId: string, updates: Partial<Portion>) => void;
  onSetDefault: (portionId: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

// ─── Theme ───────────────────────────────────────────────────────────────────

const COLORS = {
  bg: "#0f172a",
  card: "#1f2937",
  input: "#111827",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#fbbf24",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  border: "#374151",
} as const;

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Single portion card — name, price, computed multiplier, default star, remove.
 * Memoized so editing one card doesn't re-render siblings.
 */
const PortionCard = React.memo(function PortionCard({
  portion,
  basePrice,
  onUpdatePortion,
  onSetDefault,
  onRemovePortion,
}: {
  portion: Portion;
  basePrice: number;
  onUpdatePortion: (id: string, updates: Partial<Portion>) => void;
  onSetDefault: (id: string) => void;
  onRemovePortion: (id: string) => void;
}) {
  const handleNameChange = useCallback(
    (text: string) => onUpdatePortion(portion.id, { name: text }),
    [portion.id, onUpdatePortion]
  );

  const handlePriceChange = useCallback(
    (text: string) => {
      const parsed = parseFloat(text);
      onUpdatePortion(portion.id, { price: isNaN(parsed) ? 0 : parsed });
    },
    [portion.id, onUpdatePortion]
  );

  const handleSetDefault = useCallback(() => {
    triggerHaptic("selection");
    onSetDefault(portion.id);
  }, [portion.id, onSetDefault]);

  const handleRemove = useCallback(() => {
    triggerHaptic("tap");
    onRemovePortion(portion.id);
  }, [portion.id, onRemovePortion]);

  // Derived multiplier — recalculated only when price or basePrice change
  const multiplier = useMemo(
    () => (basePrice > 0 ? portion.price / basePrice : 0),
    [portion.price, basePrice]
  );

  return (
    <View testID={`portion-item-${portion.id}`} style={styles.portionCard}>
      {/* Name input */}
      <View style={styles.portionHeader}>
        <View style={styles.portionNameWrapper}>
          <Text style={styles.inputLabel}>Size Name</Text>
          <TextInput
            testID={`portion-name-${portion.id}`}
            style={styles.textInput}
            value={portion.name}
            onChangeText={handleNameChange}
            placeholder='e.g., "Large"'
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        {/* Default star — marks the pre-selected portion when ordering */}
        <TouchableOpacity
          testID={`portion-default-${portion.id}`}
          onPress={handleSetDefault}
          style={styles.defaultButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={portion.isDefault ? "star" : "star-outline"}
            size={22}
            color={portion.isDefault ? COLORS.amber : COLORS.textMuted}
          />
          {portion.isDefault && (
            <Text style={styles.defaultLabel}>Default</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Price + multiplier row */}
      <View style={styles.priceRow}>
        <View style={styles.priceInputWrapper}>
          <Text style={styles.inputLabel}>Price</Text>
          <TextInput
            testID={`portion-price-${portion.id}`}
            style={styles.textInput}
            value={portion.price > 0 ? portion.price.toString() : ""}
            onChangeText={handlePriceChange}
            placeholder="0.00"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.multiplierWrapper}>
          <Text style={styles.inputLabel}>Multiplier</Text>
          <View style={styles.multiplierBadge}>
            <Ionicons name="resize-outline" size={14} color={COLORS.blue} />
            <Text style={styles.multiplierValue}>
              {multiplier.toFixed(2)}×
            </Text>
          </View>
        </View>
      </View>

      {/* Remove button */}
      <TouchableOpacity
        testID={`portion-remove-${portion.id}`}
        onPress={handleRemove}
        style={styles.removeButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash-outline" size={18} color={COLORS.red} />
        <Text style={styles.removeText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

function PortionManager({
  productName,
  basePrice,
  portions,
  onAddPortion,
  onRemovePortion,
  onUpdatePortion,
  onSetDefault,
  onSave,
  onCancel,
  isSaving = false,
}: PortionManagerProps) {
  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    triggerHaptic("success");
    onSave();
  }, [onSave]);

  const handleCancel = useCallback(() => {
    triggerHaptic("tap");
    onCancel();
  }, [onCancel]);

  const handleAddPortion = useCallback(() => {
    triggerHaptic("tap");
    onAddPortion();
  }, [onAddPortion]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderPortion = useCallback(
    ({ item }: ListRenderItemInfo<Portion>) => (
      <PortionCard
        portion={item}
        basePrice={basePrice}
        onUpdatePortion={onUpdatePortion}
        onSetDefault={onSetDefault}
        onRemovePortion={onRemovePortion}
      />
    ),
    [basePrice, onUpdatePortion, onSetDefault, onRemovePortion]
  );

  const keyExtractor = useCallback((item: Portion) => item.id, []);

  // ── Header — product info + base price ────────────────────────────────────

  const ListHeader = useMemo(
    () => (
      <View>
        {/* Title row */}
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Ionicons name="layers-outline" size={24} color={COLORS.purple} />
            <Text style={styles.title}>Portion Sizes</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              testID="portion-cancel"
              onPress={handleCancel}
              style={styles.cancelButton}
              disabled={isSaving}
            >
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="portion-save"
              onPress={handleSave}
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color={COLORS.text} />
                  <Text style={styles.saveText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Product info banner */}
        <View style={styles.productBanner}>
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>
              {productName}
            </Text>
            <Text style={styles.basePriceLabel}>Base price</Text>
          </View>
          <Text style={styles.basePriceValue}>
            {formatCurrency(basePrice)}
          </Text>
        </View>

        {/* Section label */}
        <Text style={styles.sectionLabel}>
          {portions.length} {portions.length === 1 ? "Portion" : "Portions"}
        </Text>
      </View>
    ),
    [productName, basePrice, portions.length, handleCancel, handleSave, isSaving]
  );

  // ── Footer — add portion button ───────────────────────────────────────────

  const ListFooter = useMemo(
    () => (
      <View>
        {portions.length === 0 && (
          <Text style={styles.emptyText}>
            No portions defined. Tap below to add a size variant.
          </Text>
        )}

        <TouchableOpacity
          testID="portion-add"
          onPress={handleAddPortion}
          style={styles.addButton}
        >
          <Ionicons name="add-circle" size={22} color={COLORS.purple} />
          <Text style={styles.addButtonText}>Add Portion</Text>
        </TouchableOpacity>
      </View>
    ),
    [portions.length, handleAddPortion]
  );

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View testID="portion-manager" style={styles.container}>
      <FlatList
        data={portions}
        renderItem={renderPortion}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: COLORS.green,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },

  // Product banner
  productBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  basePriceLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  basePriceValue: {
    color: COLORS.green,
    fontSize: 20,
    fontWeight: "700",
  },

  // Section
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // Portion card
  portionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  portionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  portionNameWrapper: {
    flex: 1,
  },
  defaultButton: {
    alignItems: "center",
    gap: 2,
    paddingTop: 18,
  },
  defaultLabel: {
    color: COLORS.amber,
    fontSize: 10,
    fontWeight: "600",
  },
  priceRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  priceInputWrapper: {
    flex: 1,
  },
  multiplierWrapper: {
    flex: 1,
  },
  multiplierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.input,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multiplierValue: {
    color: COLORS.blue,
    fontSize: 15,
    fontWeight: "600",
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.red,
  },
  removeText: {
    color: COLORS.red,
    fontSize: 13,
    fontWeight: "600",
  },

  // Inputs
  inputLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Empty state
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12,
  },

  // Add button
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.purple,
    borderStyle: "dashed",
    marginTop: 4,
  },
  addButtonText: {
    color: COLORS.purple,
    fontSize: 15,
    fontWeight: "600",
  },
});

export default React.memo(PortionManager);
