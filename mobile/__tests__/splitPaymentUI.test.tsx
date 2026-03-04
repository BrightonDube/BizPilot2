/**
 * Tests for SplitPaymentScreen, TenderLineCard, and PaymentBreakdownView.
 * (integrated-payments tasks 7.1-7.4)
 *
 * Uses React Native Testing Library to validate:
 * - Initial render with empty state
 * - Adding tender lines via method buttons
 * - Removing tender lines
 * - Summary banner (remaining, change)
 * - Confirm button disabled until fully paid
 * - PaymentBreakdownView renders correct tender list
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { SplitPaymentScreen } from "@/components/payment/SplitPaymentScreen";
import { TenderLineCard } from "@/components/payment/TenderLineCard";
import { PaymentBreakdownView } from "@/components/payment/PaymentBreakdownView";

// ---------------------------------------------------------------------------
// SplitPaymentScreen tests
// ---------------------------------------------------------------------------

describe("SplitPaymentScreen", () => {
  const defaultProps = {
    orderTotal: 500,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with order total displayed", () => {
    const { getByText, getAllByText, getByTestId } = render(
      <SplitPaymentScreen {...defaultProps} />
    );
    expect(getByTestId("split-payment-screen")).toBeTruthy();
    expect(getByText("Split Payment")).toBeTruthy();
    // "R 500.00" appears in both Order Total and Remaining cards
    expect(getAllByText("R 500.00").length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no tenders added", () => {
    const { getByText } = render(<SplitPaymentScreen {...defaultProps} />);
    expect(getByText(/Add a payment method/)).toBeTruthy();
  });

  it("adds a cash tender when Cash button is pressed", () => {
    const { getByTestId } = render(<SplitPaymentScreen {...defaultProps} />);
    fireEvent.press(getByTestId("add-cash"));
    expect(getByTestId("tender-line-0")).toBeTruthy();
  });

  it("adds a card tender when Card button is pressed", () => {
    const { getByTestId } = render(<SplitPaymentScreen {...defaultProps} />);
    fireEvent.press(getByTestId("add-card"));
    expect(getByTestId("tender-line-0")).toBeTruthy();
  });

  it("can add multiple tenders", () => {
    const { getByTestId } = render(<SplitPaymentScreen {...defaultProps} />);
    fireEvent.press(getByTestId("add-cash"));
    fireEvent.press(getByTestId("add-card"));
    expect(getByTestId("tender-line-0")).toBeTruthy();
    expect(getByTestId("tender-line-1")).toBeTruthy();
  });

  it("removes a tender when remove button is pressed", () => {
    const { getByTestId, queryByTestId } = render(
      <SplitPaymentScreen {...defaultProps} />
    );
    fireEvent.press(getByTestId("add-card"));
    expect(getByTestId("tender-line-0")).toBeTruthy();
    fireEvent.press(getByTestId("remove-tender-0"));
    expect(queryByTestId("tender-line-0")).toBeNull();
  });

  it("confirm button is disabled when not fully paid", () => {
    const { getByTestId } = render(<SplitPaymentScreen {...defaultProps} />);
    const confirmBtn = getByTestId("confirm-button");
    expect(confirmBtn.props.accessibilityState?.disabled ?? confirmBtn.props.disabled).toBeTruthy();
  });

  it("calls onCancel when cancel button is pressed", () => {
    const { getByTestId } = render(<SplitPaymentScreen {...defaultProps} />);
    fireEvent.press(getByTestId("cancel-button"));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("calls onCancel from footer cancel button", () => {
    const { getByTestId } = render(<SplitPaymentScreen {...defaultProps} />);
    fireEvent.press(getByTestId("footer-cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("displays all five add-tender method buttons", () => {
    const { getByTestId } = render(<SplitPaymentScreen {...defaultProps} />);
    expect(getByTestId("add-cash")).toBeTruthy();
    expect(getByTestId("add-card")).toBeTruthy();
    expect(getByTestId("add-eft")).toBeTruthy();
    expect(getByTestId("add-room_charge")).toBeTruthy();
    expect(getByTestId("add-voucher")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// TenderLineCard tests
// ---------------------------------------------------------------------------

describe("TenderLineCard", () => {
  const baseTender = {
    id: "t1",
    method: "cash" as const,
    amount: 150,
    processed: false,
  };

  const defaultProps = {
    tender: baseTender,
    index: 0,
    onUpdateAmount: jest.fn(),
    onUpdateCashTendered: jest.fn(),
    onRemove: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders with method label and amount", () => {
    const { getByText, getByTestId } = render(
      <TenderLineCard {...defaultProps} />
    );
    expect(getByText("Cash")).toBeTruthy();
    expect(getByTestId("tender-amount-0")).toBeTruthy();
  });

  it("shows Cash Tendered input for cash method", () => {
    const { getByTestId } = render(<TenderLineCard {...defaultProps} />);
    expect(getByTestId("tender-cash-0")).toBeTruthy();
  });

  it("hides Cash Tendered input for card method", () => {
    const { queryByTestId } = render(
      <TenderLineCard
        {...defaultProps}
        tender={{ ...baseTender, method: "card" }}
      />
    );
    expect(queryByTestId("tender-cash-0")).toBeNull();
  });

  it("shows Paid badge when processed", () => {
    const { getByText, queryByTestId } = render(
      <TenderLineCard
        {...defaultProps}
        tender={{ ...baseTender, processed: true }}
      />
    );
    expect(getByText("Paid")).toBeTruthy();
    expect(queryByTestId("remove-tender-card-0")).toBeNull();
  });

  it("calls onRemove when remove button pressed", () => {
    const { getByTestId } = render(<TenderLineCard {...defaultProps} />);
    fireEvent.press(getByTestId("remove-tender-card-0"));
    expect(defaultProps.onRemove).toHaveBeenCalledWith("t1");
  });

  it("displays change indicator when cashTendered > amount", () => {
    const { getByText } = render(
      <TenderLineCard
        {...defaultProps}
        tender={{ ...baseTender, amount: 100, cashTendered: 120 }}
      />
    );
    expect(getByText("Change: R 20.00")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// PaymentBreakdownView tests
// ---------------------------------------------------------------------------

describe("PaymentBreakdownView", () => {
  const tenders = [
    { id: "t1", method: "cash" as const, amount: 200, cashTendered: 220, processed: true },
    { id: "t2", method: "card" as const, amount: 150, processed: true, reference: "YC-ABC123456" },
  ];

  it("renders all tender lines", () => {
    const { getByTestId, getByText } = render(
      <PaymentBreakdownView orderTotal={350} tenders={tenders} />
    );
    expect(getByTestId("payment-breakdown")).toBeTruthy();
    expect(getByTestId("breakdown-line-0")).toBeTruthy();
    expect(getByTestId("breakdown-line-1")).toBeTruthy();
    expect(getByText("Payment Breakdown")).toBeTruthy();
  });

  it("displays order total", () => {
    const { getAllByText } = render(
      <PaymentBreakdownView orderTotal={350} tenders={tenders} />
    );
    // "R 350.00" appears in both Total Paid and Order Total
    expect(getAllByText("R 350.00").length).toBeGreaterThanOrEqual(1);
  });

  it("displays change due from cash tenders", () => {
    const { getByText } = render(
      <PaymentBreakdownView orderTotal={350} tenders={tenders} />
    );
    expect(getByText("R 20.00")).toBeTruthy();
    expect(getByText("Change Due")).toBeTruthy();
  });

  it("shows reference for card tender", () => {
    const { getByText } = render(
      <PaymentBreakdownView orderTotal={350} tenders={tenders} />
    );
    expect(getByText("#123456")).toBeTruthy();
  });

  it("renders correctly with single tender", () => {
    const single = [
      { id: "t1", method: "eft" as const, amount: 100, processed: true },
    ];
    const { getByTestId, queryByText } = render(
      <PaymentBreakdownView orderTotal={100} tenders={single} />
    );
    expect(getByTestId("breakdown-line-0")).toBeTruthy();
    expect(queryByText("Change Due")).toBeNull();
  });
});
