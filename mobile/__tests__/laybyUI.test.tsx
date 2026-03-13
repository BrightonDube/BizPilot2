import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

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
// Imports (after mocks)
// ---------------------------------------------------------------------------

import LaybyTable, {
  LaybyTableProps,
} from "../components/laybys/LaybyTable";
import PaymentModal, {
  PaymentModalProps,
} from "../components/laybys/PaymentModal";
import CancellationModal, {
  CancellationModalProps,
  CancellationConfig,
} from "../components/laybys/CancellationModal";
import type { Layby, LaybyItem, PaymentScheduleEntry } from "../services/laybys/LaybyService";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<LaybyItem> = {}): LaybyItem {
  return {
    id: "item-1",
    productId: "prod-1",
    productName: "Widget",
    quantity: 2,
    unitPrice: 250,
    lineTotal: 500,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<PaymentScheduleEntry> = {}): PaymentScheduleEntry {
  return {
    dueDate: "2025-03-01T00:00:00.000Z",
    amount: 200,
    status: "pending",
    paidAmount: 0,
    ...overrides,
  };
}

function makeLayby(overrides: Partial<Layby> = {}): Layby {
  return {
    id: "layby-1",
    referenceNumber: "LB-001",
    status: "active",
    customerName: "Jane Doe",
    customerId: "cust-1",
    items: [makeItem()],
    totalAmount: 1000,
    depositAmount: 200,
    amountPaid: 400,
    balanceDue: 600,
    paymentFrequency: "monthly",
    schedule: [
      makeEntry({ dueDate: "2025-02-01T00:00:00.000Z", status: "paid", paidAmount: 200 }),
      makeEntry({ dueDate: "2025-03-01T00:00:00.000Z", status: "pending", amount: 200 }),
      makeEntry({ dueDate: "2025-04-01T00:00:00.000Z", status: "pending", amount: 200 }),
    ],
    startDate: "2025-01-01T00:00:00.000Z",
    endDate: "2025-06-01T00:00:00.000Z",
    nextPaymentDate: "2025-03-01T00:00:00.000Z",
    nextPaymentAmount: 200,
    extensionCount: 0,
    notes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const cancellationConfig: CancellationConfig = {
  cancellationFeePercentage: 10,
  minimumFee: 50,
  restockingFeePerItem: 15,
};

// =========================================================================
// LaybyTable
// =========================================================================

describe("LaybyTable", () => {
  const defaultProps: LaybyTableProps = {
    laybys: [
      makeLayby({ id: "1", referenceNumber: "LB-001", status: "active", customerName: "Alice" }),
      makeLayby({ id: "2", referenceNumber: "LB-002", status: "overdue", customerName: "Bob" }),
    ],
    onLaybyPress: jest.fn(),
    onCreateNew: jest.fn(),
    onBack: jest.fn(),
  };

  it("renders layby cards with progress", () => {
    const { getByText, getByTestId } = render(<LaybyTable {...defaultProps} />);
    expect(getByTestId("layby-table")).toBeTruthy();
    expect(getByText("LB-001")).toBeTruthy();
    expect(getByText("LB-002")).toBeTruthy();
    expect(getByText("Alice")).toBeTruthy();
  });

  it("filters laybys by status", () => {
    const { getByTestId, queryByText } = render(<LaybyTable {...defaultProps} />);
    fireEvent.press(getByTestId("layby-filter-active"));
    // Only the active layby should remain visible
    expect(queryByText("LB-001")).toBeTruthy();
  });

  it("calls onCreateNew when New Layby is pressed", () => {
    const onCreateNew = jest.fn();
    const { getByTestId } = render(
      <LaybyTable {...defaultProps} onCreateNew={onCreateNew} />
    );
    fireEvent.press(getByTestId("layby-new-btn"));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it("shows loading and empty states", () => {
    // Loading state
    const { getByTestId, rerender } = render(
      <LaybyTable {...defaultProps} laybys={[]} isLoading />
    );
    expect(getByTestId("layby-loading")).toBeTruthy();

    // Empty state
    rerender(<LaybyTable {...defaultProps} laybys={[]} isLoading={false} />);
    expect(getByTestId("layby-empty")).toBeTruthy();
  });
});

// =========================================================================
// PaymentModal
// =========================================================================

describe("PaymentModal", () => {
  const layby = makeLayby();

  const defaultProps: PaymentModalProps = {
    visible: true,
    layby,
    onSubmitPayment: jest.fn(),
    onClose: jest.fn(),
  };

  it("renders with layby info", () => {
    const { getByText, getByTestId } = render(<PaymentModal {...defaultProps} />);
    expect(getByTestId("payment-modal")).toBeTruthy();
    expect(getByText("LB-001")).toBeTruthy();
    expect(getByText("Jane Doe")).toBeTruthy();
    expect(getByTestId("payment-balance")).toBeTruthy();
  });

  it("shows payment method pills", () => {
    const { getByTestId } = render(<PaymentModal {...defaultProps} />);
    expect(getByTestId("payment-method-cash")).toBeTruthy();
    expect(getByTestId("payment-method-card")).toBeTruthy();
    expect(getByTestId("payment-method-eft")).toBeTruthy();
    expect(getByTestId("payment-method-other")).toBeTruthy();
  });

  it("validates amount does not exceed balance", () => {
    const { getByTestId, getByText } = render(<PaymentModal {...defaultProps} />);
    const input = getByTestId("payment-amount-input");
    fireEvent.changeText(input, "9999");
    expect(getByText("Amount exceeds balance due.")).toBeTruthy();
  });

  it("calls onSubmitPayment with correct data", () => {
    const onSubmitPayment = jest.fn();
    const { getByTestId } = render(
      <PaymentModal {...defaultProps} onSubmitPayment={onSubmitPayment} />
    );
    // Default amount is pre-filled with next instalment (200)
    fireEvent.press(getByTestId("payment-method-card"));
    fireEvent.press(getByTestId("payment-submit-btn"));
    expect(onSubmitPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 200,
        paymentMethod: "card",
      })
    );
  });
});

// =========================================================================
// CancellationModal
// =========================================================================

describe("CancellationModal", () => {
  const layby = makeLayby();

  const defaultProps: CancellationModalProps = {
    visible: true,
    layby,
    config: cancellationConfig,
    onConfirmCancellation: jest.fn(),
    onClose: jest.fn(),
  };

  it("renders fee breakdown", () => {
    const { getByTestId, getByText } = render(<CancellationModal {...defaultProps} />);
    expect(getByTestId("cancel-fee-breakdown")).toBeTruthy();
    expect(getByText("Fee Breakdown")).toBeTruthy();
    // Cancellation fee: 10% of 1000 = 100
    expect(getByText("R 100.00")).toBeTruthy();
  });

  it("shows refund amount", () => {
    const { getByTestId } = render(<CancellationModal {...defaultProps} />);
    const refund = getByTestId("cancel-refund-amount");
    expect(refund).toBeTruthy();
    // totalPaid=400, cancellation=100, restocking=15*2=30, refund=400-130=270
    expect(refund.props.children).toBe("R 270.00");
  });

  it("requires reason text before confirming", () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <CancellationModal {...defaultProps} onConfirmCancellation={onConfirm} />
    );
    // Confirm button should be disabled without reason
    const btn = getByTestId("cancel-confirm-btn");
    expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();

    // Enter a reason and confirm
    fireEvent.changeText(getByTestId("cancel-reason-input"), "Customer request");
    fireEvent.press(getByTestId("cancel-confirm-btn"));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Customer request" })
    );
  });

  it("shows warning text about irreversible action", () => {
    const { getByTestId, getByText } = render(<CancellationModal {...defaultProps} />);
    expect(getByTestId("cancel-warning")).toBeTruthy();
    expect(
      getByText(/This action cannot be undone/)
    ).toBeTruthy();
  });
});
