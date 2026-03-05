/**
 * UI tests for payment and sync components:
 * PaymentMethodSelector, SplitPaymentView, ReceiptView, SyncStatusPanel.
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

import PaymentMethodSelector from "../components/payments/PaymentMethodSelector";
import SplitPaymentView from "../components/payments/SplitPaymentView";
import ReceiptView from "../components/payments/ReceiptView";
import SyncStatusPanel from "../components/sync/SyncStatusPanel";

// ---------------------------------------------------------------------------
// PaymentMethodSelector
// ---------------------------------------------------------------------------

describe("PaymentMethodSelector", () => {
  const methods = [
    { id: "cash", name: "Cash", type: "cash" as const, icon: "cash-outline", isEnabled: true },
    { id: "card", name: "Card", type: "card" as const, icon: "card-outline", isEnabled: true },
    { id: "eft", name: "EFT", type: "eft" as const, icon: "swap-horizontal-outline", isEnabled: false },
  ];

  const baseProps = {
    methods,
    selectedMethodId: null,
    onSelectMethod: jest.fn(),
    orderTotal: 250.5,
    onProceed: jest.fn(),
  };

  test("renders payment methods", () => {
    const { getByTestId, getByText } = render(
      <PaymentMethodSelector {...baseProps} />,
    );

    expect(getByTestId("payment-method-selector")).toBeTruthy();
    expect(getByTestId("payment-method-cash")).toBeTruthy();
    expect(getByTestId("payment-method-card")).toBeTruthy();
    expect(getByTestId("payment-method-eft")).toBeTruthy();
    expect(getByText("Cash")).toBeTruthy();
    expect(getByText("Card")).toBeTruthy();
    expect(getByText("R 250.50")).toBeTruthy();
  });

  test("shows selected method", () => {
    const { getByTestId } = render(
      <PaymentMethodSelector {...baseProps} selectedMethodId="cash" />,
    );

    const cashTile = getByTestId("payment-method-cash");
    // Selected tile has the tileSelected style applied (borderColor: #3b82f6)
    expect(cashTile).toBeTruthy();
  });

  test("calls onProceed", () => {
    const onProceed = jest.fn();
    const { getByTestId } = render(
      <PaymentMethodSelector
        {...baseProps}
        selectedMethodId="cash"
        onProceed={onProceed}
      />,
    );

    fireEvent.press(getByTestId("payment-proceed"));
    expect(onProceed).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// SplitPaymentView
// ---------------------------------------------------------------------------

describe("SplitPaymentView", () => {
  const splits = [
    { id: "s1", methodName: "Cash", methodType: "cash", amount: 100 },
    { id: "s2", methodName: "Card", methodType: "card", amount: 50 },
  ];

  const baseProps = {
    orderTotal: 250,
    splits,
    onAddSplit: jest.fn(),
    onRemoveSplit: jest.fn(),
    onUpdateAmount: jest.fn(),
    remainingAmount: 100,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  test("renders split items", () => {
    const { getByTestId, getByText } = render(
      <SplitPaymentView {...baseProps} />,
    );

    expect(getByTestId("split-payment-view")).toBeTruthy();
    expect(getByTestId("split-item-s1")).toBeTruthy();
    expect(getByTestId("split-item-s2")).toBeTruthy();
    expect(getByText("Cash")).toBeTruthy();
    expect(getByText("Card")).toBeTruthy();
  });

  test("shows remaining amount", () => {
    const { getByTestId } = render(
      <SplitPaymentView {...baseProps} />,
    );

    expect(getByTestId("split-remaining")).toBeTruthy();
    expect(getByTestId("split-remaining").props.children).toBe("R 100.00");
  });

  test("disables confirm when remaining > 0", () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <SplitPaymentView {...baseProps} remainingAmount={50} onConfirm={onConfirm} />,
    );

    fireEvent.press(getByTestId("split-confirm"));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ReceiptView
// ---------------------------------------------------------------------------

describe("ReceiptView", () => {
  const items = [
    { name: "Cappuccino", quantity: 2, unitPrice: 35, total: 70 },
    { name: "Croissant", quantity: 1, unitPrice: 25, total: 25 },
  ];

  const baseProps = {
    receiptNumber: "REC-001",
    businessName: "Café Bliss",
    businessAddress: "12 Main Rd, Cape Town",
    date: "2025-01-15",
    time: "14:32",
    cashierName: "Jane",
    items,
    subtotal: 95,
    taxAmount: 14.25,
    taxRate: 15,
    total: 109.25,
    paymentMethod: "Cash",
    amountPaid: 120,
    changeGiven: 10.75,
    onPrint: jest.fn(),
    onEmail: jest.fn(),
    onNewSale: jest.fn(),
  };

  test("renders receipt with business info", () => {
    const { getByTestId, getByText } = render(
      <ReceiptView {...baseProps} />,
    );

    expect(getByTestId("receipt-view")).toBeTruthy();
    expect(getByTestId("receipt-business")).toBeTruthy();
    expect(getByText("Café Bliss")).toBeTruthy();
    expect(getByText("12 Main Rd, Cape Town")).toBeTruthy();
  });

  test("shows line items and totals", () => {
    const { getByTestId, getByText } = render(
      <ReceiptView {...baseProps} />,
    );

    expect(getByTestId("receipt-items")).toBeTruthy();
    expect(getByTestId("receipt-item-0")).toBeTruthy();
    expect(getByTestId("receipt-item-1")).toBeTruthy();
    expect(getByText("Cappuccino")).toBeTruthy();
    expect(getByText("Croissant")).toBeTruthy();
    expect(getByTestId("receipt-subtotal")).toBeTruthy();
    expect(getByTestId("receipt-total")).toBeTruthy();
  });

  test("calls onPrint", () => {
    const onPrint = jest.fn();
    const { getByTestId } = render(
      <ReceiptView {...baseProps} onPrint={onPrint} />,
    );

    fireEvent.press(getByTestId("receipt-print"));
    expect(onPrint).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// SyncStatusPanel
// ---------------------------------------------------------------------------

describe("SyncStatusPanel", () => {
  const entities = [
    {
      name: "Sales",
      pendingCount: 5,
      lastSyncAt: "2025-01-15T10:00:00.000Z",
      status: "pending" as const,
    },
    {
      name: "Products",
      pendingCount: 0,
      lastSyncAt: "2025-01-15T09:30:00.000Z",
      status: "synced" as const,
    },
    {
      name: "Customers",
      pendingCount: 2,
      lastSyncAt: null,
      status: "error" as const,
      errorMessage: "Network timeout",
    },
  ];

  const baseProps = {
    isOnline: true,
    entities,
    totalPending: 7,
    lastFullSyncAt: "2025-01-15T09:00:00.000Z",
    onSyncNow: jest.fn(),
    onRetryFailed: jest.fn(),
    isSyncing: false,
  };

  test("renders online/offline status", () => {
    const { getByTestId, getByText, rerender } = render(
      <SyncStatusPanel {...baseProps} />,
    );

    expect(getByTestId("sync-online-status")).toBeTruthy();
    expect(getByText("Online")).toBeTruthy();

    rerender(<SyncStatusPanel {...baseProps} isOnline={false} />);
    expect(getByText("Offline")).toBeTruthy();
  });

  test("shows entity sync statuses", () => {
    const { getByTestId, getByText } = render(
      <SyncStatusPanel {...baseProps} />,
    );

    expect(getByTestId("sync-entity-Sales")).toBeTruthy();
    expect(getByTestId("sync-entity-Products")).toBeTruthy();
    expect(getByTestId("sync-entity-Customers")).toBeTruthy();
    expect(getByText("Sales")).toBeTruthy();
    expect(getByText("Products")).toBeTruthy();
    expect(getByText("Network timeout")).toBeTruthy();
  });

  test("calls onSyncNow", () => {
    const onSyncNow = jest.fn();
    const { getByTestId } = render(
      <SyncStatusPanel {...baseProps} onSyncNow={onSyncNow} />,
    );

    fireEvent.press(getByTestId("sync-now-btn"));
    expect(onSyncNow).toHaveBeenCalledTimes(1);
  });
});
