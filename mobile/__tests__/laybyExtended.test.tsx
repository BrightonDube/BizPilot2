/**
 * BizPilot Mobile POS — Extended Layby Component Tests
 *
 * Tests for LaybyForm, CollectionModal, LaybyReports, and LaybyConfigForm.
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

import LaybyForm from "../components/laybys/LaybyForm";
import CollectionModal from "../components/laybys/CollectionModal";
import LaybyReports from "../components/laybys/LaybyReports";
import LaybyConfigForm from "../components/laybys/LaybyConfigForm";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));
jest.mock("@/utils/haptics", () => ({
  triggerHaptic: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleItems = [
  { id: "i1", name: "Leather Jacket", quantity: 1, price: 2500 },
  { id: "i2", name: "Boots", quantity: 2, price: 800 },
];

function makeLaybyFormProps(overrides = {}) {
  return {
    customerName: "Alice Smith",
    onCustomerNameChange: jest.fn(),
    customerPhone: "0821234567",
    onCustomerPhoneChange: jest.fn(),
    customerEmail: "alice@example.com",
    onCustomerEmailChange: jest.fn(),
    items: sampleItems,
    totalAmount: 4100,
    depositPercentage: 20,
    onDepositPercentageChange: jest.fn(),
    instalmentCount: 6,
    onInstalmentCountChange: jest.fn(),
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
    isSubmitting: false,
    errors: {},
    ...overrides,
  };
}

function makeCollectionModalProps(overrides = {}) {
  return {
    visible: true,
    onClose: jest.fn(),
    laybyId: "LBY-001",
    customerName: "Alice Smith",
    items: sampleItems,
    totalPaid: 4100,
    totalAmount: 4100,
    outstandingBalance: 0,
    onConfirmCollection: jest.fn(),
    isProcessing: false,
    ...overrides,
  };
}

const sampleReportData = {
  activeLaybysCount: 12,
  totalOutstanding: 34500,
  totalCollected: 120000,
  averageDepositPercent: 22,
  overdueCount: 3,
  completionRate: 78.5,
  recentPayments: [
    { id: "p1", customerName: "Bob", amount: 500, date: "2024-06-01", laybyId: "LBY-010" },
    { id: "p2", customerName: "Carol", amount: 750, date: "2024-06-02", laybyId: "LBY-011" },
  ],
  monthlyTrend: [
    { month: "May", created: 8, completed: 5, cancelled: 1 },
  ],
};

function makeLaybyReportsProps(overrides = {}) {
  return {
    data: sampleReportData,
    period: "30d",
    onPeriodChange: jest.fn(),
    onLaybyPress: jest.fn(),
    isLoading: false,
    ...overrides,
  };
}

const sampleConfig = {
  minDepositPercent: 20,
  maxInstalmentMonths: 12,
  overdueGraceDays: 7,
  cancellationFeePercent: 10,
  autoReminderEnabled: true,
  reminderDaysBefore: 3,
};

function makeConfigFormProps(overrides = {}) {
  return {
    config: sampleConfig,
    onConfigChange: jest.fn(),
    onSave: jest.fn(),
    onReset: jest.fn(),
    isSaving: false,
    hasChanges: true,
    ...overrides,
  };
}

// ===========================================================================
// LaybyForm
// ===========================================================================

describe("LaybyForm", () => {
  it("renders form with customer inputs", () => {
    const props = makeLaybyFormProps();
    const { getByTestId } = render(<LaybyForm {...props} />);

    expect(getByTestId("layby-form")).toBeTruthy();
    expect(getByTestId("layby-customer-name")).toBeTruthy();
    expect(getByTestId("layby-customer-phone")).toBeTruthy();
    expect(getByTestId("layby-customer-email")).toBeTruthy();
  });

  it("shows item summary with totals", () => {
    const props = makeLaybyFormProps();
    const { getByTestId, getAllByText, getByText } = render(<LaybyForm {...props} />);

    expect(getByTestId("layby-total")).toBeTruthy();
    expect(getAllByText("R 4100.00").length).toBeGreaterThan(0);
    expect(getByText("Leather Jacket")).toBeTruthy();
    expect(getByText("Boots")).toBeTruthy();
  });

  it("calls onSubmit", () => {
    const props = makeLaybyFormProps();
    const { getByTestId } = render(<LaybyForm {...props} />);

    fireEvent.press(getByTestId("layby-submit"));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("disables submit when isSubmitting", () => {
    const props = makeLaybyFormProps({ isSubmitting: true });
    const { getByTestId } = render(<LaybyForm {...props} />);

    const submitBtn = getByTestId("layby-submit");
    expect(submitBtn.props.accessibilityState?.disabled ?? submitBtn.props.disabled).toBe(true);
  });
});

// ===========================================================================
// CollectionModal
// ===========================================================================

describe("CollectionModal", () => {
  it("renders collection details", () => {
    const props = makeCollectionModalProps();
    const { getByTestId } = render(<CollectionModal {...props} />);

    expect(getByTestId("collection-modal")).toBeTruthy();
    expect(getByTestId("collection-customer")).toBeTruthy();
    expect(getByTestId("collection-total-paid")).toBeTruthy();
    expect(getByTestId("collection-balance")).toBeTruthy();
  });

  it("shows warning when outstanding balance > 0", () => {
    const props = makeCollectionModalProps({ outstandingBalance: 500, totalPaid: 3600 });
    const { getByTestId } = render(<CollectionModal {...props} />);

    expect(getByTestId("collection-warning")).toBeTruthy();
  });

  it("calls onConfirmCollection", () => {
    const props = makeCollectionModalProps({ outstandingBalance: 0 });
    const { getByTestId } = render(<CollectionModal {...props} />);

    fireEvent.press(getByTestId("collection-confirm"));
    expect(props.onConfirmCollection).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// LaybyReports
// ===========================================================================

describe("LaybyReports", () => {
  it("renders KPI cards", () => {
    const props = makeLaybyReportsProps();
    const { getByTestId } = render(<LaybyReports {...props} />);

    expect(getByTestId("layby-reports")).toBeTruthy();
    expect(getByTestId("layby-reports-active")).toBeTruthy();
    expect(getByTestId("layby-reports-outstanding")).toBeTruthy();
    expect(getByTestId("layby-reports-overdue")).toBeTruthy();
    expect(getByTestId("layby-reports-completion")).toBeTruthy();
  });

  it("shows recent payments", () => {
    const props = makeLaybyReportsProps();
    const { getByTestId, getByText } = render(<LaybyReports {...props} />);

    expect(getByTestId("layby-reports-payment-p1")).toBeTruthy();
    expect(getByTestId("layby-reports-payment-p2")).toBeTruthy();
    expect(getByText("Bob")).toBeTruthy();
  });

  it("changes period", () => {
    const props = makeLaybyReportsProps();
    const { getByTestId } = render(<LaybyReports {...props} />);

    fireEvent.press(getByTestId("layby-reports-period-7d"));
    expect(props.onPeriodChange).toHaveBeenCalledWith("7d");
  });
});

// ===========================================================================
// LaybyConfigForm
// ===========================================================================

describe("LaybyConfigForm", () => {
  it("renders config fields", () => {
    const props = makeConfigFormProps();
    const { getByTestId } = render(<LaybyConfigForm {...props} />);

    expect(getByTestId("layby-config-form")).toBeTruthy();
    expect(getByTestId("layby-config-min-deposit")).toBeTruthy();
    expect(getByTestId("layby-config-grace-days")).toBeTruthy();
    expect(getByTestId("layby-config-cancel-fee")).toBeTruthy();
    expect(getByTestId("layby-config-reminder-toggle")).toBeTruthy();
  });

  it("calls onSave", () => {
    const props = makeConfigFormProps({ hasChanges: true });
    const { getByTestId } = render(<LaybyConfigForm {...props} />);

    fireEvent.press(getByTestId("layby-config-save"));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it("disables save when no changes", () => {
    const props = makeConfigFormProps({ hasChanges: false });
    const { getByTestId } = render(<LaybyConfigForm {...props} />);

    const saveBtn = getByTestId("layby-config-save");
    expect(saveBtn.props.accessibilityState?.disabled ?? saveBtn.props.disabled).toBe(true);
  });
});
