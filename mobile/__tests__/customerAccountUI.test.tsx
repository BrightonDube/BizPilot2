/**
 * Tests for customer account UI components.
 * (customer-accounts tasks 13.1, 13.5, 14.1-14.3)
 */

import React from "react";
import { render, fireEvent, within } from "@testing-library/react-native";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("@/utils/formatters", () => ({
  formatCurrency: (v: number) => `R ${v.toFixed(2)}`,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { AccountListScreen } from "@/components/accounts/AccountListScreen";
import { ChargeToAccountModal } from "@/components/accounts/ChargeToAccountModal";
import { PaymentEntryForm } from "@/components/accounts/PaymentEntryForm";
import { CustomerAccount } from "@/services/accounts/CustomerAccountService";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockAccounts: CustomerAccount[] = [
  {
    id: "acc-1",
    customerName: "Alice Smith",
    customerEmail: "alice@example.com",
    customerPhone: "0812345678",
    status: "active",
    creditLimit: 5000,
    currentBalance: 2000,
    paymentTerms: "net_30",
    openedAt: "2024-01-01T00:00:00Z",
    lastTransactionAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "acc-2",
    customerName: "Bob Jones",
    status: "suspended",
    creditLimit: 3000,
    currentBalance: 500,
    paymentTerms: "net_7",
    openedAt: "2024-06-01T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// AccountListScreen
// ---------------------------------------------------------------------------

describe("AccountListScreen", () => {
  const defaultProps = {
    accounts: mockAccounts,
    onSelectAccount: jest.fn(),
    onCreateAccount: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the screen", () => {
    const { getByTestId, getByText } = render(
      <AccountListScreen {...defaultProps} />
    );
    expect(getByTestId("account-list-screen")).toBeTruthy();
    expect(getByText("Customer Accounts")).toBeTruthy();
  });

  it("shows account count", () => {
    const { getByText } = render(
      <AccountListScreen {...defaultProps} />
    );
    expect(getByText("2 accounts")).toBeTruthy();
  });

  it("renders account cards", () => {
    const { getByTestId } = render(
      <AccountListScreen {...defaultProps} />
    );
    expect(getByTestId("account-card-acc-1")).toBeTruthy();
    expect(getByTestId("account-card-acc-2")).toBeTruthy();
  });

  it("displays customer names", () => {
    const { getByText } = render(
      <AccountListScreen {...defaultProps} />
    );
    expect(getByText("Alice Smith")).toBeTruthy();
    expect(getByText("Bob Jones")).toBeTruthy();
  });

  it("shows balance", () => {
    const { getByText } = render(
      <AccountListScreen {...defaultProps} />
    );
    expect(getByText("R 2000.00")).toBeTruthy();
  });

  it("calls onSelectAccount when card pressed", () => {
    const { getByTestId } = render(
      <AccountListScreen {...defaultProps} />
    );
    fireEvent.press(getByTestId("account-card-acc-1"));
    expect(defaultProps.onSelectAccount).toHaveBeenCalledWith(mockAccounts[0]);
  });

  it("has create account button", () => {
    const { getByTestId } = render(
      <AccountListScreen {...defaultProps} />
    );
    fireEvent.press(getByTestId("create-account-button"));
    expect(defaultProps.onCreateAccount).toHaveBeenCalled();
  });

  it("has search input", () => {
    const { getByTestId } = render(
      <AccountListScreen {...defaultProps} />
    );
    expect(getByTestId("account-search-input")).toBeTruthy();
  });

  it("filters accounts when searching", () => {
    const { getByTestId, queryByTestId } = render(
      <AccountListScreen {...defaultProps} />
    );
    fireEvent.changeText(getByTestId("account-search-input"), "Alice");
    expect(getByTestId("account-card-acc-1")).toBeTruthy();
    expect(queryByTestId("account-card-acc-2")).toBeNull();
  });

  it("shows empty state when no matches", () => {
    const { getByTestId, getByText } = render(
      <AccountListScreen {...defaultProps} />
    );
    fireEvent.changeText(getByTestId("account-search-input"), "nonexistent");
    expect(getByText("No accounts found")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ChargeToAccountModal
// ---------------------------------------------------------------------------

describe("ChargeToAccountModal", () => {
  const defaultProps = {
    account: mockAccounts[0],
    orderId: "ord-123",
    orderTotal: 350,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the modal", () => {
    const { getByTestId, getByText } = render(
      <ChargeToAccountModal {...defaultProps} />
    );
    expect(getByTestId("charge-to-account-modal")).toBeTruthy();
    expect(getByText("Charge to Account")).toBeTruthy();
  });

  it("shows account name", () => {
    const { getByText } = render(
      <ChargeToAccountModal {...defaultProps} />
    );
    expect(getByText("Alice Smith")).toBeTruthy();
  });

  it("shows charge amount", () => {
    const { getByText } = render(
      <ChargeToAccountModal {...defaultProps} />
    );
    expect(getByText("R 350.00")).toBeTruthy();
  });

  it("shows current balance and available credit", () => {
    const { getByText } = render(
      <ChargeToAccountModal {...defaultProps} />
    );
    expect(getByText("R 2000.00")).toBeTruthy(); // current balance
    expect(getByText("R 3000.00")).toBeTruthy(); // available credit
  });

  it("calls onCancel when cancel pressed", () => {
    const { getByTestId } = render(
      <ChargeToAccountModal {...defaultProps} />
    );
    fireEvent.press(getByTestId("charge-cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("shows validation errors for over-limit charge", () => {
    const { getByTestId } = render(
      <ChargeToAccountModal
        {...defaultProps}
        account={mockAccounts[0]}
        orderTotal={4000}
      />
    );
    expect(getByTestId("charge-errors")).toBeTruthy();
  });

  it("disables confirm for suspended account", () => {
    const { getByTestId } = render(
      <ChargeToAccountModal
        {...defaultProps}
        account={mockAccounts[1]}
      />
    );
    const btn = getByTestId("charge-confirm");
    expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// PaymentEntryForm
// ---------------------------------------------------------------------------

describe("PaymentEntryForm", () => {
  const defaultProps = {
    account: mockAccounts[0],
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the form", () => {
    const { getByTestId, getByText, getAllByText } = render(
      <PaymentEntryForm {...defaultProps} />
    );
    expect(getByTestId("payment-entry-form")).toBeTruthy();
    expect(getAllByText("Record Payment").length).toBeGreaterThanOrEqual(1);
  });

  it("shows account name and balance", () => {
    const { getByText, getAllByText } = render(
      <PaymentEntryForm {...defaultProps} />
    );
    expect(getByText("Alice Smith")).toBeTruthy();
    expect(getAllByText("R 2000.00").length).toBeGreaterThanOrEqual(1);
  });

  it("has amount input", () => {
    const { getByTestId } = render(
      <PaymentEntryForm {...defaultProps} />
    );
    expect(getByTestId("payment-amount-input")).toBeTruthy();
  });

  it("has payment method buttons", () => {
    const { getByTestId } = render(
      <PaymentEntryForm {...defaultProps} />
    );
    expect(getByTestId("method-cash")).toBeTruthy();
    expect(getByTestId("method-card")).toBeTruthy();
    expect(getByTestId("method-eft")).toBeTruthy();
    expect(getByTestId("method-cheque")).toBeTruthy();
  });

  it("has quick amount buttons", () => {
    const { getByTestId } = render(
      <PaymentEntryForm {...defaultProps} />
    );
    expect(getByTestId("quick-full")).toBeTruthy();
    expect(getByTestId("quick-50%")).toBeTruthy();
  });

  it("calls onCancel when cancel pressed", () => {
    const { getByTestId } = render(
      <PaymentEntryForm {...defaultProps} />
    );
    fireEvent.press(getByTestId("payment-cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("submit is disabled without amount", () => {
    const { getByTestId } = render(
      <PaymentEntryForm {...defaultProps} />
    );
    const btn = getByTestId("payment-submit");
    expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
  });
});
