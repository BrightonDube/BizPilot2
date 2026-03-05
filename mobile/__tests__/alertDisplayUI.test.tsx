/**
 * UI tests for the AlertDisplay inventory component.
 */

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Warning: "warning" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import AlertDisplay from "../components/inventory/AlertDisplay";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

type AlertSeverity = "critical" | "warning" | "info";
type AlertType =
  | "low_stock"
  | "out_of_stock"
  | "expiring_soon"
  | "reorder_needed"
  | "count_discrepancy";

interface InventoryAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  productName: string;
  productId: string;
  message: string;
  currentStock?: number;
  reorderLevel?: number;
  expiryDate?: string;
  createdAt: string;
  isAcknowledged: boolean;
}

const makeAlert = (overrides?: Partial<InventoryAlert>): InventoryAlert => ({
  id: "a1",
  type: "low_stock",
  severity: "critical",
  productName: "Tomato Sauce",
  productId: "prod1",
  message: "Stock below reorder level",
  currentStock: 3,
  reorderLevel: 10,
  createdAt: new Date().toISOString(),
  isAcknowledged: false,
  ...overrides,
});

const sampleAlerts: InventoryAlert[] = [
  makeAlert({ id: "a1", severity: "critical", productName: "Tomato Sauce" }),
  makeAlert({
    id: "a2",
    severity: "warning",
    type: "expiring_soon",
    productName: "Fresh Cream",
    message: "Expires in 2 days",
    expiryDate: "2025-08-01",
  }),
  makeAlert({
    id: "a3",
    severity: "info",
    type: "reorder_needed",
    productName: "Napkins",
    message: "Reorder suggested",
  }),
];

// ===========================================================================
// AlertDisplay
// ===========================================================================

describe("AlertDisplay", () => {
  it("renders alert cards with severity icons", () => {
    const { getByTestId, getByText } = render(
      <AlertDisplay alerts={sampleAlerts} onAcknowledge={jest.fn()} />,
    );

    expect(getByTestId("alert-display")).toBeTruthy();
    expect(getByTestId("alert-card-a1")).toBeTruthy();
    expect(getByTestId("alert-card-a2")).toBeTruthy();
    expect(getByTestId("alert-card-a3")).toBeTruthy();
    expect(getByText("Tomato Sauce")).toBeTruthy();
    expect(getByText("Fresh Cream")).toBeTruthy();
  });

  it("filters by severity when filter pill is pressed", () => {
    const { getByTestId, queryByTestId } = render(
      <AlertDisplay alerts={sampleAlerts} onAcknowledge={jest.fn()} />,
    );

    // Press the "Warning" filter pill
    fireEvent.press(getByTestId("alert-filter-warning"));

    // Only the warning alert should be visible
    expect(queryByTestId("alert-card-a1")).toBeNull();
    expect(getByTestId("alert-card-a2")).toBeTruthy();
    expect(queryByTestId("alert-card-a3")).toBeNull();
  });

  it("shows acknowledge button on unacknowledged alerts", () => {
    const { getByTestId } = render(
      <AlertDisplay alerts={[makeAlert()]} onAcknowledge={jest.fn()} />,
    );

    expect(getByTestId("alert-acknowledge-a1")).toBeTruthy();
  });

  it("calls onAcknowledge when acknowledge button is pressed", () => {
    const onAcknowledge = jest.fn();
    const { getByTestId } = render(
      <AlertDisplay alerts={[makeAlert()]} onAcknowledge={onAcknowledge} />,
    );

    fireEvent.press(getByTestId("alert-acknowledge-a1"));
    expect(onAcknowledge).toHaveBeenCalledWith("a1");
  });

  it("shows loading state", () => {
    const { getByTestId } = render(
      <AlertDisplay alerts={[]} onAcknowledge={jest.fn()} isLoading />,
    );

    expect(getByTestId("alert-loading")).toBeTruthy();
  });

  it("shows empty state when there are no alerts", () => {
    const { getByTestId, getByText } = render(
      <AlertDisplay alerts={[]} onAcknowledge={jest.fn()} />,
    );

    expect(getByTestId("alert-empty")).toBeTruthy();
    expect(getByText("All Clear")).toBeTruthy();
  });
});
