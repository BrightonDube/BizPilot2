/**
 * PaymentReceiptService — generate and format payment receipts for display.
 *
 * Task: 14.3 (Create payment receipt view)
 *
 * Why a service instead of inline formatting?
 * Receipt data needs to be consistently formatted across:
 * 1. The on-screen receipt view after payment
 * 2. The printed receipt (via SlipApp)
 * 3. The emailed receipt (via backend)
 * Having a single source of truth for receipt formatting prevents
 * discrepancies between display and print.
 */

import {
  CustomerAccount,
  AccountTransaction,
  PaymentTerms,
  PAYMENT_TERMS_LABELS,
} from "./CustomerAccountService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentReceiptData {
  /** Unique receipt number */
  receiptNumber: string;
  /** ISO date of payment */
  paymentDate: string;
  /** Customer account info */
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  accountId: string;
  /** Payment details */
  paymentAmount: number;
  paymentMethod: string;
  reference?: string;
  /** Balance info */
  previousBalance: number;
  newBalance: number;
  creditLimit: number;
  availableCredit: number;
  /** Payment terms */
  paymentTerms: string;
  /** Staff who processed the payment */
  processedBy: string;
  /** Business details */
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessVatNumber?: string;
}

export interface ReceiptLineItem {
  label: string;
  value: string;
  isBold?: boolean;
  isTotal?: boolean;
}

export interface FormattedReceipt {
  header: string[];
  lineItems: ReceiptLineItem[];
  footer: string[];
  /** Pre-formatted text version for printing */
  plainText: string;
}

// ---------------------------------------------------------------------------
// Receipt generation
// ---------------------------------------------------------------------------

/**
 * Build receipt data from a payment transaction and account.
 *
 * @param account       - Customer account (after payment applied)
 * @param transaction   - The payment transaction record
 * @param paymentAmount - Amount paid
 * @param paymentMethod - Method (Cash, Card, EFT, etc.)
 * @param processedBy   - Staff name
 * @param businessName  - Business display name
 * @param businessDetails - Optional business address/phone/VAT
 */
export function buildPaymentReceiptData(
  account: CustomerAccount,
  transaction: AccountTransaction,
  paymentAmount: number,
  paymentMethod: string,
  processedBy: string,
  businessName: string,
  businessDetails?: {
    address?: string;
    phone?: string;
    vatNumber?: string;
  }
): PaymentReceiptData {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const previousBalance = round2(account.currentBalance + paymentAmount);
  const newBalance = account.currentBalance;
  const availableCredit = round2(
    Math.max(0, account.creditLimit - newBalance)
  );

  return {
    receiptNumber: generateReceiptNumber(transaction.id),
    paymentDate: transaction.createdAt,
    customerName: account.customerName,
    customerEmail: account.customerEmail,
    customerPhone: account.customerPhone,
    accountId: account.id,
    paymentAmount,
    paymentMethod,
    reference: transaction.reference,
    previousBalance,
    newBalance,
    creditLimit: account.creditLimit,
    availableCredit,
    paymentTerms: PAYMENT_TERMS_LABELS[account.paymentTerms],
    processedBy,
    businessName,
    businessAddress: businessDetails?.address,
    businessPhone: businessDetails?.phone,
    businessVatNumber: businessDetails?.vatNumber,
  };
}

/**
 * Format receipt data into line items for display.
 */
export function formatReceiptForDisplay(
  data: PaymentReceiptData
): FormattedReceipt {
  const formatCurrency = (amount: number) => `R ${amount.toFixed(2)}`;
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const header: string[] = [data.businessName];
  if (data.businessAddress) header.push(data.businessAddress);
  if (data.businessPhone) header.push(`Tel: ${data.businessPhone}`);
  if (data.businessVatNumber) header.push(`VAT: ${data.businessVatNumber}`);
  header.push("--- PAYMENT RECEIPT ---");

  const lineItems: ReceiptLineItem[] = [
    { label: "Receipt #", value: data.receiptNumber },
    { label: "Date", value: formatDate(data.paymentDate) },
    { label: "Customer", value: data.customerName, isBold: true },
    { label: "Account", value: data.accountId.substring(0, 8).toUpperCase() },
    { label: "", value: "" }, // spacer
    { label: "Payment Method", value: data.paymentMethod },
    {
      label: "Amount Paid",
      value: formatCurrency(data.paymentAmount),
      isBold: true,
      isTotal: true,
    },
  ];

  if (data.reference) {
    lineItems.push({ label: "Reference", value: data.reference });
  }

  lineItems.push(
    { label: "", value: "" }, // spacer
    { label: "Previous Balance", value: formatCurrency(data.previousBalance) },
    {
      label: "New Balance",
      value: formatCurrency(data.newBalance),
      isBold: true,
    },
    { label: "Credit Limit", value: formatCurrency(data.creditLimit) },
    { label: "Available Credit", value: formatCurrency(data.availableCredit) },
    { label: "Payment Terms", value: data.paymentTerms }
  );

  const footer: string[] = [
    `Processed by: ${data.processedBy}`,
    "Thank you for your payment!",
  ];

  // Build plain text version for printing
  const plainText = buildPlainTextReceipt(header, lineItems, footer);

  return { header, lineItems, footer, plainText };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a receipt number from a transaction ID.
 *
 * Why not use the transaction ID directly?
 * Transaction UUIDs are long and hard to read on receipts. We take
 * the first 8 characters and prefix with "RCP-" for a human-friendly
 * reference that can still be traced back to the transaction.
 */
export function generateReceiptNumber(transactionId: string): string {
  const shortId = transactionId.replace(/-/g, "").substring(0, 8).toUpperCase();
  return `RCP-${shortId}`;
}

/**
 * Build a plain-text receipt for thermal printer output.
 */
function buildPlainTextReceipt(
  header: string[],
  lineItems: ReceiptLineItem[],
  footer: string[]
): string {
  const lines: string[] = [];
  const WIDTH = 40;

  // Center header lines
  for (const h of header) {
    const pad = Math.max(0, Math.floor((WIDTH - h.length) / 2));
    lines.push(" ".repeat(pad) + h);
  }
  lines.push("=".repeat(WIDTH));

  // Line items: left-aligned label, right-aligned value
  for (const item of lineItems) {
    if (!item.label && !item.value) {
      lines.push("");
      continue;
    }
    const gap = WIDTH - item.label.length - item.value.length;
    if (gap > 0) {
      lines.push(item.label + " ".repeat(gap) + item.value);
    } else {
      lines.push(item.label);
      lines.push("  " + item.value);
    }
  }

  lines.push("=".repeat(WIDTH));

  // Center footer lines
  for (const f of footer) {
    const pad = Math.max(0, Math.floor((WIDTH - f.length) / 2));
    lines.push(" ".repeat(pad) + f);
  }

  return lines.join("\n");
}
