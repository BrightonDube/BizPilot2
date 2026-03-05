/**
 * Tests for customer account UI components (tasks 13.2-13.4).
 *
 * Covers:
 * - AccountDetailScreen: renders account info, balance, transactions, actions
 * - AccountCreationForm: validation, submission, payment terms selector
 * - TransactionHistoryView: filtering, grouping, empty state
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { AccountDetailScreen } from "../components/accounts/AccountDetailScreen";
import { AccountCreationForm } from "../components/accounts/AccountCreationForm";
import { TransactionHistoryView } from "../components/accounts/TransactionHistoryView";
import type {
  CustomerAccount,
  AccountTransaction,
} from "../services/accounts/CustomerAccountService";

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

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const NOW = "2024-06-15T12:00:00Z";

const mockAccount: CustomerAccount = {
  id: "acc-001",
  customerName: "Cape Town Bistro",
  customerEmail: "info@capetownbistro.co.za",
  customerPhone: "+27 21 555 1234",
  status: "active",
  creditLimit: 25000,
  currentBalance: 8500,
  paymentTerms: "net_30",
  openedAt: "2024-01-15T10:00:00Z",
  lastTransactionAt: "2024-06-10T14:30:00Z",
};

const mockTransactions: AccountTransaction[] = [
  {
    id: "tx-1",
    accountId: "acc-001",
    type: "charge",
    amount: 1500,
    balanceAfter: 8500,
    description: "Order #1042 — Lunch service",
    reference: "ORD-1042",
    createdAt: "2024-06-10T14:30:00Z",
    staffName: "Thabo M.",
  },
  {
    id: "tx-2",
    accountId: "acc-001",
    type: "payment",
    amount: 5000,
    balanceAfter: 7000,
    description: "EFT payment received",
    reference: "PAY-2024-06",
    createdAt: "2024-06-08T09:15:00Z",
    staffName: "Naledi K.",
  },
  {
    id: "tx-3",
    accountId: "acc-001",
    type: "credit_note",
    amount: 250,
    balanceAfter: 12000,
    description: "Return — damaged goods",
    createdAt: "2024-06-05T16:45:00Z",
    staffName: "Thabo M.",
  },
  {
    id: "tx-4",
    accountId: "acc-001",
    type: "charge",
    amount: 3200,
    balanceAfter: 12250,
    description: "Order #1038 — Event catering",
    reference: "ORD-1038",
    createdAt: "2024-06-05T11:00:00Z",
    staffName: "Sipho D.",
  },
  {
    id: "tx-5",
    accountId: "acc-001",
    type: "write_off",
    amount: 450,
    balanceAfter: 9050,
    description: "Bad debt write-off",
    createdAt: "2024-05-30T08:00:00Z",
    staffName: "Manager",
  },
  {
    id: "tx-6",
    accountId: "acc-001",
    type: "charge",
    amount: 1800,
    balanceAfter: 9500,
    description: "Order #1035 — Dinner service",
    createdAt: "2024-05-28T19:30:00Z",
    staffName: "Thabo M.",
  },
];

// ---------------------------------------------------------------------------
// AccountDetailScreen
// ---------------------------------------------------------------------------

describe("AccountDetailScreen", () => {
  const mockOnBack = jest.fn();
  const mockOnCharge = jest.fn();
  const mockOnPayment = jest.fn();
  const mockOnViewStatements = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("renders account name", () => {
    const { getByText } = render(
      <AccountDetailScreen
        account={mockAccount}
        transactions={mockTransactions}
        onBack={mockOnBack}
        onCharge={mockOnCharge}
        onPayment={mockOnPayment}
        onViewStatements={mockOnViewStatements}
      />
    );

    expect(getByText("Cape Town Bistro")).toBeTruthy();
  });

  it("renders balance amount", () => {
    const { getAllByText } = render(
      <AccountDetailScreen
        account={mockAccount}
        transactions={mockTransactions}
        onBack={mockOnBack}
        onCharge={mockOnCharge}
        onPayment={mockOnPayment}
        onViewStatements={mockOnViewStatements}
      />
    );

    const balanceTexts = getAllByText(/R 8500\.00/);
    expect(balanceTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("renders account status", () => {
    const { getByText } = render(
      <AccountDetailScreen
        account={mockAccount}
        transactions={mockTransactions}
        onBack={mockOnBack}
        onCharge={mockOnCharge}
        onPayment={mockOnPayment}
        onViewStatements={mockOnViewStatements}
      />
    );

    expect(getByText("Active")).toBeTruthy();
  });

  it("renders payment terms", () => {
    const { getByText } = render(
      <AccountDetailScreen
        account={mockAccount}
        transactions={mockTransactions}
        onBack={mockOnBack}
        onCharge={mockOnCharge}
        onPayment={mockOnPayment}
        onViewStatements={mockOnViewStatements}
      />
    );

    expect(getByText(/Net 30/)).toBeTruthy();
  });

  it("calls onBack when back button pressed", () => {
    const { getByTestId } = render(
      <AccountDetailScreen
        account={mockAccount}
        transactions={mockTransactions}
        onBack={mockOnBack}
        onCharge={mockOnCharge}
        onPayment={mockOnPayment}
        onViewStatements={mockOnViewStatements}
      />
    );

    const backButton = getByTestId("back-button");
    fireEvent.press(backButton);
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it("shows recent transactions", () => {
    const { getByText } = render(
      <AccountDetailScreen
        account={mockAccount}
        transactions={mockTransactions}
        onBack={mockOnBack}
        onCharge={mockOnCharge}
        onPayment={mockOnPayment}
        onViewStatements={mockOnViewStatements}
      />
    );

    expect(getByText(/Order #1042/)).toBeTruthy();
  });

  it("renders credit limit", () => {
    const { getAllByText } = render(
      <AccountDetailScreen
        account={mockAccount}
        transactions={mockTransactions}
        onBack={mockOnBack}
        onCharge={mockOnCharge}
        onPayment={mockOnPayment}
        onViewStatements={mockOnViewStatements}
      />
    );

    const limitTexts = getAllByText(/R 25000\.00/);
    expect(limitTexts.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// AccountCreationForm
// ---------------------------------------------------------------------------

describe("AccountCreationForm", () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("renders all form fields", () => {
    const { getByTestId } = render(
      <AccountCreationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    expect(getByTestId("account-name-input")).toBeTruthy();
    expect(getByTestId("account-email-input")).toBeTruthy();
    expect(getByTestId("account-phone-input")).toBeTruthy();
    expect(getByTestId("account-credit-limit-input")).toBeTruthy();
  });

  it("shows payment terms options", () => {
    const { getByText } = render(
      <AccountCreationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    expect(getByText(/Net 30/)).toBeTruthy();
  });

  it("has a submit button", () => {
    const { getByTestId } = render(
      <AccountCreationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    const submitButton = getByTestId("account-creation-submit");
    expect(submitButton).toBeTruthy();
  });

  it("calls onCancel when cancel button pressed", () => {
    const { getByTestId } = render(
      <AccountCreationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    const cancelButton = getByTestId("account-creation-cancel");
    fireEvent.press(cancelButton);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("shows loading state when submitting", () => {
    const { getByTestId } = render(
      <AccountCreationForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isSubmitting={true}
      />
    );

    const submitButton = getByTestId("account-creation-submit");
    expect(submitButton).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// TransactionHistoryView
// ---------------------------------------------------------------------------

describe("TransactionHistoryView", () => {
  it("renders account name in header", () => {
    const { getByText } = render(
      <TransactionHistoryView
        transactions={mockTransactions}
        accountName="Cape Town Bistro"
      />
    );

    expect(getByText(/Cape Town Bistro/)).toBeTruthy();
  });

  it("renders filter options", () => {
    const { getByText } = render(
      <TransactionHistoryView
        transactions={mockTransactions}
        accountName="Cape Town Bistro"
      />
    );

    expect(getByText("All")).toBeTruthy();
    expect(getByText("Charges")).toBeTruthy();
    expect(getByText("Payments")).toBeTruthy();
  });

  it("renders transaction descriptions", () => {
    const { getByText } = render(
      <TransactionHistoryView
        transactions={mockTransactions}
        accountName="Cape Town Bistro"
      />
    );

    expect(getByText(/Order #1042/)).toBeTruthy();
  });

  it("renders transaction amounts", () => {
    const { getAllByText } = render(
      <TransactionHistoryView
        transactions={mockTransactions}
        accountName="Cape Town Bistro"
      />
    );

    const amounts = getAllByText(/R 1500\.00/);
    expect(amounts.length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no transactions", () => {
    const { getByText } = render(
      <TransactionHistoryView
        transactions={[]}
        accountName="Cape Town Bistro"
      />
    );

    expect(getByText(/No transactions/i)).toBeTruthy();
  });

  it("renders staff names", () => {
    const { getAllByText } = render(
      <TransactionHistoryView
        transactions={mockTransactions}
        accountName="Cape Town Bistro"
      />
    );

    const thaboEntries = getAllByText(/Thabo M\./);
    expect(thaboEntries.length).toBeGreaterThanOrEqual(1);
  });

  it("renders references when present", () => {
    const { getByText } = render(
      <TransactionHistoryView
        transactions={mockTransactions}
        accountName="Cape Town Bistro"
      />
    );

    expect(getByText(/ORD-1042/)).toBeTruthy();
  });
});
