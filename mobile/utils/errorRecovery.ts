/**
 * BizPilot Mobile POS — Error Recovery Utilities
 *
 * Provides retry-with-backoff, timeout wrappers, and graceful
 * degradation helpers for POS operations that must be resilient.
 *
 * Why dedicated error recovery?
 * A POS system can't just show "Something went wrong" and give up.
 * The cashier has a queue of customers. We need smart retries,
 * fallback behaviors, and clear recovery paths.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Base delay in ms between retries (default: 1000) */
  baseDelay?: number;
  /** Maximum delay cap in ms (default: 30000) */
  maxDelay?: number;
  /** If provided, only retry when this returns true for the error */
  shouldRetry?: (error: unknown) => boolean;
  /** Called before each retry with the attempt number and error */
  onRetry?: (attempt: number, error: unknown) => void;
}

interface TimeoutOptions {
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Error message when timeout occurs */
  message?: string;
}

// ---------------------------------------------------------------------------
// Retry with exponential backoff
// ---------------------------------------------------------------------------

/**
 * Execute an async function with automatic retry and exponential backoff.
 *
 * Why exponential backoff?
 * If the server is overloaded, hammering it with retries makes things
 * worse. Doubling the delay each time gives the server breathing room
 * while still recovering quickly from transient failures.
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration
 * @returns The result of the successful execution
 * @throws The last error if all retries are exhausted
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30_000,
    shouldRetry,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // Check if we should retry this specific error
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt >= maxAttempts) {
        break;
      }

      // Notify the caller before retrying
      onRetry?.(attempt, error);

      // Exponential backoff: 1s, 2s, 4s, ... capped at maxDelay
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      // Add jitter (±25%) to prevent thundering herd
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      await sleep(delay + jitter);
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Timeout wrapper
// ---------------------------------------------------------------------------

/**
 * Wrap a promise with a timeout. If the promise doesn't resolve
 * within the given time, it rejects with a timeout error.
 *
 * @param promise - The promise to wrap
 * @param options - Timeout configuration
 * @returns The result of the original promise
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const { timeoutMs, message = "Operation timed out" } = options;

  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Network error detection
// ---------------------------------------------------------------------------

/**
 * Determine if an error is a retryable network error.
 *
 * Why categorize errors?
 * Not all errors should trigger a retry. A 400 Bad Request means
 * our data is wrong — retrying won't help. A 503 Service Unavailable
 * means the server is temporarily down — retrying will likely succeed.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network-level errors (no response received)
    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("fetch failed")
    ) {
      return true;
    }
  }

  // Axios-style errors with response status
  if (typeof error === "object" && error !== null && "response" in error) {
    const status = (error as { response?: { status?: number } }).response
      ?.status;
    if (status) {
      // 5xx errors are server-side — retryable
      // 429 Too Many Requests — retryable after backoff
      return status >= 500 || status === 429;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Graceful degradation
// ---------------------------------------------------------------------------

/**
 * Execute a function with a fallback value on failure.
 * Useful for non-critical operations that shouldn't block the POS flow.
 *
 * @param fn - The function to attempt
 * @param fallback - Value to return if the function fails
 * @param onError - Optional error handler for logging
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallback: T,
  onError?: (error: unknown) => void
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    onError?.(error);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
