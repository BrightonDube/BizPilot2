/**
 * BizPilot Mobile POS — Settings Zustand Store
 *
 * App-level settings persisted via WatermelonDB settings table.
 * Includes business configuration and device preferences.
 */

import { create } from "zustand";
import { DEFAULT_VAT_RATE } from "@/utils/constants";

interface SettingsStore {
  /** Business name displayed on receipts */
  businessName: string;
  /** VAT rate (0-1, e.g., 0.15 for 15%) */
  vatRate: number;
  /** Currency code (e.g., "ZAR") */
  currency: string;
  /** Receipt header text */
  receiptHeader: string;
  /** Receipt footer text */
  receiptFooter: string;
  /** Auto-logout timeout in minutes (0 = disabled) */
  autoLogoutMinutes: number;
  /** Whether haptic feedback is enabled */
  hapticsEnabled: boolean;
  /** Whether sound effects are enabled (e.g., on scan, payment) */
  soundEnabled: boolean;
  /** Number of product grid columns (tablet vs phone) */
  gridColumns: number;

  // Actions
  updateSetting: <K extends keyof SettingsStore>(
    key: K,
    value: SettingsStore[K]
  ) => void;
  loadSettings: (settings: Partial<SettingsStore>) => void;
  setSoundEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  // Sensible defaults for South African businesses
  businessName: "BizPilot POS",
  vatRate: DEFAULT_VAT_RATE,
  currency: "ZAR",
  receiptHeader: "",
  receiptFooter: "Thank you for your purchase!",
  autoLogoutMinutes: 30,
  hapticsEnabled: true,
  soundEnabled: true,
  gridColumns: 4,

  updateSetting: (key, value) =>
    set((state) => ({ ...state, [key]: value })),

  loadSettings: (settings) =>
    set((state) => ({ ...state, ...settings })),

  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
}));
