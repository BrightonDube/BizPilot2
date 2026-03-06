/**
 * BizPilot Mobile POS — PMS Error Handler
 *
 * Categorizes PMS errors, implements exponential backoff retry logic,
 * handles token refresh on auth failures, and collects error statistics.
 *
 * Why a dedicated error handler instead of generic try/catch?
 * PMS integrations have unique failure modes: stale tokens, rate limiting,
 * connection timeouts, and transient network errors. Each category needs
 * different retry behavior. A generic catch-all would retry unrecoverable
 * errors (e.g., invalid room number) and waste time/bandwidth.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * PMS error categories determine retry behavior.
 * - transient: Network blip, retry with backoff
 * - auth: Token expired, refresh and retry once
 * - rate_limit: Too many requests, back off longer
 * - validation: Bad input, do NOT retry
 * - server: PMS server error, retry with backoff
 * - unknown: Unexpected error, retry once then give up
 */
export type PMSErrorCategory =
  | "transient"
  | "auth"
  | "rate_limit"
  | "validation"
  | "server"
  | "unknown";

export interface PMSError {
  category: PMSErrorCategory;
  message: string;
  statusCode: number | null;
  retryable: boolean;
  originalError: unknown;
  timestamp: number;
}

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds */
  maxDelayMs: number;
  /** Jitter factor (0-1) to randomize delay */
  jitterFactor: number;
}

export interface ErrorStats {
  totalErrors: number;
  byCategory: Record<PMSErrorCategory, number>;
  lastError: PMSError | null;
  lastResetAt: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.3,
};

// ---------------------------------------------------------------------------
// Error Categorization
// ---------------------------------------------------------------------------

/**
 * Categorizes an error based on HTTP status code and error characteristics.
 *
 * Why not use error.code or error.name?
 * PMS APIs return standard HTTP status codes. Using status codes gives
 * us reliable, cross-PMS-vendor categorization without depending on
 * vendor-specific error formats.
 */
export function categorizeError(
  error: unknown,
  statusCode: number | null
): PMSError {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  const now = Date.now();

  // Network-level failures (no status code)
  if (statusCode === null || statusCode === 0) {
    return {
      category: "transient",
      message,
      statusCode,
      retryable: true,
      originalError: error,
      timestamp: now,
    };
  }

  // Auth failures
  if (statusCode === 401 || statusCode === 403) {
    return {
      category: "auth",
      message,
      statusCode,
      retryable: true, // Retry after token refresh
      originalError: error,
      timestamp: now,
    };
  }

  // Rate limiting
  if (statusCode === 429) {
    return {
      category: "rate_limit",
      message,
      statusCode,
      retryable: true,
      originalError: error,
      timestamp: now,
    };
  }

  // Client validation errors (4xx except 401/403/429)
  if (statusCode >= 400 && statusCode < 500) {
    return {
      category: "validation",
      message,
      statusCode,
      retryable: false, // Bad input won't succeed on retry
      originalError: error,
      timestamp: now,
    };
  }

  // Server errors (5xx)
  if (statusCode >= 500) {
    return {
      category: "server",
      message,
      statusCode,
      retryable: true,
      originalError: error,
      timestamp: now,
    };
  }

  return {
    category: "unknown",
    message,
    statusCode,
    retryable: false,
    originalError: error,
    timestamp: now,
  };
}

// ---------------------------------------------------------------------------
// Exponential Backoff
// ---------------------------------------------------------------------------

/**
 * Calculates the delay before the next retry attempt using exponential
 * backoff with jitter.
 *
 * Formula: min(baseDelay * 2^attempt + jitter, maxDelay)
 *
 * Why jitter? Without jitter, all clients that failed at the same time
 * will retry at the same time, causing a "thundering herd" that
 * overwhelms the PMS server again. Jitter spreads retries over time.
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = exponentialDelay * config.jitterFactor * Math.random();
  const delay = exponentialDelay + jitter;
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleeps for the calculated backoff duration.
 * Returns the actual delay used (useful for testing/logging).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes a function with exponential backoff retry logic.
 *
 * - Retries only if the error is categorized as retryable
 * - For auth errors, calls onAuthRetry (token refresh) before retrying
 * - Tracks errors in the global stats
 *
 * Why async generator pattern wasn't used:
 * A simple retry loop is more readable and debuggable at 2 AM.
 * The "boring over clever" principle applies here.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    config?: RetryConfig;
    onAuthRetry?: () => Promise<void>;
    getStatusCode?: (error: unknown) => number | null;
  }
): Promise<T> {
  const config = options?.config ?? DEFAULT_RETRY_CONFIG;
  const getStatusCode =
    options?.getStatusCode ?? defaultGetStatusCode;

  let lastError: PMSError | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const statusCode = getStatusCode(error);
      const pmsError = categorizeError(error, statusCode);
      lastError = pmsError;

      // Track the error
      recordError(pmsError);

      // Don't retry non-retryable errors
      if (!pmsError.retryable) {
        throw pmsError;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= config.maxRetries) {
        throw pmsError;
      }

      // For auth errors, try token refresh before retrying
      if (pmsError.category === "auth" && options?.onAuthRetry) {
        try {
          await options.onAuthRetry();
        } catch {
          // Token refresh failed — give up
          throw pmsError;
        }
      }

      // Wait before retrying
      const delay = calculateBackoffDelay(attempt, config);
      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

// ---------------------------------------------------------------------------
// Error Statistics
// ---------------------------------------------------------------------------

let errorStats: ErrorStats = {
  totalErrors: 0,
  byCategory: {
    transient: 0,
    auth: 0,
    rate_limit: 0,
    validation: 0,
    server: 0,
    unknown: 0,
  },
  lastError: null,
  lastResetAt: Date.now(),
};

/** Records an error in the statistics collector. */
export function recordError(error: PMSError): void {
  errorStats.totalErrors += 1;
  errorStats.byCategory[error.category] += 1;
  errorStats.lastError = error;
}

/** Returns a snapshot of the current error statistics. */
export function getErrorStats(): ErrorStats {
  return { ...errorStats, byCategory: { ...errorStats.byCategory } };
}

/** Resets error statistics (e.g., at shift start or EOD). */
export function resetErrorStats(): void {
  errorStats = {
    totalErrors: 0,
    byCategory: {
      transient: 0,
      auth: 0,
      rate_limit: 0,
      validation: 0,
      server: 0,
      unknown: 0,
    },
    lastError: null,
    lastResetAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Default status code extractor.
 * Works with Axios-style errors that have response.status.
 */
function defaultGetStatusCode(error: unknown): number | null {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    // Axios pattern
    if (e.response && typeof e.response === "object") {
      const resp = e.response as Record<string, unknown>;
      if (typeof resp.status === "number") return resp.status;
    }
    // Generic status
    if (typeof e.status === "number") return e.status;
    if (typeof e.statusCode === "number") return e.statusCode;
  }
  return null;
}
