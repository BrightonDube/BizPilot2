/**
 * BizPilot Mobile POS — useKeyboardShortcuts Hook
 *
 * Provides hardware keyboard shortcut support for POS operations.
 * Critical for iPads with Magic Keyboard and Windows tablets.
 *
 * Why keyboard shortcuts in a touch-first POS?
 * Many hospitality POS stations use iPad + Magic Keyboard or Windows
 * tablets with keyboard covers. Keyboard shortcuts (F1–F12, Ctrl+P)
 * let trained staff process orders significantly faster than touch
 * alone. This is a competitive feature vs. Square/Toast.
 *
 * Shortcut map (inspired by industry-standard POS key bindings):
 * - F1: New sale / clear cart
 * - F2: Hold cart
 * - F3: Recall held cart
 * - F4: Search products (focus search bar)
 * - F5: Manual sync
 * - F8: Checkout / pay
 * - F9: Void last order
 * - Esc: Close current modal
 * - Enter: Confirm current action
 * - +/- : Increment/decrement selected item quantity
 * - Delete: Remove selected item from cart
 *
 * Why a hook instead of a global event listener?
 * A hook lets each screen register its own shortcuts. The POS screen
 * registers F1–F9, but the orders screen registers different shortcuts.
 * When the user navigates away, the hook cleans up automatically.
 */

import { useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A keyboard shortcut definition.
 * Supports single keys, function keys, and modifier combos.
 */
export interface KeyboardShortcut {
  /** Human-readable label for the shortcut (shown in help overlay) */
  label: string;
  /** The key to listen for (e.g., "F1", "Escape", "+", "p") */
  key: string;
  /** Whether Ctrl/Cmd must be held */
  ctrlKey?: boolean;
  /** Whether Shift must be held */
  shiftKey?: boolean;
  /** Whether Alt/Option must be held */
  altKey?: boolean;
  /** The handler to invoke when the shortcut is triggered */
  handler: () => void;
}

// ---------------------------------------------------------------------------
// Default POS shortcuts factory
// ---------------------------------------------------------------------------

export interface PosShortcutActions {
  onNewSale?: () => void;
  onHoldCart?: () => void;
  onRecallCart?: () => void;
  onFocusSearch?: () => void;
  onSync?: () => void;
  onCheckout?: () => void;
  onVoidOrder?: () => void;
  onCloseModal?: () => void;
  onConfirm?: () => void;
}

/**
 * Create the standard set of POS keyboard shortcuts.
 * Pass handlers for the actions you want to support.
 */
export function createPosShortcuts(actions: PosShortcutActions): KeyboardShortcut[] {
  const shortcuts: KeyboardShortcut[] = [];

  if (actions.onNewSale) {
    shortcuts.push({ label: "New Sale", key: "F1", handler: actions.onNewSale });
  }
  if (actions.onHoldCart) {
    shortcuts.push({ label: "Hold Cart", key: "F2", handler: actions.onHoldCart });
  }
  if (actions.onRecallCart) {
    shortcuts.push({ label: "Recall Cart", key: "F3", handler: actions.onRecallCart });
  }
  if (actions.onFocusSearch) {
    shortcuts.push({ label: "Search Products", key: "F4", handler: actions.onFocusSearch });
  }
  if (actions.onSync) {
    shortcuts.push({ label: "Sync Now", key: "F5", handler: actions.onSync });
  }
  if (actions.onCheckout) {
    shortcuts.push({ label: "Checkout", key: "F8", handler: actions.onCheckout });
  }
  if (actions.onVoidOrder) {
    shortcuts.push({ label: "Void Order", key: "F9", handler: actions.onVoidOrder });
  }
  if (actions.onCloseModal) {
    shortcuts.push({ label: "Close", key: "Escape", handler: actions.onCloseModal });
  }
  if (actions.onConfirm) {
    shortcuts.push({ label: "Confirm", key: "Enter", handler: actions.onConfirm });
  }

  return shortcuts;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Register keyboard shortcuts for the current screen.
 * Shortcuts are automatically cleaned up when the component unmounts.
 *
 * Only works on platforms with hardware keyboard support:
 * - iOS (iPad with Magic Keyboard)
 * - Android (tablets with Bluetooth keyboard)
 * - Web (React Native Web / Windows)
 *
 * On platforms without keyboard support, this hook is a no-op.
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const currentShortcuts = shortcutsRef.current;

    for (const shortcut of currentShortcuts) {
      const keyMatch = event.key === shortcut.key;
      const ctrlMatch = shortcut.ctrlKey
        ? event.ctrlKey || event.metaKey
        : true;
      const shiftMatch = shortcut.shiftKey ? event.shiftKey : true;
      const altMatch = shortcut.altKey ? event.altKey : true;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        shortcut.handler();
        return;
      }
    }
  }, []);

  useEffect(() => {
    // Keyboard shortcuts only work on web and platforms with keydown events
    if (Platform.OS === "web") {
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }

    // On iOS/Android, we'd use the onKeyPress prop or a native module.
    // For now, keyboard shortcuts are web-only. The native implementation
    // requires react-native-keyevent which is not yet in dependencies.
    // TODO: Add react-native-keyevent for native keyboard support
  }, [handleKeyDown]);
}
