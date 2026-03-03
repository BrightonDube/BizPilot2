/**
 * BizPilot Mobile POS — SearchBar Component
 *
 * Debounced search input for filtering products by name, SKU, or barcode.
 *
 * Why debounce instead of instant filtering?
 * With 10,000+ products, filtering on every keystroke causes jank.
 * A 300ms debounce waits for the user to pause typing, then filters
 * once — smooth experience even on lower-end Android tablets.
 *
 * Why a clear button instead of relying on keyboard clear?
 * Not all tablets have a physical keyboard. The clear button (×)
 * provides a consistent way to reset search regardless of input method.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SearchBarProps {
  /** Placeholder text shown when input is empty */
  placeholder?: string;
  /** Called with the debounced search query */
  onSearch: (query: string) => void;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Additional TextInput props (e.g., autoFocus) */
  inputProps?: Omit<TextInputProps, "value" | "onChangeText" | "placeholder">;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SearchBar: React.FC<SearchBarProps> = React.memo(function SearchBar({
  placeholder = "Search products...",
  onSearch,
  debounceMs = 300,
  inputProps,
}) {
  const [text, setText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the search callback
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      onSearch(text.trim());
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [text, debounceMs, onSearch]);

  const handleClear = useCallback(() => {
    setText("");
    onSearch("");
  }, [onSearch]);

  return (
    <View style={styles.container}>
      <Ionicons
        name="search"
        size={18}
        color="#6b7280"
        style={styles.icon}
      />

      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#6b7280"
        value={text}
        onChangeText={setText}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search products"
        {...inputProps}
      />

      {text.length > 0 && (
        <Pressable
          onPress={handleClear}
          hitSlop={8}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={18} color="#6b7280" />
        </Pressable>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    marginVertical: 6,
  },
  icon: {
    marginRight: 4,
  },
  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
});

export default SearchBar;
