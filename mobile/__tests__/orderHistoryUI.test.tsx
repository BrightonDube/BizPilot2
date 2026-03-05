/**
 * Tests for OrderHistoryScreen and OrderDetailView UI components.
 * (order-management tasks 13.1-13.4)
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { OrderHistoryScreen } from "@/components/orders/OrderHistoryScreen";
import { OrderDetailView } from "@/components/orders/OrderDetailView";
import { HistoricalOrder } from "@/services/orders/OrderHistoryService";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockOrders: HistoricalOrder[] = [
  {
    id: "o1",
    orderNumber: "1001",
    status: "completed",
    orderType: "dine_in",
    customerName: "Alice Smith",
    items: [
      { id: "i1", name: "Burger", quantity: 2, unitPrice: 75, total: 150 },
      { id: "i2", name: "Fries", quantity: 1, unitPrice: 35, total: 35 },
    ],
    subtotal: 185,
    tax: 27.75,
    total: 212.75,
    paymentMethod: "card",
    createdAt: "2025-01-15T12:00:00Z",
    completedAt: "2025-01-15T12:35:00Z",
    staffName: "Jane",
    notes: "Extra sauce on the side",
  },
  {
    id: "o2",
    orderNumber: "1002",
    status: "cancelled",
    orderType: "takeaway",
    items: [
      { id: "i3", name: "Salad", quantity: 1, unitPrice: 55, total: 55 },
    ],
    subtotal: 55,
    tax: 8.25,
    total: 63.25,
    createdAt: "2025-01-15T14:00:00Z",
    staffName: "Bob",
  },
];

// ---------------------------------------------------------------------------
// OrderHistoryScreen
// ---------------------------------------------------------------------------

describe("OrderHistoryScreen", () => {
  const defaultProps = {
    orders: mockOrders,
    onSelectOrder: jest.fn(),
    onReprint: jest.fn(),
    onRefund: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the screen with header and order count", () => {
    const { getByTestId, getByText } = render(
      <OrderHistoryScreen {...defaultProps} />
    );
    expect(getByTestId("order-history-screen")).toBeTruthy();
    expect(getByText("Order History")).toBeTruthy();
    expect(getByText("2 orders")).toBeTruthy();
  });

  it("renders order rows", () => {
    const { getByTestId } = render(
      <OrderHistoryScreen {...defaultProps} />
    );
    expect(getByTestId("order-row-o1")).toBeTruthy();
    expect(getByTestId("order-row-o2")).toBeTruthy();
  });

  it("displays order number and total", () => {
    const { getByText } = render(
      <OrderHistoryScreen {...defaultProps} />
    );
    expect(getByText("#1001")).toBeTruthy();
    expect(getByText("R 212.75")).toBeTruthy();
  });

  it("calls onSelectOrder when order row is pressed", () => {
    const { getByTestId } = render(
      <OrderHistoryScreen {...defaultProps} />
    );
    fireEvent.press(getByTestId("order-row-o1"));
    expect(defaultProps.onSelectOrder).toHaveBeenCalledWith(mockOrders[0]);
  });

  it("shows reprint button for orders", () => {
    const { getByTestId } = render(
      <OrderHistoryScreen {...defaultProps} />
    );
    fireEvent.press(getByTestId("reprint-o1"));
    expect(defaultProps.onReprint).toHaveBeenCalledWith(mockOrders[0]);
  });

  it("shows refund button only for completed orders", () => {
    const { getByTestId, queryByTestId } = render(
      <OrderHistoryScreen {...defaultProps} />
    );
    expect(getByTestId("refund-o1")).toBeTruthy();
    expect(queryByTestId("refund-o2")).toBeNull(); // cancelled, no refund
  });

  it("has a search input", () => {
    const { getByTestId } = render(
      <OrderHistoryScreen {...defaultProps} />
    );
    expect(getByTestId("search-input")).toBeTruthy();
  });

  it("filters orders when searching", () => {
    const { getByTestId, queryByTestId } = render(
      <OrderHistoryScreen {...defaultProps} />
    );
    fireEvent.changeText(getByTestId("search-input"), "Alice");
    expect(getByTestId("order-row-o1")).toBeTruthy();
    expect(queryByTestId("order-row-o2")).toBeNull();
  });

  it("toggles filter panel", () => {
    const { getByTestId, queryByTestId } = render(
      <OrderHistoryScreen {...defaultProps} />
    );
    expect(queryByTestId("filter-panel")).toBeNull();
    fireEvent.press(getByTestId("filter-toggle"));
    expect(getByTestId("filter-panel")).toBeTruthy();
  });

  it("filters by status pill", () => {
    const { getByTestId, queryByTestId } = render(
      <OrderHistoryScreen {...defaultProps} />
    );
    fireEvent.press(getByTestId("filter-toggle"));
    fireEvent.press(getByTestId("filter-status-cancelled"));
    expect(getByTestId("order-row-o2")).toBeTruthy();
    expect(queryByTestId("order-row-o1")).toBeNull();
  });

  it("shows empty state when no orders match", () => {
    const { getByTestId, getByText } = render(
      <OrderHistoryScreen {...defaultProps} />
    );
    fireEvent.changeText(getByTestId("search-input"), "nonexistent");
    expect(getByText("No orders found")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// OrderDetailView
// ---------------------------------------------------------------------------

describe("OrderDetailView", () => {
  const order = mockOrders[0];
  const defaultProps = {
    order,
    onClose: jest.fn(),
    onReprint: jest.fn(),
    onRefund: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders order detail view", () => {
    const { getByTestId, getByText } = render(
      <OrderDetailView {...defaultProps} />
    );
    expect(getByTestId("order-detail-view")).toBeTruthy();
    expect(getByText("Order #1001")).toBeTruthy();
  });

  it("shows all items", () => {
    const { getByTestId } = render(
      <OrderDetailView {...defaultProps} />
    );
    expect(getByTestId("item-row-0")).toBeTruthy();
    expect(getByTestId("item-row-1")).toBeTruthy();
  });

  it("displays totals", () => {
    const { getByText } = render(
      <OrderDetailView {...defaultProps} />
    );
    expect(getByText("R 185.00")).toBeTruthy(); // subtotal
    expect(getByText("R 27.75")).toBeTruthy(); // tax
    expect(getByText("R 212.75")).toBeTruthy(); // total
  });

  it("shows customer name", () => {
    const { getByText } = render(
      <OrderDetailView {...defaultProps} />
    );
    expect(getByText("Alice Smith")).toBeTruthy();
  });

  it("shows notes", () => {
    const { getByText } = render(
      <OrderDetailView {...defaultProps} />
    );
    expect(getByText("Extra sauce on the side")).toBeTruthy();
  });

  it("shows duration for completed orders", () => {
    const { getByText } = render(
      <OrderDetailView {...defaultProps} />
    );
    expect(getByText("35m")).toBeTruthy();
  });

  it("calls onClose when close button pressed", () => {
    const { getByTestId } = render(
      <OrderDetailView {...defaultProps} />
    );
    fireEvent.press(getByTestId("close-detail"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("shows reprint and refund buttons", () => {
    const { getByTestId } = render(
      <OrderDetailView {...defaultProps} />
    );
    expect(getByTestId("reprint-button")).toBeTruthy();
    expect(getByTestId("refund-button")).toBeTruthy();
  });

  it("calls onReprint when reprint pressed", () => {
    const { getByTestId } = render(
      <OrderDetailView {...defaultProps} />
    );
    fireEvent.press(getByTestId("reprint-button"));
    expect(defaultProps.onReprint).toHaveBeenCalledWith(order);
  });

  it("calls onRefund when refund pressed", () => {
    const { getByTestId } = render(
      <OrderDetailView {...defaultProps} />
    );
    fireEvent.press(getByTestId("refund-button"));
    expect(defaultProps.onRefund).toHaveBeenCalledWith(order);
  });

  it("hides refund button for non-completed orders", () => {
    const { queryByTestId } = render(
      <OrderDetailView
        {...defaultProps}
        order={{ ...order, status: "cancelled" }}
      />
    );
    expect(queryByTestId("refund-button")).toBeNull();
  });
});
