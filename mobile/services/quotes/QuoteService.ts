/**
 * QuoteService — pure functions for proforma invoice / quote management.
 *
 * Handles:
 *   - Line item and totals calculations
 *   - Quote validation and status checks
 *   - Expiry tracking and warnings
 *   - Search, filter, sort, and duplication
 *
 * Why pure functions?
 * Quote totals and tax calculations must be deterministic and auditable.
 * Pure functions ensure the same inputs always produce the same outputs,
 * critical for financial accuracy in POS systems.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "approved"
  | "rejected"
  | "converted"
  | "expired"
  | "cancelled";

export interface QuoteLineItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  /** Percentage discount 0-100 applied to this line. */
  discount: number;
  /** Tax rate as a percentage (e.g. 15 for 15% VAT). */
  taxRate: number;
  /** Net total after discount, before tax. */
  lineTotal: number;
  /** Tax amount for this line. */
  lineTax: number;
}

export interface Quote {
  id: string;
  /** Format: QT-YYYYMMDD-XXXX */
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  items: QuoteLineItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  status: QuoteStatus;
  /** ISO date string for the expiration date. */
  validUntil: string;
  notes: string;
  termsAndConditions: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  approvedAt: string | null;
  convertedAt: string | null;
  revisionNumber: number;
}

export interface QuoteCalculation {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
}

export interface QuoteValidationResult {
  isValid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Converted",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: "#6b7280",
  sent: "#3b82f6",
  viewed: "#8b5cf6",
  approved: "#22c55e",
  rejected: "#ef4444",
  converted: "#06b6d4",
  expired: "#f59e0b",
  cancelled: "#9ca3af",
};

/** Expiry warning thresholds in days. */
const EXPIRY_WARNING_DAYS = 7;
const EXPIRY_CRITICAL_DAYS = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to 2 decimal places to avoid floating-point drift. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Milliseconds in one day. */
const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// 1. Calculate a single line item
// ---------------------------------------------------------------------------

/**
 * Build a QuoteLineItem from product details and per-line adjustments.
 *
 * Calculation:
 *   discountedPrice = unitPrice × quantity × (1 - discount / 100)
 *   lineTax         = discountedPrice × taxRate / 100
 *   lineTotal       = discountedPrice (tax-exclusive subtotal)
 */
export function calculateLineItem(
  productName: string,
  quantity: number,
  unitPrice: number,
  discount: number,
  taxRate: number
): QuoteLineItem {
  const grossTotal = round2(unitPrice * quantity);
  const discountAmount = round2(grossTotal * (discount / 100));
  const lineTotal = round2(grossTotal - discountAmount);
  const lineTax = round2(lineTotal * (taxRate / 100));

  return {
    id: "",
    productId: "",
    productName,
    quantity,
    unitPrice,
    discount,
    taxRate,
    lineTotal,
    lineTax,
  };
}

// ---------------------------------------------------------------------------
// 2. Calculate quote totals from line items
// ---------------------------------------------------------------------------

/**
 * Aggregate all line items into quote-level totals.
 *
 * subtotal      = sum of (unitPrice × quantity) before discounts
 * totalDiscount = sum of per-line discount amounts
 * totalTax      = sum of per-line tax
 * grandTotal    = subtotal - totalDiscount + totalTax
 */
export function calculateQuoteTotals(items: QuoteLineItem[]): QuoteCalculation {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  for (const item of items) {
    const gross = round2(item.unitPrice * item.quantity);
    const discountAmt = round2(gross * (item.discount / 100));
    subtotal += gross;
    totalDiscount += discountAmt;
    totalTax += item.lineTax;
  }

  subtotal = round2(subtotal);
  totalDiscount = round2(totalDiscount);
  totalTax = round2(totalTax);

  return {
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal: round2(subtotal - totalDiscount + totalTax),
  };
}

// ---------------------------------------------------------------------------
// 3. Validate a quote
// ---------------------------------------------------------------------------

/**
 * Validate required fields and business rules on a quote.
 * Returns a result with `isValid` and an array of human-readable errors.
 */
export function validateQuote(
  quote: Partial<Quote>
): QuoteValidationResult {
  const errors: string[] = [];

  if (!quote.customerId?.trim()) {
    errors.push("Customer is required");
  }

  if (!quote.customerName?.trim()) {
    errors.push("Customer name is required");
  }

  if (!quote.items || quote.items.length === 0) {
    errors.push("At least one line item is required");
  } else {
    for (let i = 0; i < quote.items.length; i++) {
      const item = quote.items[i];
      if (item.quantity <= 0) {
        errors.push(`Item ${i + 1}: quantity must be greater than 0`);
      }
      if (item.unitPrice < 0) {
        errors.push(`Item ${i + 1}: unit price cannot be negative`);
      }
      if (item.discount < 0 || item.discount > 100) {
        errors.push(`Item ${i + 1}: discount must be between 0 and 100`);
      }
    }
  }

  if (!quote.validUntil) {
    errors.push("Validity date is required");
  }

  if (quote.grandTotal !== undefined && quote.grandTotal < 0) {
    errors.push("Grand total cannot be negative");
  }

  return { isValid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// 4. Generate quote number
// ---------------------------------------------------------------------------

/**
 * Generate a sequential quote number in the format QT-YYYYMMDD-XXXX.
 *
 * @param index - Sequential counter (0-based), zero-padded to 4 digits.
 * @param date  - ISO date string used for the YYYYMMDD segment.
 */
export function generateQuoteNumber(index: number, date: string): string {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const seq = String(index + 1).padStart(4, "0");

  return `QT-${yyyy}${mm}${dd}-${seq}`;
}

// ---------------------------------------------------------------------------
// 5. Check if quote is expired
// ---------------------------------------------------------------------------

/**
 * Returns true when the quote's `validUntil` date has passed.
 */
export function isQuoteExpired(quote: Quote, now: Date): boolean {
  return now.getTime() > new Date(quote.validUntil).getTime();
}

// ---------------------------------------------------------------------------
// 6. Check if quote can be converted to a sale
// ---------------------------------------------------------------------------

/**
 * A quote can only be converted to a sale when its status is "approved".
 */
export function canConvertToSale(
  quote: Quote
): { canConvert: boolean; reason: string | null } {
  if (quote.status === "approved") {
    return { canConvert: true, reason: null };
  }

  const reasons: Record<string, string> = {
    draft: "Quote must be approved before conversion",
    sent: "Quote must be approved before conversion",
    viewed: "Quote must be approved before conversion",
    rejected: "Cannot convert a rejected quote",
    converted: "Quote has already been converted",
    expired: "Cannot convert an expired quote",
    cancelled: "Cannot convert a cancelled quote",
  };

  return {
    canConvert: false,
    reason: reasons[quote.status] ?? "Quote cannot be converted in its current state",
  };
}

// ---------------------------------------------------------------------------
// 7. Days until expiry
// ---------------------------------------------------------------------------

/**
 * Returns the number of full days remaining until the quote expires.
 * Negative values mean the quote is already past its expiry date.
 */
export function getDaysUntilExpiry(quote: Quote, now: Date): number {
  const expiryMs = new Date(quote.validUntil).getTime();
  return Math.ceil((expiryMs - now.getTime()) / MS_PER_DAY);
}

// ---------------------------------------------------------------------------
// 8. Filter quotes by status
// ---------------------------------------------------------------------------

/**
 * Return only quotes whose status appears in the given list.
 */
export function filterQuotesByStatus(
  quotes: Quote[],
  statuses: QuoteStatus[]
): Quote[] {
  const statusSet = new Set(statuses);
  return quotes.filter((q) => statusSet.has(q.status));
}

// ---------------------------------------------------------------------------
// 9. Search quotes
// ---------------------------------------------------------------------------

/**
 * Full-text search across quote number, customer name, and product names.
 */
export function searchQuotes(quotes: Quote[], query: string): Quote[] {
  if (!query.trim()) return quotes;

  const lowerQuery = query.toLowerCase().trim();

  return quotes.filter((q) => {
    if (q.quoteNumber.toLowerCase().includes(lowerQuery)) return true;
    if (q.customerName.toLowerCase().includes(lowerQuery)) return true;
    if (q.items.some((i) => i.productName.toLowerCase().includes(lowerQuery))) {
      return true;
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// 10. Sort quotes by date
// ---------------------------------------------------------------------------

/**
 * Sort quotes by `createdAt` in ascending or descending order.
 * Returns a new array — does not mutate the input.
 */
export function sortQuotesByDate(
  quotes: Quote[],
  direction: "asc" | "desc"
): Quote[] {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...quotes].sort(
    (a, b) =>
      multiplier *
      (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  );
}

// ---------------------------------------------------------------------------
// 11. Duplicate a quote
// ---------------------------------------------------------------------------

/**
 * Deep-copy a quote with a new number, reset status to draft, and
 * clear conversion / sent timestamps. Bumps the revision number.
 */
export function duplicateQuote(
  quote: Quote,
  newNumber: string,
  now: Date
): Quote {
  const nowISO = now.toISOString();

  return {
    ...quote,
    id: "",
    quoteNumber: newNumber,
    status: "draft",
    items: quote.items.map((item) => ({ ...item, id: "" })),
    revisionNumber: quote.revisionNumber + 1,
    createdAt: nowISO,
    updatedAt: nowISO,
    sentAt: null,
    approvedAt: null,
    convertedAt: null,
  };
}

// ---------------------------------------------------------------------------
// 12. Expiry warning level
// ---------------------------------------------------------------------------

/**
 * Categorise the urgency of a quote's expiry for UI display.
 *
 * - `expired`  — past the `validUntil` date
 * - `critical` — fewer than 3 days remaining
 * - `warning`  — fewer than 7 days remaining
 * - `safe`     — 7 or more days remaining
 */
export function calculateExpiryWarning(
  quote: Quote,
  now: Date
): "safe" | "warning" | "critical" | "expired" {
  const days = getDaysUntilExpiry(quote, now);

  if (days <= 0) return "expired";
  if (days < EXPIRY_CRITICAL_DAYS) return "critical";
  if (days < EXPIRY_WARNING_DAYS) return "warning";
  return "safe";
}
