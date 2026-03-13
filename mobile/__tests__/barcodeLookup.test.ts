/**
 * Tests for useBarcodeLookup hook (Tasks 5.2, 11.5, 13.5, 25.8)
 *
 * Validates:
 * - Scanner open/close state management
 * - Product lookup by barcode
 * - Scan history tracking
 * - Callbacks for found/not-found products
 * - Error handling for invalid barcodes
 */

import { renderHook, act } from "@testing-library/react-native";
import { useBarcodeLookup } from "@/hooks/useBarcodeLookup";
import type { BarcodeProduct } from "@/services/stock/BarcodeService";

// Mock BarcodeService
jest.mock("@/services/stock/BarcodeService", () => ({
  detectFormat: jest.fn((barcode: string) => {
    if (barcode.length === 13) return "EAN-13";
    if (barcode.length === 12) return "UPC-A";
    return "UNKNOWN";
  }),
  validateBarcode: jest.fn((barcode: string) => ({
    isValid: barcode.length >= 8,
    format: barcode.length === 13 ? "EAN-13" : "UNKNOWN",
    error: barcode.length < 8 ? "Too short" : null,
  })),
  lookupProductByBarcode: jest.fn(
    (barcode: string, products: BarcodeProduct[]) => {
      const product = products.find((p) => p.barcode === barcode) ?? null;
      return {
        rawValue: barcode,
        format: barcode.length === 13 ? "EAN-13" : "UNKNOWN",
        isValid: true,
        product,
        timestamp: new Date().toISOString(),
      };
    }
  ),
}));

const MOCK_PRODUCTS: BarcodeProduct[] = [
  {
    id: "p1",
    name: "Coca-Cola 330ml",
    sku: "COKE-330",
    barcode: "5449000000996",
    price: 15.99,
    currentStock: 24,
    category: "Beverages",
  },
  {
    id: "p2",
    name: "Lay's Classic 40g",
    sku: "LAYS-40",
    barcode: "6009510800012",
    price: 9.99,
    currentStock: 48,
    category: "Snacks",
  },
];

describe("useBarcodeLookup", () => {
  it("starts with scanner closed and empty state", () => {
    const { result } = renderHook(() =>
      useBarcodeLookup({ products: MOCK_PRODUCTS })
    );

    expect(result.current.isScannerOpen).toBe(false);
    expect(result.current.lastScan).toBeNull();
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.recentScans).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("opens and closes the scanner", () => {
    const { result } = renderHook(() =>
      useBarcodeLookup({ products: MOCK_PRODUCTS })
    );

    act(() => result.current.openScanner());
    expect(result.current.isScannerOpen).toBe(true);

    act(() => result.current.closeScanner());
    expect(result.current.isScannerOpen).toBe(false);
  });

  it("finds a product by barcode", () => {
    const onProductFound = jest.fn();
    const { result } = renderHook(() =>
      useBarcodeLookup({ products: MOCK_PRODUCTS, onProductFound })
    );

    act(() => result.current.handleScan("5449000000996"));

    expect(result.current.lastScan).not.toBeNull();
    expect(result.current.lastScan?.product?.name).toBe("Coca-Cola 330ml");
    expect(onProductFound).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Coca-Cola 330ml" }),
      "5449000000996"
    );
  });

  it("calls onProductNotFound when barcode has no match", () => {
    const onProductNotFound = jest.fn();
    const { result } = renderHook(() =>
      useBarcodeLookup({ products: MOCK_PRODUCTS, onProductNotFound })
    );

    act(() => result.current.handleScan("9999999999999"));

    expect(result.current.lastScan?.product).toBeNull();
    expect(onProductNotFound).toHaveBeenCalledWith("9999999999999");
  });

  it("tracks recent scans in history", () => {
    const { result } = renderHook(() =>
      useBarcodeLookup({ products: MOCK_PRODUCTS })
    );

    act(() => result.current.handleScan("5449000000996"));
    act(() => result.current.handleScan("6009510800012"));

    expect(result.current.recentScans).toHaveLength(2);
    // Most recent first
    expect(result.current.recentScans[0].barcode).toBe("6009510800012");
    expect(result.current.recentScans[1].barcode).toBe("5449000000996");
  });

  it("limits history to maxHistory", () => {
    const { result } = renderHook(() =>
      useBarcodeLookup({ products: MOCK_PRODUCTS, maxHistory: 2 })
    );

    act(() => result.current.handleScan("5449000000996"));
    act(() => result.current.handleScan("6009510800012"));
    act(() => result.current.handleScan("5449000000996"));

    expect(result.current.recentScans).toHaveLength(2);
  });

  it("clears history", () => {
    const { result } = renderHook(() =>
      useBarcodeLookup({ products: MOCK_PRODUCTS })
    );

    act(() => result.current.handleScan("5449000000996"));
    expect(result.current.recentScans).toHaveLength(1);

    act(() => result.current.clearHistory());
    expect(result.current.recentScans).toHaveLength(0);
  });

  it("sets error for invalid barcodes", () => {
    const { result } = renderHook(() =>
      useBarcodeLookup({ products: MOCK_PRODUCTS })
    );

    act(() => result.current.handleScan("123")); // Too short

    expect(result.current.error).toContain("Invalid barcode");
    expect(result.current.isProcessing).toBe(false);
  });

  it("marks found/not-found in scan history", () => {
    const { result } = renderHook(() =>
      useBarcodeLookup({ products: MOCK_PRODUCTS })
    );

    act(() => result.current.handleScan("5449000000996")); // Found
    act(() => result.current.handleScan("9999999999999")); // Not found

    expect(result.current.recentScans[0].found).toBe(false);
    expect(result.current.recentScans[1].found).toBe(true);
  });
});
