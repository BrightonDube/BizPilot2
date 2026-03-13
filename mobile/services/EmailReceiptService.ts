/**
 * BizPilot Mobile POS — EmailReceiptService
 *
 * Handles formatting and sending receipts via email.
 * Uses the existing ReceiptService for formatting and delegates
 * actual email sending to the backend API (via sync queue when offline).
 *
 * Why not send email directly from the mobile device?
 * 1. SMTP credentials shouldn't be on the device (security)
 * 2. Transactional email services (SendGrid, Postmark) need server-side API keys
 * 3. Offline-first: queue the email request and sync later
 * 4. The backend already has email templates and branding
 *
 * Flow:
 * 1. Staff taps "Email Receipt" → this service formats the request
 * 2. Request is queued in the sync queue
 * 3. On next sync, the backend processes the email send
 * 4. If online, an immediate API call is attempted first
 */

import type { MobileOrder, MobileOrderItem, SyncQueueEntry, SyncAction } from "@/types";
import type { ReceiptConfig, FormattedReceipt } from "./ReceiptService";
import { formatReceipt, renderTextReceipt } from "./ReceiptService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Email receipt request payload */
export interface EmailReceiptRequest {
  /** Recipient email address */
  to: string;
  /** Order ID for reference */
  orderId: string;
  /** Order number for the subject line */
  orderNumber: string;
  /** The formatted text receipt (plain text fallback) */
  textReceipt: string;
  /** Structured receipt data for HTML email template on the server */
  receiptData: FormattedReceipt;
  /** Timestamp of the request */
  requestedAt: number;
}

/** Result of an email receipt attempt */
export interface EmailReceiptResult {
  /** Whether the email was sent immediately (online) or queued (offline) */
  status: "sent" | "queued" | "failed";
  /** Error message if failed */
  error?: string;
  /** Sync queue entry ID if queued */
  queueEntryId?: string;
}

// ---------------------------------------------------------------------------
// Email validation
// ---------------------------------------------------------------------------

/**
 * Validate an email address format.
 * Uses a practical regex — not RFC 5322 complete, but catches
 * common mistakes in a POS context (typos, missing @, etc.).
 */
export function validateEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 254) return false;

  // Practical email regex for POS use
  const emailRegex = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/;
  return emailRegex.test(trimmed);
}

// ---------------------------------------------------------------------------
// Receipt email creation
// ---------------------------------------------------------------------------

/**
 * Create an email receipt request from an order.
 * This generates both the plain-text receipt and the structured data
 * the server needs to render the HTML email template.
 */
export function createEmailReceiptRequest(
  order: MobileOrder,
  items: MobileOrderItem[],
  recipientEmail: string,
  config: ReceiptConfig,
  extras?: {
    cashierName?: string;
    customerName?: string | null;
    amountTendered?: number;
    change?: number;
  }
): EmailReceiptRequest {
  const receipt = formatReceipt(order, items, config, extras);
  const textReceipt = renderTextReceipt(receipt);

  return {
    to: recipientEmail.trim().toLowerCase(),
    orderId: order.id,
    orderNumber: order.orderNumber,
    textReceipt,
    receiptData: receipt,
    requestedAt: Date.now(),
  };
}

/**
 * Create a sync queue entry for an email receipt request.
 * This is used when the device is offline or as a reliable delivery
 * mechanism (queue first, attempt immediate send, mark processed if successful).
 */
export function createEmailSyncEntry(
  request: EmailReceiptRequest
): SyncQueueEntry {
  const id = `email_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    entityType: "email_receipt",
    entityId: request.orderId,
    action: "create" as SyncAction,
    payload: JSON.stringify(request),
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
    processedAt: null,
  };
}

/**
 * Attempt to send an email receipt immediately via the API.
 * Falls back to queuing if the API call fails.
 *
 * Why try immediate + queue fallback?
 * Best UX: staff sees "Email sent!" immediately when online.
 * Reliable: if offline or API fails, it's queued for later.
 */
export async function sendEmailReceipt(
  request: EmailReceiptRequest,
  apiClient: {
    post: (url: string, data: unknown) => Promise<{ status: number }>;
  },
  isOnline: boolean
): Promise<EmailReceiptResult> {
  // If offline, queue immediately
  if (!isOnline) {
    const entry = createEmailSyncEntry(request);
    return {
      status: "queued",
      queueEntryId: entry.id,
    };
  }

  // Try immediate send
  try {
    const response = await apiClient.post("/api/receipts/email", {
      to: request.to,
      orderId: request.orderId,
      orderNumber: request.orderNumber,
      textReceipt: request.textReceipt,
    });

    if (response.status >= 200 && response.status < 300) {
      return { status: "sent" };
    }

    // API returned error — queue for retry
    const entry = createEmailSyncEntry(request);
    return {
      status: "queued",
      queueEntryId: entry.id,
      error: `API returned status ${response.status}`,
    };
  } catch (error) {
    // Network or other error — queue for retry
    const entry = createEmailSyncEntry(request);
    return {
      status: "queued",
      queueEntryId: entry.id,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
