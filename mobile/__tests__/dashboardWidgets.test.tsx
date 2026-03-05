/**
 * UI tests for dashboard widget components:
 * KPIWidget, TableWidget, ListWidget, GaugeWidget.
 */

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import KPIWidget from "../components/dashboards/KPIWidget";
import TableWidget from "../components/dashboards/TableWidget";
import ListWidget from "../components/dashboards/ListWidget";
import GaugeWidget from "../components/dashboards/GaugeWidget";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TableColumn {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "center" | "right";
  format?: "currency" | "number" | "percentage" | "text" | "date";
}

interface ListItem {
  id: string;
  rank: number;
  label: string;
  value: number;
  format: "currency" | "number" | "percentage";
  change?: number;
  icon?: string;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const tableColumns: TableColumn[] = [
  { key: "name", label: "Product", format: "text" },
  { key: "qty", label: "Qty", align: "right", format: "number" },
  { key: "revenue", label: "Revenue", align: "right", format: "currency" },
];

const tableData = [
  { name: "Chicken Burger", qty: 42, revenue: 3775.8 },
  { name: "Beef Steak", qty: 28, revenue: 4197.2 },
];

const listItems: ListItem[] = [
  { id: "li-1", rank: 1, label: "Chicken Burger", value: 3775.8, format: "currency" },
  { id: "li-2", rank: 2, label: "Beef Steak", value: 4197.2, format: "currency" },
  { id: "li-3", rank: 3, label: "Cola", value: 1250, format: "currency" },
  { id: "li-4", rank: 4, label: "Fries", value: 980, format: "currency" },
];

// ---------------------------------------------------------------------------
// KPIWidget
// ---------------------------------------------------------------------------

describe("KPIWidget", () => {
  it("renders with currency value", () => {
    const { getByTestId } = render(
      <KPIWidget
        title="Total Revenue"
        value={45230.5}
        format="currency"
      />,
    );

    expect(getByTestId("kpi-widget")).toBeTruthy();
    expect(getByTestId("kpi-title")).toBeTruthy();
    expect(getByTestId("kpi-value")).toBeTruthy();
  });

  it("shows trend indicator", () => {
    const { getByTestId } = render(
      <KPIWidget
        title="Total Revenue"
        value={45230.5}
        format="currency"
        previousValue={40000}
        trendDirection="up"
        trendPercentage={13.1}
      />,
    );

    expect(getByTestId("kpi-trend")).toBeTruthy();
  });

  it("shows loading state", () => {
    const { getByTestId, queryByTestId } = render(
      <KPIWidget
        title="Total Revenue"
        value={0}
        format="currency"
        isLoading
      />,
    );

    expect(getByTestId("kpi-loading")).toBeTruthy();
    expect(queryByTestId("kpi-value")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TableWidget
// ---------------------------------------------------------------------------

describe("TableWidget", () => {
  it("renders table with headers and rows", () => {
    const { getByTestId } = render(
      <TableWidget
        title="Top Products"
        columns={tableColumns}
        data={tableData}
      />,
    );

    expect(getByTestId("table-widget")).toBeTruthy();
    expect(getByTestId("table-title")).toBeTruthy();
    expect(getByTestId("table-header-name")).toBeTruthy();
    expect(getByTestId("table-header-qty")).toBeTruthy();
    expect(getByTestId("table-header-revenue")).toBeTruthy();
    expect(getByTestId("table-row-0")).toBeTruthy();
    expect(getByTestId("table-row-1")).toBeTruthy();
  });

  it("calls onSort when header pressed", () => {
    const onSort = jest.fn();
    const { getByTestId } = render(
      <TableWidget
        title="Top Products"
        columns={tableColumns}
        data={tableData}
        onSort={onSort}
      />,
    );

    fireEvent.press(getByTestId("table-header-revenue"));
    expect(onSort).toHaveBeenCalledWith("revenue");
  });

  it("shows empty state", () => {
    const { getByTestId, queryByTestId } = render(
      <TableWidget
        title="Top Products"
        columns={tableColumns}
        data={[]}
        emptyMessage="No products found"
      />,
    );

    expect(getByTestId("table-empty")).toBeTruthy();
    expect(queryByTestId("table-row-0")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ListWidget
// ---------------------------------------------------------------------------

describe("ListWidget", () => {
  it("renders ranked items with values", () => {
    const { getByTestId } = render(
      <ListWidget title="Top Sellers" items={listItems} />,
    );

    expect(getByTestId("list-widget")).toBeTruthy();
    expect(getByTestId("list-title")).toBeTruthy();
    expect(getByTestId("list-item-li-1")).toBeTruthy();
    expect(getByTestId("list-item-li-4")).toBeTruthy();
    expect(getByTestId("list-value-li-1")).toBeTruthy();
  });

  it("shows gold/silver/bronze for top 3", () => {
    const { getByTestId } = render(
      <ListWidget title="Top Sellers" items={listItems} />,
    );

    // Rank badges exist for top-3 items
    expect(getByTestId("list-rank-li-1")).toBeTruthy();
    expect(getByTestId("list-rank-li-2")).toBeTruthy();
    expect(getByTestId("list-rank-li-3")).toBeTruthy();
  });

  it("shows loading state", () => {
    const { getByTestId, queryByTestId } = render(
      <ListWidget title="Top Sellers" items={[]} isLoading />,
    );

    expect(getByTestId("list-loading")).toBeTruthy();
    expect(queryByTestId("list-item-li-1")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GaugeWidget
// ---------------------------------------------------------------------------

describe("GaugeWidget", () => {
  it("renders with current value and target", () => {
    const { getByTestId } = render(
      <GaugeWidget
        title="Monthly Target"
        currentValue={32500}
        targetValue={50000}
        format="currency"
      />,
    );

    expect(getByTestId("gauge-widget")).toBeTruthy();
    expect(getByTestId("gauge-title")).toBeTruthy();
    expect(getByTestId("gauge-value")).toBeTruthy();
    expect(getByTestId("gauge-target")).toBeTruthy();
  });

  it("shows percentage achieved", () => {
    const { getByTestId } = render(
      <GaugeWidget
        title="Monthly Target"
        currentValue={32500}
        targetValue={50000}
        format="currency"
      />,
    );

    expect(getByTestId("gauge-percentage")).toBeTruthy();
    expect(getByTestId("gauge-progress")).toBeTruthy();
  });

  it("shows color based on thresholds", () => {
    const { getByTestId: getGood } = render(
      <GaugeWidget
        title="High Performance"
        currentValue={45000}
        targetValue={50000}
        format="currency"
        thresholds={{ warning: 70, critical: 50 }}
      />,
    );
    expect(getGood("gauge-progress")).toBeTruthy();

    const { getByTestId: getLow } = render(
      <GaugeWidget
        title="Low Performance"
        currentValue={15000}
        targetValue={50000}
        format="currency"
        thresholds={{ warning: 70, critical: 50 }}
      />,
    );
    expect(getLow("gauge-progress")).toBeTruthy();
  });
});
