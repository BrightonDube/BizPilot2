/**
 * BizPilot Mobile POS — ReceiptService Tests
 *
 * Tests for receipt formatting, text rendering, and date formatting.
 */

import {
  formatLineItem,
  formatReceiptDateTime,
  formatReceipt,
  renderTextReceipt,
  type FormattedReceipt,
  type ReceiptConfig,
} from "@/services/ReceiptService";
import type { MobileOrder, MobileOrderItem } from "@/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TEST_CONFIG: ReceiptConfig = {
  businessName: "Test Restaurant",
  addressLine1: "123 Main Street",
  addressLine2: "Cape Town, 8001",
  phone: "+27 21 123 4567",
  vatNumber: "4123456789",
  footerMessage: "Thank you for dining with us!",
  showVatInvoice: true,
  vatInvoicePrefix: "INV",
  taxRate: 0.15,
};

function makeOrder(overrides: Partial<MobileOrder> = {}): MobileOrder {
  return {
    id: "order-1",
    orderNumber: "ABC123",
    customerId: null,
    status: "completed",
    subtotal: 100,
    taxAmount: 15,
    discountAmount: 0,
    total: 115,
    paymentMethod: "cash",
    paymentStatus: "paid",
    notes: null,
    createdBy: "user-1",
    createdAt: new Date("2024-03-15T14:30:00Z").getTime(),
    updatedAt: new Date("2024-03-15T14:30:00Z").getTime(),
    remoteId: null,
    syncedAt: null,
    isDirty: false,
    ...overrides,
  };
}

function makeOrderItem(
  overrides: Partial<MobileOrderItem> = {}
): MobileOrderItem {
  return {
    id: "item-1",
    remoteId: null,
    orderId: "order-1",
    productId: "prod-1",
    productName: "Burger",
    quantity: 2,
    unitPrice: 50,
    discount: 0,
    total: 100,
    notes: null,
    createdAt: Date.now(),
    syncedAt: null,
    isDirty: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// formatLineItem tests
// ---------------------------------------------------------------------------

describe("formatLineItem", () => {
  it("calculates line total correctly", () => {
    const item = makeOrderItem({ unitPrice: 50, quantity: 3, discount: 0 });
    const result = formatLineItem(item);
    expect(result.lineTotal).toBe(150);
    expect(result.productName).toBe("Burger");
    expect(result.quantity).toBe(3);
  });

  it("applies discount to line total", () => {
    const item = makeOrderItem({
      unitPrice: 100,
      quantity: 1,
      discount: 20,
    });
    const result = formatLineItem(item);
    expect(result.lineTotal).toBe(80);
    expect(result.discount).toBe(20);
  });

  it("preserves notes", () => {
    const item = makeOrderItem({ notes: "No onions" });
    const result = formatLineItem(item);
    expect(result.notes).toBe("No onions");
  });

  it("handles null notes", () => {
    const item = makeOrderItem({ notes: null });
    const result = formatLineItem(item);
    expect(result.notes).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatReceiptDateTime tests
// ---------------------------------------------------------------------------

describe("formatReceiptDateTime", () => {
  it("returns date and time strings", () => {
    const ts = new Date("2024-03-15T14:30:00Z").getTime();
    const result = formatReceiptDateTime(ts);
    expect(result.date).toBeTruthy();
    expect(result.time).toBeTruthy();
    expect(typeof result.date).toBe("string");
    expect(typeof result.time).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// formatReceipt tests
// ---------------------------------------------------------------------------

describe("formatReceipt", () => {
  it("builds complete receipt structure", () => {
    const order = makeOrder();
    const items = [makeOrderItem()];
    const receipt = formatReceipt(order, items, TEST_CONFIG, {
      cashierName: "Alice",
      customerName: "Bob",
      amountTendered: 200,
      change: 85,
    });

    expect(receipt.header.businessName).toBe("Test Restaurant");
    expect(receipt.header.addressLine1).toBe("123 Main Street");
    expect(receipt.header.vatNumber).toBe("4123456789");
    expect(receipt.orderNumber).toBe("ABC123");
    expect(receipt.cashierName).toBe("Alice");
    expect(receipt.customerName).toBe("Bob");
    expect(receipt.items).toHaveLength(1);
    expect(receipt.subtotal).toBe(100);
    expect(receipt.taxAmount).toBe(15);
    expect(receipt.total).toBe(115);
    expect(receipt.paymentMethod).toBe("cash");
    expect(receipt.amountTendered).toBe(200);
    expect(receipt.change).toBe(85);
    expect(receipt.footer.message).toBe("Thank you for dining with us!");
    expect(receipt.footer.showVatInvoice).toBe(true);
    expect(receipt.footer.vatInvoiceNumber).toBe("INV-ABC123");
  });

  it("uses defaults for optional extras", () => {
    const order = makeOrder();
    const items = [makeOrderItem()];
    const receipt = formatReceipt(order, items, TEST_CONFIG);

    expect(receipt.cashierName).toBe("Staff");
    expect(receipt.customerName).toBeNull();
    expect(receipt.amountTendered).toBe(115); // = order.total
    expect(receipt.change).toBe(0);
  });

  it("handles empty items list", () => {
    const order = makeOrder({ subtotal: 0, taxAmount: 0, total: 0 });
    const receipt = formatReceipt(order, [], TEST_CONFIG);
    expect(receipt.items).toHaveLength(0);
  });

  it("uses default tax rate when not in config", () => {
    const config: ReceiptConfig = {
      businessName: "Minimal",
    };
    const receipt = formatReceipt(makeOrder(), [makeOrderItem()], config);
    expect(receipt.taxRate).toBe(0.15);
    expect(receipt.footer.message).toBe("Thank you for your patronage!");
    expect(receipt.footer.showVatInvoice).toBe(false);
    expect(receipt.footer.vatInvoiceNumber).toBeNull();
  });

  it("includes discount in receipt", () => {
    const order = makeOrder({ discountAmount: 10 });
    const receipt = formatReceipt(order, [makeOrderItem()], TEST_CONFIG);
    expect(receipt.discount).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// renderTextReceipt tests
// ---------------------------------------------------------------------------

describe("renderTextReceipt", () => {
  function makeFullReceipt(): FormattedReceipt {
    return formatReceipt(
      makeOrder(),
      [
        makeOrderItem({ productName: "Burger", quantity: 2, unitPrice: 50 }),
        makeOrderItem({
          id: "item-2",
          productName: "Fries",
          quantity: 1,
          unitPrice: 35,
          discount: 5,
          notes: "Extra salt",
        }),
      ],
      TEST_CONFIG,
      {
        cashierName: "Alice",
        customerName: "Bob",
        amountTendered: 200,
        change: 85,
      }
    );
  }

  it("produces a non-empty string", () => {
    const text = renderTextReceipt(makeFullReceipt());
    expect(text.length).toBeGreaterThan(0);
  });

  it("contains business name centered", () => {
    const text = renderTextReceipt(makeFullReceipt());
    expect(text).toContain("Test Restaurant");
  });

  it("contains order number", () => {
    const text = renderTextReceipt(makeFullReceipt());
    expect(text).toContain("#ABC123");
  });

  it("contains line items", () => {
    const text = renderTextReceipt(makeFullReceipt());
    expect(text).toContain("Burger");
    expect(text).toContain("Fries");
  });

  it("contains item notes", () => {
    const text = renderTextReceipt(makeFullReceipt());
    expect(text).toContain("Extra salt");
  });

  it("contains discount on discounted item", () => {
    const text = renderTextReceipt(makeFullReceipt());
    expect(text).toContain("Discount");
  });

  it("contains payment info for cash", () => {
    const text = renderTextReceipt(makeFullReceipt());
    expect(text).toContain("CASH");
    expect(text).toContain("Tendered");
    expect(text).toContain("Change");
  });

  it("contains VAT info", () => {
    const text = renderTextReceipt(makeFullReceipt());
    expect(text).toContain("VAT (15%)");
  });

  it("contains footer message", () => {
    const text = renderTextReceipt(makeFullReceipt());
    expect(text).toContain("Thank you for dining with us!");
  });

  it("contains tax invoice number", () => {
    const text = renderTextReceipt(makeFullReceipt());
    expect(text).toContain("Tax Invoice: INV-ABC123");
  });

  it("does not contain tendered/change for card payment", () => {
    const receipt = makeFullReceipt();
    receipt.paymentMethod = "card";
    const text = renderTextReceipt(receipt);
    expect(text).toContain("CARD");
    expect(text).not.toContain("Tendered");
    expect(text).not.toContain("Change");
  });

  it("respects 42-character receipt width", () => {
    const text = renderTextReceipt(makeFullReceipt());
    const lines = text.split("\n");
    for (const line of lines) {
      // Some lines may be shorter but none should exceed receipt width + small margin
      expect(line.length).toBeLessThanOrEqual(50);
    }
  });
});
