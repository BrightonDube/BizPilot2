/**
 * SnapScanService — SnapScan QR Code Payment Integration
 *
 * Implements QR code-based mobile payments via the SnapScan REST API.
 * Customers scan a QR code with the SnapScan app on their phone.
 *
 * Why REST API (not an SDK)?
 * SnapScan does not have an official React Native SDK.
 * Their integration is REST-based:
 * 1. Create a payment request → get back a QR code URL
 * 2. Display the QR code on the POS screen
 * 3. Poll the SnapScan API until payment is confirmed or timed out
 *
 * Why polling instead of webhooks?
 * The POS is a mobile device behind NAT — it cannot receive inbound HTTP
 * callbacks. Polling (every 2 seconds, up to 2 minutes) is the correct
 * pattern for mobile POS SnapScan integration.
 *
 * Environment variables required:
 * - SNAPSCAN_API_KEY (set in app config / secure storage)
 * - SNAPSCAN_MERCHANT_ID (registered SnapScan merchant)
 *
 * Validates: integrated-payments Requirement 3 (QR Code Payments — SnapScan)
 *            Tasks 4.1–4.6
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SnapScanPaymentStatus =
  | "pending"       // QR displayed, waiting for customer to scan
  | "scanning"      // Customer has opened SnapScan app
  | "authorising"   // Customer confirmed amount in app
  | "completed"     // Payment successful
  | "cancelled"     // Customer cancelled in app
  | "timeout"       // POS polling timeout
  | "error";        // API or network error

export interface SnapScanPaymentRequest {
  /** Amount in ZAR (decimal, e.g. 50.00) */
  amount: number;
  /** Reference stored against the SnapScan payment (shown in merchant dashboard) */
  internalReference: string;
  /** Optional note displayed to the customer in the SnapScan app */
  message?: string;
  /**
   * Polling timeout in milliseconds (default: 120_000 = 2 minutes).
   * After this time, the payment is considered timed out and the cashier
   * should offer an alternative payment method.
   */
  timeoutMs?: number;
  /**
   * How often to poll for payment status (default: 2_000 = 2 seconds).
   * SnapScan docs recommend no faster than 1 second.
   */
  pollIntervalMs?: number;
}

export interface SnapScanPaymentResponse {
  /** The unique SnapScan payment ID */
  snapScanId: string;
  /**
   * URL of the QR code image to display on screen.
   * Render this as an <Image> with the QR code; customers scan it with
   * the SnapScan app.
   */
  qrCodeUrl: string;
  /**
   * Deep link that opens the SnapScan app directly (for same-device payments).
   * Optional — not all SnapScan accounts have this configured.
   */
  deepLinkUrl?: string;
}

export interface SnapScanPaymentResult {
  success: boolean;
  status: SnapScanPaymentStatus;
  /** SnapScan transaction reference (store against order on success) */
  snapScanReference?: string;
  /** Amount that was paid (may differ if customer used SnapScan credit) */
  paidAmount?: number;
  error?: string;
}

/** Callback for UI updates during the polling wait */
export interface SnapScanPollingCallbacks {
  onQrReady?: (qrCodeUrl: string) => void;
  onStatusUpdate?: (status: SnapScanPaymentStatus) => void;
  onComplete?: (result: SnapScanPaymentResult) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 120_000;    // 2 minutes
const DEFAULT_POLL_INTERVAL_MS = 2_000; // 2 seconds
const SNAPSCAN_API_BASE = "https://pos.snapscan.io/merchant/api/v1";

// ---------------------------------------------------------------------------
// Task 4.1: createSnapScanPayment
// ---------------------------------------------------------------------------

/**
 * Create a SnapScan payment request and return the QR code to display.
 *
 * This is a single HTTP call to the SnapScan API. The response includes
 * the QR code URL and a unique payment ID for polling.
 *
 * @param request - Payment details
 * @param apiKey - SnapScan API key (from secure storage, not bundled in app)
 * @param merchantId - SnapScan merchant ID
 */
export async function createSnapScanPayment(
  request: SnapScanPaymentRequest,
  apiKey: string,
  merchantId: string
): Promise<SnapScanPaymentResponse> {
  const { amount, internalReference, message } = request;

  if (amount <= 0) {
    throw new Error("SnapScan payment amount must be greater than zero");
  }

  const body = {
    amount: Math.round(amount * 100), // API expects cents
    reference: internalReference,
    merchantId,
    message: message ?? `Payment for order ${internalReference}`,
  };

  const response = await fetch(`${SNAPSCAN_API_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${apiKey}:`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SnapScan API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  return {
    snapScanId: data.id ?? data.snapCode,
    qrCodeUrl: data.href ?? data.snapCodeUrl,
    deepLinkUrl: data.deepLinkUrl,
  };
}

// ---------------------------------------------------------------------------
// Task 4.4: pollForPaymentStatus
// ---------------------------------------------------------------------------

/**
 * Polls the SnapScan API to check if payment has been completed.
 *
 * Called by the payment flow after displaying the QR code. Polls every
 * `pollIntervalMs` until:
 * - Payment confirmed (status: "completed") → resolve with success
 * - Payment cancelled by customer → resolve with cancelled
 * - Timeout reached → resolve with timeout
 * - API error → resolve with error
 *
 * @param snapScanId - The payment ID from createSnapScanPayment
 * @param apiKey - SnapScan API key
 * @param timeoutMs - How long to wait before giving up
 * @param pollIntervalMs - How often to check
 */
export async function pollForPaymentStatus(
  snapScanId: string,
  apiKey: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  onStatusUpdate?: (status: SnapScanPaymentStatus) => void
): Promise<SnapScanPaymentResult> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    let data: Record<string, unknown>;
    try {
      const response = await fetch(
        `${SNAPSCAN_API_BASE}/payments/${snapScanId}`,
        {
          headers: {
            Authorization: `Basic ${btoa(`${apiKey}:`)}`,
          },
        }
      );

      if (!response.ok) {
        // Log and continue polling — transient network errors shouldn't abort
        console.warn(`SnapScan poll HTTP ${response.status} — retrying`);
        continue;
      }

      data = await response.json();
    } catch {
      // Network error during poll — continue (offline briefly)
      continue;
    }

    const status = normaliseSnapScanStatus(data.status as string);
    onStatusUpdate?.(status);

    if (status === "completed") {
      return {
        success: true,
        status,
        snapScanReference: data.snapScanId as string ?? snapScanId,
        paidAmount: typeof data.totalAmount === "number" ? data.totalAmount / 100 : undefined,
      };
    }

    if (status === "cancelled") {
      return {
        success: false,
        status,
        error: "Payment was cancelled by the customer.",
      };
    }

    // Other statuses (pending, scanning, authorising) — keep polling
  }

  // Deadline reached
  return {
    success: false,
    status: "timeout",
    error:
      "Payment timed out. Please ask the customer to try again or use another payment method.",
  };
}

// ---------------------------------------------------------------------------
// Task 4.5: cancelSnapScanPayment
// ---------------------------------------------------------------------------

/**
 * Cancel an in-progress SnapScan payment (e.g., cashier pressed Cancel).
 *
 * This calls the SnapScan API to void the payment request, which prevents
 * a customer from paying after the POS has moved on.
 *
 * @param snapScanId - The payment ID to cancel
 * @param apiKey - SnapScan API key
 */
export async function cancelSnapScanPayment(
  snapScanId: string,
  apiKey: string
): Promise<void> {
  try {
    await fetch(`${SNAPSCAN_API_BASE}/payments/${snapScanId}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${apiKey}:`)}`,
      },
    });
  } catch {
    // Best-effort — the payment will expire on SnapScan's servers anyway
    console.warn(`Could not cancel SnapScan payment ${snapScanId}`);
  }
}

// ---------------------------------------------------------------------------
// Task 4.1–4.5 combined: Full payment flow
// ---------------------------------------------------------------------------

/**
 * Complete SnapScan payment flow:
 * 1. Create payment request → get QR code
 * 2. Poll for completion
 * 3. Handle timeout/cancel
 *
 * This is the main entry point called from the POS checkout screen.
 */
export async function processSnapScanPayment(
  request: SnapScanPaymentRequest,
  apiKey: string,
  merchantId: string,
  callbacks: SnapScanPollingCallbacks = {}
): Promise<SnapScanPaymentResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  } = request;

  // Step 1: Create payment + get QR code
  let paymentResponse: SnapScanPaymentResponse;
  try {
    paymentResponse = await createSnapScanPayment(request, apiKey, merchantId);
  } catch (err) {
    return {
      success: false,
      status: "error",
      error: `Could not create SnapScan payment: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Notify UI: show QR code
  callbacks.onQrReady?.(paymentResponse.qrCodeUrl);
  callbacks.onStatusUpdate?.("pending");

  // Step 2: Poll for completion
  const result = await pollForPaymentStatus(
    paymentResponse.snapScanId,
    apiKey,
    timeoutMs,
    pollIntervalMs,
    callbacks.onStatusUpdate
  );

  callbacks.onComplete?.(result);
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Map SnapScan API status strings to our internal SnapScanPaymentStatus type.
 *
 * SnapScan API returns statuses like: "pending", "scanning", "authorising",
 * "completed", "cancelled" — normalise any unknown values to "pending".
 */
function normaliseSnapScanStatus(apiStatus: string): SnapScanPaymentStatus {
  const VALID_STATUSES: Set<SnapScanPaymentStatus> = new Set([
    "pending",
    "scanning",
    "authorising",
    "completed",
    "cancelled",
    "timeout",
    "error",
  ]);

  const lower = (apiStatus ?? "").toLowerCase() as SnapScanPaymentStatus;
  return VALID_STATUSES.has(lower) ? lower : "pending";
}

/**
 * Generate a SnapScan QR code URL directly from the payment parameters.
 *
 * Task 4.2: QR code generation helper.
 * SnapScan supports pre-formatted URLs that encode the merchant + amount.
 * These open the SnapScan app directly when scanned.
 *
 * Note: This generates a "static" SnapScan URL. Dynamic URLs (from
 * createSnapScanPayment) are preferred as they allow payment confirmation.
 * Use this as a fallback when the API is unavailable.
 *
 * @param merchantId - SnapScan merchant ID
 * @param amount - Amount in ZAR
 * @param reference - Order reference
 */
export function generateStaticSnapScanUrl(
  merchantId: string,
  amount: number,
  reference: string
): string {
  const amountCents = Math.round(amount * 100);
  const encoded = encodeURIComponent(reference);
  return `https://pos.snapscan.io/qr/${merchantId}?amount=${amountCents}&reference=${encoded}`;
}
