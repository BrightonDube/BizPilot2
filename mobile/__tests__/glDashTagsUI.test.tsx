import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));
jest.mock("@/utils/haptics", () => ({
  triggerHaptic: jest.fn(),
}));

import ReportExportView from "../components/general-ledger/ReportExportView";
import WidgetLibrary from "../components/dashboards/WidgetLibrary";
import WidgetConfigPanel from "../components/dashboards/WidgetConfigPanel";
import SmartCollectionBuilder from "../components/tags/SmartCollectionBuilder";

// =============================================================================
// ReportExportView
// =============================================================================

describe("ReportExportView", () => {
  const readyReport = {
    id: "r1",
    name: "March Trial Balance",
    type: "trial_balance" as const,
    period: "March 2024",
    generatedAt: "2024-03-31T12:00:00Z",
    status: "ready" as const,
  };

  const generatingReport = {
    id: "r2",
    name: "Q1 Income Statement",
    type: "income_statement" as const,
    period: "Q1 2024",
    generatedAt: "2024-03-31T13:00:00Z",
    status: "generating" as const,
  };

  const baseProps = {
    reports: [readyReport, generatingReport],
    onGenerateReport: jest.fn(),
    onExportPDF: jest.fn(),
    onExportExcel: jest.fn(),
    onViewReport: jest.fn(),
    isGenerating: false,
    selectedPeriod: "Month",
    onPeriodChange: jest.fn(),
  };

  it("renders report list", () => {
    const { getByTestId } = render(<ReportExportView {...baseProps} />);
    expect(getByTestId("report-export-view")).toBeTruthy();
    expect(getByTestId("report-item-r1")).toBeTruthy();
    expect(getByTestId("report-item-r2")).toBeTruthy();
  });

  it("shows generate buttons", () => {
    const { getByTestId } = render(<ReportExportView {...baseProps} />);
    expect(getByTestId("report-generate-trial_balance")).toBeTruthy();
    expect(getByTestId("report-generate-income_statement")).toBeTruthy();
    expect(getByTestId("report-generate-balance_sheet")).toBeTruthy();
    expect(getByTestId("report-generate-journal")).toBeTruthy();
  });

  it("shows export buttons for ready reports", () => {
    const { getByTestId, queryByTestId } = render(
      <ReportExportView {...baseProps} />,
    );
    // Ready report has PDF and Excel export buttons
    expect(getByTestId("report-export-pdf-r1")).toBeTruthy();
    expect(getByTestId("report-export-excel-r1")).toBeTruthy();
    // Generating report does NOT have export buttons
    expect(queryByTestId("report-export-pdf-r2")).toBeNull();
    expect(queryByTestId("report-export-excel-r2")).toBeNull();
  });
});

// =============================================================================
// WidgetLibrary
// =============================================================================

describe("WidgetLibrary", () => {
  const widgets = [
    {
      id: "w1",
      name: "Sales Chart",
      description: "Daily sales overview",
      category: "sales" as const,
      icon: "cart-outline",
      previewImageUrl: null,
      isPopular: true,
    },
    {
      id: "w2",
      name: "Stock Levels",
      description: "Current inventory levels",
      category: "inventory" as const,
      icon: "cube-outline",
      previewImageUrl: null,
      isPopular: false,
    },
    {
      id: "w3",
      name: "Revenue KPI",
      description: "Monthly revenue KPI",
      category: "financial" as const,
      icon: "wallet-outline",
      previewImageUrl: null,
      isPopular: false,
    },
  ];

  const baseProps = {
    widgets,
    onSelectWidget: jest.fn(),
    filterCategory: "all",
    onFilterChange: jest.fn(),
    searchQuery: "",
    onSearchChange: jest.fn(),
    onClose: jest.fn(),
  };

  it("renders widget templates", () => {
    const { getByTestId } = render(<WidgetLibrary {...baseProps} />);
    expect(getByTestId("widget-library")).toBeTruthy();
    expect(getByTestId("widget-template-w1")).toBeTruthy();
    expect(getByTestId("widget-template-w2")).toBeTruthy();
    expect(getByTestId("widget-template-w3")).toBeTruthy();
  });

  it("filters by category", () => {
    const { getByTestId, queryByTestId } = render(
      <WidgetLibrary {...baseProps} filterCategory="sales" />,
    );
    expect(getByTestId("widget-template-w1")).toBeTruthy();
    expect(queryByTestId("widget-template-w2")).toBeNull();
    expect(queryByTestId("widget-template-w3")).toBeNull();
  });

  it("calls onSelectWidget when a widget is pressed", () => {
    const { getByTestId } = render(<WidgetLibrary {...baseProps} />);
    fireEvent.press(getByTestId("widget-template-w1"));
    expect(baseProps.onSelectWidget).toHaveBeenCalledWith("w1");
  });
});

// =============================================================================
// WidgetConfigPanel
// =============================================================================

describe("WidgetConfigPanel", () => {
  const baseProps = {
    config: {
      title: "Revenue Chart",
      dataSource: "ds1",
      refreshInterval: 30,
      displayType: "chart" as const,
      colorScheme: "blue",
      filters: {},
    },
    onConfigChange: jest.fn(),
    dataSources: [
      { id: "ds1", name: "Sales Data" },
      { id: "ds2", name: "Inventory Data" },
    ],
    onSave: jest.fn(),
    onCancel: jest.fn(),
    onPreview: jest.fn(),
  };

  it("renders config fields", () => {
    const { getByTestId } = render(<WidgetConfigPanel {...baseProps} />);
    expect(getByTestId("widget-config-panel")).toBeTruthy();
    expect(getByTestId("widget-config-title").props.value).toBe("Revenue Chart");
    expect(getByTestId("widget-config-source-ds1")).toBeTruthy();
    expect(getByTestId("widget-config-source-ds2")).toBeTruthy();
    expect(getByTestId("widget-config-type-chart")).toBeTruthy();
    expect(getByTestId("widget-config-refresh-30")).toBeTruthy();
    expect(getByTestId("widget-config-color-blue")).toBeTruthy();
  });

  it("calls onSave when save button is pressed", () => {
    const { getByTestId } = render(<WidgetConfigPanel {...baseProps} />);
    fireEvent.press(getByTestId("widget-config-save"));
    expect(baseProps.onSave).toHaveBeenCalled();
  });
});

// =============================================================================
// SmartCollectionBuilder
// =============================================================================

describe("SmartCollectionBuilder", () => {
  const baseProps = {
    collectionName: "Premium Products",
    onCollectionNameChange: jest.fn(),
    rules: [
      { id: "rule1", field: "price", operator: "greater_than" as const, value: "100" },
      { id: "rule2", field: "category", operator: "equals" as const, value: "electronics" },
    ],
    onAddRule: jest.fn(),
    onRemoveRule: jest.fn(),
    onUpdateRule: jest.fn(),
    matchType: "all" as const,
    onMatchTypeChange: jest.fn(),
    availableFields: [
      { id: "price", name: "Price", type: "number" as const },
      { id: "category", name: "Category", type: "string" as const },
    ],
    previewCount: 42,
    onPreview: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  it("renders collection name and rules", () => {
    const { getByTestId } = render(<SmartCollectionBuilder {...baseProps} />);
    expect(getByTestId("smart-collection-builder")).toBeTruthy();
    expect(getByTestId("collection-name").props.value).toBe("Premium Products");
    expect(getByTestId("collection-rule-rule1")).toBeTruthy();
    expect(getByTestId("collection-rule-rule2")).toBeTruthy();
  });

  it("calls onAddRule when add rule button is pressed", () => {
    const { getByTestId } = render(<SmartCollectionBuilder {...baseProps} />);
    fireEvent.press(getByTestId("collection-add-rule"));
    expect(baseProps.onAddRule).toHaveBeenCalled();
  });

  it("shows preview count", () => {
    const { getByTestId } = render(<SmartCollectionBuilder {...baseProps} />);
    expect(getByTestId("collection-preview-count").props.children).toEqual([
      42,
      " ",
      "items match",
    ]);
  });
});
