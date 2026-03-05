/**
 * BizPilot Mobile POS — MenuGrid Component
 *
 * Enhanced menu grid for the POS screen that combines category filtering,
 * PLU barcode search, text search, and an item selection flow with portion
 * and modifier support.
 *
 * Why a single orchestrating component instead of separate screens?
 * In a busy restaurant POS environment the cashier needs to filter, search,
 * and customise an item without navigating away from the grid. Keeping
 * everything in one view (with inline modals) minimises taps and keeps
 * the mental context intact during a rush.
 *
 * Why FlatList instead of FlashList here?
 * This component owns its own modal overlays and selection state. FlatList
 * is simpler to integrate with React Native's built-in Modal and avoids
 * the extra dependency on @shopify/flash-list for a self-contained widget
 * that typically renders fewer than 100 visible items at once.
 *
 * Why a Map for selectedModifiers?
 * Each modifier group has independent min/max constraints. A Map keyed by
 * groupId lets us validate each group in O(1) and avoids accidentally
 * mixing selections across groups.
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  StyleSheet,
  type ListRenderItemInfo,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MenuCategory {
  id: string;
  name: string;
  parentId: string | null;
  imageUrl: string | null;
  iconName: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Modifier {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  modifiers: Modifier[];
}

export interface Portion {
  id: string;
  name: string;
  priceMultiplier: number;
  priceOverride: number | null;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  basePrice: number;
  pluCode: string | null;
  categoryId: string;
  isAvailable: boolean;
  modifierGroups: ModifierGroup[];
  portions: Portion[];
  tags: string[];
}

export interface MenuGridProps {
  /** Categories to display as filter tabs */
  categories: MenuCategory[];
  /** Menu items to display in the grid */
  items: MenuItem[];
  /** Called when an item is fully configured and added to cart */
  onItemSelect: (
    item: MenuItem,
    portion: Portion | null,
    modifiers: Modifier[],
  ) => void;
  /** Optional callback for PLU barcode lookups */
  onPLUSearch?: (pluCode: string) => void;
  /** Whether the data is still loading */
  isLoading?: boolean;
  /** Number of grid columns (default 3, tablet-first) */
  numColumns?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 300;
const PLU_TOAST_DURATION_MS = 2_000;
const ALL_CATEGORY_ID = "__all__";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * A single menu item card rendered inside the FlatList grid.
 *
 * Why extracted and memoised?
 * Same rationale as ProductCard — prevents the entire grid from
 * re-rendering when one card's availability changes.
 */
const MenuItemCard = React.memo(function MenuItemCard({
  item,
  onPress,
}: {
  item: MenuItem;
  onPress: (item: MenuItem) => void;
}) {
  const handlePress = useCallback(() => {
    if (!item.isAvailable) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item);
  }, [item, onPress]);

  return (
    <Pressable
      testID={`menu-item-${item.id}`}
      onPress={handlePress}
      disabled={!item.isAvailable}
      style={({ pressed }) => [
        styles.itemCard,
        pressed && item.isAvailable && styles.itemCardPressed,
        !item.isAvailable && styles.itemCardUnavailable,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatCurrency(item.basePrice)}${
        !item.isAvailable ? ", unavailable" : ""
      }`}
      accessibilityState={{ disabled: !item.isAvailable }}
    >
      {/* Thumbnail or placeholder */}
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.itemImage}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={styles.itemImagePlaceholder}>
          <Ionicons
            name="restaurant-outline"
            size={28}
            color={item.isAvailable ? "#6b7280" : "#4b5563"}
          />
        </View>
      )}

      <Text
        style={[styles.itemName, !item.isAvailable && styles.textMuted]}
        numberOfLines={2}
      >
        {item.name}
      </Text>

      <Text
        style={[styles.itemPrice, !item.isAvailable && styles.textMuted]}
      >
        {formatCurrency(item.basePrice)}
      </Text>

      {/* Unavailable overlay */}
      {!item.isAvailable && (
        <View
          testID={`unavailable-badge-${item.id}`}
          style={styles.unavailableOverlay}
        >
          <Text style={styles.unavailableText}>Unavailable</Text>
        </View>
      )}
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function MenuGridComponent({
  categories,
  items,
  onItemSelect,
  onPLUSearch,
  isLoading = false,
  numColumns = 3,
}: MenuGridProps) {
  // ---- state ----
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pluQuery, setPluQuery] = useState("");
  const [pluToast, setPluToast] = useState<string | null>(null);

  // Item selection flow
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [portionModalVisible, setPortionModalVisible] = useState(false);
  const [modifierModalVisible, setModifierModalVisible] = useState(false);
  const [selectedPortion, setSelectedPortion] = useState<Portion | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<
    Map<string, string[]>
  >(new Map());

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pluToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- debounced text search ----
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim().toLowerCase());
    }, DEBOUNCE_MS);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // ---- sorted active categories ----
  const sortedCategories = useMemo(
    () =>
      categories
        .filter((c) => c.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  // ---- filtered items: by category + text search, available first ----
  const filteredItems = useMemo(() => {
    let result = items;

    // Category filter
    if (selectedCategoryId) {
      result = result.filter((i) => i.categoryId === selectedCategoryId);
    }

    // Text search across name, description, and tags
    if (debouncedSearch) {
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(debouncedSearch) ||
          i.description.toLowerCase().includes(debouncedSearch) ||
          i.tags.some((t) => t.toLowerCase().includes(debouncedSearch)),
      );
    }

    // Sort: available items first, then alphabetical
    return [...result].sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [items, selectedCategoryId, debouncedSearch]);

  // ---- PLU search ----
  const handlePLUSubmit = useCallback(() => {
    const code = pluQuery.trim();
    if (!code) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPLUSearch?.(code);

    const found = items.find(
      (i) => i.pluCode?.toLowerCase() === code.toLowerCase(),
    );

    if (found) {
      // Immediately trigger selection (skip modals for PLU scans)
      onItemSelect(found, null, []);
      setPluQuery("");
    } else {
      // Brief toast feedback
      setPluToast(`PLU "${code}" not found`);
      if (pluToastTimerRef.current) clearTimeout(pluToastTimerRef.current);
      pluToastTimerRef.current = setTimeout(
        () => setPluToast(null),
        PLU_TOAST_DURATION_MS,
      );
    }
  }, [pluQuery, items, onItemSelect, onPLUSearch]);

  // ---- category selection ----
  const handleCategorySelect = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategoryId(id === ALL_CATEGORY_ID ? null : id);
  }, []);

  // ---- item tap → begin selection flow ----
  const handleItemPress = useCallback((item: MenuItem) => {
    setSelectedItem(item);
    setSelectedPortion(null);
    setSelectedModifiers(new Map());

    const hasManyPortions = item.portions.length > 1;
    const hasModifiers = item.modifierGroups.length > 0;

    if (!hasManyPortions && !hasModifiers) {
      // No customisation needed — add directly
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Use the first (default) portion if exactly one exists
      const defaultPortion = item.portions.length === 1 ? item.portions[0] : null;
      // Collect default modifiers
      const defaults: Modifier[] = [];
      for (const group of item.modifierGroups) {
        for (const mod of group.modifiers) {
          if (mod.isDefault) defaults.push(mod);
        }
      }
      onItemSelect(item, defaultPortion, defaults);
      setSelectedItem(null);
      return;
    }

    if (hasManyPortions) {
      setPortionModalVisible(true);
    } else {
      // Skip portion, go straight to modifiers
      const defaultPortion =
        item.portions.length === 1 ? item.portions[0] : null;
      setSelectedPortion(defaultPortion);
      if (hasModifiers) {
        // Pre-select default modifiers
        const defaultMap = buildDefaultModifierMap(item.modifierGroups);
        setSelectedModifiers(defaultMap);
        setModifierModalVisible(true);
      }
    }
  }, [onItemSelect]);

  // ---- portion selected ----
  const handlePortionSelect = useCallback(
    (portion: Portion) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedPortion(portion);

      if (selectedItem && selectedItem.modifierGroups.length > 0) {
        const defaultMap = buildDefaultModifierMap(
          selectedItem.modifierGroups,
        );
        setSelectedModifiers(defaultMap);
        setPortionModalVisible(false);
        setModifierModalVisible(true);
      } else {
        // No modifiers — add to cart
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (selectedItem) onItemSelect(selectedItem, portion, []);
        setPortionModalVisible(false);
        setSelectedItem(null);
      }
    },
    [selectedItem, onItemSelect],
  );

  // ---- modifier toggled ----
  const handleModifierToggle = useCallback(
    (groupId: string, modifierId: string, maxSelections: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedModifiers((prev) => {
        const next = new Map(prev);
        const current = next.get(groupId) ?? [];

        if (current.includes(modifierId)) {
          // Deselect
          next.set(
            groupId,
            current.filter((id) => id !== modifierId),
          );
        } else if (maxSelections === 1) {
          // Radio behaviour — replace selection
          next.set(groupId, [modifierId]);
        } else if (current.length < maxSelections) {
          // Checkbox behaviour — add if under limit
          next.set(groupId, [...current, modifierId]);
        }

        return next;
      });
    },
    [],
  );

  // ---- "Add to Cart" from modifier modal ----
  const handleAddToCart = useCallback(() => {
    if (!selectedItem) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Flatten selected modifiers from Map into Modifier[]
    const flatModifiers: Modifier[] = [];
    for (const group of selectedItem.modifierGroups) {
      const ids = selectedModifiers.get(group.id) ?? [];
      for (const mod of group.modifiers) {
        if (ids.includes(mod.id)) flatModifiers.push(mod);
      }
    }

    onItemSelect(selectedItem, selectedPortion, flatModifiers);
    setModifierModalVisible(false);
    setSelectedItem(null);
  }, [selectedItem, selectedPortion, selectedModifiers, onItemSelect]);

  // ---- price calculation for the modifier modal ----
  const calculatedTotal = useMemo(() => {
    if (!selectedItem) return 0;
    let base = selectedItem.basePrice;

    if (selectedPortion) {
      base =
        selectedPortion.priceOverride != null
          ? selectedPortion.priceOverride
          : base * selectedPortion.priceMultiplier;
    }

    let modTotal = 0;
    for (const group of selectedItem.modifierGroups) {
      const ids = selectedModifiers.get(group.id) ?? [];
      for (const mod of group.modifiers) {
        if (ids.includes(mod.id)) modTotal += mod.price;
      }
    }

    return base + modTotal;
  }, [selectedItem, selectedPortion, selectedModifiers]);

  // ---- validate all required modifier groups are satisfied ----
  const allRequiredGroupsSatisfied = useMemo(() => {
    if (!selectedItem) return false;
    for (const group of selectedItem.modifierGroups) {
      if (group.required) {
        const selected = selectedModifiers.get(group.id) ?? [];
        if (selected.length < group.minSelections) return false;
      }
    }
    return true;
  }, [selectedItem, selectedModifiers]);

  // ---- close helpers ----
  const closePortionModal = useCallback(() => {
    setPortionModalVisible(false);
    setSelectedItem(null);
  }, []);

  const closeModifierModal = useCallback(() => {
    setModifierModalVisible(false);
    setSelectedItem(null);
  }, []);

  // ---- FlatList render ----
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MenuItem>) => (
      <MenuItemCard item={item} onPress={handleItemPress} />
    ),
    [handleItemPress],
  );

  const keyExtractor = useCallback((item: MenuItem) => item.id, []);

  // ---- render ----
  return (
    <View testID="menu-grid" style={styles.container}>
      {/* ───── PLU Search Bar ───── */}
      <View style={styles.pluContainer}>
        <Ionicons
          name="barcode-outline"
          size={20}
          color="#6b7280"
          style={styles.pluIcon}
        />
        <TextInput
          testID="plu-search-input"
          style={styles.pluInput}
          placeholder="Scan / enter PLU code…"
          placeholderTextColor="#6b7280"
          value={pluQuery}
          onChangeText={setPluQuery}
          onSubmitEditing={handlePLUSubmit}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="PLU code search"
        />
        {pluQuery.length > 0 && (
          <Pressable
            onPress={() => setPluQuery("")}
            hitSlop={8}
            accessibilityLabel="Clear PLU search"
            accessibilityRole="button"
          >
            <Ionicons name="close-circle" size={18} color="#6b7280" />
          </Pressable>
        )}
      </View>

      {/* PLU toast feedback */}
      {pluToast && (
        <View style={styles.pluToast}>
          <Ionicons name="alert-circle" size={16} color="#fbbf24" />
          <Text style={styles.pluToastText}>{pluToast}</Text>
        </View>
      )}

      {/* ───── Category Tabs ───── */}
      <ScrollView
        testID="category-tabs"
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        {/* "All" tab */}
        <Pressable
          onPress={() => handleCategorySelect(ALL_CATEGORY_ID)}
          style={[
            styles.categoryPill,
            {
              backgroundColor:
                selectedCategoryId === null ? "#3b82f6" : "#374151",
            },
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedCategoryId === null }}
          accessibilityLabel="All categories, tab"
        >
          <Text
            style={[
              styles.categoryPillText,
              selectedCategoryId === null && styles.categoryPillTextActive,
            ]}
          >
            All
          </Text>
        </Pressable>

        {sortedCategories.map((cat) => {
          const isActive = selectedCategoryId === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => handleCategorySelect(cat.id)}
              style={[
                styles.categoryPill,
                { backgroundColor: isActive ? cat.color : "#374151" },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${cat.name} category${isActive ? ", selected" : ""}`}
            >
              <View style={styles.categoryPillInner}>
                {/* Icon or thumbnail */}
                {cat.imageUrl ? (
                  <Image
                    source={{ uri: cat.imageUrl }}
                    style={styles.categoryThumb}
                    contentFit="cover"
                  />
                ) : cat.iconName ? (
                  <Ionicons
                    name={(cat.iconName as keyof typeof Ionicons.glyphMap) ?? "grid-outline"}
                    size={16}
                    color={isActive ? "#ffffff" : "#9ca3af"}
                    style={styles.categoryIcon}
                  />
                ) : null}

                <Text
                  style={[
                    styles.categoryPillText,
                    isActive && styles.categoryPillTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ───── Text Search ───── */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={18}
          color="#6b7280"
          style={styles.searchIcon}
        />
        <TextInput
          testID="text-search-input"
          style={styles.searchInput}
          placeholder="Search menu items…"
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search menu items"
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => setSearchQuery("")}
            hitSlop={8}
            accessibilityLabel="Clear search"
            accessibilityRole="button"
          >
            <Ionicons name="close-circle" size={18} color="#6b7280" />
          </Pressable>
        )}
      </View>

      {/* ───── Loading State ───── */}
      {isLoading && (
        <View testID="menu-loading" style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}

      {/* ───── Empty State ───── */}
      {!isLoading && filteredItems.length === 0 && (
        <View testID="menu-empty" style={styles.centered}>
          <Ionicons name="search-outline" size={48} color="#4b5563" />
          <Text style={styles.emptyText}>No items found</Text>
        </View>
      )}

      {/* ───── Menu Item Grid ───── */}
      {!isLoading && filteredItems.length > 0 && (
        <FlatList
          testID="menu-items-grid"
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={numColumns}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          // Why removeClippedSubviews? Reduces memory usage on large menus
          removeClippedSubviews
          maxToRenderPerBatch={20}
          windowSize={7}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
         Portion Selector Modal
         ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        testID="portion-modal"
        visible={portionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closePortionModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Portion</Text>
              <Pressable
                onPress={closePortionModal}
                hitSlop={12}
                accessibilityLabel="Close portion modal"
                accessibilityRole="button"
              >
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>

            {/* Portion list */}
            <ScrollView style={styles.modalBody}>
              {selectedItem?.portions.map((portion) => {
                const price =
                  portion.priceOverride != null
                    ? portion.priceOverride
                    : (selectedItem?.basePrice ?? 0) *
                      portion.priceMultiplier;

                return (
                  <Pressable
                    key={portion.id}
                    testID={`portion-option-${portion.id}`}
                    onPress={() => handlePortionSelect(portion)}
                    style={styles.portionRow}
                    accessibilityRole="radio"
                    accessibilityLabel={`${portion.name}, ${formatCurrency(price)}`}
                  >
                    <Ionicons
                      name={
                        selectedPortion?.id === portion.id
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={22}
                      color={
                        selectedPortion?.id === portion.id
                          ? "#3b82f6"
                          : "#6b7280"
                      }
                    />
                    <Text style={styles.portionName}>{portion.name}</Text>
                    <Text style={styles.portionPrice}>
                      {formatCurrency(price)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
         Modifier Selector Modal
         ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        testID="modifier-modal"
        visible={modifierModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModifierModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Customise</Text>
              <Pressable
                onPress={closeModifierModal}
                hitSlop={12}
                accessibilityLabel="Close modifier modal"
                accessibilityRole="button"
              >
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>

            {/* Modifier groups */}
            <ScrollView style={styles.modalBody}>
              {selectedItem?.modifierGroups.map((group) => {
                const groupSelections =
                  selectedModifiers.get(group.id) ?? [];

                return (
                  <View key={group.id} style={styles.modGroupSection}>
                    {/* Group heading with constraints */}
                    <View style={styles.modGroupHeader}>
                      <Text style={styles.modGroupName}>
                        {group.name}
                        {group.required && (
                          <Text style={styles.requiredAsterisk}> *</Text>
                        )}
                      </Text>
                      <Text style={styles.modGroupHint}>
                        {group.minSelections === group.maxSelections
                          ? `Choose ${group.minSelections}`
                          : `${group.minSelections}–${group.maxSelections}`}
                      </Text>
                    </View>

                    {/* Individual modifiers */}
                    {group.modifiers.map((mod) => {
                      const isChecked = groupSelections.includes(mod.id);
                      const isRadio = group.maxSelections === 1;

                      return (
                        <Pressable
                          key={mod.id}
                          testID={`modifier-option-${mod.id}`}
                          onPress={() =>
                            handleModifierToggle(
                              group.id,
                              mod.id,
                              group.maxSelections,
                            )
                          }
                          style={styles.modRow}
                          accessibilityRole={isRadio ? "radio" : "checkbox"}
                          accessibilityState={{ checked: isChecked }}
                          accessibilityLabel={`${mod.name}${mod.price !== 0 ? `, ${formatCurrency(mod.price)}` : ""}`}
                        >
                          <Ionicons
                            name={
                              isRadio
                                ? isChecked
                                  ? "radio-button-on"
                                  : "radio-button-off"
                                : isChecked
                                  ? "checkbox"
                                  : "square-outline"
                            }
                            size={22}
                            color={isChecked ? "#3b82f6" : "#6b7280"}
                          />
                          <Text style={styles.modName}>{mod.name}</Text>
                          {mod.price !== 0 && (
                            <Text
                              style={[
                                styles.modPrice,
                                {
                                  color:
                                    mod.price > 0 ? "#22c55e" : "#ef4444",
                                },
                              ]}
                            >
                              {mod.price > 0 ? "+" : ""}
                              {formatCurrency(mod.price)}
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>

            {/* Footer with total and add button */}
            <View style={styles.modalFooter}>
              <Text style={styles.totalLabel}>
                Total:{" "}
                <Text style={styles.totalValue}>
                  {formatCurrency(calculatedTotal)}
                </Text>
              </Text>
              <Pressable
                testID="add-to-cart-btn"
                onPress={handleAddToCart}
                disabled={!allRequiredGroupsSatisfied}
                style={[
                  styles.addToCartBtn,
                  !allRequiredGroupsSatisfied && styles.addToCartBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Add to cart, ${formatCurrency(calculatedTotal)}`}
                accessibilityState={{ disabled: !allRequiredGroupsSatisfied }}
              >
                <Ionicons name="cart-outline" size={20} color="#ffffff" />
                <Text style={styles.addToCartText}>Add to Cart</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the initial modifier selection map pre-filling each group's
 * default modifiers so the cashier only has to change what's different.
 */
function buildDefaultModifierMap(
  groups: ModifierGroup[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const group of groups) {
    const defaults = group.modifiers
      .filter((m) => m.isDefault)
      .map((m) => m.id);
    map.set(group.id, defaults);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  // ── PLU Search ──
  pluContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    marginTop: 8,
  },
  pluIcon: {
    marginRight: 6,
  },
  pluInput: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  pluToast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#292524",
    marginHorizontal: 8,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  pluToastText: {
    color: "#fbbf24",
    fontSize: 13,
    fontWeight: "500",
  },

  // ── Category Tabs ──
  categoryScroll: {
    maxHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  categoryContent: {
    paddingHorizontal: 8,
    gap: 6,
    alignItems: "center",
    paddingVertical: 6,
  },
  categoryPill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 48,
    alignItems: "center",
  },
  categoryPillInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  categoryPillText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
  },
  categoryPillTextActive: {
    color: "#ffffff",
  },
  categoryThumb: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  categoryIcon: {
    marginRight: 2,
  },

  // ── Text Search ──
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    marginVertical: 6,
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },

  // ── Grid ──
  gridContent: {
    paddingHorizontal: 4,
    paddingBottom: 16,
  },

  // ── Item Card ──
  itemCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 12,
    margin: 4,
    flex: 1,
    minHeight: 120,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  itemCardPressed: {
    backgroundColor: "#374151",
    transform: [{ scale: 0.97 }],
  },
  itemCardUnavailable: {
    opacity: 0.5,
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  itemName: {
    color: "#f3f4f6",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  itemPrice: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "700",
  },
  textMuted: {
    color: "#4b5563",
  },
  unavailableOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  unavailableText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  // ── Centered states ──
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "500",
  },

  // ── Modals (shared) ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: "#1f2937",
    borderRadius: 16,
    width: "90%",
    maxHeight: "85%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  modalClose: {
    color: "#9ca3af",
    fontSize: 24,
  },
  modalBody: {
    padding: 16,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },

  // ── Portion Modal ──
  portionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#292524",
  },
  portionName: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 16,
    fontWeight: "500",
  },
  portionPrice: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Modifier Modal ──
  modGroupSection: {
    marginBottom: 16,
  },
  modGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modGroupName: {
    color: "#f3f4f6",
    fontSize: 16,
    fontWeight: "700",
  },
  requiredAsterisk: {
    color: "#ef4444",
  },
  modGroupHint: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "500",
  },
  modRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#292524",
  },
  modName: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 15,
    fontWeight: "500",
  },
  modPrice: {
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Add to Cart ──
  totalLabel: {
    color: "#9ca3af",
    fontSize: 16,
    fontWeight: "500",
  },
  totalValue: {
    color: "#ffffff",
    fontWeight: "700",
  },
  addToCartBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    minWidth: 48,
  },
  addToCartBtnDisabled: {
    backgroundColor: "#374151",
    opacity: 0.6,
  },
  addToCartText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default React.memo(MenuGridComponent) as typeof MenuGridComponent;
