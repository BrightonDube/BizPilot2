/**
 * BizPilot Mobile POS — BarcodeService, BarcodeScannerView & MapView Tests
 *
 * Pure-function tests for the barcode service plus UI tests for the
 * scanner view and delivery map view components.
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

import {
  detectBarcodeFormat,
  validateEAN13,
  lookupProduct,
  processScan,
  fuzzyBarcodeMatch,
  type BarcodeProduct,
} from "../services/stock/BarcodeService";
import BarcodeScannerView from "../components/stock/BarcodeScannerView";
import MapView from "../components/delivery/MapView";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));
jest.mock("@/utils/haptics", () => ({
  triggerHaptic: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleCatalog: BarcodeProduct[] = [
  {
    id: "prod1",
    name: "Coca-Cola 330ml",
    sku: "SKU-001",
    barcode: "5449000000996",
    price: 15.99,
    currentStock: 48,
    category: "Beverages",
  },
  {
    id: "prod2",
    name: "Lay's Original 150g",
    sku: "SKU-002",
    barcode: "6009510800013",
    price: 24.99,
    currentStock: 30,
    category: "Snacks",
  },
];

const sampleDeliveries = [
  {
    id: "del1",
    address: "42 Main Rd, Cape Town",
    latitude: -33.9249,
    longitude: 18.4241,
    status: "in_transit" as const,
    driverName: "John",
    estimatedArrival: "14:30",
  },
  {
    id: "del2",
    address: "10 Long St, Stellenbosch",
    latitude: -33.9321,
    longitude: 18.8602,
    status: "pending" as const,
  },
];

// ===========================================================================
// BarcodeService — Pure Functions
// ===========================================================================

describe("BarcodeService", () => {
  it("detectBarcodeFormat recognizes EAN-13 (13 digits)", () => {
    expect(detectBarcodeFormat("5449000000996")).toBe("EAN-13");
  });

  it("detectBarcodeFormat recognizes EAN-8 (8 digits)", () => {
    expect(detectBarcodeFormat("96385074")).toBe("EAN-8");
  });

  it("validateEAN13 validates correct check digit", () => {
    // 5449000000996 is a valid EAN-13 (Coca-Cola)
    expect(validateEAN13("5449000000996")).toBe(true);
  });

  it("validateEAN13 rejects invalid check digit", () => {
    // Change last digit to make it invalid
    expect(validateEAN13("5449000000995")).toBe(false);
  });

  it("lookupProduct finds product by barcode", () => {
    const result = lookupProduct("5449000000996", sampleCatalog);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Coca-Cola 330ml");
  });

  it("lookupProduct returns null for unknown barcode", () => {
    const result = lookupProduct("0000000000000", sampleCatalog);
    expect(result).toBeNull();
  });

  it("processScan returns valid result", () => {
    const result = processScan("5449000000996", sampleCatalog, "2024-06-15T10:00:00Z");
    expect(result.isValid).toBe(true);
    expect(result.format).toBe("EAN-13");
    expect(result.product).not.toBeNull();
    expect(result.product!.id).toBe("prod1");
    expect(result.timestamp).toBe("2024-06-15T10:00:00Z");
  });

  it("fuzzyBarcodeMatch finds partial matches", () => {
    const matches = fuzzyBarcodeMatch("544900", sampleCatalog);
    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe("prod1");
  });
});

// ===========================================================================
// BarcodeScannerView
// ===========================================================================

describe("BarcodeScannerView", () => {
  function makeScannerProps(overrides = {}) {
    return {
      onScan: jest.fn(),
      lastScanResult: null,
      recentScans: [],
      onClearHistory: jest.fn(),
      isProcessing: false,
      ...overrides,
    };
  }

  it("renders input and scan button", () => {
    const props = makeScannerProps();
    const { getByTestId } = render(<BarcodeScannerView {...props} />);

    expect(getByTestId("barcode-scanner-view")).toBeTruthy();
    expect(getByTestId("barcode-input")).toBeTruthy();
    expect(getByTestId("barcode-scan-btn")).toBeTruthy();
  });

  it("calls onScan when button pressed", () => {
    const props = makeScannerProps();
    const { getByTestId } = render(<BarcodeScannerView {...props} />);

    const input = getByTestId("barcode-input");
    fireEvent.changeText(input, "5449000000996");
    fireEvent.press(getByTestId("barcode-scan-btn"));

    expect(props.onScan).toHaveBeenCalledWith("5449000000996");
  });

  it("shows last scan result", () => {
    const props = makeScannerProps({
      lastScanResult: {
        productName: "Coca-Cola 330ml",
        isValid: true,
        format: "EAN-13",
      },
    });
    const { getByTestId, getByText } = render(<BarcodeScannerView {...props} />);

    expect(getByTestId("barcode-last-result")).toBeTruthy();
    expect(getByText("Coca-Cola 330ml")).toBeTruthy();
  });
});

// ===========================================================================
// MapView (Delivery)
// ===========================================================================

describe("MapView", () => {
  function makeMapProps(overrides = {}) {
    return {
      deliveries: sampleDeliveries,
      onDeliveryPress: jest.fn(),
      selectedDeliveryId: undefined,
      isLoading: false,
      ...overrides,
    };
  }

  it("renders delivery cards", () => {
    const props = makeMapProps();
    const { getByTestId } = render(<MapView {...props} />);

    expect(getByTestId("delivery-map-view")).toBeTruthy();
    expect(getByTestId("delivery-card-del1")).toBeTruthy();
    expect(getByTestId("delivery-card-del2")).toBeTruthy();
  });

  it("shows map placeholder", () => {
    const props = makeMapProps();
    const { getByTestId } = render(<MapView {...props} />);

    expect(getByTestId("delivery-map-placeholder")).toBeTruthy();
  });

  it("calls onDeliveryPress", () => {
    const props = makeMapProps();
    const { getByTestId } = render(<MapView {...props} />);

    fireEvent.press(getByTestId("delivery-card-del1"));
    expect(props.onDeliveryPress).toHaveBeenCalledWith("del1");
  });
});
