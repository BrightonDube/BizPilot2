/**
 * BizPilot Mobile — Quote UI Tests
 *
 * Covers QuoteListScreen (5 tests) and QuoteCreationForm (5 tests).
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

import QuoteListScreen from "@/components/quotes/QuoteListScreen";
import QuoteCreationForm from "@/components/quotes/QuoteCreationForm";
import type { Quote } from "@/services/quotes/QuoteService";
import type {
  Customer,
  Product,
} from "@/components/quotes/QuoteCreationForm";

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

jest.mock("@/services/quotes/QuoteService", () => {
  const actual = jest.requireActual("@/services/quotes/QuoteService");
  return {
    ...actual,
    searchQuotes: (quotes: Quote[], q: string) => {
      if (!q.trim()) return quotes;
      const lower = q.toLowerCase();
      return quotes.filter(
        (qt: Quote) =>
          qt.quoteNumber.toLowerCase().includes(lower) ||
          qt.customerName.toLowerCase().includes(lower)
      );
    },
    sortQuotesByDate: (quotes: Quote[]) => quotes,
    filterQuotesByStatus: (quotes: Quote[], statuses: string[]) =>
      quotes.filter((q: Quote) => statuses.includes(q.status)),
    calculateExpiryWarning: () => "safe",
    getDaysUntilExpiry: () => 15,
    calculateLineItem: (
      name: string,
      qty: number,
      price: number,
      discount: number,
      taxRate: number
    ) => {
      const net = qty * price * (1 - discount / 100);
      const tax = net * (taxRate / 100);
      return {
        productName: name,
        quantity: qty,
        unitPrice: price,
        discount,
        taxRate,
        lineTotal: net,
        lineTax: tax,
      };
    },
    calculateQuoteTotals: () => ({
      subtotal: 0,
      totalDiscount: 0,
      totalTax: 0,
      grandTotal: 0,
    }),
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "q1",
    quoteNumber: "QT-20250101-0001",
    customerId: "c1",
    customerName: "Acme Corp",
    customerEmail: "acme@example.com",
    items: [
      {
        id: "li1",
        productId: "p1",
        productName: "Widget",
        quantity: 2,
        unitPrice: 100,
        discount: 0,
        taxRate: 15,
        lineTotal: 200,
        lineTax: 30,
      },
    ],
    subtotal: 200,
    totalDiscount: 0,
    totalTax: 30,
    grandTotal: 230,
    status: "draft",
    validUntil: "2025-06-01T00:00:00Z",
    notes: "",
    termsAndConditions: "",
    createdBy: "user1",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    sentAt: null,
    approvedAt: null,
    convertedAt: null,
    revisionNumber: 1,
    ...overrides,
  };
}

const MOCK_QUOTES: Quote[] = [
  makeQuote(),
  makeQuote({
    id: "q2",
    quoteNumber: "QT-20250102-0002",
    customerName: "Beta LLC",
    status: "sent",
    grandTotal: 500,
  }),
  makeQuote({
    id: "q3",
    quoteNumber: "QT-20250103-0003",
    customerName: "Gamma Inc",
    status: "approved",
    grandTotal: 750,
  }),
  makeQuote({
    id: "q4",
    quoteNumber: "QT-20250104-0004",
    customerName: "Delta Co",
    status: "converted",
    grandTotal: 1200,
  }),
];

const MOCK_CUSTOMERS: Customer[] = [
  { id: "c1", name: "Acme Corp", email: "acme@example.com" },
  { id: "c2", name: "Beta LLC", email: "beta@example.com" },
];

const MOCK_PRODUCTS: Product[] = [
  { id: "p1", name: "Widget", price: 100, taxRate: 15 },
  { id: "p2", name: "Gadget", price: 250, taxRate: 15 },
];

// ---------------------------------------------------------------------------
// QuoteListScreen
// ---------------------------------------------------------------------------

describe("QuoteListScreen", () => {
  const baseProps = {
    quotes: MOCK_QUOTES,
    onCreateQuote: jest.fn(),
    onQuotePress: jest.fn(),
    onBack: jest.fn(),
    isLoading: false,
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the quotes list with cards for each quote", () => {
    const { getByTestId } = render(<QuoteListScreen {...baseProps} />);

    expect(getByTestId("quote-list")).toBeTruthy();
    expect(getByTestId("quote-card-q1")).toBeTruthy();
    expect(getByTestId("quote-card-q2")).toBeTruthy();
    expect(getByTestId("quote-card-q3")).toBeTruthy();
    expect(getByTestId("quote-card-q4")).toBeTruthy();
  });

  it("shows stats row with total, active, pending, and converted counts", () => {
    const { getByTestId, getAllByText } = render(
      <QuoteListScreen {...baseProps} />
    );

    const statsRow = getByTestId("quote-stats");
    expect(statsRow).toBeTruthy();
    // total=4, active=draft+sent+viewed=2, pending=sent+viewed=1, converted=1
    expect(getAllByText("4").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Total").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Active").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Pending").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Converted").length).toBeGreaterThanOrEqual(1);
  });

  it("filters quotes when a status filter pill is pressed", () => {
    const { getByTestId, queryByTestId } = render(
      <QuoteListScreen {...baseProps} />
    );

    fireEvent.press(getByTestId("quote-filter-draft"));

    // Only the draft quote (q1) should remain visible
    expect(getByTestId("quote-card-q1")).toBeTruthy();
    expect(queryByTestId("quote-card-q2")).toBeNull();
    expect(queryByTestId("quote-card-q3")).toBeNull();
    expect(queryByTestId("quote-card-q4")).toBeNull();
  });

  it("calls onCreateQuote when New Quote button is pressed", () => {
    const { getByTestId } = render(<QuoteListScreen {...baseProps} />);

    fireEvent.press(getByTestId("quote-new-btn"));

    expect(baseProps.onCreateQuote).toHaveBeenCalledTimes(1);
  });

  it("shows loading state when isLoading is true and empty state when no quotes", () => {
    // Loading
    const { getByTestId, rerender, queryByTestId } = render(
      <QuoteListScreen {...baseProps} isLoading />
    );
    expect(getByTestId("quote-loading")).toBeTruthy();

    // Empty
    rerender(<QuoteListScreen {...baseProps} quotes={[]} isLoading={false} />);
    expect(getByTestId("quote-empty")).toBeTruthy();
    expect(queryByTestId("quote-loading")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// QuoteCreationForm
// ---------------------------------------------------------------------------

describe("QuoteCreationForm", () => {
  const baseProps = {
    customers: MOCK_CUSTOMERS,
    products: MOCK_PRODUCTS,
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
    isSubmitting: false,
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the form with the customer selector", () => {
    const { getByTestId, getByText } = render(
      <QuoteCreationForm {...baseProps} />
    );

    expect(getByTestId("quote-form")).toBeTruthy();
    expect(getByTestId("quote-customer-select")).toBeTruthy();
    expect(getByText("Select a customer…")).toBeTruthy();
  });

  it("shows the add item button", () => {
    const { getByTestId, getByText } = render(
      <QuoteCreationForm {...baseProps} />
    );

    expect(getByTestId("quote-add-item-btn")).toBeTruthy();
    expect(getByText("Add Item")).toBeTruthy();
  });

  it("shows the totals section with subtotal, discount, tax, and grand total", () => {
    const { getByTestId, getByText } = render(
      <QuoteCreationForm {...baseProps} />
    );

    expect(getByTestId("quote-totals")).toBeTruthy();
    expect(getByText("Subtotal")).toBeTruthy();
    expect(getByText("Discount")).toBeTruthy();
    expect(getByText("Tax")).toBeTruthy();
    expect(getByText("Grand Total")).toBeTruthy();
  });

  it("calls onCancel when cancel button is pressed", () => {
    const { getByTestId } = render(<QuoteCreationForm {...baseProps} />);

    fireEvent.press(getByTestId("quote-cancel-btn"));

    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows validity selector pills", () => {
    const { getAllByTestId, getByText } = render(
      <QuoteCreationForm {...baseProps} />
    );

    const pills = getAllByTestId("quote-validity-select");
    expect(pills.length).toBe(5); // 7, 14, 30, 60, 90

    expect(getByText("7 days")).toBeTruthy();
    expect(getByText("14 days")).toBeTruthy();
    expect(getByText("30 days")).toBeTruthy();
    expect(getByText("60 days")).toBeTruthy();
    expect(getByText("90 days")).toBeTruthy();
  });
});
