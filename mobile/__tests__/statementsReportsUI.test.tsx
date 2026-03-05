/**
 * Integration tests for the four statement / reports UI components:
 *   1. StatementView
 *   2. AgingReportDashboard
 *   3. ARSummaryDashboard
 *   4. CollectionsQueueView
 *
 * 20 tests total — 5 per component.
 */

import React from "react";
import { render, fireEvent, within } from "@testing-library/react-native";

import StatementView from "../components/accounts/StatementView";
import AgingReportDashboard from "../components/accounts/AgingReportDashboard";
import ARSummaryDashboard from "../components/accounts/ARSummaryDashboard";
import CollectionsQueueView from "../components/accounts/CollectionsQueueView";

import type {
  Statement,
  StatementTransaction,
  AgingBreakdown,
} from "../components/accounts/StatementView";
import type {
  AgingBucket,
  AccountAgingRow,
} from "../components/accounts/AgingReportDashboard";
import type {
  ARMetrics,
  TopAccount,
  MonthlyTrend,
} from "../components/accounts/ARSummaryDashboard";
import type {
  CollectionItem,
  CollectionActivity,
} from "../components/accounts/CollectionsQueueView";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function createMockStatement(): Statement {
  const transactions: StatementTransaction[] = [
    {
      id: "tx-1",
      date: "2024-06-01T10:00:00Z",
      type: "charge",
      description: "Order #1001",
      amount: 500,
      runningBalance: 1500,
    },
    {
      id: "tx-2",
      date: "2024-06-05T14:00:00Z",
      type: "payment",
      description: "EFT Payment",
      amount: 300,
      runningBalance: 1200,
    },
  ];

  const aging: AgingBreakdown = {
    current: 800,
    days30: 200,
    days60: 100,
    days90Plus: 100,
    total: 1200,
  };

  return {
    id: "stmt-001",
    accountId: "acc-001",
    accountName: "Cape Town Bistro",
    accountNumber: "ACC-1234",
    statementDate: "2024-06-30T00:00:00Z",
    periodStart: "2024-06-01T00:00:00Z",
    periodEnd: "2024-06-30T00:00:00Z",
    openingBalance: 1000,
    totalCharges: 500,
    totalPayments: 300,
    closingBalance: 1200,
    aging,
    transactions,
  };
}

function createMockAgingBuckets(): AgingBucket[] {
  return [
    { label: "Current", amount: 15000, count: 5, percentage: 50 },
    { label: "1-30 Days", amount: 6000, count: 3, percentage: 20 },
    { label: "31-60 Days", amount: 4500, count: 2, percentage: 15 },
    { label: "61-90 Days", amount: 3000, count: 2, percentage: 10 },
    { label: "90+ Days", amount: 1500, count: 1, percentage: 5 },
  ];
}

function createMockAccountAgingRows(): AccountAgingRow[] {
  return [
    {
      id: "ar-1",
      accountName: "Cape Town Bistro",
      accountNumber: "ACC-1234",
      current: 5000,
      days30: 2000,
      days60: 1000,
      days90Plus: 500,
      totalOwed: 8500,
      paymentTerms: 30,
      lastPaymentDate: "2024-06-10",
    },
    {
      id: "ar-2",
      accountName: "Stellenbosch Deli",
      accountNumber: "ACC-5678",
      current: 3000,
      days30: 1000,
      days60: 0,
      days90Plus: 0,
      totalOwed: 4000,
      paymentTerms: 14,
      lastPaymentDate: null,
    },
  ];
}

function createMockARMetrics(): ARMetrics {
  return {
    totalReceivables: 30000,
    totalCreditLimit: 100000,
    totalAvailableCredit: 70000,
    averageDSO: 32.5,
    overdueAmount: 9000,
    overduePercentage: 30,
    totalAccounts: 20,
    activeAccounts: 18,
    suspendedAccounts: 2,
    collectionsCount: 5,
  };
}

function createMockTopAccounts(): TopAccount[] {
  return [
    {
      id: "ta-1",
      name: "Cape Town Bistro",
      balance: 8500,
      creditLimit: 25000,
      utilizationPercent: 34,
      daysOverdue: 15,
    },
    {
      id: "ta-2",
      name: "Stellenbosch Deli",
      balance: 4000,
      creditLimit: 10000,
      utilizationPercent: 40,
      daysOverdue: 0,
    },
  ];
}

function createMockMonthlyTrends(): MonthlyTrend[] {
  return [
    { month: "Apr", charges: 12000, payments: 10000, netChange: 2000 },
    { month: "May", charges: 15000, payments: 14000, netChange: 1000 },
    { month: "Jun", charges: 11000, payments: 13000, netChange: -2000 },
  ];
}

function createMockCollectionItems(): CollectionItem[] {
  const activity: CollectionActivity = {
    id: "act-1",
    type: "phone_call",
    date: "2024-06-12T09:00:00Z",
    notes: "Left voicemail",
    createdBy: "staff-1",
  };

  return [
    {
      id: "col-1",
      accountId: "acc-001",
      accountName: "Cape Town Bistro",
      accountNumber: "ACC-1234",
      totalOwed: 8500,
      overdueAmount: 3500,
      daysOverdue: 45,
      lastPaymentDate: "2024-05-15T00:00:00Z",
      lastContactDate: "2024-06-12T09:00:00Z",
      priority: "high",
      promiseDate: null,
      promiseAmount: null,
      recentActivities: [activity],
    },
    {
      id: "col-2",
      accountId: "acc-002",
      accountName: "Stellenbosch Deli",
      accountNumber: "ACC-5678",
      totalOwed: 4000,
      overdueAmount: 1000,
      daysOverdue: 10,
      lastPaymentDate: null,
      lastContactDate: null,
      priority: "low",
      promiseDate: null,
      promiseAmount: null,
      recentActivities: [],
    },
  ];
}

// ===========================================================================
// StatementView
// ===========================================================================

describe("StatementView", () => {
  const defaultProps = () => ({
    statement: createMockStatement(),
    onBack: jest.fn(),
    onDownload: jest.fn(),
    onEmail: jest.fn(),
  });

  it("renders statement with all sections", () => {
    const { getByTestId } = render(<StatementView {...defaultProps()} />);

    expect(getByTestId("statement-view")).toBeTruthy();
    expect(getByTestId("statement-account-info")).toBeTruthy();
    expect(getByTestId("statement-balance-summary")).toBeTruthy();
    expect(getByTestId("statement-aging-breakdown")).toBeTruthy();
    expect(getByTestId("statement-footer")).toBeTruthy();
  });

  it("calls onBack when back button pressed", () => {
    const props = defaultProps();
    const { getByTestId } = render(<StatementView {...props} />);

    fireEvent.press(getByTestId("statement-back-btn"));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it("calls onDownload with statement ID", () => {
    const props = defaultProps();
    const { getByTestId } = render(<StatementView {...props} />);

    fireEvent.press(getByTestId("statement-download-btn"));
    expect(props.onDownload).toHaveBeenCalledWith("stmt-001");
  });

  it("calls onEmail with statement ID", () => {
    const props = defaultProps();
    const { getByTestId } = render(<StatementView {...props} />);

    fireEvent.press(getByTestId("statement-email-btn"));
    expect(props.onEmail).toHaveBeenCalledWith("stmt-001");
  });

  it("displays formatted currency amounts", () => {
    const { getByTestId } = render(<StatementView {...defaultProps()} />);

    const summary = getByTestId("statement-balance-summary");
    const summaryContent = within(summary);

    expect(summaryContent.getByText("R 1000.00")).toBeTruthy();
    expect(summaryContent.getByText("+R 500.00")).toBeTruthy();
    expect(summaryContent.getByText("−R 300.00")).toBeTruthy();
    expect(summaryContent.getByText("R 1200.00")).toBeTruthy();
  });
});

// ===========================================================================
// AgingReportDashboard
// ===========================================================================

describe("AgingReportDashboard", () => {
  const defaultProps = () => ({
    buckets: createMockAgingBuckets(),
    accounts: createMockAccountAgingRows(),
    totalAR: 30000,
    reportDate: "30 Jun 2024",
    onBack: jest.fn(),
    onAccountPress: jest.fn(),
    onRefresh: jest.fn(),
    isLoading: false,
  });

  it("renders dashboard with summary cards and accounts list", () => {
    const { getByTestId } = render(<AgingReportDashboard {...defaultProps()} />);

    expect(getByTestId("aging-report-dashboard")).toBeTruthy();
    expect(getByTestId("aging-summary-cards")).toBeTruthy();
    expect(getByTestId("aging-total-ar")).toBeTruthy();
    expect(getByTestId("aging-accounts-list")).toBeTruthy();
  });

  it("shows loading state when isLoading", () => {
    const props = { ...defaultProps(), accounts: [], isLoading: true };
    const { getByTestId } = render(<AgingReportDashboard {...props} />);

    expect(getByTestId("aging-loading")).toBeTruthy();
  });

  it("shows empty state when no accounts", () => {
    const props = { ...defaultProps(), accounts: [], isLoading: false };
    const { getByTestId } = render(<AgingReportDashboard {...props} />);

    expect(getByTestId("aging-empty-state")).toBeTruthy();
  });

  it("calls onAccountPress when account row tapped", () => {
    const props = defaultProps();
    const { getByTestId } = render(<AgingReportDashboard {...props} />);

    fireEvent.press(getByTestId("aging-account-ar-1"));
    expect(props.onAccountPress).toHaveBeenCalledWith("ar-1");
  });

  it("calls onRefresh when refresh button pressed", () => {
    const props = defaultProps();
    const { getByTestId } = render(<AgingReportDashboard {...props} />);

    fireEvent.press(getByTestId("aging-refresh-btn"));
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// ARSummaryDashboard
// ===========================================================================

describe("ARSummaryDashboard", () => {
  const defaultProps = () => ({
    metrics: createMockARMetrics(),
    topAccounts: createMockTopAccounts(),
    monthlyTrends: createMockMonthlyTrends(),
    onBack: jest.fn(),
    onAccountPress: jest.fn(),
    onViewAgingReport: jest.fn(),
    onViewCollections: jest.fn(),
    isLoading: false,
  });

  it("renders KPI cards with all metrics", () => {
    const { getByTestId } = render(<ARSummaryDashboard {...defaultProps()} />);

    expect(getByTestId("ar-summary-dashboard")).toBeTruthy();
    expect(getByTestId("ar-kpi-grid")).toBeTruthy();
    expect(getByTestId("ar-kpi-total-receivables")).toBeTruthy();
    expect(getByTestId("ar-kpi-avg-dso")).toBeTruthy();
    expect(getByTestId("ar-kpi-overdue")).toBeTruthy();
    expect(getByTestId("ar-kpi-active-accounts")).toBeTruthy();
  });

  it("calls onBack when back pressed", () => {
    const props = defaultProps();
    const { getByTestId } = render(<ARSummaryDashboard {...props} />);

    fireEvent.press(getByTestId("ar-back-btn"));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it("calls onViewAgingReport when aging button pressed", () => {
    const props = defaultProps();
    const { getByTestId } = render(<ARSummaryDashboard {...props} />);

    fireEvent.press(getByTestId("ar-aging-btn"));
    expect(props.onViewAgingReport).toHaveBeenCalledTimes(1);
  });

  it("calls onViewCollections when collections button pressed", () => {
    const props = defaultProps();
    const { getByTestId } = render(<ARSummaryDashboard {...props} />);

    fireEvent.press(getByTestId("ar-collections-btn"));
    expect(props.onViewCollections).toHaveBeenCalledTimes(1);
  });

  it("shows loading state", () => {
    const props = { ...defaultProps(), isLoading: true };
    const { getByTestId } = render(<ARSummaryDashboard {...props} />);

    expect(getByTestId("ar-loading")).toBeTruthy();
  });
});

// ===========================================================================
// CollectionsQueueView
// ===========================================================================

describe("CollectionsQueueView", () => {
  const defaultProps = () => ({
    items: createMockCollectionItems(),
    totalOverdue: 4500,
    onBack: jest.fn(),
    onLogActivity: jest.fn(),
    onAccountPress: jest.fn(),
    onWriteOff: jest.fn(),
    isLoading: false,
  });

  it("renders collection items with priority indicators", () => {
    const { getByTestId } = render(<CollectionsQueueView {...defaultProps()} />);

    expect(getByTestId("collections-queue-view")).toBeTruthy();
    expect(getByTestId("collection-card-col-1")).toBeTruthy();
    expect(getByTestId("collection-card-col-2")).toBeTruthy();
  });

  it("filters items by priority when filter pill pressed", () => {
    const { getByTestId, queryByTestId } = render(
      <CollectionsQueueView {...defaultProps()} />,
    );

    fireEvent.press(getByTestId("collections-filter-high"));

    expect(getByTestId("collection-card-col-1")).toBeTruthy();
    expect(queryByTestId("collection-card-col-2")).toBeNull();
  });

  it("calls onLogActivity when activity action used", () => {
    const props = defaultProps();
    const { getByTestId } = render(<CollectionsQueueView {...props} />);

    // Tap the "Log Call" button on the first collection card
    fireEvent.press(getByTestId("action-call-col-1"));

    // Fill in notes in the activity modal
    fireEvent.changeText(getByTestId("activity-notes-input"), "Spoke with owner");

    // Save the activity
    fireEvent.press(getByTestId("activity-save-btn"));

    expect(props.onLogActivity).toHaveBeenCalledWith(
      "acc-001",
      "phone_call",
      "Spoke with owner",
    );
  });

  it("shows empty state when no items", () => {
    const props = { ...defaultProps(), items: [], isLoading: false };
    const { getByTestId } = render(<CollectionsQueueView {...props} />);

    expect(getByTestId("collections-empty")).toBeTruthy();
  });

  it("calls onAccountPress when item pressed", () => {
    const props = defaultProps();
    const { getByTestId } = render(<CollectionsQueueView {...props} />);

    fireEvent.press(getByTestId("collection-card-col-1"));
    expect(props.onAccountPress).toHaveBeenCalledWith("acc-001");
  });
});
