/**
 * Tests for order management UI components:
 * - FloorPlanView (tasks 4.1-4.3)
 * - TableOrderSummary (task 4.4)
 * - OrderStatusTracker (tasks 6.1-6.4)
 * - KDSDisplayScreen (task 7.4)
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

import FloorPlanView from "@/components/tables/FloorPlanView";
import TableOrderSummary from "@/components/tables/TableOrderSummary";
import OrderStatusTracker from "@/components/orders/OrderStatusTracker";
import KDSDisplayScreen from "@/components/kds/KDSDisplayScreen";
import type { TableRecord } from "@/services/order/TableService";
import type { ManagedOrder } from "@/services/order/OrderManagementService";
import type { KDSOrder, KDSStation } from "@/services/kds/KDSService";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noop = jest.fn();

const makeTable = (overrides: Partial<TableRecord> = {}): TableRecord => ({
  id: `t-${Math.random().toString(36).substring(7)}`,
  name: "Table 1",
  capacity: 4,
  status: "available",
  activeOrderId: null,
  statusChangedAt: "2025-06-15T08:00:00.000Z",
  ...overrides,
});

const makeOrder = (overrides: Partial<ManagedOrder> = {}): ManagedOrder => ({
  id: `order-${Math.random().toString(36).substring(7)}`,
  orderType: "dine_in",
  tableId: "t1",
  status: "new",
  items: [
    { name: "Burger", quantity: 2, unitPrice: 89.0 },
    { name: "Fries", quantity: 1, unitPrice: 35.0 },
  ],
  statusHistory: [
    { timestamp: "2025-06-15T12:00:00.000Z", status: "new", changedBy: "staff-1" },
  ],
  ...overrides,
} as any);

const makeKDSOrder = (overrides: Partial<KDSOrder> = {}): KDSOrder => ({
  id: "kds-order-1",
  displayNumber: "A01",
  orderType: "dine_in",
  tableName: "Table 5",
  items: [
    {
      id: "ki1",
      orderId: "kds-order-1",
      name: "Burger",
      quantity: 1,
      modifiers: ["No onion"],
      category: "grill",
      status: "pending",
      stationId: "grill",
    },
    {
      id: "ki2",
      orderId: "kds-order-1",
      name: "Salad",
      quantity: 1,
      modifiers: [],
      category: "salad",
      status: "pending",
      stationId: "salad",
    },
  ],
  sentAt: "2025-06-15T12:00:00.000Z",
  priority: 0,
  ...overrides,
});

const makeStations = (): KDSStation[] => [
  { id: "grill", name: "Grill", categories: ["grill"] },
  { id: "salad", name: "Salad", categories: ["salad"] },
];

// ---------------------------------------------------------------------------
// FloorPlanView Tests (Tasks 4.1-4.3)
// ---------------------------------------------------------------------------

describe("FloorPlanView (Tasks 4.1-4.3)", () => {
  const tables = [
    makeTable({ id: "t1", name: "Table 1", status: "available" }),
    makeTable({ id: "t2", name: "Table 2", status: "occupied" }),
    makeTable({ id: "t3", name: "Table 3", status: "reserved" }),
  ];

  it("renders all table tiles", () => {
    const { getByText } = render(
      <FloorPlanView tables={tables} onSelectTable={noop} />
    );
    expect(getByText("Table 1")).toBeTruthy();
    expect(getByText("Table 2")).toBeTruthy();
    expect(getByText("Table 3")).toBeTruthy();
  });

  it("shows status counts in header", () => {
    const { getByText } = render(
      <FloorPlanView tables={tables} onSelectTable={noop} />
    );
    expect(getByText("1 Available")).toBeTruthy();
    expect(getByText("1 Occupied")).toBeTruthy();
    expect(getByText("1 Reserved")).toBeTruthy();
  });

  it("calls onSelectTable when a tile is tapped", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <FloorPlanView tables={tables} onSelectTable={onSelect} />
    );
    fireEvent.press(getByText("Table 1"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe("t1");
  });

  it("shows empty state with no tables", () => {
    const { getByText } = render(
      <FloorPlanView tables={[]} onSelectTable={noop} />
    );
    expect(getByText("No tables configured")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// TableOrderSummary Tests (Task 4.4)
// ---------------------------------------------------------------------------

describe("TableOrderSummary (Task 4.4)", () => {
  const table = makeTable({ id: "t1", name: "Table 5", status: "occupied" });
  const order = makeOrder({
    id: "order-abc123",
    items: [
      { name: "Burger", quantity: 2, unitPrice: 89.0 },
      { name: "Fries", quantity: 1, unitPrice: 35.0 },
    ],
  });

  it("renders table name and status", () => {
    const { getByText } = render(
      <TableOrderSummary table={table} order={order} onClose={noop} />
    );
    expect(getByText("Table 5")).toBeTruthy();
    expect(getByText("(occupied)")).toBeTruthy();
  });

  it("renders order items", () => {
    const { getByText } = render(
      <TableOrderSummary table={table} order={order} onClose={noop} />
    );
    expect(getByText("Burger")).toBeTruthy();
    expect(getByText("Fries")).toBeTruthy();
  });

  it("calculates and shows total", () => {
    const { getByText } = render(
      <TableOrderSummary table={table} order={order} onClose={noop} />
    );
    // 2×89 + 1×35 = 213
    expect(getByText("R 213.00")).toBeTruthy();
  });

  it("shows empty state when no order", () => {
    const { getByText } = render(
      <TableOrderSummary table={table} order={null} onClose={noop} />
    );
    expect(getByText("No active order")).toBeTruthy();
  });

  it("calls onViewOrder when View button pressed", () => {
    const onView = jest.fn();
    const { getByLabelText } = render(
      <TableOrderSummary
        table={table}
        order={order}
        onClose={noop}
        onViewOrder={onView}
      />
    );
    fireEvent.press(getByLabelText("View full order"));
    expect(onView).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// OrderStatusTracker Tests (Tasks 6.1-6.4)
// ---------------------------------------------------------------------------

describe("OrderStatusTracker (Tasks 6.1-6.4)", () => {
  const baseTime = new Date("2025-06-15T12:00:00.000Z").getTime();
  const orders: ManagedOrder[] = [
    makeOrder({
      id: "o1",
      status: "new",
      statusHistory: [{ timestamp: "2025-06-15T12:00:00.000Z", status: "new", changedBy: "s1" }],
    }),
    makeOrder({
      id: "o2",
      status: "preparing",
      statusHistory: [{ timestamp: "2025-06-15T11:30:00.000Z", status: "new", changedBy: "s1" }],
    }),
  ];

  it("renders Active Orders title", () => {
    const { getByText } = render(
      <OrderStatusTracker orders={orders} now={baseTime + 300000} onSelectOrder={noop} />
    );
    expect(getByText("Active Orders")).toBeTruthy();
  });

  it("shows overdue alert badge when orders exceed threshold", () => {
    // 20 minutes after o2 was created (o2 is 50 min old)
    const { getByText } = render(
      <OrderStatusTracker
        orders={orders}
        now={baseTime + 20 * 60000}
        alertThresholdMinutes={15}
        onSelectOrder={noop}
      />
    );
    expect(getByText(/overdue/)).toBeTruthy();
  });

  it("calls onSelectOrder when a card is tapped", () => {
    const onSelect = jest.fn();
    const { getAllByRole } = render(
      <OrderStatusTracker
        orders={[orders[0]]}
        now={baseTime + 60000}
        onSelectOrder={onSelect}
      />
    );
    fireEvent.press(getAllByRole("button")[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("shows empty state with no orders", () => {
    const { getByText } = render(
      <OrderStatusTracker orders={[]} now={baseTime} onSelectOrder={noop} />
    );
    expect(getByText("No active orders")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// KDSDisplayScreen Tests (Task 7.4)
// ---------------------------------------------------------------------------

describe("KDSDisplayScreen (Task 7.4)", () => {
  const stations = makeStations();
  const now = new Date("2025-06-15T12:05:00.000Z").getTime();
  const orders = [makeKDSOrder()];

  it("renders station tabs", () => {
    const { getByLabelText } = render(
      <KDSDisplayScreen
        orders={orders}
        stations={stations}
        activeStationId={null}
        onBumpItem={noop}
        onRecallItem={noop}
        onSelectStation={noop}
        now={now}
      />
    );
    expect(getByLabelText("All stations")).toBeTruthy();
    expect(getByLabelText("Grill station")).toBeTruthy();
    expect(getByLabelText("Salad station")).toBeTruthy();
  });

  it("renders KDS tickets with order number", () => {
    const { getByText } = render(
      <KDSDisplayScreen
        orders={orders}
        stations={stations}
        activeStationId={null}
        onBumpItem={noop}
        onRecallItem={noop}
        onSelectStation={noop}
        now={now}
      />
    );
    expect(getByText("A01")).toBeTruthy();
  });

  it("shows item modifiers", () => {
    const { getByText } = render(
      <KDSDisplayScreen
        orders={orders}
        stations={stations}
        activeStationId={null}
        onBumpItem={noop}
        onRecallItem={noop}
        onSelectStation={noop}
        now={now}
      />
    );
    expect(getByText("No onion")).toBeTruthy();
  });

  it("calls onBumpItem when item is tapped", () => {
    const onBump = jest.fn();
    const { getByLabelText } = render(
      <KDSDisplayScreen
        orders={orders}
        stations={stations}
        activeStationId={null}
        onBumpItem={onBump}
        onRecallItem={noop}
        onSelectStation={noop}
        now={now}
      />
    );
    fireEvent.press(getByLabelText("Bump Burger"));
    expect(onBump).toHaveBeenCalledWith("kds-order-1", "ki1");
  });

  it("shows empty state when all caught up", () => {
    const { getByText } = render(
      <KDSDisplayScreen
        orders={[]}
        stations={stations}
        activeStationId={null}
        onBumpItem={noop}
        onRecallItem={noop}
        onSelectStation={noop}
        now={now}
      />
    );
    expect(getByText("All caught up!")).toBeTruthy();
  });

  it("calls onSelectStation when tab is pressed", () => {
    const onSelect = jest.fn();
    const { getByLabelText } = render(
      <KDSDisplayScreen
        orders={orders}
        stations={stations}
        activeStationId={null}
        onBumpItem={noop}
        onRecallItem={noop}
        onSelectStation={onSelect}
        now={now}
      />
    );
    fireEvent.press(getByLabelText("Grill station"));
    expect(onSelect).toHaveBeenCalledWith("grill");
  });
});
