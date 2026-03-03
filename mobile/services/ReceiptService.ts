/**
 * BizPilot Mobile POS — ReceiptService
 *
 * Pure functions for formatting receipt data. This service transforms
 * an order into a structured receipt object that can be:
 * 1. Displayed in the Receipt component (digital receipt)
 * 2. Sent to a thermal printer (ESC/POS compatible)
 * 3. Exported as a text-based receipt for email/SMS
 *
 * Why pure functions instead of a class?
 * Receipts are read-only transformations — there's no state to manage.
 * Pure functions are trivially testable, composable, and tree-shakeable.
 *
 * Why not just format in the Receipt component?
 * Formatting logic is reused across digital display, thermal print,
 * and email. Extracting it here avoids duplication and allows the
 * thermal printer module to use the same formatting without importing React.
 */

import { formatCurrency, generateOrderNumber } from "@/utils/formatters";
import {
  roundTo2,
  calculateLineTotal,
  calculateCartTotals,
} from "@/utils/priceCalculator";
import { DEFAULT_VAT_RATE, CURRENCY_CODE } from "@/utils/constants";
import type { MobileOrder, MobileOrderItem } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single line item on the receipt */
export interface ReceiptLineItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  notes: string | null;
}

/** The receipt header containing business/location info */
export interface ReceiptHeader {
  businessName: string;
  addressLine1: string | null;
  addressLine2: string | null;
  phone: string | null;
  vatNumber: string | null;
}

/** The receipt footer with legal/custom messages */
export interface ReceiptFooter {
  message: string;
  /** True if the VAT invoice number should be printed */
  showVatInvoice: boolean;
  vatInvoiceNumber: string | null;
}

/** Complete formatted receipt data */
export interface FormattedReceipt {
  header: ReceiptHeader;
  orderNumber: string;
  orderDate: string;
  orderTime: string;
  cashierName: string;
  customerName: string | null;
  items: ReceiptLineItem[];
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  discount: number;
  total: number;
  paymentMethod: string;
  amountTendered: number;
  change: number;
  footer: ReceiptFooter;
  /** Room charge details (only present for room_charge payment method) */
  roomCharge?: {
    guestName: string;
    roomNumber: string;
    folioNumber: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Formatting configuration
// ---------------------------------------------------------------------------

export interface ReceiptConfig {
  businessName: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  footerMessage?: string;
  showVatInvoice?: boolean;
  vatInvoicePrefix?: string;
  taxRate?: number;
}

const DEFAULT_FOOTER_MESSAGE = "Thank you for your patronage!";

// ---------------------------------------------------------------------------
// Receipt formatting functions
// ---------------------------------------------------------------------------

/**
 * Formats a single order item into a receipt line item.
 * Calculates the line total using the standard price calculator.
 */
export function formatLineItem(item: MobileOrderItem): ReceiptLineItem {
  const lineTotal = calculateLineTotal({
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    discount: item.discount,
  });

  return {
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
    lineTotal,
    notes: item.notes,
  };
}

/**
 * Formats a date into receipt-friendly date and time strings.
 * Uses South African locale for consistency with the rest of the app.
 */
export function formatReceiptDateTime(timestamp: number): {
  date: string;
  time: string;
} {
  const d = new Date(timestamp);
  return {
    date: d.toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    time: d.toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  };
}

/**
 * Builds the complete formatted receipt from an order and its items.
 *
 * This is the main entry point for receipt generation. It composes
 * header, line items, totals, and footer into a single object.
 */
export function formatReceipt(
  order: MobileOrder,
  items: MobileOrderItem[],
  config: ReceiptConfig,
  extras?: {
    cashierName?: string;
    customerName?: string | null;
    amountTendered?: number;
    change?: number;
    roomCharge?: {
      guestName: string;
      roomNumber: string;
      folioNumber: string | null;
    } | null;
  }
): FormattedReceipt {
  const { date, time } = formatReceiptDateTime(order.createdAt);
  const taxRate = config.taxRate ?? DEFAULT_VAT_RATE;

  const receiptItems = items.map(formatLineItem);

  return {
    header: {
      businessName: config.businessName,
      addressLine1: config.addressLine1 ?? null,
      addressLine2: config.addressLine2 ?? null,
      phone: config.phone ?? null,
      vatNumber: config.vatNumber ?? null,
    },
    orderNumber: order.orderNumber,
    orderDate: date,
    orderTime: time,
    cashierName: extras?.cashierName ?? "Staff",
    customerName: extras?.customerName ?? null,
    items: receiptItems,
    subtotal: order.subtotal,
    taxAmount: order.taxAmount,
    taxRate,
    discount: order.discountAmount,
    total: order.total,
    paymentMethod: order.paymentMethod ?? "Cash",
    amountTendered: extras?.amountTendered ?? order.total,
    change: extras?.change ?? 0,
    footer: {
      message: config.footerMessage ?? DEFAULT_FOOTER_MESSAGE,
      showVatInvoice: config.showVatInvoice ?? false,
      vatInvoiceNumber: config.showVatInvoice
        ? `${config.vatInvoicePrefix ?? "INV"}-${order.orderNumber}`
        : null,
    },
    roomCharge: extras?.roomCharge ?? null,
  };
}

// ---------------------------------------------------------------------------
// Text receipt rendering (for thermal printers & email)
// ---------------------------------------------------------------------------

/** Character width for receipt paper (standard 80mm = 42 chars) */
const RECEIPT_WIDTH = 42;

/** Pads a string to fill the receipt width with dots or spaces */
function padLine(left: string, right: string, fill = " "): string {
  const gap = RECEIPT_WIDTH - left.length - right.length;
  if (gap <= 0) return left + " " + right;
  return left + fill.repeat(gap) + right;
}

/** Centers text on the receipt */
function centerText(text: string): string {
  const padding = Math.max(0, Math.floor((RECEIPT_WIDTH - text.length) / 2));
  return " ".repeat(padding) + text;
}

/** Horizontal rule */
function hrLine(char = "-"): string {
  return char.repeat(RECEIPT_WIDTH);
}

/**
 * Renders a FormattedReceipt as a plain-text string for thermal printers.
 *
 * Uses fixed-width formatting suitable for ESC/POS compatible printers
 * and plain-text email receipts.
 */
export function renderTextReceipt(receipt: FormattedReceipt): string {
  const lines: string[] = [];

  // Header
  lines.push(centerText(receipt.header.businessName));
  if (receipt.header.addressLine1) {
    lines.push(centerText(receipt.header.addressLine1));
  }
  if (receipt.header.addressLine2) {
    lines.push(centerText(receipt.header.addressLine2));
  }
  if (receipt.header.phone) {
    lines.push(centerText(`Tel: ${receipt.header.phone}`));
  }
  if (receipt.header.vatNumber) {
    lines.push(centerText(`VAT: ${receipt.header.vatNumber}`));
  }

  lines.push(hrLine("="));

  // Order info
  lines.push(padLine("Order:", `#${receipt.orderNumber}`));
  lines.push(padLine("Date:", receipt.orderDate));
  lines.push(padLine("Time:", receipt.orderTime));
  lines.push(padLine("Cashier:", receipt.cashierName));
  if (receipt.customerName) {
    lines.push(padLine("Customer:", receipt.customerName));
  }

  lines.push(hrLine());

  // Line items
  for (const item of receipt.items) {
    const qty = `${item.quantity}x`;
    const price = formatCurrency(item.lineTotal);
    lines.push(padLine(`${qty} ${item.productName}`, price));

    if (item.discount > 0) {
      lines.push(padLine("  Discount:", `-${formatCurrency(item.discount)}`));
    }
    if (item.notes) {
      lines.push(`  Note: ${item.notes}`);
    }
  }

  lines.push(hrLine());

  // Totals
  lines.push(padLine("Subtotal:", formatCurrency(receipt.subtotal)));
  lines.push(
    padLine(
      `VAT (${(receipt.taxRate * 100).toFixed(0)}%):`,
      formatCurrency(receipt.taxAmount)
    )
  );
  if (receipt.discount > 0) {
    lines.push(padLine("Discount:", `-${formatCurrency(receipt.discount)}`));
  }

  lines.push(hrLine("="));
  lines.push(padLine("TOTAL:", formatCurrency(receipt.total)));
  lines.push(hrLine("="));

  // Payment
  lines.push(padLine("Paid:", receipt.paymentMethod.toUpperCase()));
  if (receipt.paymentMethod.toLowerCase() === "cash") {
    lines.push(padLine("Tendered:", formatCurrency(receipt.amountTendered)));
    lines.push(padLine("Change:", formatCurrency(receipt.change)));
  }

  // Room charge details (for hotel POS)
  if (receipt.roomCharge) {
    lines.push(hrLine());
    lines.push(centerText("--- ROOM CHARGE ---"));
    lines.push(padLine("Guest:", receipt.roomCharge.guestName));
    lines.push(padLine("Room:", receipt.roomCharge.roomNumber));
    if (receipt.roomCharge.folioNumber) {
      lines.push(padLine("Folio:", receipt.roomCharge.folioNumber));
    }
    lines.push("");
    lines.push(centerText("Guest Signature:"));
    lines.push("");
    lines.push(centerText("_______________________"));
    lines.push("");
  }

  lines.push(hrLine());

  // Footer
  if (receipt.footer.showVatInvoice && receipt.footer.vatInvoiceNumber) {
    lines.push(centerText(`Tax Invoice: ${receipt.footer.vatInvoiceNumber}`));
  }
  lines.push("");
  lines.push(centerText(receipt.footer.message));
  lines.push("");

  return lines.join("\n");
}
