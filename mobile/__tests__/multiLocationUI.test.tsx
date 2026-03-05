/**
 * Multi-location component UI tests.
 *
 * Covers LocationListScreen, TransferListScreen, TransferDetailScreen,
 * and ReceivingScreen with 12 tests total.
 */
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));
jest.mock("@/utils/haptics", () => ({
  triggerHaptic: jest.fn(),
}));

import LocationListScreen from "../components/multi-location/LocationListScreen";
import TransferListScreen from "../components/multi-location/TransferListScreen";
import TransferDetailScreen from "../components/multi-location/TransferDetailScreen";
import ReceivingScreen from "../components/multi-location/ReceivingScreen";

// ─── LocationListScreen ──────────────────────────────────────────────────────

const locations = [
  {
    id: "loc1",
    name: "Main Warehouse",
    address: "123 Industrial Rd",
    totalProducts: 150,
    totalValue: 50000,
    lowStockCount: 5,
    lastSyncAt: new Date().toISOString(),
    isActive: true,
  },
  {
    id: "loc2",
    name: "Branch Store",
    address: "456 High St",
    totalProducts: 80,
    totalValue: 25000,
    lowStockCount: 0,
    lastSyncAt: new Date().toISOString(),
    isActive: false,
  },
];

const baseLocationProps = {
  locations,
  onLocationPress: jest.fn(),
  onAddLocation: jest.fn(),
  searchQuery: "",
  onSearchChange: jest.fn(),
};

describe("LocationListScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders location cards with names", () => {
    const { getByTestId, getByText } = render(
      <LocationListScreen {...baseLocationProps} />,
    );

    expect(getByTestId("location-list")).toBeTruthy();
    expect(getByTestId("location-card-loc1")).toBeTruthy();
    expect(getByTestId("location-card-loc2")).toBeTruthy();
    expect(getByText("Main Warehouse")).toBeTruthy();
    expect(getByText("Branch Store")).toBeTruthy();
  });

  it("shows loading state", () => {
    const { getByTestId } = render(
      <LocationListScreen {...baseLocationProps} isLoading />,
    );

    expect(getByTestId("location-loading")).toBeTruthy();
  });

  it("calls onLocationPress", () => {
    const onLocationPress = jest.fn();
    const { getByTestId } = render(
      <LocationListScreen {...baseLocationProps} onLocationPress={onLocationPress} />,
    );

    fireEvent.press(getByTestId("location-card-loc1"));
    expect(onLocationPress).toHaveBeenCalledWith("loc1");
  });
});

// ─── TransferListScreen ──────────────────────────────────────────────────────

const transfers = [
  {
    id: "t1",
    transferNumber: "TRF-001",
    fromLocation: "Main Warehouse",
    toLocation: "Branch Store",
    itemCount: 5,
    totalValue: 1200,
    status: "pending" as const,
    createdAt: "2024-06-01T10:00:00Z",
    createdBy: "Admin",
  },
  {
    id: "t2",
    transferNumber: "TRF-002",
    fromLocation: "Branch Store",
    toLocation: "Main Warehouse",
    itemCount: 3,
    totalValue: 800,
    status: "in_transit" as const,
    createdAt: "2024-06-02T10:00:00Z",
    createdBy: "Manager",
  },
];

const baseTransferListProps = {
  transfers,
  onTransferPress: jest.fn(),
  onCreateTransfer: jest.fn(),
  filterStatus: "all" as const,
  onFilterChange: jest.fn(),
};

describe("TransferListScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders transfer cards", () => {
    const { getByTestId, getByText } = render(
      <TransferListScreen {...baseTransferListProps} />,
    );

    expect(getByTestId("transfer-list")).toBeTruthy();
    expect(getByTestId("transfer-card-t1")).toBeTruthy();
    expect(getByTestId("transfer-card-t2")).toBeTruthy();
    expect(getByText("TRF-001")).toBeTruthy();
    expect(getByText("TRF-002")).toBeTruthy();
  });

  it("shows status filter pills", () => {
    const { getByTestId } = render(
      <TransferListScreen {...baseTransferListProps} />,
    );

    expect(getByTestId("transfer-filter-all")).toBeTruthy();
    expect(getByTestId("transfer-filter-pending")).toBeTruthy();
    expect(getByTestId("transfer-filter-in_transit")).toBeTruthy();
    expect(getByTestId("transfer-filter-received")).toBeTruthy();
  });

  it("calls onCreateTransfer", () => {
    const onCreateTransfer = jest.fn();
    const { getByTestId } = render(
      <TransferListScreen {...baseTransferListProps} onCreateTransfer={onCreateTransfer} />,
    );

    fireEvent.press(getByTestId("transfer-create"));
    expect(onCreateTransfer).toHaveBeenCalledTimes(1);
  });
});

// ─── TransferDetailScreen ────────────────────────────────────────────────────

const transferItems = [
  { id: "ti1", productName: "Gadget X", sku: "GX-01", requestedQty: 20, sentQty: 18, receivedQty: null, unitCost: 50 },
  { id: "ti2", productName: "Gadget Y", sku: "GY-02", requestedQty: 10, sentQty: 10, receivedQty: null, unitCost: 30 },
];

const baseTransferDetailProps = {
  transferNumber: "TRF-001",
  fromLocation: "Main Warehouse",
  toLocation: "Branch Store",
  status: "pending" as const,
  items: transferItems,
  createdBy: "Admin",
  createdAt: "2024-06-01T10:00:00Z",
  onBack: jest.fn(),
};

describe("TransferDetailScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders transfer header and items", () => {
    const { getByTestId, getByText } = render(
      <TransferDetailScreen {...baseTransferDetailProps} />,
    );

    expect(getByTestId("transfer-detail")).toBeTruthy();
    expect(getByText("TRF-001")).toBeTruthy();
    expect(getByText("Main Warehouse")).toBeTruthy();
    expect(getByText("Branch Store")).toBeTruthy();
    expect(getByTestId("transfer-item-ti1")).toBeTruthy();
    expect(getByTestId("transfer-item-ti2")).toBeTruthy();
  });

  it("shows action buttons based on status", () => {
    const onApprove = jest.fn();
    const onCancel = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <TransferDetailScreen
        {...baseTransferDetailProps}
        status="pending"
        onApprove={onApprove}
        onCancel={onCancel}
      />,
    );

    // pending status shows Approve and Cancel
    expect(getByTestId("transfer-approve")).toBeTruthy();
    expect(getByTestId("transfer-cancel")).toBeTruthy();
    // Receive is only shown for in_transit
    expect(queryByTestId("transfer-receive")).toBeNull();
  });

  it("calls onBack", () => {
    const onBack = jest.fn();
    const { getByTestId } = render(
      <TransferDetailScreen {...baseTransferDetailProps} onBack={onBack} />,
    );

    fireEvent.press(getByTestId("transfer-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// ─── ReceivingScreen ─────────────────────────────────────────────────────────

const receivingItems = [
  { id: "ri1", productName: "Product A", sku: "PA-01", expectedQty: 50, receivedQty: 0, condition: "good" as const },
  { id: "ri2", productName: "Product B", sku: "PB-02", expectedQty: 30, receivedQty: 30, condition: "good" as const },
];

const baseReceivingProps = {
  transferNumber: "TRF-001",
  fromLocation: "Main Warehouse",
  items: receivingItems,
  onUpdateQty: jest.fn(),
  onUpdateCondition: jest.fn(),
  onReceiveAll: jest.fn(),
  onSubmit: jest.fn(),
  onBack: jest.fn(),
  notes: "",
  onNotesChange: jest.fn(),
};

describe("ReceivingScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders items with expected qty", () => {
    const { getByTestId, getByText } = render(
      <ReceivingScreen {...baseReceivingProps} />,
    );

    expect(getByTestId("receiving-screen")).toBeTruthy();
    expect(getByTestId("receiving-item-ri1")).toBeTruthy();
    expect(getByTestId("receiving-item-ri2")).toBeTruthy();
    expect(getByText("Product A")).toBeTruthy();
    expect(getByText("Product B")).toBeTruthy();
  });

  it("calls onReceiveAll", () => {
    const onReceiveAll = jest.fn();
    const { getByTestId } = render(
      <ReceivingScreen {...baseReceivingProps} onReceiveAll={onReceiveAll} />,
    );

    fireEvent.press(getByTestId("receiving-receive-all"));
    expect(onReceiveAll).toHaveBeenCalledTimes(1);
  });

  it("calls onSubmit", () => {
    const onSubmit = jest.fn();
    const { getByTestId } = render(
      <ReceivingScreen {...baseReceivingProps} onSubmit={onSubmit} />,
    );

    fireEvent.press(getByTestId("receiving-submit"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
