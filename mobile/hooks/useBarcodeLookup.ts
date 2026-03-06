/**
 * BizPilot Mobile POS — useBarcodeLookup Hook
 *
 * Connects the barcode scanner component to product/stock lookup logic.
 * Used in stock counting (month-end-stock 5.2, 13.5) and tag management
 * (tags-categorization 11.5, 25.8).
 *
 * Why a hook instead of inline logic?
 * Multiple screens need barcode→product lookup (POS, stock count, tagging).
 * This hook encapsulates the lookup flow so each screen only provides
 * a callback for what to do with the found product.
 */

import { useState, useCallback } from "react";
import {
  lookupProductByBarcode,
  detectFormat,
  validateBarcode,
  type BarcodeProduct,
  type BarcodeScanResult,
  type BarcodeFormat,
} from "@/services/stock/BarcodeService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BarcodeLookupState {
  /** Whether the scanner modal is visible */
  isScannerOpen: boolean;
  /** The last scanned barcode result */
  lastScan: BarcodeScanResult | null;
  /** Whether a lookup is in progress */
  isProcessing: boolean;
  /** History of recent scans */
  recentScans: RecentScan[];
  /** Error message from the last scan */
  error: string | null;
}

export interface RecentScan {
  barcode: string;
  format: BarcodeFormat;
  product: BarcodeProduct | null;
  timestamp: number;
  found: boolean;
}

export interface UseBarcodeLookupOptions {
  /** Product catalog to search against */
  products: BarcodeProduct[];
  /** Called when a product is found */
  onProductFound?: (product: BarcodeProduct, barcode: string) => void;
  /** Called when no product matches the barcode */
  onProductNotFound?: (barcode: string) => void;
  /** Maximum number of recent scans to keep */
  maxHistory?: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBarcodeLookup(options: UseBarcodeLookupOptions) {
  const {
    products,
    onProductFound,
    onProductNotFound,
    maxHistory = 50,
  } = options;

  const [state, setState] = useState<BarcodeLookupState>({
    isScannerOpen: false,
    lastScan: null,
    isProcessing: false,
    recentScans: [],
    error: null,
  });

  /**
   * Opens the barcode scanner modal.
   */
  const openScanner = useCallback(() => {
    setState((prev) => ({ ...prev, isScannerOpen: true, error: null }));
  }, []);

  /**
   * Closes the barcode scanner modal.
   */
  const closeScanner = useCallback(() => {
    setState((prev) => ({ ...prev, isScannerOpen: false }));
  }, []);

  /**
   * Processes a scanned barcode: validates, looks up product, updates history.
   *
   * Why synchronous lookup?
   * Products are synced to local WatermelonDB. Lookup is an in-memory
   * array scan — no network call needed. Keeping it synchronous avoids
   * race conditions during rapid scanning.
   */
  const handleScan = useCallback(
    (rawBarcode: string) => {
      setState((prev) => ({ ...prev, isProcessing: true, error: null }));

      try {
        const format = detectFormat(rawBarcode);
        const validation = validateBarcode(rawBarcode);

        if (!validation.isValid) {
          setState((prev) => ({
            ...prev,
            isProcessing: false,
            error: `Invalid barcode: ${rawBarcode}`,
          }));
          return;
        }

        const result = lookupProductByBarcode(rawBarcode, products);

        const scan: RecentScan = {
          barcode: rawBarcode,
          format,
          product: result.product,
          timestamp: Date.now(),
          found: result.product !== null,
        };

        setState((prev) => ({
          ...prev,
          lastScan: result,
          isProcessing: false,
          recentScans: [scan, ...prev.recentScans].slice(0, maxHistory),
        }));

        if (result.product) {
          onProductFound?.(result.product, rawBarcode);
        } else {
          onProductNotFound?.(rawBarcode);
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: err instanceof Error ? err.message : "Scan failed",
        }));
      }
    },
    [products, onProductFound, onProductNotFound, maxHistory]
  );

  /**
   * Clears the scan history.
   */
  const clearHistory = useCallback(() => {
    setState((prev) => ({ ...prev, recentScans: [] }));
  }, []);

  return {
    ...state,
    openScanner,
    closeScanner,
    handleScan,
    clearHistory,
  };
}
