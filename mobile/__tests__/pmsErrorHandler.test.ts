/**
 * Tests for PMSErrorHandler (Tasks 21.1, 21.2, 21.5, 21.6, 21.7)
 *
 * Validates:
 * - Error categorization based on HTTP status codes
 * - Exponential backoff delay calculation
 * - Retry logic with retryable/non-retryable errors
 * - Auth retry (token refresh) integration
 * - Error statistics collection and reset
 * - Property-based tests for categorization and backoff
 */

import {
  categorizeError,
  calculateBackoffDelay,
  withRetry,
  getErrorStats,
  resetErrorStats,
  recordError,
  type PMSError,
  type RetryConfig,
} from "@/services/pms/PMSErrorHandler";

beforeEach(() => {
  resetErrorStats();
});

// ---------------------------------------------------------------------------
// Error Categorization (Task 21.1 + PBT 21.6)
// ---------------------------------------------------------------------------

describe("categorizeError", () => {
  it("categorizes null status code as transient (network error)", () => {
    const result = categorizeError(new Error("Network error"), null);
    expect(result.category).toBe("transient");
    expect(result.retryable).toBe(true);
  });

  it("categorizes status 0 as transient", () => {
    const result = categorizeError(new Error("Connection refused"), 0);
    expect(result.category).toBe("transient");
    expect(result.retryable).toBe(true);
  });

  it("categorizes 401 as auth", () => {
    const result = categorizeError(new Error("Unauthorized"), 401);
    expect(result.category).toBe("auth");
    expect(result.retryable).toBe(true);
  });

  it("categorizes 403 as auth", () => {
    const result = categorizeError(new Error("Forbidden"), 403);
    expect(result.category).toBe("auth");
    expect(result.retryable).toBe(true);
  });

  it("categorizes 429 as rate_limit", () => {
    const result = categorizeError(new Error("Too Many Requests"), 429);
    expect(result.category).toBe("rate_limit");
    expect(result.retryable).toBe(true);
  });

  it("categorizes 400 as validation (not retryable)", () => {
    const result = categorizeError(new Error("Bad Request"), 400);
    expect(result.category).toBe("validation");
    expect(result.retryable).toBe(false);
  });

  it("categorizes 404 as validation (not retryable)", () => {
    const result = categorizeError(new Error("Not Found"), 404);
    expect(result.category).toBe("validation");
    expect(result.retryable).toBe(false);
  });

  it("categorizes 422 as validation (not retryable)", () => {
    const result = categorizeError(new Error("Unprocessable"), 422);
    expect(result.category).toBe("validation");
    expect(result.retryable).toBe(false);
  });

  it("categorizes 500 as server (retryable)", () => {
    const result = categorizeError(new Error("Internal Server Error"), 500);
    expect(result.category).toBe("server");
    expect(result.retryable).toBe(true);
  });

  it("categorizes 502 as server (retryable)", () => {
    const result = categorizeError(new Error("Bad Gateway"), 502);
    expect(result.category).toBe("server");
    expect(result.retryable).toBe(true);
  });

  it("categorizes 503 as server (retryable)", () => {
    const result = categorizeError(new Error("Service Unavailable"), 503);
    expect(result.category).toBe("server");
    expect(result.retryable).toBe(true);
  });

  it("includes timestamp in result", () => {
    const before = Date.now();
    const result = categorizeError(new Error("test"), 500);
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
  });

  it("preserves original error", () => {
    const original = new Error("original");
    const result = categorizeError(original, 500);
    expect(result.originalError).toBe(original);
  });

  // Property-based test: any 4xx except 401/403/429 is validation
  it("PBT: all 4xx (except 401/403/429) are validation", () => {
    const excluded = new Set([401, 403, 429]);
    for (let code = 400; code < 500; code++) {
      if (excluded.has(code)) continue;
      const result = categorizeError(new Error(`status ${code}`), code);
      expect(result.category).toBe("validation");
      expect(result.retryable).toBe(false);
    }
  });

  // Property-based test: all 5xx are server errors
  it("PBT: all 5xx are server errors", () => {
    for (let code = 500; code < 600; code++) {
      const result = categorizeError(new Error(`status ${code}`), code);
      expect(result.category).toBe("server");
      expect(result.retryable).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Exponential Backoff (Task 21.2 + PBT 21.7)
// ---------------------------------------------------------------------------

describe("calculateBackoffDelay", () => {
  const config: RetryConfig = {
    maxRetries: 5,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    jitterFactor: 0, // No jitter for deterministic tests
  };

  it("returns baseDelay for attempt 0", () => {
    const delay = calculateBackoffDelay(0, config);
    expect(delay).toBe(1000);
  });

  it("doubles delay for each attempt", () => {
    expect(calculateBackoffDelay(1, config)).toBe(2000);
    expect(calculateBackoffDelay(2, config)).toBe(4000);
    expect(calculateBackoffDelay(3, config)).toBe(8000);
  });

  it("caps at maxDelayMs", () => {
    const delay = calculateBackoffDelay(10, config); // 2^10 * 1000 = 1024000
    expect(delay).toBe(30000);
  });

  it("adds jitter when jitterFactor > 0", () => {
    const jitterConfig: RetryConfig = {
      ...config,
      jitterFactor: 0.5,
    };
    const delay = calculateBackoffDelay(0, jitterConfig);
    // Base: 1000, jitter up to 500 => delay between 1000 and 1500
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(1500);
  });

  // PBT: delay always increases (or stays at cap) with higher attempts
  it("PBT: delay is monotonically non-decreasing with attempt number", () => {
    let prevDelay = 0;
    for (let attempt = 0; attempt < 10; attempt++) {
      const delay = calculateBackoffDelay(attempt, config);
      expect(delay).toBeGreaterThanOrEqual(prevDelay);
      prevDelay = delay;
    }
  });

  // PBT: delay never exceeds maxDelayMs
  it("PBT: delay never exceeds maxDelayMs", () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const delay = calculateBackoffDelay(attempt, config);
      expect(delay).toBeLessThanOrEqual(config.maxDelayMs);
    }
  });
});

// ---------------------------------------------------------------------------
// Retry Logic (Task 21.2)
// ---------------------------------------------------------------------------

describe("withRetry", () => {
  const fastConfig: RetryConfig = {
    maxRetries: 2,
    baseDelayMs: 1, // 1ms for fast tests
    maxDelayMs: 10,
    jitterFactor: 0,
  };

  it("returns result on first success", async () => {
    const fn = jest.fn().mockResolvedValue("success");
    const result = await withRetry(fn, { config: fastConfig });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient error and succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue("recovered");

    const result = await withRetry(fn, {
      config: fastConfig,
      getStatusCode: () => null, // transient
    });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry validation errors", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("bad input"));

    await expect(
      withRetry(fn, {
        config: fastConfig,
        getStatusCode: () => 400,
      })
    ).rejects.toMatchObject({ category: "validation" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retries", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("server down"));

    await expect(
      withRetry(fn, {
        config: fastConfig,
        getStatusCode: () => 500,
      })
    ).rejects.toMatchObject({ category: "server" });
    // 1 initial + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("calls onAuthRetry for auth errors", async () => {
    const onAuthRetry = jest.fn().mockResolvedValue(undefined);
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("unauthorized"))
      .mockResolvedValue("refreshed");

    const result = await withRetry(fn, {
      config: fastConfig,
      getStatusCode: () => 401,
      onAuthRetry,
    });
    expect(result).toBe("refreshed");
    expect(onAuthRetry).toHaveBeenCalledTimes(1);
  });

  it("gives up if onAuthRetry fails", async () => {
    const onAuthRetry = jest
      .fn()
      .mockRejectedValue(new Error("refresh failed"));
    const fn = jest.fn().mockRejectedValue(new Error("unauthorized"));

    await expect(
      withRetry(fn, {
        config: fastConfig,
        getStatusCode: () => 401,
        onAuthRetry,
      })
    ).rejects.toMatchObject({ category: "auth" });
  });
});

// ---------------------------------------------------------------------------
// Error Statistics (Task 21.5)
// ---------------------------------------------------------------------------

describe("errorStats", () => {
  it("starts with zero counts", () => {
    const stats = getErrorStats();
    expect(stats.totalErrors).toBe(0);
    expect(stats.lastError).toBeNull();
  });

  it("records errors by category", () => {
    const error: PMSError = {
      category: "transient",
      message: "timeout",
      statusCode: null,
      retryable: true,
      originalError: new Error("timeout"),
      timestamp: Date.now(),
    };
    recordError(error);
    recordError(error);

    const stats = getErrorStats();
    expect(stats.totalErrors).toBe(2);
    expect(stats.byCategory.transient).toBe(2);
    expect(stats.lastError).toEqual(error);
  });

  it("tracks multiple categories", () => {
    recordError({
      category: "transient",
      message: "",
      statusCode: null,
      retryable: true,
      originalError: null,
      timestamp: Date.now(),
    });
    recordError({
      category: "auth",
      message: "",
      statusCode: 401,
      retryable: true,
      originalError: null,
      timestamp: Date.now(),
    });
    recordError({
      category: "server",
      message: "",
      statusCode: 500,
      retryable: true,
      originalError: null,
      timestamp: Date.now(),
    });

    const stats = getErrorStats();
    expect(stats.totalErrors).toBe(3);
    expect(stats.byCategory.transient).toBe(1);
    expect(stats.byCategory.auth).toBe(1);
    expect(stats.byCategory.server).toBe(1);
  });

  it("resets stats", () => {
    recordError({
      category: "transient",
      message: "",
      statusCode: null,
      retryable: true,
      originalError: null,
      timestamp: Date.now(),
    });
    resetErrorStats();

    const stats = getErrorStats();
    expect(stats.totalErrors).toBe(0);
    expect(stats.lastError).toBeNull();
  });

  it("returns a copy (not a reference)", () => {
    const stats1 = getErrorStats();
    recordError({
      category: "auth",
      message: "",
      statusCode: 401,
      retryable: true,
      originalError: null,
      timestamp: Date.now(),
    });
    const stats2 = getErrorStats();

    expect(stats1.totalErrors).toBe(0);
    expect(stats2.totalErrors).toBe(1);
  });
});
