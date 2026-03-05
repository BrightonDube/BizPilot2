/**
 * Stock control component UI tests.
 *
 * Covers AdjustmentForm, ReceivingForm, WasteEntryForm, StockTakeForm,
 * and BulkApprovalList with 14 tests total.
 */
import React from "react";
import { render, fireEvent, waitFor, within } from "@testing-library/react-native";

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

import AdjustmentForm from "../components/stock/AdjustmentForm";
import ReceivingForm from "../components/stock/ReceivingForm";
import WasteEntryForm from "../components/stock/WasteEntryForm";
import StockTakeForm from "../components/stock/StockTakeForm";
import BulkApprovalList from "../components/stock/BulkApprovalList";

// ─── AdjustmentForm ──────────────────────────────────────────────────────────

const baseAdjustmentProps = {
  productName: "Widget A",
  productSku: "WGT-001",
  currentStock: 50,
  adjustmentType: "increase" as const,
  onTypeChange: jest.fn(),
  quantity: "10",
  onQuantityChange: jest.fn(),
  reason: "" as const,
  onReasonChange: jest.fn(),
  notes: "",
  onNotesChange: jest.fn(),
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

describe("AdjustmentForm", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders product info and form fields", () => {
    const { getByText, getByTestId } = render(
      <AdjustmentForm {...baseAdjustmentProps} />,
    );

    expect(getByText("Widget A")).toBeTruthy();
    expect(getByText("SKU: WGT-001")).toBeTruthy();
    expect(getByTestId("adjustment-form")).toBeTruthy();
    expect(getByTestId("adjustment-quantity")).toBeTruthy();
    expect(getByTestId("adjustment-notes")).toBeTruthy();
  });

  it("calls onSubmit when submit pressed", () => {
    const onSubmit = jest.fn();
    const { getByTestId } = render(
      <AdjustmentForm {...baseAdjustmentProps} onSubmit={onSubmit} />,
    );

    fireEvent.press(getByTestId("adjustment-submit"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows new stock preview (current + quantity)", () => {
    const { getByTestId } = render(
      <AdjustmentForm {...baseAdjustmentProps} currentStock={50} quantity="10" adjustmentType="increase" />,
    );

    const preview = getByTestId("adjustment-preview");
    // Preview should show current (50), operator (+10), and result (60)
    expect(preview).toBeTruthy();
    expect(within(preview).getByText("60")).toBeTruthy();
  });
});

// ─── ReceivingForm ───────────────────────────────────────────────────────────

const receivingItems = [
  { id: "r1", productName: "Alpha", sku: "A-01", orderedQty: 100, receivedQty: 0, unitCost: 25 },
  { id: "r2", productName: "Beta", sku: "B-02", orderedQty: 50, receivedQty: 50, unitCost: 10 },
];

const baseReceivingProps = {
  purchaseOrderNumber: "PO-2024-001",
  supplierName: "Acme Supplies",
  items: receivingItems,
  onUpdateReceivedQty: jest.fn(),
  onReceiveAll: jest.fn(),
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
  deliveryNote: "",
  onDeliveryNoteChange: jest.fn(),
};

describe("ReceivingForm", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders PO number and items", () => {
    const { getByTestId } = render(<ReceivingForm {...baseReceivingProps} />);

    expect(getByTestId("receiving-po-number")).toBeTruthy();
    expect(getByTestId("receiving-supplier")).toBeTruthy();
    expect(getByTestId("receiving-item-r1")).toBeTruthy();
    expect(getByTestId("receiving-item-r2")).toBeTruthy();
  });

  it("calls onReceiveAll", () => {
    const onReceiveAll = jest.fn();
    const { getByTestId } = render(
      <ReceivingForm {...baseReceivingProps} onReceiveAll={onReceiveAll} />,
    );

    fireEvent.press(getByTestId("receiving-receive-all"));
    expect(onReceiveAll).toHaveBeenCalledTimes(1);
  });

  it("shows summary totals", () => {
    const { getByText, getAllByText } = render(<ReceivingForm {...baseReceivingProps} />);

    // totalItems = 2, totalReceived = 1 (Beta has receivedQty > 0)
    // totalValue = 0*25 + 50*10 = 500
    expect(getByText("1 / 2")).toBeTruthy();
    expect(getAllByText("R 500.00").length).toBeGreaterThanOrEqual(1);
  });
});

// ─── WasteEntryForm ──────────────────────────────────────────────────────────

const baseWasteProps = {
  productName: "Perishable Item",
  productSku: "PER-100",
  currentStock: 30,
  quantity: "5",
  onQuantityChange: jest.fn(),
  reason: "" as const,
  onReasonChange: jest.fn(),
  costPerUnit: 12.5,
  notes: "",
  onNotesChange: jest.fn(),
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

describe("WasteEntryForm", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders waste form with product info", () => {
    const { getByText, getAllByText, getByTestId } = render(
      <WasteEntryForm {...baseWasteProps} />,
    );

    expect(getByText("Perishable Item")).toBeTruthy();
    expect(getByText("SKU: PER-100")).toBeTruthy();
    expect(getByTestId("waste-quantity")).toBeTruthy();
    expect(getByTestId("waste-notes")).toBeTruthy();
    expect(getAllByText("Record Waste").length).toBeGreaterThanOrEqual(1);
  });

  it("shows waste cost calculation", () => {
    const { getByTestId } = render(
      <WasteEntryForm {...baseWasteProps} quantity="5" costPerUnit={12.5} />,
    );

    // totalWasteCost = 5 * 12.5 = 62.5
    const costCard = getByTestId("waste-cost");
    expect(within(costCard).getByText("R 62.50")).toBeTruthy();
  });
});

// ─── StockTakeForm ───────────────────────────────────────────────────────────

const stockTakeItems = [
  { id: "st1", productName: "Item One", sku: "I-01", expectedQty: 100, countedQty: 98, category: "Electronics" },
  { id: "st2", productName: "Item Two", sku: "I-02", expectedQty: 50, countedQty: null, category: "Food" },
  { id: "st3", productName: "Item Three", sku: "I-03", expectedQty: 75, countedQty: 75, category: "Electronics" },
];

const baseStockTakeProps = {
  stockTakeName: "Monthly Count Q1",
  items: stockTakeItems,
  onUpdateCount: jest.fn(),
  onMarkCounted: jest.fn(),
  filterCategory: "",
  onFilterCategoryChange: jest.fn(),
  categories: ["Electronics", "Food"],
  searchQuery: "",
  onSearchChange: jest.fn(),
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

describe("StockTakeForm", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders items with count inputs", () => {
    const { getByTestId, getByText } = render(
      <StockTakeForm {...baseStockTakeProps} />,
    );

    expect(getByTestId("stock-take-form")).toBeTruthy();
    expect(getByText("Monthly Count Q1")).toBeTruthy();
    expect(getByTestId("stock-take-item-st1")).toBeTruthy();
    expect(getByTestId("stock-take-count-st1")).toBeTruthy();
    expect(getByTestId("stock-take-item-st2")).toBeTruthy();
  });

  it("shows progress indicator", () => {
    const { getByTestId } = render(
      <StockTakeForm {...baseStockTakeProps} />,
    );

    const progress = getByTestId("stock-take-progress");
    // 2 of 3 items counted (st1 and st3)
    expect(within(progress).getByText("2/3")).toBeTruthy();
    expect(within(progress).getByText("67%")).toBeTruthy();
  });

  it("filters by search query", () => {
    const { queryByTestId } = render(
      <StockTakeForm {...baseStockTakeProps} searchQuery="Item One" />,
    );

    expect(queryByTestId("stock-take-item-st1")).toBeTruthy();
    expect(queryByTestId("stock-take-item-st2")).toBeNull();
    expect(queryByTestId("stock-take-item-st3")).toBeNull();
  });
});

// ─── BulkApprovalList ────────────────────────────────────────────────────────

const approvalItems = [
  {
    id: "a1",
    type: "adjustment" as const,
    description: "Correction for Widget",
    requestedBy: "John",
    requestedAt: "2024-01-15T10:00:00Z",
    quantity: 10,
    value: 250,
    status: "pending" as const,
  },
  {
    id: "a2",
    type: "waste" as const,
    description: "Expired milk batch",
    requestedBy: "Jane",
    requestedAt: "2024-01-16T14:00:00Z",
    quantity: 20,
    value: 100,
    status: "pending" as const,
  },
];

const baseApprovalProps = {
  items: approvalItems,
  onApprove: jest.fn(),
  onReject: jest.fn(),
  onApproveAll: jest.fn(),
  onRejectAll: jest.fn(),
  selectedIds: [] as string[],
  onToggleSelect: jest.fn(),
  onSelectAll: jest.fn(),
  filterType: "",
  onFilterTypeChange: jest.fn(),
};

describe("BulkApprovalList", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders approval items", () => {
    const { getByTestId, getByText } = render(
      <BulkApprovalList {...baseApprovalProps} />,
    );

    expect(getByTestId("bulk-approval-list")).toBeTruthy();
    expect(getByTestId("approval-item-a1")).toBeTruthy();
    expect(getByTestId("approval-item-a2")).toBeTruthy();
    expect(getByText("Correction for Widget")).toBeTruthy();
    expect(getByText("Expired milk batch")).toBeTruthy();
  });

  it("calls onApprove for individual item", () => {
    const onApprove = jest.fn();
    const { getByTestId } = render(
      <BulkApprovalList {...baseApprovalProps} onApprove={onApprove} />,
    );

    fireEvent.press(getByTestId("approval-approve-a1"));
    expect(onApprove).toHaveBeenCalledWith("a1");
  });

  it("shows empty state", () => {
    const { getByTestId, getByText } = render(
      <BulkApprovalList {...baseApprovalProps} items={[]} />,
    );

    expect(getByTestId("approval-empty")).toBeTruthy();
    expect(getByText("No items to review")).toBeTruthy();
  });
});
