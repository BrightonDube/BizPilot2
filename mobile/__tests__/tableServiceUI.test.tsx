/**
 * BizPilot Mobile — Table Service & Floor Plan UI Tests
 *
 * Tests pure functions from TableService and the
 * FloorPlanCanvas / FloorPlanView components.
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

import {
  calculateTableSummary,
  getStatusColor,
  filterTablesByStatus,
  findAvailableTable,
  getOccupiedDuration,
  isLongOccupied,
  calculateOccupancyRate,
  sortTablesByNumber,
  type RestaurantTable,
  type TableStatus,
} from "@/services/tables/TableService";

import FloorPlanCanvas, {
  type FloorPlanCanvasProps,
} from "@/components/tables/FloorPlanCanvas";

import FloorPlanView from "@/components/tables/FloorPlanView";
import type { TableRecord } from "@/services/order/TableService";

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));

// ─── Mock data helpers ───────────────────────────────────────────────────────

function makeTable(overrides: Partial<RestaurantTable> = {}): RestaurantTable {
  return {
    id: "t1",
    number: 1,
    name: "Table 1",
    seats: 4,
    shape: "square",
    status: "available",
    position: { x: 10, y: 20 },
    currentOrderId: null,
    currentOrderTotal: 0,
    occupiedSince: null,
    reservedFor: null,
    reservationTime: null,
    section: "Main Floor",
    serverName: null,
    ...overrides,
  };
}

const mockTables: RestaurantTable[] = [
  makeTable({ id: "t1", number: 1, status: "available", seats: 4 }),
  makeTable({ id: "t2", number: 3, status: "occupied", seats: 6, currentOrderTotal: 250, occupiedSince: new Date(Date.now() - 30 * 60000).toISOString() }),
  makeTable({ id: "t3", number: 2, status: "reserved", seats: 2, reservedFor: "Smith" }),
  makeTable({ id: "t4", number: 4, status: "cleaning", seats: 4 }),
  makeTable({ id: "t5", number: 5, status: "blocked", seats: 8 }),
];

function makeTableRecord(overrides: Partial<TableRecord> = {}): TableRecord {
  return {
    id: "tr1",
    name: "T1",
    capacity: 4,
    status: "available",
    activeOrderId: null,
    statusChangedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── TableService Unit Tests ─────────────────────────────────────────────────

describe("TableService", () => {
  it("calculateTableSummary counts statuses correctly", () => {
    const summary = calculateTableSummary(mockTables);
    expect(summary.total).toBe(5);
    expect(summary.available).toBe(1);
    expect(summary.occupied).toBe(1);
    expect(summary.reserved).toBe(1);
    expect(summary.cleaning).toBe(1);
    expect(summary.blocked).toBe(1);
  });

  it("getStatusColor returns correct colors", () => {
    expect(getStatusColor("available")).toBe("#22c55e");
    expect(getStatusColor("occupied")).toBe("#ef4444");
    expect(getStatusColor("reserved")).toBe("#fbbf24");
    expect(getStatusColor("cleaning")).toBe("#8b5cf6");
    expect(getStatusColor("blocked")).toBe("#6b7280");
  });

  it("filterTablesByStatus works", () => {
    const available = filterTablesByStatus(mockTables, ["available"]);
    expect(available).toHaveLength(1);
    expect(available[0].id).toBe("t1");

    const multi = filterTablesByStatus(mockTables, ["available", "reserved"]);
    expect(multi).toHaveLength(2);
  });

  it("findAvailableTable finds table with enough seats", () => {
    const found = findAvailableTable(mockTables, 4);
    expect(found).not.toBeNull();
    expect(found!.id).toBe("t1");

    // No available table with 10 seats
    const none = findAvailableTable(mockTables, 10);
    expect(none).toBeNull();
  });

  it("getOccupiedDuration calculates minutes", () => {
    const now = new Date("2024-06-15T14:30:00Z");
    const occupiedSince = "2024-06-15T13:00:00Z";
    expect(getOccupiedDuration(occupiedSince, now)).toBe(90);
  });

  it("isLongOccupied returns true when over threshold", () => {
    const now = new Date("2024-06-15T15:00:00Z");
    const occupiedSince = "2024-06-15T13:00:00Z"; // 120 min
    expect(isLongOccupied(occupiedSince, 90, now)).toBe(true);
    expect(isLongOccupied(occupiedSince, 150, now)).toBe(false);
  });

  it("calculateOccupancyRate: occupied / total * 100", () => {
    const rate = calculateOccupancyRate(mockTables);
    // 1 occupied out of 5 = 20%
    expect(rate).toBe(20);

    expect(calculateOccupancyRate([])).toBe(0);
  });

  it("sortTablesByNumber orders correctly", () => {
    const sorted = sortTablesByNumber(mockTables);
    expect(sorted.map((t) => t.number)).toEqual([1, 2, 3, 4, 5]);
  });
});

// ─── FloorPlanCanvas Tests ───────────────────────────────────────────────────

describe("FloorPlanCanvas", () => {
  const baseProps: FloorPlanCanvasProps = {
    tables: mockTables,
    onTablePress: jest.fn(),
    onBack: jest.fn(),
    sections: ["Main Floor", "Patio"],
    activeSection: "Main Floor",
    onSectionChange: jest.fn(),
  };

  it("renders tables on canvas", () => {
    const { getByTestId } = render(<FloorPlanCanvas {...baseProps} />);

    expect(getByTestId("floor-plan")).toBeTruthy();
    expect(getByTestId("floor-table-t1")).toBeTruthy();
    expect(getByTestId("floor-table-t2")).toBeTruthy();
  });

  it("calls onTablePress when table tapped", () => {
    const onTablePress = jest.fn();
    const { getByTestId } = render(
      <FloorPlanCanvas {...baseProps} onTablePress={onTablePress} />,
    );

    fireEvent.press(getByTestId("floor-table-t1"));
    expect(onTablePress).toHaveBeenCalledWith("t1");
  });

  it("shows section tabs", () => {
    const { getByTestId } = render(<FloorPlanCanvas {...baseProps} />);

    expect(getByTestId("floor-section-main-floor")).toBeTruthy();
    expect(getByTestId("floor-section-patio")).toBeTruthy();
  });

  it("shows summary bar", () => {
    const { getByTestId } = render(<FloorPlanCanvas {...baseProps} />);
    expect(getByTestId("floor-summary")).toBeTruthy();
  });

  it("shows loading state", () => {
    const { getByTestId } = render(
      <FloorPlanCanvas {...baseProps} isLoading />,
    );
    expect(getByTestId("floor-loading")).toBeTruthy();
  });
});

// ─── FloorPlanView Tests ─────────────────────────────────────────────────────

describe("FloorPlanView", () => {
  const mockRecords: TableRecord[] = [
    makeTableRecord({ id: "tr1", name: "T1", status: "available", capacity: 4 }),
    makeTableRecord({ id: "tr2", name: "T2", status: "occupied", capacity: 6 }),
    makeTableRecord({ id: "tr3", name: "T3", status: "reserved", capacity: 2 }),
  ];

  it("renders in compact mode", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <FloorPlanView
        tables={mockRecords}
        onSelectTable={onSelect}
        columns={2}
      />,
    );

    expect(getByText("Floor Plan")).toBeTruthy();
    expect(getByText("T1")).toBeTruthy();
    expect(getByText("T2")).toBeTruthy();
    expect(getByText("T3")).toBeTruthy();
  });

  it("highlights specified table", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <FloorPlanView
        tables={mockRecords}
        onSelectTable={onSelect}
        selectedTableId="tr2"
      />,
    );

    // The selected table should still render
    expect(getByText("T2")).toBeTruthy();
  });
});
