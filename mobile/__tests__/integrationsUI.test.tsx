/**
 * UI tests for integration components:
 * SageConnectionPanel, XeroConnectionPanel, WooCommercePanel,
 * SyncLogViewer, AccountMappingView.
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Warning: "warning", Success: "success" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));
jest.mock("@/utils/haptics", () => ({
  triggerHaptic: jest.fn(),
}));

import SageConnectionPanel from "../components/integrations/SageConnectionPanel";
import XeroConnectionPanel from "../components/integrations/XeroConnectionPanel";
import WooCommercePanel from "../components/integrations/WooCommercePanel";
import SyncLogViewer from "../components/integrations/SyncLogViewer";
import AccountMappingView from "../components/integrations/AccountMappingView";

// ---------------------------------------------------------------------------
// SageConnectionPanel
// ---------------------------------------------------------------------------

describe("SageConnectionPanel", () => {
  const baseProps = {
    isConnected: true,
    lastSyncAt: "2025-01-15T10:00:00.000Z",
    companyName: "Acme Trading",
    syncStatus: "idle" as const,
    errorMessage: null,
    onConnect: jest.fn(),
    onDisconnect: jest.fn(),
    onSync: jest.fn(),
    onViewLogs: jest.fn(),
    pendingTransactions: 5,
  };

  test("renders connected state with company name", () => {
    const { getByTestId, getByText } = render(
      <SageConnectionPanel {...baseProps} />,
    );

    expect(getByTestId("sage-connection")).toBeTruthy();
    expect(getByTestId("sage-company")).toBeTruthy();
    expect(getByText("Acme Trading")).toBeTruthy();
    expect(getByText("Connected")).toBeTruthy();
  });

  test("renders disconnected state", () => {
    const { getByText, getByTestId, queryByTestId } = render(
      <SageConnectionPanel
        {...baseProps}
        isConnected={false}
        companyName={null}
      />,
    );

    expect(getByText("Disconnected")).toBeTruthy();
    expect(queryByTestId("sage-company")).toBeNull();
    expect(getByTestId("sage-connect-btn")).toBeTruthy();
  });

  test("calls onSync when sync button pressed", () => {
    const onSync = jest.fn();
    const { getByTestId } = render(
      <SageConnectionPanel {...baseProps} onSync={onSync} />,
    );

    fireEvent.press(getByTestId("sage-sync-btn"));
    expect(onSync).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// XeroConnectionPanel
// ---------------------------------------------------------------------------

describe("XeroConnectionPanel", () => {
  const baseProps = {
    isConnected: true,
    lastSyncAt: "2025-01-15T10:00:00.000Z",
    organizationName: "Xero Org Ltd",
    syncStatus: "idle" as const,
    errorMessage: null,
    onConnect: jest.fn(),
    onDisconnect: jest.fn(),
    onSync: jest.fn(),
    onViewLogs: jest.fn(),
    pendingInvoices: 3,
    mappedAccounts: 12,
    onMapAccounts: jest.fn(),
  };

  test("renders connected state with org name", () => {
    const { getByTestId, getByText } = render(
      <XeroConnectionPanel {...baseProps} />,
    );

    expect(getByTestId("xero-connection")).toBeTruthy();
    expect(getByTestId("xero-org")).toBeTruthy();
    expect(getByText("Xero Org Ltd")).toBeTruthy();
    expect(getByText("Connected")).toBeTruthy();
  });

  test("shows mapped accounts count", () => {
    const { getByTestId, getByText } = render(
      <XeroConnectionPanel {...baseProps} />,
    );

    expect(getByTestId("xero-mapped")).toBeTruthy();
    expect(getByText("12")).toBeTruthy();
    expect(getByText("Mapped")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// WooCommercePanel
// ---------------------------------------------------------------------------

describe("WooCommercePanel", () => {
  const baseProps = {
    isConnected: true,
    storeUrl: "https://shop.example.com",
    lastSyncAt: "2025-01-15T10:00:00.000Z",
    syncStatus: "idle" as const,
    productsSynced: 42,
    ordersSynced: 18,
    stockSynced: 7,
    errorMessage: null,
    onConnect: jest.fn(),
    onDisconnect: jest.fn(),
    onSyncProducts: jest.fn(),
    onSyncOrders: jest.fn(),
    onSyncStock: jest.fn(),
    onViewLogs: jest.fn(),
  };

  test("renders store URL and sync counts", () => {
    const { getByTestId, getByText } = render(
      <WooCommercePanel {...baseProps} />,
    );

    expect(getByTestId("woo-store-url")).toBeTruthy();
    expect(getByText("https://shop.example.com")).toBeTruthy();
    expect(getByTestId("woo-products-synced")).toBeTruthy();
    expect(getByText("42")).toBeTruthy();
    expect(getByTestId("woo-orders-synced")).toBeTruthy();
    expect(getByText("18")).toBeTruthy();
  });

  test("calls onSyncProducts", () => {
    const onSyncProducts = jest.fn();
    const { getByTestId } = render(
      <WooCommercePanel {...baseProps} onSyncProducts={onSyncProducts} />,
    );

    fireEvent.press(getByTestId("woo-sync-products"));
    expect(onSyncProducts).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// SyncLogViewer
// ---------------------------------------------------------------------------

describe("SyncLogViewer", () => {
  const logs = [
    {
      id: "log1",
      timestamp: "2025-01-15T10:00:00.000Z",
      integration: "sage" as const,
      operation: "Push Invoices",
      status: "success" as const,
      message: "12 invoices pushed",
    },
    {
      id: "log2",
      timestamp: "2025-01-15T09:00:00.000Z",
      integration: "xero" as const,
      operation: "Pull Contacts",
      status: "error" as const,
      message: "Auth token expired",
    },
  ];

  const baseProps = {
    logs,
    filterIntegration: "",
    onFilterChange: jest.fn(),
    filterStatus: "",
    onStatusFilterChange: jest.fn(),
    onBack: jest.fn(),
    hasMore: false,
  };

  test("renders log entries", () => {
    const { getByTestId, getByText } = render(
      <SyncLogViewer {...baseProps} />,
    );

    expect(getByTestId("sync-log-viewer")).toBeTruthy();
    expect(getByTestId("sync-log-entry-log1")).toBeTruthy();
    expect(getByTestId("sync-log-entry-log2")).toBeTruthy();
    expect(getByText("Push Invoices")).toBeTruthy();
    expect(getByText("Pull Contacts")).toBeTruthy();
  });

  test("filters by integration", () => {
    const onFilterChange = jest.fn();
    const { getByTestId } = render(
      <SyncLogViewer {...baseProps} onFilterChange={onFilterChange} />,
    );

    fireEvent.press(getByTestId("sync-log-filter-sage"));
    expect(onFilterChange).toHaveBeenCalledWith("sage");
  });

  test("shows load more when hasMore", () => {
    const onLoadMore = jest.fn();
    const { getByTestId } = render(
      <SyncLogViewer {...baseProps} hasMore={true} onLoadMore={onLoadMore} />,
    );

    expect(getByTestId("sync-log-load-more")).toBeTruthy();
    fireEvent.press(getByTestId("sync-log-load-more"));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// AccountMappingView
// ---------------------------------------------------------------------------

describe("AccountMappingView", () => {
  const mappings = [
    {
      id: "m1",
      posAccountName: "Walk-in Sales",
      posAccountCode: "4000",
      externalAccountName: "Revenue – Retail",
      externalAccountCode: "REV-001",
      isMapped: true,
      category: "revenue" as const,
    },
    {
      id: "m2",
      posAccountName: "Office Supplies",
      posAccountCode: "5001",
      externalAccountName: null,
      externalAccountCode: null,
      isMapped: false,
      category: "expense" as const,
    },
  ];

  const baseProps = {
    mappings,
    onMapAccount: jest.fn(),
    onUnmapAccount: jest.fn(),
    onAutoMap: jest.fn(),
    onSave: jest.fn(),
    onBack: jest.fn(),
    filterCategory: "",
    onFilterChange: jest.fn(),
  };

  test("renders mapping list", () => {
    const { getByTestId, getByText } = render(
      <AccountMappingView {...baseProps} />,
    );

    expect(getByTestId("account-mapping-view")).toBeTruthy();
    expect(getByTestId("account-mapping-item-m1")).toBeTruthy();
    expect(getByTestId("account-mapping-item-m2")).toBeTruthy();
    expect(getByText("Walk-in Sales")).toBeTruthy();
    expect(getByText("Office Supplies")).toBeTruthy();
  });

  test("calls onAutoMap", () => {
    const onAutoMap = jest.fn();
    const { getByTestId } = render(
      <AccountMappingView {...baseProps} onAutoMap={onAutoMap} />,
    );

    fireEvent.press(getByTestId("account-mapping-auto"));
    expect(onAutoMap).toHaveBeenCalledTimes(1);
  });
});
