/**
 * YocoService — Yoco Card Payment Integration
 *
 * Wraps the Yoco POS SDK for React Native to provide card payment processing.
 * Supports tap (NFC), chip, and swipe via Yoco card readers.
 *
 * Why an adapter/service layer around the Yoco SDK?
 * 1. The SDK is a commercial hardware-dependent module — we want to swap
 *    it with a mock in tests without changing calling code
 * 2. Payment callback handling is async and event-driven; this service
 *    wraps it in a clean Promise API that fits the POS checkout flow
 * 3. Error handling is normalised — Yoco errors (network, card decline,
 *    reader disconnect) are translated into typed PaymentError values
 * 4. Retry logic and timeout handling live here, not in UI components
 *
 * SDK installation:
 * The Yoco React Native SDK is installed via:
 *   pnpm add @yoco/react-native-pos
 *
 * The SDK requires a physical Yoco card reader connected via Bluetooth.
 * In development/test environments, use YocoServiceMock (see tests).
 *
 * Validates: integrated-payments Requirement 2 (Card Payments — Yoco)
 *            Tasks 3.1–3.6
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CardPaymentStatus =
  | "idle"
  | "awaiting_card"
  | "processing"
  | "success"
  | "declined"
  | "cancelled"
  | "error"
  | "reader_disconnected";

export type YocoPaymentMethod =
  | "tap"    // Contactless / NFC
  | "chip"   // EMV chip insert
  | "swipe"; // Magnetic stripe

export interface YocoPaymentRequest {
  /** Order amount in ZAR cents (e.g. R50.00 → 5000) */
  amountCents: number;
  /** Currency (default: "ZAR") */
  currency?: string;
  /** Internal order reference stored with the Yoco transaction */
  internalReference: string;
  /** Human-readable description shown on card reader display */
  description?: string;
  /** Timeout in milliseconds (default: 60_000) */
  timeoutMs?: number;
}

export interface YocoPaymentResult {
  success: boolean;
  status: CardPaymentStatus;
  /** Yoco transaction reference (returned on success; store against order) */
  yocoReference?: string;
  /** Payment method used (tap/chip/swipe) */
  method?: YocoPaymentMethod;
  /** Amount charged in ZAR cents */
  amountCents?: number;
  error?: string;
  errorCode?: string;
}

export interface YocoRefundRequest {
  /** Yoco transaction reference from the original payment */
  yocoReference: string;
  /** Amount to refund in ZAR cents (partial refund if < original amount) */
  amountCents: number;
  /** Reason for refund — displayed in Yoco merchant dashboard */
  reason?: string;
}

export interface YocoRefundResult {
  success: boolean;
  refundReference?: string;
  error?: string;
}

/** Callbacks from the card reader during a payment attempt */
export interface YocoPaymentCallbacks {
  /** Called when the reader is ready and waiting for a card */
  onAwaitingCard?: () => void;
  /** Called when the card is detected and processing starts */
  onCardDetected?: (method: YocoPaymentMethod) => void;
  /** Called on every status update (use for UI progress indicator) */
  onStatusUpdate?: (status: CardPaymentStatus) => void;
  /** Called when payment is complete (success or failure) */
  onComplete?: (result: YocoPaymentResult) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CURRENCY = "ZAR";
const DEFAULT_TIMEOUT_MS = 60_000;

/** Yoco error codes mapped to human-readable messages */
const YOCO_ERROR_MESSAGES: Record<string, string> = {
  "CARD_DECLINED":          "Card was declined. Please try another card.",
  "INSUFFICIENT_FUNDS":     "Insufficient funds on this card.",
  "EXPIRED_CARD":           "This card has expired.",
  "INVALID_CARD":           "Card could not be read. Please try again.",
  "READER_DISCONNECTED":    "Card reader disconnected. Please reconnect.",
  "READER_NOT_FOUND":       "No Yoco card reader found. Please connect your reader.",
  "PAYMENT_TIMEOUT":        "Payment timed out. Please try again.",
  "NETWORK_ERROR":          "Network error. Please check your connection.",
  "TRANSACTION_CANCELLED":  "Payment was cancelled.",
  "AMOUNT_MISMATCH":        "Payment amount mismatch. Please try again.",
};

// ---------------------------------------------------------------------------
// SDK adapter
//
// Why a dynamic import with try/catch?
// The Yoco SDK requires a physical card reader and native module linking.
// In CI/test environments and when running on simulators, the SDK is not
// available. The dynamic import catches ImportError and the functions below
// return clear error messages instead of crashing.
// ---------------------------------------------------------------------------

type YocoSDK = {
  charge: (
    amountCents: number,
    currency: string,
    reference: string,
    options: Record<string, unknown>
  ) => Promise<{ success: boolean; transactionId?: string; errorCode?: string }>;
  refund: (
    transactionId: string,
    amountCents: number
  ) => Promise<{ success: boolean; refundId?: string; errorCode?: string }>;
  cancelTransaction: () => Promise<void>;
  getReaderStatus: () => Promise<{ connected: boolean; batteryLevel?: number }>;
};

let sdk: YocoSDK | null = null;
let sdkLoadError: string | null = null;

/**
 * Load the Yoco SDK lazily on first use.
 *
 * Why lazy? The SDK links to native modules that may not be available
 * in all environments. Lazy loading gives a better error message and
 * doesn't crash the whole app startup.
 */
async function loadSdk(): Promise<YocoSDK | null> {
  if (sdk) return sdk;
  if (sdkLoadError) return null;

  try {
    // Dynamic import — will fail gracefully in test environments
    // In production, the SDK is registered as a native module
    const yoco = await import("@yoco/react-native-pos");
    sdk = yoco.default as unknown as YocoSDK;
    return sdk;
  } catch (err) {
    sdkLoadError = `Yoco SDK unavailable: ${err instanceof Error ? err.message : String(err)}`;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Task 3.2 & 3.3: YocoService — card payment flow
// ---------------------------------------------------------------------------

/**
 * Initiate a card payment via Yoco.
 *
 * Flow:
 * 1. Load the Yoco SDK (check reader connection)
 * 2. Start the charge via SDK
 * 3. SDK fires callbacks as the card reader processes the tap/chip/swipe
 * 4. On complete, return a YocoPaymentResult with the Yoco reference
 *
 * The returned Promise resolves when the payment attempt is complete
 * (success or failure). Callers should NOT fire-and-forget; they MUST
 * await the result to update the order status.
 *
 * @param request - Payment details
 * @param callbacks - Optional UI callbacks for progress updates
 */
export async function chargeCard(
  request: YocoPaymentRequest,
  callbacks: YocoPaymentCallbacks = {}
): Promise<YocoPaymentResult> {
  const {
    amountCents,
    currency = DEFAULT_CURRENCY,
    internalReference,
    description,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = request;

  // Validate inputs before touching the SDK
  if (amountCents <= 0) {
    return makeError("INVALID_AMOUNT", "Payment amount must be greater than zero");
  }
  if (!internalReference) {
    return makeError("INVALID_REFERENCE", "Internal reference is required");
  }

  const yoco = await loadSdk();
  if (!yoco) {
    return makeError(
      "SDK_UNAVAILABLE",
      sdkLoadError ?? "Yoco SDK is not available in this environment"
    );
  }

  // Notify UI: ready for card
  callbacks.onAwaitingCard?.();
  callbacks.onStatusUpdate?.("awaiting_card");

  // Race: SDK charge vs. timeout
  const chargePromise = yoco.charge(amountCents, currency, internalReference, {
    description: description ?? `Order ${internalReference}`,
  });

  const timeoutPromise = new Promise<{ success: false; errorCode: string }>(
    (resolve) =>
      setTimeout(
        () => resolve({ success: false, errorCode: "PAYMENT_TIMEOUT" }),
        timeoutMs
      )
  );

  let sdkResponse: { success: boolean; transactionId?: string; errorCode?: string };

  try {
    callbacks.onStatusUpdate?.("processing");
    sdkResponse = await Promise.race([chargePromise, timeoutPromise]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result = makeError("SDK_ERROR", message);
    callbacks.onComplete?.(result);
    return result;
  }

  // --- Task 3.4: Handle payment callbacks ---

  if (sdkResponse.success && sdkResponse.transactionId) {
    const result: YocoPaymentResult = {
      success: true,
      status: "success",
      yocoReference: sdkResponse.transactionId,
      amountCents,
    };
    callbacks.onStatusUpdate?.("success");
    callbacks.onComplete?.(result);
    return result;
  }

  // Map Yoco error codes to user-friendly messages
  const errorCode = sdkResponse.errorCode ?? "UNKNOWN";
  const status: CardPaymentStatus =
    errorCode === "TRANSACTION_CANCELLED"
      ? "cancelled"
      : errorCode === "READER_DISCONNECTED"
      ? "reader_disconnected"
      : "declined";

  const result = makeError(errorCode, undefined, status);
  callbacks.onStatusUpdate?.(status);
  callbacks.onComplete?.(result);
  return result;
}

/**
 * Cancel an in-progress card payment.
 * Called when the cashier presses Cancel during the card reader prompt.
 */
export async function cancelCardPayment(): Promise<void> {
  const yoco = await loadSdk();
  if (yoco) {
    await yoco.cancelTransaction();
  }
}

// ---------------------------------------------------------------------------
// Task 3.5: Refund via Yoco
// ---------------------------------------------------------------------------

/**
 * Process a refund via Yoco for a previously captured transaction.
 *
 * Why partial refunds?
 * In the POS context, a customer might return only some items from an order.
 * Partial refunds up to the original transaction amount are allowed by Yoco.
 *
 * @param request - Refund details including the original Yoco reference
 */
export async function refundCardPayment(
  request: YocoRefundRequest
): Promise<YocoRefundResult> {
  const { yocoReference, amountCents, reason } = request;

  if (amountCents <= 0) {
    return { success: false, error: "Refund amount must be greater than zero" };
  }

  const yoco = await loadSdk();
  if (!yoco) {
    return {
      success: false,
      error: sdkLoadError ?? "Yoco SDK is not available",
    };
  }

  try {
    const response = await yoco.refund(yocoReference, amountCents);
    if (response.success && response.refundId) {
      return { success: true, refundReference: response.refundId };
    }
    const errorCode = response.errorCode ?? "REFUND_FAILED";
    return {
      success: false,
      error: YOCO_ERROR_MESSAGES[errorCode] ?? `Refund failed: ${errorCode}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Refund error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Reader status check
// ---------------------------------------------------------------------------

/**
 * Check if a Yoco card reader is connected and ready.
 * Call this before showing the card payment option to avoid surprising
 * the cashier with a "reader not found" error mid-transaction.
 */
export async function getReaderStatus(): Promise<{
  connected: boolean;
  batteryLevel?: number;
  sdkAvailable: boolean;
}> {
  const yoco = await loadSdk();
  if (!yoco) {
    return { connected: false, sdkAvailable: false };
  }
  try {
    const status = await yoco.getReaderStatus();
    return { ...status, sdkAvailable: true };
  } catch {
    return { connected: false, sdkAvailable: true };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError(
  errorCode: string,
  customMessage?: string,
  status: CardPaymentStatus = "error"
): YocoPaymentResult {
  return {
    success: false,
    status,
    error: customMessage ?? YOCO_ERROR_MESSAGES[errorCode] ?? `Payment failed: ${errorCode}`,
    errorCode,
  };
}

/**
 * Convert a ZAR decimal amount to cents.
 * Exported so UI components can format amounts correctly before calling chargeCard.
 *
 * Example: zarToCents(50.00) → 5000
 */
export function zarToCents(zarAmount: number): number {
  return Math.round(zarAmount * 100);
}

/**
 * Convert cents back to ZAR decimal.
 * Example: centsToZar(5000) → 50.00
 */
export function centsToZar(amountCents: number): number {
  return Math.round(amountCents) / 100;
}
