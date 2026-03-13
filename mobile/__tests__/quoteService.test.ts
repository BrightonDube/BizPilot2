/**
 * Unit tests for QuoteService pure functions.
 */

import {
  calculateLineItem,
  calculateQuoteTotals,
  validateQuote,
  generateQuoteNumber,
  isQuoteExpired,
  canConvertToSale,
  getDaysUntilExpiry,
  filterQuotesByStatus,
  searchQuotes,
  sortQuotesByDate,
  duplicateQuote,
  calculateExpiryWarning,
  type Quote,
  type QuoteLineItem,
} from "@/services/quotes/QuoteService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<QuoteLineItem> = {}): QuoteLineItem {
  return {
    id: "item-1",
    productId: "prod-1",
    productName: "Widget",
    quantity: 2,
    unitPrice: 100,
    discount: 10,
    taxRate: 15,
    lineTotal: 180,
    lineTax: 27,
    ...overrides,
  };
}

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "q-1",
    quoteNumber: "QT-20250101-0001",
    customerId: "cust-1",
    customerName: "Acme Corp",
    customerEmail: "acme@example.com",
    items: [makeItem()],
    subtotal: 200,
    totalDiscount: 20,
    totalTax: 27,
    grandTotal: 207,
    status: "draft",
    validUntil: "2025-12-31T00:00:00.000Z",
    notes: "",
    termsAndConditions: "",
    createdBy: "user-1",
    createdAt: "2025-01-15T10:00:00.000Z",
    updatedAt: "2025-01-15T10:00:00.000Z",
    sentAt: null,
    approvedAt: null,
    convertedAt: null,
    revisionNumber: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Line item calculation
// ---------------------------------------------------------------------------

describe("calculateLineItem", () => {
  it("calculates lineTotal and lineTax with discount and tax", () => {
    // 2 × R100 = R200 gross, 10% discount = R180 net, 15% tax = R27
    const item = calculateLineItem("Widget", 2, 100, 10, 15);

    expect(item.lineTotal).toBe(180);
    expect(item.lineTax).toBe(27);
    expect(item.productName).toBe("Widget");
  });

  it("handles zero discount and zero tax", () => {
    const item = calculateLineItem("Plain", 3, 50, 0, 0);

    expect(item.lineTotal).toBe(150);
    expect(item.lineTax).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Quote totals
// ---------------------------------------------------------------------------

describe("calculateQuoteTotals", () => {
  it("aggregates multiple line items correctly", () => {
    const items: QuoteLineItem[] = [
      calculateLineItem("A", 1, 200, 0, 15),   // gross 200, disc 0, tax 30
      calculateLineItem("B", 2, 100, 10, 15),   // gross 200, disc 20, tax 27
    ];

    const totals = calculateQuoteTotals(items);

    expect(totals.subtotal).toBe(400);
    expect(totals.totalDiscount).toBe(20);
    expect(totals.totalTax).toBe(57);
    expect(totals.grandTotal).toBe(437); // 400 - 20 + 57
  });
});

// ---------------------------------------------------------------------------
// 3. Quote validation
// ---------------------------------------------------------------------------

describe("validateQuote", () => {
  it("returns valid for a complete quote", () => {
    const result = validateQuote(makeQuote());

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns errors for missing customer and empty items", () => {
    const result = validateQuote({
      customerId: "",
      customerName: "",
      items: [],
      validUntil: "",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Customer is required");
    expect(result.errors).toContain("Customer name is required");
    expect(result.errors).toContain("At least one line item is required");
    expect(result.errors).toContain("Validity date is required");
  });

  it("flags invalid item quantity and discount", () => {
    const result = validateQuote({
      customerId: "c-1",
      customerName: "Test",
      items: [makeItem({ quantity: 0, discount: 150 })],
      validUntil: "2025-12-31",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("quantity must be greater than 0"),
        expect.stringContaining("discount must be between 0 and 100"),
      ])
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Quote number generation
// ---------------------------------------------------------------------------

describe("generateQuoteNumber", () => {
  it("formats as QT-YYYYMMDD-XXXX", () => {
    const num = generateQuoteNumber(0, "2025-03-07T00:00:00Z");

    expect(num).toBe("QT-20250307-0001");
  });

  it("zero-pads the sequential index", () => {
    const num = generateQuoteNumber(99, "2025-01-01T00:00:00Z");

    expect(num).toBe("QT-20250101-0100");
  });
});

// ---------------------------------------------------------------------------
// 5. Expiry checking
// ---------------------------------------------------------------------------

describe("isQuoteExpired", () => {
  it("returns false when validUntil is in the future", () => {
    const quote = makeQuote({ validUntil: "2099-01-01T00:00:00Z" });
    expect(isQuoteExpired(quote, new Date("2025-06-01"))).toBe(false);
  });

  it("returns true when validUntil has passed", () => {
    const quote = makeQuote({ validUntil: "2024-01-01T00:00:00Z" });
    expect(isQuoteExpired(quote, new Date("2025-06-01"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. canConvertToSale
// ---------------------------------------------------------------------------

describe("canConvertToSale", () => {
  it("allows conversion for approved quotes", () => {
    const result = canConvertToSale(makeQuote({ status: "approved" }));
    expect(result.canConvert).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("rejects conversion for draft quotes with a reason", () => {
    const result = canConvertToSale(makeQuote({ status: "draft" }));
    expect(result.canConvert).toBe(false);
    expect(result.reason).toBe("Quote must be approved before conversion");
  });
});

// ---------------------------------------------------------------------------
// 7. Days until expiry
// ---------------------------------------------------------------------------

describe("getDaysUntilExpiry", () => {
  it("returns positive days when not yet expired", () => {
    const quote = makeQuote({ validUntil: "2025-01-20T00:00:00Z" });
    const days = getDaysUntilExpiry(quote, new Date("2025-01-15T00:00:00Z"));
    expect(days).toBe(5);
  });

  it("returns negative days when past expiry", () => {
    const quote = makeQuote({ validUntil: "2025-01-10T00:00:00Z" });
    const days = getDaysUntilExpiry(quote, new Date("2025-01-15T00:00:00Z"));
    expect(days).toBe(-5);
  });
});

// ---------------------------------------------------------------------------
// 8. Filter, search, sort
// ---------------------------------------------------------------------------

describe("filterQuotesByStatus", () => {
  it("returns only quotes matching the given statuses", () => {
    const quotes = [
      makeQuote({ id: "a", status: "draft" }),
      makeQuote({ id: "b", status: "approved" }),
      makeQuote({ id: "c", status: "sent" }),
    ];

    const filtered = filterQuotesByStatus(quotes, ["draft", "sent"]);
    expect(filtered.map((q) => q.id)).toEqual(["a", "c"]);
  });
});

describe("searchQuotes", () => {
  it("matches by customer name (case-insensitive)", () => {
    const quotes = [
      makeQuote({ id: "a", customerName: "Acme Corp" }),
      makeQuote({ id: "b", customerName: "Beta Ltd" }),
    ];

    expect(searchQuotes(quotes, "acme").map((q) => q.id)).toEqual(["a"]);
  });
});

describe("sortQuotesByDate", () => {
  it("sorts ascending by createdAt", () => {
    const quotes = [
      makeQuote({ id: "late", createdAt: "2025-06-01T00:00:00Z" }),
      makeQuote({ id: "early", createdAt: "2025-01-01T00:00:00Z" }),
    ];

    const sorted = sortQuotesByDate(quotes, "asc");
    expect(sorted.map((q) => q.id)).toEqual(["early", "late"]);
  });
});

// ---------------------------------------------------------------------------
// 9. Duplicate quote
// ---------------------------------------------------------------------------

describe("duplicateQuote", () => {
  it("deep copies, resets status, and bumps revision", () => {
    const original = makeQuote({
      status: "approved",
      revisionNumber: 2,
      sentAt: "2025-01-10T00:00:00Z",
    });
    const now = new Date("2025-02-01T12:00:00Z");
    const dup = duplicateQuote(original, "QT-20250201-0005", now);

    expect(dup.status).toBe("draft");
    expect(dup.quoteNumber).toBe("QT-20250201-0005");
    expect(dup.revisionNumber).toBe(3);
    expect(dup.sentAt).toBeNull();
    expect(dup.approvedAt).toBeNull();
    expect(dup.convertedAt).toBeNull();
    expect(dup.id).toBe("");
    // Ensure deep copy — item ids reset
    expect(dup.items[0].id).toBe("");
    expect(dup.items).not.toBe(original.items);
  });
});

// ---------------------------------------------------------------------------
// 10. Expiry warning levels
// ---------------------------------------------------------------------------

describe("calculateExpiryWarning", () => {
  const quote = makeQuote({ validUntil: "2025-01-20T00:00:00Z" });

  it('returns "safe" when 7+ days remain', () => {
    expect(calculateExpiryWarning(quote, new Date("2025-01-10T00:00:00Z"))).toBe("safe");
  });

  it('returns "warning" when < 7 days remain', () => {
    expect(calculateExpiryWarning(quote, new Date("2025-01-15T00:00:00Z"))).toBe("warning");
  });

  it('returns "critical" when < 3 days remain', () => {
    expect(calculateExpiryWarning(quote, new Date("2025-01-18T00:00:00Z"))).toBe("critical");
  });

  it('returns "expired" when past validUntil', () => {
    expect(calculateExpiryWarning(quote, new Date("2025-01-21T00:00:00Z"))).toBe("expired");
  });
});
