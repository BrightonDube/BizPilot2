/**
 * BizPilot Mobile — Report Service & UI Tests
 *
 * Tests pure calculation functions from ReportService and the
 * ReportTabLayout, InventoryTab, COGSTab, ProfitMarginTab components.
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

import {
  calculateInventoryValue,
  calculateCOGS,
  calculateGrossMargin,
  identifySlowMovers,
  identifyLowStock,
  calculateTurnoverRate,
  generateReportSummary,
  sortReportItems,
  type InventoryReportItem,
  type COGSEntry,
  type ProfitMarginEntry,
} from "@/services/reports/ReportService";

import ReportTabLayout, {
  type ReportTab,
} from "@/components/reports/ReportTabLayout";
import InventoryTab from "@/components/reports/InventoryTab";
import COGSTab from "@/components/reports/COGSTab";
import ProfitMarginTab from "@/components/reports/ProfitMarginTab";

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));

// ─── Mock data ───────────────────────────────────────────────────────────────

const mockInventoryItems: InventoryReportItem[] = [
  {
    productId: "p1",
    productName: "Widget A",
    category: "Electronics",
    currentStock: 5,
    reorderLevel: 10,
    unitCost: 50,
    totalValue: 250,
    turnoverRate: 3.2,
    daysOfStock: 100,
  },
  {
    productId: "p2",
    productName: "Gadget B",
    category: "Electronics",
    currentStock: 50,
    reorderLevel: 20,
    unitCost: 30,
    totalValue: 1500,
    turnoverRate: 5.1,
    daysOfStock: 30,
  },
  {
    productId: "p3",
    productName: "Gizmo C",
    category: "Hardware",
    currentStock: 8,
    reorderLevel: 15,
    unitCost: 75,
    totalValue: 600,
    turnoverRate: 1.8,
    daysOfStock: 200,
  },
];

const mockCOGSEntries: COGSEntry[] = [
  {
    category: "Food",
    openingStock: 10000,
    purchases: 5000,
    closingStock: 8000,
    cogs: 7000,
    cogsPercentage: 35,
  },
  {
    category: "Beverages",
    openingStock: 4000,
    purchases: 2000,
    closingStock: 3000,
    cogs: 3000,
    cogsPercentage: 25,
  },
];

const mockMarginEntries: ProfitMarginEntry[] = [
  {
    category: "Food",
    revenue: 20000,
    cogs: 7000,
    grossProfit: 13000,
    grossMarginPercentage: 65,
    trend: "up",
  },
  {
    category: "Beverages",
    revenue: 12000,
    cogs: 3000,
    grossProfit: 9000,
    grossMarginPercentage: 75,
    trend: "down",
  },
];

const mockTabs: ReportTab[] = [
  { key: "inventory", label: "Inventory", icon: "cube-outline" },
  { key: "cogs", label: "COGS", icon: "cart-outline" },
  { key: "margin", label: "Margin", icon: "trending-up-outline" },
];

// ─── ReportService Unit Tests ────────────────────────────────────────────────

describe("ReportService", () => {
  it("calculateInventoryValue sums correctly", () => {
    const total = calculateInventoryValue(mockInventoryItems);
    expect(total).toBe(250 + 1500 + 600);
  });

  it("calculateCOGS formula: opening + purchases - closing", () => {
    expect(calculateCOGS(10000, 5000, 8000)).toBe(7000);
    // Negative result clamped to 0
    expect(calculateCOGS(1000, 500, 5000)).toBe(0);
  });

  it("calculateGrossMargin returns correct profit and percentage", () => {
    const result = calculateGrossMargin(20000, 7000);
    expect(result.grossProfit).toBe(13000);
    expect(result.marginPercentage).toBe(65);
    // Zero revenue guard
    const zero = calculateGrossMargin(0, 0);
    expect(zero.marginPercentage).toBe(0);
  });

  it("identifySlowMovers filters by threshold days", () => {
    const slow = identifySlowMovers(mockInventoryItems, 90);
    expect(slow).toHaveLength(2);
    expect(slow.map((i) => i.productId)).toEqual(["p1", "p3"]);
  });

  it("identifyLowStock finds items below reorder level", () => {
    const low = identifyLowStock(mockInventoryItems);
    expect(low).toHaveLength(2);
    expect(low.map((i) => i.productId)).toEqual(["p1", "p3"]);
  });

  it("calculateTurnoverRate divides cogs/inventory", () => {
    expect(calculateTurnoverRate(10000, 5000)).toBe(2);
    expect(calculateTurnoverRate(10000, 0)).toBe(0);
  });

  it("generateReportSummary produces correct min/max/avg", () => {
    const summary = generateReportSummary(
      [100, 300, 200],
      ["Alpha", "Beta", "Gamma"],
    );
    expect(summary.totalValue).toBe(600);
    expect(summary.itemCount).toBe(3);
    expect(summary.averageValue).toBe(200);
    expect(summary.highestItem).toEqual({ name: "Beta", value: 300 });
    expect(summary.lowestItem).toEqual({ name: "Alpha", value: 100 });
  });

  it("sortReportItems sorts ascending and descending", () => {
    const items = [
      { name: "B", value: 20 },
      { name: "A", value: 10 },
      { name: "C", value: 30 },
    ];
    const asc = sortReportItems(items, "value", "asc");
    expect(asc.map((i) => i.value)).toEqual([10, 20, 30]);

    const desc = sortReportItems(items, "value", "desc");
    expect(desc.map((i) => i.value)).toEqual([30, 20, 10]);
  });
});

// ─── ReportTabLayout Tests ───────────────────────────────────────────────────

describe("ReportTabLayout", () => {
  const baseProps = {
    tabs: mockTabs,
    activeTab: "inventory",
    onTabChange: jest.fn(),
    dateRange: { startDate: "2024-01-01", endDate: "2024-01-31" },
    onDateRangeChange: jest.fn(),
    onBack: jest.fn(),
  };

  it("renders tabs and calls onTabChange", () => {
    const onTabChange = jest.fn();
    const { getByTestId } = render(
      <ReportTabLayout {...baseProps} onTabChange={onTabChange}>
        <></>
      </ReportTabLayout>,
    );

    expect(getByTestId("report-tab-inventory")).toBeTruthy();
    expect(getByTestId("report-tab-cogs")).toBeTruthy();

    fireEvent.press(getByTestId("report-tab-cogs"));
    expect(onTabChange).toHaveBeenCalledWith("cogs");
  });

  it("shows date range presets", () => {
    const { getByTestId } = render(
      <ReportTabLayout {...baseProps}>
        <></>
      </ReportTabLayout>,
    );

    expect(getByTestId("report-date-today")).toBeTruthy();
    expect(getByTestId("report-date-week")).toBeTruthy();
    expect(getByTestId("report-date-month")).toBeTruthy();
    expect(getByTestId("report-date-quarter")).toBeTruthy();
  });
});

// ─── InventoryTab Tests ──────────────────────────────────────────────────────

describe("InventoryTab", () => {
  it("renders summary cards with totals", () => {
    const { getByTestId, getByText } = render(
      <InventoryTab
        items={mockInventoryItems}
        totalValue={2350}
        lowStockCount={2}
        slowMoverCount={1}
      />,
    );

    expect(getByTestId("inventory-total-value")).toBeTruthy();
    expect(getByText("R 2350.00")).toBeTruthy();
    expect(getByTestId("inventory-low-stock")).toBeTruthy();
  });

  it("renders item cards", () => {
    const { getByTestId } = render(
      <InventoryTab
        items={mockInventoryItems}
        totalValue={2350}
        lowStockCount={2}
        slowMoverCount={1}
      />,
    );

    expect(getByTestId("inventory-item-p1")).toBeTruthy();
    expect(getByTestId("inventory-item-p2")).toBeTruthy();
    expect(getByTestId("inventory-item-p3")).toBeTruthy();
  });

  it("shows loading state", () => {
    const { getByTestId } = render(
      <InventoryTab
        items={[]}
        totalValue={0}
        lowStockCount={0}
        slowMoverCount={0}
        isLoading
      />,
    );

    expect(getByTestId("inventory-loading")).toBeTruthy();
  });
});

// ─── COGSTab Tests ───────────────────────────────────────────────────────────

describe("COGSTab", () => {
  it("renders total COGS", () => {
    const { getByTestId, getAllByText } = render(
      <COGSTab
        entries={mockCOGSEntries}
        totalCOGS={10000}
        totalRevenue={32000}
        period="January 2024"
      />,
    );

    expect(getByTestId("cogs-total")).toBeTruthy();
    expect(getAllByText("R 10000.00").length).toBeGreaterThanOrEqual(1);
  });

  it("shows category entries", () => {
    const { getByTestId, getByText } = render(
      <COGSTab
        entries={mockCOGSEntries}
        totalCOGS={10000}
        totalRevenue={32000}
        period="January 2024"
      />,
    );

    expect(getByTestId("cogs-entry-0")).toBeTruthy();
    expect(getByTestId("cogs-entry-1")).toBeTruthy();
    expect(getByText("Food")).toBeTruthy();
    expect(getByText("Beverages")).toBeTruthy();
  });

  it("shows loading state", () => {
    const { getByTestId } = render(
      <COGSTab
        entries={[]}
        totalCOGS={0}
        totalRevenue={0}
        period=""
        isLoading
      />,
    );

    expect(getByTestId("cogs-loading")).toBeTruthy();
  });
});

// ─── ProfitMarginTab Tests ───────────────────────────────────────────────────

describe("ProfitMarginTab", () => {
  it("shows revenue/profit/margin", () => {
    const { getByTestId, getByText } = render(
      <ProfitMarginTab
        entries={mockMarginEntries}
        totalRevenue={32000}
        totalCOGS={10000}
        totalGrossProfit={22000}
        averageMargin={70}
      />,
    );

    expect(getByTestId("margin-revenue")).toBeTruthy();
    expect(getByTestId("margin-profit")).toBeTruthy();
    expect(getByTestId("margin-average")).toBeTruthy();
    expect(getByText("R 32000.00")).toBeTruthy();
    expect(getByText("70.0%")).toBeTruthy();
  });

  it("shows category entries with trends", () => {
    const { getByTestId, getByText } = render(
      <ProfitMarginTab
        entries={mockMarginEntries}
        totalRevenue={32000}
        totalCOGS={10000}
        totalGrossProfit={22000}
        averageMargin={70}
      />,
    );

    expect(getByTestId("margin-entry-0")).toBeTruthy();
    expect(getByTestId("margin-entry-1")).toBeTruthy();
    expect(getByText("Food")).toBeTruthy();
    expect(getByText("Beverages")).toBeTruthy();
  });
});
